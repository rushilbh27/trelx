import Link from "next/link";
import { DashboardActions } from "@/app/components/DashboardActions";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel, severityText } from "@/lib/error-copy";
import { formatDuration } from "@/lib/transcript";
import type { Call } from "@/lib/types";

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

function severityClass(severity: string) {
  if (severity === "critical") return "text-red-300";
  if (severity === "high") return "text-orange-200";
  if (severity === "medium") return "text-yellow-200";
  return "text-zinc-400";
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default async function DashboardPage() {
  let callRows: unknown[] = [];
  let agentRows: unknown[] = [];
  let aggregateRow: Record<string, unknown> | null = null;
  let errorFreqRows: Array<Record<string, unknown>> = [];
  let setupError: string | null = null;

  try {
    const supabase = createServerSupabase();
    const [callsResult, agentsResult, aggregatesResult, errorFreqResult] = await Promise.all([
      supabase
        .from("calls")
        .select("*")
        .gte("duration_seconds", 30)
        .order("created_at", { ascending: false })
        .limit(42),
      supabase.rpc("get_trelx_agent_error_summary"),
      supabase.rpc("get_trelx_dashboard_aggregates"),
      supabase.rpc("get_trelx_error_frequency")
    ]);

    if (callsResult.error) throw callsResult.error;
    if (agentsResult.error) throw agentsResult.error;
    if (aggregatesResult.error) throw aggregatesResult.error;
    if (errorFreqResult.error) throw errorFreqResult.error;
    callRows = callsResult.data ?? [];
    agentRows = agentsResult.data ?? [];
    aggregateRow = ((aggregatesResult.data ?? [])[0] as Record<string, unknown> | undefined) ?? null;
    errorFreqRows = (errorFreqResult.data ?? []) as Array<Record<string, unknown>>;
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  }

  const calls = callRows as Call[];
  const agents = (agentRows as AgentStats[])
    .map((agent) => ({
      ...agent,
      total_calls: Number(agent.total_calls),
      analyzed_calls: Number(agent.analyzed_calls),
      calls_with_errors: Number(agent.calls_with_errors),
      error_count: Number(agent.error_count),
      critical_count: Number(agent.critical_count),
      error_rate: Number(agent.error_rate)
    }))
    .sort((a, b) => b.error_rate - a.error_rate || b.critical_count - a.critical_count || b.total_calls - a.total_calls);

  const totalCalls = Number(aggregateRow?.eligible_calls ?? 0);
  const totalErrors = Number(aggregateRow?.total_errors ?? 0);
  const criticalErrors = Number(aggregateRow?.critical_errors ?? 0);
  const analyzedCalls = Number(aggregateRow?.total_analyzed ?? 0);
  const pendingCalls = Number(aggregateRow?.pending_calls ?? 0);
  const callsWithErrors = Number(aggregateRow?.calls_with_errors ?? 0);
  const coverage = percent(analyzedCalls, totalCalls);
  const errorPressure = percent(callsWithErrors, analyzedCalls);
  const criticalShare = percent(criticalErrors, Math.max(totalErrors, 1));
  const cleanCalls = Math.max(analyzedCalls - callsWithErrors, 0);
  const topErrors = errorFreqRows
    .filter((row) => typeof row.error_type === "string")
    .slice(0, 5)
    .map((row) => [String(row.error_type), Number(row.count ?? 0)] as const);
  const topErrorMax = Math.max(...topErrors.map(([, count]) => count), 1);
  const recentCalls = calls.slice(0, 8);
  const watchlist = agents.slice(0, 5);
  const boardAgents = agents.slice(0, 8);
  const boardMax = Math.max(...boardAgents.map((agent) => agent.error_rate), 1);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
  const worstAgent = agents[0];

  if (setupError) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="rounded-[32px] border border-yellow-400/30 bg-black/70 p-8 text-sm text-zinc-300">
          <div className="font-[family-name:var(--font-display)] text-2xl font-black text-yellow-300">Supabase not connected</div>
          <p className="mt-4 max-w-3xl leading-7">
            Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ULTRAVOX_API_KEY`, and `OPENAI_API_KEY` to `.env.local`.
          </p>
          <pre className="mt-5 overflow-auto rounded-3xl border border-white/10 bg-black p-4 text-xs text-zinc-500">{setupError}</pre>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-[radial-gradient(circle_at_12%_8%,rgba(255,122,24,0.18),transparent_18%),radial-gradient(circle_at_100%_10%,rgba(255,122,24,0.12),transparent_20%),linear-gradient(180deg,#060606_0%,#0b0b0b_100%)] px-4 py-6 md:px-6">
      <div className="mx-auto max-w-[1520px] rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(14,14,14,0.98))] shadow-[0_40px_140px_rgba(0,0,0,0.45)]">
        <div className="grid gap-0 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="border-b border-white/8 p-5 lg:min-h-[calc(100vh-126px)] lg:border-b-0 lg:border-r">
            <div className="rounded-[28px] border border-white/8 bg-[#131313] p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-100">Operator view</div>
              <div className="mt-3 font-[family-name:var(--font-display)] text-3xl font-black text-white">Dashboard</div>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Live signal for transcript failures, agent drift, and fix readiness.
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              {[
                ["/dashboard", "Dashboard", `${coverage}% coverage`],
                ["/calls", "Calls", `${totalCalls} eligible`],
                ["/errors", "Errors", `${totalErrors} logged`],
                ["/blueprint", "Blueprint", `${agents.length} agents`]
              ].map(([href, label, meta]) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-[22px] border px-4 py-3 transition ${
                    href === "/dashboard"
                      ? "border-orange-300/35 bg-orange-500/10 text-white"
                      : "border-white/8 bg-[#131313] text-zinc-300 hover:border-orange-300/18 hover:bg-[#171311]"
                  }`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{meta}</div>
                </Link>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[24px] border border-white/8 bg-[#121212] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Calls with errors</div>
                <div className="mt-2 text-3xl font-black text-white">{callsWithErrors}</div>
                <div className="mt-2 text-xs text-zinc-400">{errorPressure}% of analyzed calls need attention.</div>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-[#121212] p-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Autopilot</div>
                <div className="mt-2 text-2xl font-black text-orange-100">ON</div>
                <div className="mt-2 text-xs text-zinc-400">Initial sync capped to 200 calls for demo stability.</div>
              </div>
            </div>
          </aside>

          <section className="p-5 md:p-6">
            <div className="mb-4 grid gap-4 xl:grid-cols-[1fr_auto]">
              <div className="flex items-center rounded-[26px] border border-white/8 bg-[#121212] px-5 py-4">
                <div className="mr-3 text-zinc-500">⌕</div>
                <div>
                  <div className="text-sm text-white">Search agents, calls, and failures</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Use Calls and Errors pages for deeper drill-down</div>
                </div>
              </div>
              <div className="flex items-center rounded-[26px] border border-white/8 bg-[#121212] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                Snapshot {dateLabel}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-[48rem]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-orange-100">Control room</div>
                    <h1 className="mt-3 max-w-[11ch] font-[family-name:var(--font-display)] text-[clamp(2.9rem,5vw,5.4rem)] font-black leading-[0.92] tracking-[-0.04em] text-white">
                      Ship the next prompt from real production pressure.
                    </h1>
                    <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
                      {worstAgent
                        ? `${worstAgent.agent_name} is currently the noisiest agent at ${worstAgent.error_rate}% error rate. Start there, inspect transcript evidence, then simulate the patch before you touch prod.`
                        : "No agent data yet. Once calls land, this board will surface where to intervene first."}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/8 bg-[#171311] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                    {dateLabel}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  {[
                    `Coverage ${coverage}%`,
                    `${cleanCalls} clean calls`,
                    `${criticalErrors} critical flags`,
                    `${pendingCalls} pending`
                  ].map((chip) => (
                    <div key={chip} className="rounded-full border border-white/8 bg-[#171311] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                      {chip}
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                    <span>Analysis coverage</span>
                    <span>{coverage}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/[0.06]">
                    <div className="h-3 rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-200" style={{ width: `${coverage}%` }} />
                  </div>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/8 bg-[#111111] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Pipeline status</div>
                    <div className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black text-white">Live autopilot</div>
                  </div>
                  <span className="rounded-full border border-orange-300/25 bg-orange-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100">
                    Running
                  </span>
                </div>
                <div className="mt-5">
                  <DashboardActions />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-1">
                  {[
                    ["Calls ready", totalCalls, "eligible over 30 seconds"],
                    ["Failures", totalErrors, "total transcript-backed issues"],
                    ["Critical share", `${criticalShare}%`, "of all logged errors"]
                  ].map(([label, value, meta]) => (
                    <div key={label} className="rounded-[24px] border border-white/8 bg-[#161616] p-4">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
                      <div className="mt-2 text-3xl font-black text-white">{value}</div>
                      <div className="mt-2 text-xs text-zinc-400">{meta}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
              <div className="rounded-[30px] border border-white/8 bg-[#111111] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Agent watchlist</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">highest drift first</p>
                  </div>
                  <Link href="/errors" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100 hover:text-white">
                    Open errors
                  </Link>
                </div>
                <div className="mt-5 grid gap-3">
                  {watchlist.map((agent) => (
                    <Link key={agent.agent_id} href={`/dashboard/${encodeURIComponent(agent.agent_id)}`} className="block rounded-[24px] border border-white/8 bg-[#171717] p-4 transition hover:border-orange-300/25">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{agent.agent_name}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{agent.agent_type}</div>
                        </div>
                        <div className={agent.critical_count > 0 ? severityClass("critical") : "text-orange-100"}>
                          {agent.error_rate}%
                        </div>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
                        <div
                          className={`h-2 rounded-full ${agent.critical_count > 0 ? "bg-red-300" : "bg-orange-300"}`}
                          style={{ width: `${Math.max(agent.error_rate, 8)}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
                        <span>{agent.calls_with_errors}/{agent.analyzed_calls} noisy calls</span>
                        <span>{agent.top_error_type ? errorLabel(agent.top_error_type) : "clean trend"}</span>
                      </div>
                    </Link>
                  ))}
                  {watchlist.length === 0 ? <div className="text-sm text-zinc-500">No agents synced yet.</div> : null}
                </div>
              </div>

              <div className="rounded-[30px] border border-white/8 bg-[#111111] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Failure stack</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">what repeats most</p>
                  </div>
                  <Link href="/errors" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-100 hover:text-white">
                    View errors
                  </Link>
                </div>
                <div className="mt-6 space-y-4">
                  {topErrors.map(([type, count]) => {
                    const width = Math.max(16, Math.round((count / topErrorMax) * 100));
                    return (
                      <div key={type}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-white">{errorLabel(type)}</span>
                          <span className="text-sm font-black text-orange-100">{count}</span>
                        </div>
                        <div className="h-3 rounded-full bg-white/[0.05]">
                          <div className="h-3 rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-200" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {topErrors.length === 0 ? <div className="text-sm text-zinc-500">No failures detected yet.</div> : null}
                </div>
              </div>
            </section>

            <section className="mt-4">
              <div className="rounded-[30px] border border-white/8 bg-[#111111] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-2xl font-black text-white">Latest calls</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">fast path to evidence</p>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{recentCalls.length} shown</div>
                </div>
                <div className="mt-5 divide-y divide-white/10">
                  {recentCalls.map((call) => {
                    const critical = (call.critical_error_count ?? 0) > 0;
                    const callErrors = call.error_count ?? 0;
                    return (
                      <Link
                        key={call.id}
                        href={`/calls/${encodeURIComponent(call.id)}`}
                        className="grid gap-3 py-4 md:grid-cols-[minmax(0,1.3fr)_0.7fr_90px_110px] md:items-center hover:bg-white/[0.02]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white">{call.summary || call.agent_name || call.id}</div>
                          <div className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-zinc-500">{call.agent_name ?? call.agent_id}</div>
                        </div>
                        <div className="text-sm text-zinc-400">{new Date(call.created_at).toLocaleTimeString()}</div>
                        <div className="text-sm text-zinc-400">{formatDuration(call.duration_seconds)}</div>
                        <div className={critical ? severityText("critical") : callErrors > 0 ? severityText("high") : "text-orange-100"}>
                          {call.analysis_status === "complete" ? `${callErrors} err` : call.analysis_status ?? "pending"}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>

            {agents.length === 0 ? (
              <div className="mt-4 rounded-[30px] border border-white/8 bg-[#111111] p-8 text-sm text-zinc-400">
                No real calls in Supabase yet. Run sync after env vars and schema are ready.
              </div>
            ) : (
              <section className="mt-4">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-3xl font-black text-white">Agent board</h2>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{callsWithErrors} calls with errors across the board</p>
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">open an agent to inspect fixes and blueprint history</div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {boardAgents.map((agent) => (
                    <Link
                      href={`/dashboard/${encodeURIComponent(agent.agent_id)}`}
                      key={agent.agent_id}
                      className="overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.008))] p-5 transition hover:border-orange-300/25"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{agent.agent_type}</div>
                          <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-black text-white">{agent.agent_name}</h3>
                        </div>
                        <div className={`text-3xl font-black ${agent.critical_count > 0 ? severityClass("critical") : "text-orange-100"}`}>
                          {agent.error_rate}%
                        </div>
                      </div>

                      <div className="mt-5 h-2 rounded-full bg-white/[0.06]">
                        <div
                          className={`h-2 rounded-full ${agent.critical_count > 0 ? "bg-red-300" : "bg-orange-300"}`}
                          style={{ width: `${Math.max(14, Math.round((agent.error_rate / boardMax) * 100))}%` }}
                        />
                      </div>

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        {[
                          ["Calls", agent.total_calls],
                          ["Errors", agent.error_count],
                          ["Critical", agent.critical_count]
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-[22px] border border-white/8 bg-[#161616] p-4">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</div>
                            <div className="mt-2 text-2xl font-black text-white">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                          {agent.top_error_type ? errorLabel(agent.top_error_type) : "No dominant failure"}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                          {agent.calls_with_errors} calls with errors
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
