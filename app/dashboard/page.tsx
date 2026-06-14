import Link from "next/link";
import { DashboardActions } from "@/app/components/DashboardActions";
import { createServerSupabase } from "@/lib/supabase";
import type { Call, CallError } from "@/lib/types";

export const dynamic = "force-dynamic";

type AgentStats = {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  calls: number;
  errors: number;
  errorCallIds: Set<string>;
  critical: number;
  errorRate: number;
  lastCall: string;
};

function severityClass(severity: string) {
  if (severity === "critical") return "text-red-400";
  if (severity === "high") return "text-orange-300";
  if (severity === "medium") return "text-yellow-300";
  return "text-zinc-400";
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
        .gte("duration_seconds", 30)
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase.from("call_errors").select("*").limit(5000)
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
  const stats = new Map<string, AgentStats>();

  for (const call of calls) {
    const existing = stats.get(call.agent_id);
    const next: AgentStats = existing ?? {
      agent_id: call.agent_id,
      agent_name: call.agent_name ?? call.agent_id,
      agent_type: call.agent_type ?? "unknown",
      calls: 0,
      errors: 0,
      errorCallIds: new Set<string>(),
      critical: 0,
      errorRate: 0,
      lastCall: call.created_at
    };
    next.calls += 1;
    if (new Date(call.created_at) > new Date(next.lastCall)) next.lastCall = call.created_at;
    stats.set(call.agent_id, next);
  }

  for (const error of errors) {
    const existing = stats.get(error.agent_id);
    if (!existing) continue;
    existing.errors += 1;
    existing.errorCallIds.add(error.call_id);
    if (error.severity === "critical") existing.critical += 1;
  }

  const agents = [...stats.values()]
    .map((agent) => ({
      ...agent,
      errorRate: agent.calls === 0 ? 0 : Math.round((agent.errorCallIds.size / agent.calls) * 100)
    }))
    .sort((a, b) => b.errorRate - a.errorRate);

  const totalCalls = calls.length;
  const totalErrors = errors.length;
  const criticalErrors = errors.filter((error) => error.severity === "critical").length;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Real Ultravox calls</p>
          <h1 className="mt-2 text-4xl font-black text-white">Agent grid</h1>
        </div>
        <DashboardActions />
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        {[
          ["Calls", totalCalls],
          ["Errors", totalErrors],
          ["Critical", criticalErrors]
        ].map(([label, value]) => (
          <div key={label} className="border border-white/10 bg-black p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
            <div className="mt-2 text-4xl font-black text-white">{value}</div>
          </div>
        ))}
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
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                <div className={agent.critical > 0 ? severityClass("critical") : "text-emerald-300"}>
                  {agent.errorRate}%
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2 text-xs">
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Calls</div>
                  <div className="mt-1 text-lg text-white">{agent.calls}</div>
                </div>
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Errors</div>
                  <div className="mt-1 text-lg text-white">{agent.errors}</div>
                </div>
                <div className="border border-white/10 p-3">
                  <div className="text-zinc-500">Critical</div>
                  <div className="mt-1 text-lg text-red-400">{agent.critical}</div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
