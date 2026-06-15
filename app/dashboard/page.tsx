import Link from "next/link";
import { MIN_ANALYSIS_SECONDS, MAX_ANALYSIS_SECONDS } from "@/lib/analysis-window";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import { DashboardActions } from "@/app/components/DashboardActions";
import type { Call, CallError } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

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

function pressureColor(agent: AgentStats): { label: string; badge: string; bar: string } {
  if (agent.critical_count > 0)  return { label: "Critical", badge: "badge-crit", bar: "bg-[var(--crit)]" };
  if (agent.error_rate >= 15)    return { label: "High",     badge: "badge-warn", bar: "bg-[var(--warn)]" };
  if (agent.error_rate >= 5)     return { label: "Moderate", badge: "badge-cobalt", bar: "bg-cobalt" };
  return                                 { label: "Healthy",  badge: "badge-ok",   bar: "bg-[var(--ok)]" };
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
        .limit(1000),
      supabase
        .from("call_errors")
        .select("id, call_id, agent_id, error_type, severity, quote, call_stage")
        .limit(1000)
    ]);
    if (callsResult.error) throw callsResult.error;
    if (errorsResult.error) throw errorsResult.error;
    callRows = callsResult.data ?? [];
    errorRows = errorsResult.data ?? [];
  } catch (error) {
    setupError = error instanceof Error ? error.message : JSON.stringify(error, null, 2);
  }

  const calls = callRows as Call[];
  const eligibleCallIds = new Set(calls.map((c) => c.id));
  const errors = (errorRows as CallError[]).filter((e) => eligibleCallIds.has(e.call_id));
  const agentBuckets = new Map<string, AgentStats>();
  const errorCountsByAgent = new Map<string, Map<string, number>>();

  for (const call of calls) {
    const bucket = agentBuckets.get(call.agent_id) ?? {
      agent_id: call.agent_id,
      agent_name: call.agent_name ?? call.agent_id,
      agent_type: call.agent_type ?? "unknown",
      total_calls: 0, analyzed_calls: 0, calls_with_errors: 0,
      error_count: 0, critical_count: 0, error_rate: 0, top_error_type: null
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
    .map((a) => {
      a.error_rate = a.analyzed_calls > 0
        ? Math.round((a.calls_with_errors / a.analyzed_calls) * 1000) / 10
        : 0;
      a.top_error_type = [...(errorCountsByAgent.get(a.agent_id) ?? new Map()).entries()]
        .sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      return a;
    })
    .sort((a, b) => b.error_rate - a.error_rate || b.critical_count - a.critical_count || b.total_calls - a.total_calls);

  const totalCalls = calls.length;
  const analyzedCalls = calls.filter((c) => c.analysis_status === "complete").length;
  const callsWithErrors = calls.filter((c) => (c.error_count ?? 0) > 0).length;
  const totalErrors = calls.reduce((s, c) => s + (c.error_count ?? 0), 0);
  const criticalErrors = calls.reduce((s, c) => s + (c.critical_error_count ?? 0), 0);
  const coverage = percent(analyzedCalls, totalCalls);
  const failureRate = percent(callsWithErrors, analyzedCalls);

  const topErrors = [...errors.reduce((map, e) => {
    map.set(e.error_type, (map.get(e.error_type) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topErrorMax = Math.max(...topErrors.map(([, c]) => c), 1);

  const failedCalls = calls
    .filter((c) => (c.error_count ?? 0) > 0)
    .sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0) || (b.error_count ?? 0) - (a.error_count ?? 0))
    .slice(0, 6);

  if (setupError) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-12 md:px-8">
        <div className="border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-8 shadow-brutal">
          <div className="font-display text-2xl font-bold text-ink mb-3">Supabase not connected</div>
          <p className="font-sans text-sm text-ink-2 leading-relaxed mb-5">
            Add <code className="font-mono bg-chalk-2 px-1">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="font-mono bg-chalk-2 px-1">SUPABASE_SERVICE_ROLE_KEY</code>, <code className="font-mono bg-chalk-2 px-1">ULTRAVOX_API_KEY</code>, and <code className="font-mono bg-chalk-2 px-1">OPENAI_API_KEY</code> to <code className="font-mono bg-chalk-2 px-1">.env.local</code>.
          </p>
          <pre className="font-mono text-xs text-ink-2 bg-white border-2 border-chalk-3 p-4 overflow-auto whitespace-pre-wrap max-h-[400px]">{setupError}</pre>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="animate-fade-up">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-2">
            Trelx · Control Room
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-ink leading-none tracking-tight mb-3">
            Agent Watchlist
          </h1>
          <p className="font-sans text-sm text-ink-3 max-w-xl leading-relaxed">
            Transcript-backed failures across {totalCalls} eligible calls. Open any agent to inspect evidence and generate prompt fixes.
          </p>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <DashboardActions />
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger animate-fade-up" style={{ animationDelay: "150ms" }}>
        {[
          { label: "Total Calls",  value: totalCalls,    meta: `${MIN_ANALYSIS_SECONDS}s–${Math.round(MAX_ANALYSIS_SECONDS / 60)}m window` },
          { label: "Analyzed",     value: `${coverage}%`, meta: `${analyzedCalls} of ${totalCalls}` },
          { label: "With Errors",  value: callsWithErrors, meta: `${failureRate}% failure rate` },
          { label: "Critical",     value: criticalErrors,  meta: `${totalErrors} total flags` }
        ].map(({ label, value, meta }) => (
          <div key={label} className="bg-white border-2 border-ink p-5 shadow-brutal-sm hover:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all duration-150">
            <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-2">{label}</div>
            <div className="font-display text-4xl font-bold text-ink leading-none mb-1">{value}</div>
            <div className="font-sans text-xs text-ink-3">{meta}</div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Agent table ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Agents</h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{agents.length} active · sorted by failure rate</span>
          </div>

          <div className="border-2 border-ink bg-white shadow-brutal">
            {/* Table header */}
            <div className="border-b-2 border-ink grid grid-cols-[minmax(0,1fr)_80px_80px_80px_100px] gap-0">
              {["Agent", "Calls", "Analyzed", "Errors", "Rate"].map((h) => (
                <div key={h} className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ink-3 border-r border-chalk-3 last:border-r-0">
                  {h}
                </div>
              ))}
            </div>

            {/* Agent rows */}
            <div className="divide-y divide-chalk-2">
              {agents.map((agent, i) => {
                const pressure = pressureColor(agent);
                return (
                  <Link
                    key={agent.agent_id}
                    href={`/dashboard/${encodeURIComponent(agent.agent_id)}`}
                    className="grid grid-cols-[minmax(0,1fr)_80px_80px_80px_100px] gap-0 group hover:bg-chalk transition-colors duration-100"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {/* Agent name + details */}
                    <div className="px-4 py-4 border-r border-chalk-2 group-hover:border-chalk-3 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-sans text-sm font-semibold text-ink truncate">{agent.agent_name}</span>
                        {agent.critical_count > 0 && (
                          <span className="badge badge-crit shrink-0">{agent.critical_count} crit</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 error-bar">
                          <div
                            className={`error-bar-fill ${pressure.bar}`}
                            style={{ width: `${Math.min(100, Math.max(4, agent.error_rate))}%` }}
                          />
                        </div>
                        {agent.top_error_type && (
                          <span className="font-mono text-[9px] text-ink-3 uppercase tracking-wide shrink-0">
                            {errorLabel(agent.top_error_type)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-4 flex items-center border-r border-chalk-2 font-mono text-sm text-ink">{agent.total_calls}</div>
                    <div className="px-4 py-4 flex items-center border-r border-chalk-2 font-mono text-sm text-ink-3">{agent.analyzed_calls}</div>
                    <div className="px-4 py-4 flex items-center border-r border-chalk-2 font-mono text-sm text-ink">{agent.calls_with_errors}</div>
                    <div className="px-4 py-4 flex items-center justify-between">
                      <span
                        className={`font-display text-2xl font-bold ${
                          agent.critical_count > 0 ? "text-[var(--crit)]"
                          : agent.error_rate >= 15 ? "text-[var(--warn)]"
                          : agent.error_rate >= 5 ? "text-cobalt"
                          : "text-[var(--ok)]"
                        }`}
                      >
                        {agent.error_rate}%
                      </span>
                      <span className="text-ink-3 text-xs group-hover:translate-x-1 transition-transform duration-100">→</span>
                    </div>
                  </Link>
                );
              })}
              {agents.length === 0 && (
                <div className="px-6 py-10 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-2">No data yet</div>
                  <p className="font-sans text-sm text-ink-3">Pipeline will auto-sync agent calls.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Right sidebar ── */}
        <aside className="space-y-5">

          {/* Failure stack */}
          <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
            <h2 className="font-display text-xl font-bold text-ink mb-1">Failure Stack</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-5">Most repeated mistakes</p>
            <div className="space-y-4">
              {topErrors.map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-sans text-sm font-semibold text-ink">{errorLabel(type)}</span>
                    <span className="font-mono text-sm font-bold text-cobalt">{count}</span>
                  </div>
                  <div className="error-bar">
                    <div
                      className="error-bar-fill bg-cobalt"
                      style={{ width: `${Math.round((count / topErrorMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {topErrors.length === 0 && (
                <div className="font-sans text-sm text-ink-3">No failures detected yet.</div>
              )}
            </div>
          </section>

          {/* Inspect queue */}
          <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
            <h2 className="font-display text-xl font-bold text-ink mb-1">Inspect Next</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-3 mb-4">Recent failed calls</p>
            <div className="divide-y divide-chalk-2">
              {failedCalls.map((call) => (
                <Link
                  key={call.id}
                  href={`/calls/${encodeURIComponent(call.id)}`}
                  className="flex items-start justify-between gap-3 py-3 group hover:bg-chalk -mx-1 px-1 transition-colors duration-100"
                >
                  <div className="min-w-0">
                    <div className="font-sans text-sm font-semibold text-ink line-clamp-1 group-hover:text-cobalt transition-colors duration-100">
                      {call.summary || call.agent_name || call.id}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {(call.critical_error_count ?? 0) > 0 && (
                        <span className="badge badge-crit">{call.critical_error_count} crit</span>
                      )}
                      <span className="font-mono text-[10px] text-ink-3">{call.error_count ?? 0} errors</span>
                      <span className="font-mono text-[10px] text-ink-3">{formatDuration(call.duration_seconds)}</span>
                    </div>
                  </div>
                  <span className="text-ink-3 mt-1 text-xs shrink-0 group-hover:translate-x-1 transition-transform duration-100">→</span>
                </Link>
              ))}
              {failedCalls.length === 0 && (
                <div className="py-4 font-sans text-sm text-ink-3">No failed calls in current window.</div>
              )}
            </div>
            {failedCalls.length > 0 && (
              <Link
                href="/calls"
                className="mt-4 flex items-center gap-2 btn-brutal w-full justify-center"
              >
                <span>All calls</span>
                <span>→</span>
              </Link>
            )}
          </section>

        </aside>
      </div>
    </main>
  );
}
