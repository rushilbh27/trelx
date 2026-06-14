import { NextResponse } from "next/server";
import { synthesizeBlueprint } from "@/lib/blueprint";
import { createServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Body = {
  agent_type?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const agentType = body.agent_type ?? "sales";
    const supabase = createServerSupabase();

    const [{ count: callCount, error: callError }, { data: errorRows, error: rowsError }] =
      await Promise.all([
        supabase
          .from("calls")
          .select("*", { count: "exact", head: true })
          .eq("agent_type", agentType)
          .eq("analyzed", true)
          .gte("duration_seconds", 30),
        supabase
          .from("call_errors")
          .select("error_type, severity, quote, calls!inner(agent_type, duration_seconds)")
          .eq("calls.agent_type", agentType)
          .gte("calls.duration_seconds", 30)
          .limit(500)
      ]);

    if (callError) throw callError;
    if (rowsError) throw rowsError;

    const rows = (errorRows ?? []) as Array<{
      error_type: string;
      severity: string;
      quote: string | null;
    }>;
    const grouped = new Map<string, { count: number; quote: string | null }>();
    for (const row of rows) {
      const current = grouped.get(row.error_type) ?? { count: 0, quote: row.quote };
      grouped.set(row.error_type, {
        count: current.count + 1,
        quote: current.quote ?? row.quote
      });
    }

    const topPatterns = [...grouped.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([type, item]) => `${item.count}x ${type}: ${item.quote ?? "No quote"}`)
      .join("\n");

    const systemPrompt = await synthesizeBlueprint({
      agentType,
      callCount: callCount ?? 0,
      errorCount: rows.length,
      topPatterns: topPatterns || "No error patterns yet. Produce a robust baseline prompt."
    });

    const { data: inserted, error: insertError } = await supabase
      .from("blueprints")
      .insert({
        agent_type: agentType,
        system_prompt: systemPrompt,
        based_on_calls: callCount ?? 0,
        based_on_errors: rows.length
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, blueprint: inserted });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
