import { NextResponse } from "next/server";
import { generatePatch } from "@/lib/patch-generator";
import { createServerSupabase } from "@/lib/supabase";
import { getAgentPrompt } from "@/lib/ultravox";

export const dynamic = "force-dynamic";

type Body = {
  error_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    if (!body.error_id) {
      return NextResponse.json({ ok: false, error: "error_id required" }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: errorRow, error } = await supabase
      .from("call_errors")
      .select("*")
      .eq("id", body.error_id)
      .single();
    if (error) throw error;

    const row = errorRow as {
      agent_id: string;
      error_type: string;
      quote: string | null;
    };
    const { systemPrompt } = await getAgentPrompt(row.agent_id);
    if (!systemPrompt) {
      return NextResponse.json({ ok: false, error: "No live prompt found via Ultravox GET" }, { status: 422 });
    }

    const patch = await generatePatch({
      errorType: row.error_type,
      quote: row.quote ?? "",
      reasoning: `Detected ${row.error_type} in real transcript quote.`,
      systemPrompt
    });

    if (!patch) {
      return NextResponse.json(
        { ok: false, error: "GPT-4o did not return a valid exact-substring patch" },
        { status: 422 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("patches")
      .insert({
        agent_id: row.agent_id,
        error_type: row.error_type,
        find_text: patch.find_text,
        replace_text: patch.replace_text,
        reason: patch.reason,
        status: "draft"
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, patch: inserted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
