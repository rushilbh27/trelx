import Link from "next/link";
import { MAX_ANALYSIS_SECONDS, MIN_ANALYSIS_SECONDS } from "@/lib/analysis-window";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import type { Call, CallError } from "@/lib/types";

export const dynamic = "force-dynamic";

type AgentStats = {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  total_calls: number;
  analyzed_calls: number;
  calls_with_errors: number;
  error_count: number;
  critical_count: number;
  error_rate: number;
  top_error_type: string | null;
};

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function pressureClass(agent: AgentStats) {
  if (agent.critical_count > 0) return "text-red-300";
  if (agent.error_rate >= 15) return "text-orange-200";
  if (agent.error_rate >= 8) return "text-yellow-200";
  return "text-zinc-300";
}

export default async function DashboardPage() {
  let callRows: unknown[] = [];
  let errorRows: unknown[] = [];
  let setupError: string | null = null;

  try {
    const supabase = createServerSupabase();
    const [callsResult, errorsResult] = await Promise.all([
      supabase
        .from("calls")
        .select("*")
        .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
        .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("call_errors")
        .select("id, call_id, agent_id, error_type, severity, quote, call_stage")
        .order("detected_at", { ascending: false })
        .limit(2000)
    ]);

    if (callsResult.error) throw callsResult.error;
    if (errorsResult.error) throw errorsResult.error;
    callRows = callsResult.data ?? [];
    errorRows = errorsResult.data ?? [];
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  }

  const calls = callRows as Call[];
  const eligibleCallIds = new Set(calls.map((call) => call.id));
  const errors = (errorRows as CallError[]).filter((error) => eligibleCallIds.has(error.call_id));
  const agentBuckets = new Map<string, AgentStats>();
  const errorCountsByAgent = new Map<string, Map<string, number>>();

  for (const call of calls) {
    const bucket = agentBuckets.get(call.agent_id) ?? {
      agent_id: call.agent_id,
      agent_name: call.agent_name ?? call.agent_id,
      agent_type: call.agent_type ?? "unknown",
      total_calls: 0,
      analyzed_calls: 0,
      calls_with_errors: 0,
      error_count: 0,
      critical_count: 0,
      error_rate: 0,
      top_error_type: null
    };
    bucket.total_calls += 1;
    if (call.analysis_status === "complete") bucket.analyzed_calls += 1;
    if ((call.error_count ?? 0) > 0) bucket.calls_with_errors += 1;
    bucket.error_count += call.error_count ?? 0;
    bucket.critical_count += call.critical_error_count ?? 0;
    agentBuckets.set(call.agent_id, bucket);
  }

  for (const error of errors) {
    const map = errorCountsByAgent.get(error.agent_id) ?? new Map<string, number>();
    map.set(error.error_type, (map.get(error.error_type) ?? 0) + 1);
    errorCountsByAgent.set(error.agent_id, map);
  }

  const agents = [...agentBuckets.values()]
    .map((agent) => {
      agent.error_rate = agent.analyzed_calls > 0
        ? Math.round((agent.calls_with_errors / agent.analyzed_calls) * 1000) / 10
        : 0;
      agent.top_error_type = [...(errorCountsByAgent.get(agent.agent_id) ?? new Map<string, number>()).entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return agent;
    })
    .sort((a, b) => b.error_rate - a.error_rate || b.critical_count - a.critical_count || b.total_calls - a.total_calls);

  const totalCalls = calls.length;
  const analyzedCalls = calls.filter((call) => call.analysis_status === "complete").length;
  const callsWithErrors = calls.filter((call) => (call.error_count ?? 0) > 0).length;
  const totalErrors = calls.reduce((sum, call) => sum + (call.error_count ?? 0), 0);
  const criticalErrors = calls.reduce((sum, call) => sum + (call.critical_error_count ?? 0), 0);
  const coverage = percent(analyzedCalls, totalCalls);
  const failureRate = percent(callsWithErrors, analyzedCalls);
  const topErrors = [...errors.reduce((map, error) => {
    map.set(error.error_type, (map.get(error.error_type) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topErrorMax = Math.max(...topErrors.map(([, count]) => count), 1);
  const failedCalls = calls.filter((call) => (call.error_count ?? 0) > 0).slice(0, 8);
  const windowLabel = `${MIN_ANALYSIS_SECONDS}s-${Math.round(MAX_ANALYSIS_SECONDS / 60)}m calls`;

  if (setupError) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="rounded-2xl border border-yellow-400/30 bg-black/70 p-8 text-sm text-zinc-300">
          <div className="font-[family-name:var(--font-display)] text-2xl font-black text-yellow-300">Supabase not connected</div>
          <p className="mt-4 max-w-3xl leading-7">
            Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ULTRAVOX_API_KEY`, and `OPENAI_API_KEY` to `.env.local`.
          </p>
          <pre className="mt-5 overflow-auto rounded-xl border border-white/10 bg-black p-4 text-xs text-zinc-500">{setupError}</pre>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(249,115,22,0.18),transparent_24%),radial-gradient(circle_at_100%_0%,rgba(255,184,107,0.08),transparent_22%),linear-gradient(180deg,#070707_0%,#0b0908_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <section className="rounded-3xl border border-white/8 bg-[#111111]/95 p-5 shadow-[0_36px_120px_rgba(0,0,0,0.35)] md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-orange-100">Trelx control room</div>
              <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl font-black tracking-[-0.04em] text-white md:text-6xl">
                Agent watchlist
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Transcript-backed failures across the active Ultravox call window. Open the noisiest agent, inspect evidence, generate the prompt fix.
              </p>
            </div>
            <div className="rounded-full border border-orange-300/20 bg-orange-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-orange-100">
              {windowLabel}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Calls", totalCalls, "eligible"],
              ["Analyzed", `${coverage}%`, `${analyzedCalls}/${totalCalls}`],
              ["With errors", callsWithErrors, `${failureRate}% pressure`],
              ["Critical", criticalErrors, `${totalErrors} total errors`]
            ].map(([label, value, meta]) => (
              <div key={label} className="rounded-2xl border border-white/8 bg-[#171717] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
                <div className="mt-2 text-3xl font-black text-white">{value}</div>
                <div className="mt-1 text-xs text-zinc-500">{meta}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-3xl border border-white/8 bg-[#111111]/95 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Agents</h2>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">highest failure rate first</p>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{agents.length} active</div>
            </div>

            <div className="grid gap-3">
              {agents.map((agent) => (
                <Link
                  key={agent.agent_id}
                  href={`/dashboard/${encodeURIComponent(agent.agent_id)}`}
                  className="group grid gap-4 rounded-2xl border border-white/8 bg-[#171717] p-4 transition hover:border-orange-300/30 hover:bg-[#1b1512] md:grid-cols-[minmax(0,1fr)_120px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black text-white">{agent.agent_name}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                        {agent.agent_type}
                      </span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/[0.06]">
                      <div
                        className={`h-2 rounded-full ${agent.critical_count > 0 ? "bg-red-300" : "bg-orange-300"}`}
                        style={{ width: `${Math.min(100, Math.max(6, agent.error_rate))}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-zinc-400">
                      <span>{agent.total_calls} calls</span>
                      <span>{agent.analyzed_calls} analyzed</span>
                      <span>{agent.calls_with_errors} failed</span>
                      <span>{agent.top_error_type ? errorLabel(agent.top_error_type) : "no dominant failure"}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:block md:text-right">
                    <div className={`text-3xl font-black ${pressureClass(agent)}`}>{agent.error_rate}%</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">error rate</div>
                  </div>
                </Link>
              ))}
              {agents.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-[#171717] p-6 text-sm text-zinc-500">
                  No real calls in Supabase yet. Run sync after env vars and schema are ready.
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-white/8 bg-[#111111]/95 p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Failure stack</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">repeat mistakes</p>
              <div className="mt-5 space-y-4">
                {topErrors.map(([type, count]) => {
                  const width = Math.max(10, Math.round((count / topErrorMax) * 100));
                  return (
                    <div key={type}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-white">{errorLabel(type)}</span>
                        <span className="font-black text-orange-100">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/[0.06]">
                        <div className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-200" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
                {topErrors.length === 0 ? <div className="text-sm text-zinc-500">No failures detected yet.</div> : null}
              </div>
            </section>

            <section className="rounded-3xl border border-white/8 bg-[#111111]/95 p-5">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Inspect next</h2>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">recent failed calls</p>
              <div className="mt-4 divide-y divide-white/10">
                {failedCalls.map((call) => (
                  <Link key={call.id} href={`/calls/${encodeURIComponent(call.id)}`} className="block py-3 transition hover:bg-white/[0.02]">
                    <div className="line-clamp-2 text-sm font-semibold leading-5 text-white">{call.summary || call.agent_name || call.id}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                      <span>{call.error_count ?? 0} errors</span>
                      <span>{formatDuration(call.duration_seconds)}</span>
                      <span>{call.agent_name ?? call.agent_id}</span>
                    </div>
                  </Link>
                ))}
                {failedCalls.length === 0 ? <div className="py-4 text-sm text-zinc-500">No failed calls in the current window.</div> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
