import { NextResponse } from "next/server";
import { simulatePatchOnTranscript } from "@/lib/simulator";
import { createServerSupabase } from "@/lib/supabase";
import type { Call, Patch } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  patch_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.patch_id) {
      return NextResponse.json({ ok: false, error: "patch_id required" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: patchData, error: patchError } = await supabase
      .from("patches")
      .select("*")
      .eq("id", body.patch_id)
      .single();
    if (patchError) throw patchError;
    const patch = patchData as Patch;

    const { data: errors, error: errorsError } = await supabase
      .from("call_errors")
      .select("call_id, quote")
      .eq("agent_id", patch.agent_id)
      .eq("error_type", patch.error_type)
      .limit(8);
    if (errorsError) throw errorsError;

    const callIds = [...new Set((errors ?? []).map((row) => String(row.call_id)))];
    if (callIds.length === 0) {
      return NextResponse.json({ ok: false, error: "No matching calls to simulate" }, { status: 404 });
    }

    const { data: callsData, error: callsError } = await supabase
      .from("calls")
      .select("*")
      .in("id", callIds)
      .gte("duration_seconds", 30);
    if (callsError) throw callsError;

    const calls = (callsData ?? []) as Call[];
    const results = await Promise.all(
      calls.map(async (call) => ({
        call_id: call.id,
        result: await simulatePatchOnTranscript({
          errorType: patch.error_type,
          reasoning: patch.reason ?? "Repeated real-call error pattern.",
          findText: patch.find_text,
          replaceText: patch.replace_text,
          transcript: call.transcript ?? ""
        })
      }))
    );

    const valid = results.filter((item) => item.result !== null);
    if (valid.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid simulation responses" }, { status: 422 });
    }

    const afterFailures = valid.filter((item) => item.result?.would_error).length;
    const beforeRate = 100;
    const afterRate = Math.round((afterFailures / valid.length) * 100);

    const { data: updated, error: updateError } = await supabase
      .from("patches")
      .update({ before_rate: beforeRate, after_rate: afterRate, status: "simulated" })
      .eq("id", patch.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      patch: updated,
      simulated: valid.length,
      results: valid
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
