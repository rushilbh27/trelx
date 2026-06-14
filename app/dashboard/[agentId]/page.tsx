import Link from "next/link";
import { GenerateFixButton } from "@/app/components/FixActions";
import { createServerSupabase } from "@/lib/supabase";
import type { Call, CallError, Patch } from "@/lib/types";

export const dynamic = "force-dynamic";

function severityClass(severity: string) {
  if (severity === "critical") return "border-red-500/40 text-red-300";
  if (severity === "high") return "border-orange-400/40 text-orange-300";
  if (severity === "medium") return "border-yellow-400/40 text-yellow-300";
  return "border-zinc-600 text-zinc-300";
}

export default async function AgentPage({ params }: { params: { agentId: string } }) {
  const agentId = decodeURIComponent(params.agentId);
  let callRows: unknown[] = [];
  let errorRows: unknown[] = [];
  let patchRows: unknown[] = [];
  let setupError: string | null = null;

  try {
    const supabase = createServerSupabase();
    const [callsResult, errorsResult, patchesResult] = await Promise.all([
      supabase
        .from("calls")
        .select("*")
        .eq("agent_id", agentId)
        .gte("duration_seconds", 30)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("call_errors")
        .select("*")
        .eq("agent_id", agentId)
        .order("detected_at", { ascending: false })
        .limit(80),
      supabase
        .from("patches")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

    if (callsResult.error) throw callsResult.error;
    if (errorsResult.error) throw errorsResult.error;
    if (patchesResult.error) throw patchesResult.error;
    callRows = callsResult.data ?? [];
    errorRows = errorsResult.data ?? [];
    patchRows = patchesResult.data ?? [];
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  }

  const calls = callRows as Call[];
  const eligibleCallIds = new Set(calls.map((call) => call.id));
  const errors = (errorRows as CallError[]).filter((error) => eligibleCallIds.has(error.call_id));
  const patches = patchRows as Patch[];
  const agentName = calls[0]?.agent_name ?? agentId;
  const errorCounts = new Map<string, number>();
  for (const error of errors) errorCounts.set(error.error_type, (errorCounts.get(error.error_type) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <Link href="/dashboard" className="text-xs uppercase tracking-[0.16em] text-zinc-500 hover:text-white">
        Back to dashboard
      </Link>
      {setupError ? (
        <div className="mt-6 border border-yellow-400/30 bg-black p-8 text-sm text-zinc-300">
          <div className="font-black text-yellow-300">Supabase not connected</div>
          <pre className="mt-4 overflow-auto border border-white/10 bg-black p-3 text-xs text-zinc-500">{setupError}</pre>
        </div>
      ) : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-[0.72fr_0.28fr]">
        <section>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Agent profile</p>
          <h1 className="mt-2 text-4xl font-black text-white">{agentName}</h1>
          <p className="mt-2 break-all text-xs text-zinc-500">{agentId}</p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="border border-white/10 bg-black p-4">
              <div className="text-xs text-zinc-500">Calls</div>
              <div className="mt-1 text-3xl font-black">{calls.length}</div>
            </div>
            <div className="border border-white/10 bg-black p-4">
              <div className="text-xs text-zinc-500">Errors</div>
              <div className="mt-1 text-3xl font-black">{errors.length}</div>
            </div>
            <div className="border border-white/10 bg-black p-4">
              <div className="text-xs text-zinc-500">Top error</div>
              <div className="mt-2 text-sm text-white">{[...errorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"}</div>
            </div>
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-xl font-black text-white">Transcript-backed errors</h2>
            {errors.length === 0 ? (
              <div className="border border-white/10 bg-black p-6 text-sm text-zinc-400">No analyzed errors yet.</div>
            ) : (
              <div className="grid gap-4">
                {errors.map((error) => (
                  <article key={error.id} className="border border-white/10 bg-black p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`border px-2 py-1 text-xs uppercase ${severityClass(error.severity)}`}>{error.severity}</span>
                      <span className="text-sm font-black text-white">{error.error_type}</span>
                      {error.call_stage ? <span className="text-xs text-zinc-500">{error.call_stage}</span> : null}
                    </div>
                    <blockquote className="mt-4 border-l-2 border-emerald-300 pl-4 text-sm leading-6 text-zinc-200">
                      {error.quote ?? "No quote captured."}
                    </blockquote>
                    <GenerateFixButton errorId={error.id} />
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="grid content-start gap-4">
          <section className="border border-white/10 bg-black p-5">
            <h2 className="text-lg font-black text-white">Error leaderboard</h2>
            <div className="mt-4 grid gap-2">
              {[...errorCounts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between border border-white/10 p-3 text-xs">
                    <span>{type}</span>
                    <span className="text-emerald-300">{count}</span>
                  </div>
                ))}
            </div>
          </section>
          <section className="border border-white/10 bg-black p-5">
            <h2 className="text-lg font-black text-white">Patches</h2>
            <div className="mt-4 grid gap-2">
              {patches.map((patch) => (
                <div key={patch.id} className="border border-white/10 p-3 text-xs">
                  <div className="font-bold text-white">{patch.error_type}</div>
                  <div className="mt-1 text-zinc-500">{patch.status}</div>
                  <div className="mt-2 text-emerald-300">
                    {patch.before_rate ?? "-"}% to {patch.after_rate ?? "-"}%
                  </div>
                </div>
              ))}
              {patches.length === 0 ? <div className="text-sm text-zinc-500">No patches yet.</div> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
