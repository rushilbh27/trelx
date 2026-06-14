import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase";
import { errorImpact, errorLabel, hasAgentEvidence, severityTone } from "@/lib/error-copy";
import type { CallError } from "@/lib/types";

export const dynamic = "force-dynamic";

type ErrorRow = CallError & {
  calls?: {
    agent_name: string | null;
    agent_type: string | null;
    duration_seconds: number | null;
    created_at: string;
    summary: string | null;
  };
};

export default async function ErrorsPage() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("call_errors")
    .select("*, calls!inner(agent_name, agent_type, duration_seconds, created_at, summary)")
    .gte("calls.duration_seconds", 30)
    .order("detected_at", { ascending: false })
    .limit(250);
  if (error) throw error;

  const rows = ((data ?? []) as ErrorRow[]).filter((row) => hasAgentEvidence(row.quote));
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.error_type, (counts.get(row.error_type) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-orange-100">Failure intelligence</p>
          <h1 className="mt-2 text-4xl font-black text-white">Error queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Every row is transcript-backed. Click a call to inspect the exact failed agent turn.
          </p>
        </div>
        <Link href="/calls" className="rounded-full border border-orange-300/20 bg-[#171311] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-orange-300 hover:text-white">
          calls
        </Link>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        {[...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([type, count]) => (
          <div key={type} className="rounded-[24px] border border-white/8 bg-[#111111] p-4">
            <div className="text-xs text-zinc-500">{errorLabel(type)}</div>
            <div className="mt-2 text-3xl font-black text-white">{count}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-3">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={`/calls/${encodeURIComponent(row.call_id)}`}
            className="rounded-[26px] border border-white/8 bg-[#111111] p-5 transition hover:border-orange-300/35"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${severityTone(row.severity)}`}>
                {row.severity}
              </span>
              <span className="font-black text-white">{errorLabel(row.error_type)}</span>
              <span className="text-xs text-zinc-500">{row.calls?.agent_name ?? row.agent_id}</span>
              {row.call_stage ? <span className="text-xs text-zinc-600">{row.call_stage}</span> : null}
            </div>
            <p className="mt-3 text-sm text-zinc-400">{errorImpact(row.error_type)}</p>
            <blockquote className="mt-3 border-l-2 border-orange-300 pl-4 text-sm text-zinc-200">
              {row.quote ?? "No quote captured."}
            </blockquote>
          </Link>
        ))}
        {rows.length === 0 ? <div className="rounded-[26px] border border-white/8 bg-[#111111] p-8 text-sm text-zinc-400">No errors detected yet.</div> : null}
      </section>
    </main>
  );
}
