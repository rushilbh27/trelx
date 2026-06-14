import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel, hasAgentEvidence, severityText } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import type { Call, CallError } from "@/lib/types";

export const dynamic = "force-dynamic";

type CallRow = Call & { errorCount: number; topError: string | null; critical: number };

export default async function CallsPage() {
  const supabase = createServerSupabase();
  const [callsResult, errorsResult] = await Promise.all([
    supabase
      .from("calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("call_errors")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(5000)
  ]);

  if (callsResult.error) throw callsResult.error;
  if (errorsResult.error) throw errorsResult.error;

  const errors = ((errorsResult.data ?? []) as CallError[]).filter((error) => hasAgentEvidence(error.quote));
  const byCall = new Map<string, CallError[]>();
  for (const error of errors) {
    const list = byCall.get(error.call_id) ?? [];
    list.push(error);
    byCall.set(error.call_id, list);
  }

  const calls = ((callsResult.data ?? []) as Call[]).map((call): CallRow => {
    const callErrors = byCall.get(call.id) ?? [];
    const counts = new Map<string, number>();
    for (const error of callErrors) counts.set(error.error_type, (counts.get(error.error_type) ?? 0) + 1);
    const topError = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return {
      ...call,
      errorCount: callErrors.length,
      topError,
      critical: callErrors.filter((error) => error.severity === "critical").length
    };
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Voxray-style evidence queue</p>
          <h1 className="mt-2 text-4xl font-black text-white">Calls</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Latest Ultravox calls with analysis state, transcript availability, and detected failure count.
          </p>
        </div>
        <Link href="/errors" className="border border-white/10 bg-black px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-emerald-300 hover:text-white">
          error queue
        </Link>
      </div>

      <section className="overflow-hidden border border-white/10 bg-black">
        <div className="grid grid-cols-[1fr_110px_120px_140px] border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:grid-cols-[1fr_150px_120px_120px_160px]">
          <div>Call</div>
          <div className="hidden md:block">Agent</div>
          <div>Duration</div>
          <div>Analysis</div>
          <div>Top issue</div>
        </div>
        <div className="divide-y divide-white/10">
          {calls.map((call) => (
            <Link
              key={call.id}
              href={`/calls/${encodeURIComponent(call.id)}`}
              className="grid grid-cols-[1fr_110px_120px_140px] px-4 py-4 text-sm transition hover:bg-white/[0.03] md:grid-cols-[1fr_150px_120px_120px_160px]"
            >
              <div className="min-w-0">
                <div className="truncate font-black text-white">{call.summary || call.id}</div>
                <div className="mt-1 truncate text-xs text-zinc-500">{call.id}</div>
              </div>
              <div className="hidden truncate text-xs text-zinc-400 md:block">{call.agent_name ?? call.agent_id}</div>
              <div className={call.duration_seconds && call.duration_seconds >= 30 ? "text-zinc-200" : "text-zinc-600"}>
                {formatDuration(call.duration_seconds)}
              </div>
              <div className={call.analyzed ? "text-emerald-300" : "text-yellow-300"}>
                {call.analyzed ? `${call.errorCount} error${call.errorCount === 1 ? "" : "s"}` : "pending"}
              </div>
              <div className={call.critical > 0 ? severityText("critical") : "truncate text-zinc-400"}>
                {call.topError ? errorLabel(call.topError) : call.duration_seconds && call.duration_seconds < 30 ? "short skip" : "clean"}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
