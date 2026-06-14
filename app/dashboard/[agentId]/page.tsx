import Link from "next/link";
import { ErrorEvidenceCard } from "@/app/components/ErrorEvidenceCard";
import { MAX_ANALYSIS_SECONDS, MIN_ANALYSIS_SECONDS } from "@/lib/analysis-window";
import { errorLabel, hasAgentEvidence, severityText } from "@/lib/error-copy";
import { createServerSupabase } from "@/lib/supabase";
import { formatDuration, messageRowsToTranscriptLines, parseTranscript } from "@/lib/transcript";
import type { Call, CallError, CallMessage, Patch } from "@/lib/types";

export const dynamic = "force-dynamic";

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
        .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
        .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("call_errors")
        .select("*")
        .eq("agent_id", agentId)
        .order("detected_at", { ascending: false })
        .limit(500),
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
  const errors = (errorRows as CallError[]).filter((error) => eligibleCallIds.has(error.call_id) && hasAgentEvidence(error.quote));
  const patches = patchRows as Patch[];
  const topPatterns = [...errors.reduce((map, error) => {
    const current = map.get(error.error_type) ?? {
      error_type: error.error_type,
      count: 0,
      critical_count: 0,
      example_line: error.quote ?? ""
    };
    current.count += 1;
    current.critical_count += error.severity === "critical" ? 1 : 0;
    if (!current.example_line && error.quote) current.example_line = error.quote;
    map.set(error.error_type, current);
    return map;
  }, new Map<string, { error_type: string; count: number; critical_count: number; example_line: string }>()).values()]
    .sort((a, b) => b.count - a.count || b.critical_count - a.critical_count)
    .slice(0, 8);
  const agentName = calls[0]?.agent_name ?? agentId;
  const errorsByCall = new Map<string, CallError[]>();
  for (const error of errors) {
    const list = errorsByCall.get(error.call_id) ?? [];
    list.push(error);
    errorsByCall.set(error.call_id, list);
  }

  const callsWithErrors = calls.filter((call) => (call.error_count ?? 0) > 0).slice(0, 8);
  const analyzedCalls = calls.filter((call) => call.analysis_status === "complete").length;
  const pendingCalls = calls.filter((call) => call.analysis_status === "pending" || call.analysis_status === "analyzing").length;
  const criticalCount = calls.reduce((sum, call) => sum + (call.critical_error_count ?? 0), 0);
  const errorRate = analyzedCalls > 0 ? Math.round((calls.filter((call) => (call.error_count ?? 0) > 0).length / analyzedCalls) * 100) : 0;

  const evidenceCallIds = [...new Set(errors.slice(0, 30).map((error) => error.call_id))];
  const messageMap = new Map<string, ReturnType<typeof messageRowsToTranscriptLines>>();
  if (evidenceCallIds.length > 0) {
    const supabase = createServerSupabase();
    const { data: messageRows } = await supabase
      .from("call_messages")
      .select("call_id,role,text,ordinal")
      .in("call_id", evidenceCallIds)
      .order("ordinal", { ascending: true });
    const grouped = new Map<string, CallMessage[]>();
    for (const row of ((messageRows ?? []) as CallMessage[])) {
      const list = grouped.get(row.call_id) ?? [];
      list.push(row);
      grouped.set(row.call_id, list);
    }
    for (const [callId, rows] of grouped.entries()) {
      messageMap.set(callId, messageRowsToTranscriptLines(rows));
    }
  }

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
          <p className="text-xs uppercase tracking-[0.24em] text-orange-100">Agent profile</p>
          <h1 className="mt-2 text-4xl font-black text-white">{agentName}</h1>
          <p className="mt-2 break-all text-xs text-zinc-500">{agentId}</p>

          <div className="mt-8 grid gap-3 md:grid-cols-4">
            <div className="rounded-[24px] border border-white/8 bg-[#111111] p-4">
              <div className="text-xs text-zinc-500">Calls</div>
              <div className="mt-1 text-3xl font-black">{calls.length}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-[#111111] p-4">
              <div className="text-xs text-zinc-500">Analyzed</div>
              <div className="mt-1 text-3xl font-black">{analyzedCalls}</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-[#111111] p-4">
              <div className="text-xs text-zinc-500">Error rate</div>
              <div className={`mt-1 text-3xl font-black ${errorRate > 0 ? "text-orange-300" : "text-orange-100"}`}>{errorRate}%</div>
            </div>
            <div className="rounded-[24px] border border-white/8 bg-[#111111] p-4">
              <div className="text-xs text-zinc-500">Critical</div>
              <div className="mt-1 text-3xl font-black text-red-300">{criticalCount}</div>
            </div>
          </div>

          <section className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/8 bg-[#111111] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Failure pattern leaderboard</h2>
                <span className="text-xs text-zinc-500">{pendingCalls} pending</span>
              </div>
              <div className="mt-4 grid gap-2">
                {topPatterns.map((pattern) => (
                  <div key={pattern.error_type} className="border border-white/10 px-3 py-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-white">{errorLabel(pattern.error_type)}</span>
                      <span className={pattern.critical_count > 0 ? severityText("critical") : "text-orange-100"}>{pattern.count}</span>
                    </div>
                    {pattern.example_line ? <div className="mt-2 text-zinc-400">{pattern.example_line}</div> : null}
                  </div>
                ))}
                {topPatterns.length === 0 ? <div className="text-sm text-zinc-500">No detected failures.</div> : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-[#111111] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Worst recent calls</h2>
              <div className="mt-4 divide-y divide-white/10">
                {callsWithErrors.map((call) => {
                  const callErrors = errorsByCall.get(call.id) ?? [];
                  const hasCritical = (call.critical_error_count ?? 0) > 0;
                  return (
                    <Link key={call.id} href={`/calls/${encodeURIComponent(call.id)}`} className="grid grid-cols-[1fr_70px_78px] gap-3 py-3 text-xs hover:bg-white/[0.03]">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-white">{call.summary || call.id}</div>
                        <div className="mt-1 truncate text-zinc-500">{new Date(call.created_at).toLocaleString()}</div>
                      </div>
                      <div className="text-zinc-400">{formatDuration(call.duration_seconds)}</div>
                      <div className={hasCritical ? severityText("critical") : severityText("high")}>{callErrors.length || call.error_count || 0} err</div>
                    </Link>
                  );
                })}
                {callsWithErrors.length === 0 ? <div className="text-sm text-zinc-500">No failed calls for this agent.</div> : null}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xl font-black text-white">Transcript-backed errors</h2>
            {errors.length === 0 ? (
              <div className="rounded-[28px] border border-white/8 bg-[#111111] p-6 text-sm text-zinc-400">No analyzed errors yet.</div>
            ) : (
              <div className="grid gap-4">
                {errors.slice(0, 30).map((error) => {
                  const call = calls.find((item) => item.id === error.call_id);
                  const transcriptLines = messageMap.get(error.call_id) ?? parseTranscript(call?.transcript);
                  return (
                    <ErrorEvidenceCard
                      key={error.id}
                      error={error}
                      transcriptLines={transcriptLines}
                      showFix
                    />
                  );
                })}
              </div>
            )}
          </section>
        </section>

        <aside className="grid content-start gap-4">
          <section className="rounded-[28px] border border-white/8 bg-[#111111] p-5">
            <h2 className="text-lg font-black text-white">Error leaderboard</h2>
            <div className="mt-4 grid gap-2">
              {topPatterns.map((pattern) => (
                <div key={pattern.error_type} className="flex items-center justify-between border border-white/10 p-3 text-xs">
                  <span>{errorLabel(pattern.error_type)}</span>
                  <span className={pattern.critical_count > 0 ? severityText("critical") : "text-orange-100"}>{pattern.count}</span>
                </div>
              ))}
              {topPatterns.length === 0 ? <div className="text-sm text-zinc-500">No failures yet.</div> : null}
            </div>
          </section>
          <section className="rounded-[28px] border border-white/8 bg-[#111111] p-5">
            <h2 className="text-lg font-black text-white">Patches</h2>
            <div className="mt-4 grid gap-2">
              {patches.map((patch) => (
                <div key={patch.id} className="border border-white/10 p-3 text-xs">
                  <div className="font-bold text-white">{patch.error_type}</div>
                  <div className="mt-1 text-zinc-500">{patch.status}</div>
                  <div className="mt-2 text-orange-100">
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
