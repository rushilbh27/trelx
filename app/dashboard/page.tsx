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
  if (severity === "critical") return "text-red-400";
  if (severity === "high") return "text-orange-300";
  if (severity === "medium") return "text-yellow-300";
  return "text-zinc-400";
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
        .limit(16),
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
  const agents = (agentRows as AgentStats[]).map((agent) => ({
    ...agent,
    total_calls: Number(agent.total_calls),
    analyzed_calls: Number(agent.analyzed_calls),
    calls_with_errors: Number(agent.calls_with_errors),
    error_count: Number(agent.error_count),
    critical_count: Number(agent.critical_count),
    error_rate: Number(agent.error_rate)
  })).sort((a, b) => b.error_rate - a.error_rate || b.critical_count - a.critical_count || b.total_calls - a.total_calls);
  const totalCalls = Number(aggregateRow?.eligible_calls ?? 0);
  const totalErrors = Number(aggregateRow?.total_errors ?? 0);
  const criticalErrors = Number(aggregateRow?.critical_errors ?? 0);
  const analyzedCalls = Number(aggregateRow?.total_analyzed ?? 0);
  const pendingCalls = Number(aggregateRow?.pending_calls ?? 0);
  const callsWithErrors = Number(aggregateRow?.calls_with_errors ?? 0);
  const topErrors = errorFreqRows
    .filter((row) => typeof row.error_type === "string")
    .slice(0, 6)
    .map((row) => [String(row.error_type), Number(row.count ?? 0)] as const);
  const recentCalls = calls.slice(0, 8);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Real Ultravox calls</p>
          <h1 className="mt-2 text-4xl font-black text-white">Agent grid</h1>
        </div>
        <DashboardActions />
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-5">
        {[
          ["Calls", totalCalls],
          ["Analyzed", analyzedCalls],
          ["Pending", pendingCalls],
          ["Errors", totalErrors],
          ["Critical", criticalErrors]
        ].map(([label, value]) => (
          <div key={label} className="border border-white/10 bg-black p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
            <div className="mt-2 text-4xl font-black text-white">{value}</div>
          </div>
        ))}
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-[0.42fr_0.58fr]">
        <div className="border border-white/10 bg-black p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Top failure patterns</h2>
            <Link href="/errors" className="text-xs text-emerald-300 hover:text-white">view all</Link>
          </div>
          <div className="mt-4 grid gap-2">
            {topErrors.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between border border-white/10 px-3 py-2 text-xs">
                <span>{errorLabel(type)}</span>
                <span className="text-emerald-300">{count}</span>
              </div>
            ))}
            {topErrors.length === 0 ? <div className="text-sm text-zinc-500">No failures detected yet.</div> : null}
          </div>
        </div>

        <div className="border border-white/10 bg-black p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Latest calls</h2>
            <Link href="/calls" className="text-xs text-emerald-300 hover:text-white">open call log</Link>
          </div>
          <div className="mt-4 divide-y divide-white/10">
            {recentCalls.map((call) => {
              const callErrors = call.error_count ?? 0;
              const critical = (call.critical_error_count ?? 0) > 0;
              return (
                <Link key={call.id} href={`/calls/${encodeURIComponent(call.id)}`} className="grid grid-cols-[1fr_80px_90px] gap-3 py-3 text-xs hover:bg-white/[0.03]">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-white">{call.summary || call.agent_name || call.id}</div>
                    <div className="mt-1 truncate text-zinc-500">{call.agent_name ?? call.agent_id}</div>
                  </div>
                  <div className="text-zinc-400">{formatDuration(call.duration_seconds)}</div>
                  <div className={critical ? severityText("critical") : callErrors > 0 ? severityText("high") : "text-emerald-300"}>
                    {call.analysis_status === "complete" ? `${callErrors} err` : call.analysis_status ?? "pending"}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {setupError ? (
        <div className="border border-yellow-400/30 bg-black p-8 text-sm text-zinc-300">
          <div className="font-black text-yellow-300">Supabase not connected</div>
          <p className="mt-3 max-w-3xl leading-6">
            Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
            `ULTRAVOX_API_KEY`, and `OPENAI_API_KEY` to `.env.local`, then run sync.
          </p>
          <pre className="mt-4 overflow-auto border border-white/10 bg-black p-3 text-xs text-zinc-500">{setupError}</pre>
        </div>
      ) : agents.length === 0 ? (
        <div className="border border-white/10 bg-black p-8 text-sm text-zinc-400">
          No real calls in Supabase yet. Run sync after env vars and schema are ready.
        </div>
      ) : (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Agent grid</h2>
            <div className="text-xs text-zinc-500">{callsWithErrors} calls with errors</div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Link
              href={`/dashboard/${encodeURIComponent(agent.agent_id)}`}
              key={agent.agent_id}
              className="border border-white/10 bg-black p-5 transition hover:border-emerald-300/70"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-white">{agent.agent_name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{agent.agent_type}</p>
                </div>
                <div className={agent.critical_count > 0 ? severityClass("critical") : "text-emerald-300"}>
                  {agent.error_rate}%
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Calls</div>
                  <div className="mt-1 text-lg text-white">{agent.total_calls}</div>
                </div>
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Errors</div>
                  <div className="mt-1 text-lg text-white">{agent.error_count}</div>
                </div>
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Critical</div>
                  <div className="mt-1 text-lg text-red-400">{agent.critical_count}</div>
                </div>
              </div>
              {agent.top_error_type ? (
                <div className="mt-3 border border-white/10 px-3 py-2 text-xs text-zinc-400">
                  Top issue: <span className="text-white">{errorLabel(agent.top_error_type)}</span>
                </div>
              ) : null}
            </Link>
          ))}
          </div>
        </section>
      )}
    </main>
  );
}
