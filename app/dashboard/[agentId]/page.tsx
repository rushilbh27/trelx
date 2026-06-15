import Link from "next/link";
import { ErrorEvidenceCard } from "@/app/components/ErrorEvidenceCard";
import { MAX_ANALYSIS_SECONDS, MIN_ANALYSIS_SECONDS } from "@/lib/analysis-window";
import { errorLabel, hasAgentEvidence } from "@/lib/error-copy";
import { createServerSupabase } from "@/lib/supabase";
import { formatDuration, messageRowsToTranscriptLines, parseTranscript } from "@/lib/transcript";
import type { Call, CallError, CallMessage, Patch } from "@/lib/types";

export const dynamic = "force-dynamic";

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
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
        .from("calls").select("*").eq("agent_id", agentId)
        .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
        .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
        .order("created_at", { ascending: false }).limit(5000),
      supabase
        .from("call_errors").select("*").eq("agent_id", agentId)
        .order("detected_at", { ascending: false }).limit(10000),
      supabase
        .from("patches").select("*").eq("agent_id", agentId)
        .order("created_at", { ascending: false }).limit(20)
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
  const eligibleCallIds = new Set(calls.map((c) => c.id));
  const errors = (errorRows as CallError[]).filter(
    (e) => eligibleCallIds.has(e.call_id) && hasAgentEvidence(e.quote)
  );
  const patches = patchRows as Patch[];

  const topPatterns = [
    ...errors
      .reduce((map, e) => {
        const cur = map.get(e.error_type) ?? { error_type: e.error_type, count: 0, critical_count: 0, example_line: e.quote ?? "" };
        cur.count += 1;
        cur.critical_count += e.severity === "critical" ? 1 : 0;
        if (!cur.example_line && e.quote) cur.example_line = e.quote;
        map.set(e.error_type, cur);
        return map;
      }, new Map<string, { error_type: string; count: number; critical_count: number; example_line: string }>())
      .values()
  ]
    .sort((a, b) => b.count - a.count || b.critical_count - a.critical_count)
    .slice(0, 8);

  const agentName = calls[0]?.agent_name ?? agentId;
  const analyzedCalls = calls.filter((c) => c.analysis_status === "complete").length;
  const pendingCalls = calls.filter((c) => c.analysis_status === "pending" || c.analysis_status === "analyzing").length;
  const criticalCount = calls.reduce((s, c) => s + (c.critical_error_count ?? 0), 0);
  const callsWithErrorsCount = calls.filter((c) => (c.error_count ?? 0) > 0).length;
  const errorRate = analyzedCalls > 0 ? Math.round((callsWithErrorsCount / analyzedCalls) * 1000) / 10 : 0;

  const callsWithErrors = calls
    .filter((c) => (c.error_count ?? 0) > 0)
    .sort((a, b) => (b.critical_error_count ?? 0) - (a.critical_error_count ?? 0) || (b.error_count ?? 0) - (a.error_count ?? 0))
    .slice(0, 8);

  const errorsByCall = new Map<string, CallError[]>();
  for (const e of errors) {
    const list = errorsByCall.get(e.call_id) ?? [];
    list.push(e);
    errorsByCall.set(e.call_id, list);
  }

  const evidenceCallIds = [...new Set(errors.slice(0, 30).map((e) => e.call_id))];
  const messageMap = new Map<string, ReturnType<typeof messageRowsToTranscriptLines>>();
  if (evidenceCallIds.length > 0 && !setupError) {
    try {
      const supabase = createServerSupabase();
      const { data: messageRows, error: messagesError } = await supabase
        .from("call_messages")
        .select("call_id,role,text,ordinal")
        .in("call_id", evidenceCallIds)
        .order("ordinal", { ascending: true });
      
      if (messagesError) throw messagesError;

      const grouped = new Map<string, CallMessage[]>();
      for (const row of ((messageRows ?? []) as CallMessage[])) {
        const list = grouped.get(row.call_id) ?? [];
        list.push(row);
        grouped.set(row.call_id, list);
      }
      for (const [callId, rows] of grouped.entries()) {
        messageMap.set(callId, messageRowsToTranscriptLines(rows));
      }
    } catch (error) {
      setupError = error instanceof Error ? error.message : String(error);
    }
  }

  if (setupError) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-12 md:px-8">
        <div className="border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-8 shadow-brutal mb-6">
          <div className="font-display text-2xl font-bold text-ink mb-3">Connection Error</div>
          <p className="font-sans text-sm text-ink-2 leading-relaxed mb-5">
            Unable to connect to Supabase. The database may be paused or unreachable.
          </p>
          <pre className="font-mono text-xs text-ink-2 bg-white border-2 border-chalk-3 p-4 overflow-auto whitespace-pre-wrap max-h-[400px]">{setupError}</pre>
        </div>
      </main>
    );
  }

  const topErrorMax = Math.max(...topPatterns.map((p) => p.count), 1);

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 animate-fade-in" aria-label="Breadcrumb">
        <Link href="/dashboard" className="btn-brutal" style={{ padding: "6px 12px", fontSize: "10px" }}>
          ← Dashboard
        </Link>
        <span className="font-mono text-ink-3 text-xs">/</span>
        <span className="font-mono text-xs text-ink-3 truncate">{agentName}</span>
      </nav>

      {/* ── Agent header ────────────────────────────────────────────────────── */}
      <div className="mb-8 animate-fade-up">
        <div className="font-mono text-[10px] uppercase tracking-widest text-cobalt mb-2">Agent Profile</div>
        <h1 className="font-display text-5xl md:text-6xl font-bold text-ink leading-none mb-2">
          {agentName}
        </h1>
        <div className="font-mono text-[10px] text-ink-3 break-all">{agentId}</div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fade-up" style={{ animationDelay: "100ms" }}>
        {[
          { label: "Total Calls",  value: calls.length,   sub: "in window" },
          { label: "Analyzed",     value: analyzedCalls,  sub: `${percent(analyzedCalls, calls.length)}% coverage` },
          { label: "Error Rate",   value: `${errorRate}%`, sub: `${callsWithErrorsCount} failed calls`,
            color: criticalCount > 0 ? "text-[var(--crit)]" : errorRate >= 15 ? "text-[var(--warn)]" : errorRate >= 5 ? "text-cobalt" : "text-[var(--ok)]" },
          { label: "Critical",     value: criticalCount,   sub: `${errors.length} total flags`,
            color: criticalCount > 0 ? "text-[var(--crit)]" : "text-ink" }
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white border-2 border-ink p-5 shadow-brutal-sm">
            <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-2">{label}</div>
            <div className={`font-display text-4xl font-bold leading-none mb-1 ${color ?? "text-ink"}`}>{value}</div>
            <div className="font-sans text-xs text-ink-3">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Body grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* ── Left: patterns + evidence ── */}
        <div className="space-y-8">

          {/* Failure pattern breakdown */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink">Failure Patterns</h2>
              {pendingCalls > 0 && (
                <span className="badge badge-cobalt">{pendingCalls} pending</span>
              )}
            </div>
            {topPatterns.length > 0 ? (
              <div className="bg-white border-2 border-ink shadow-brutal divide-y divide-chalk-2">
                {topPatterns.map((pattern) => (
                  <div key={pattern.error_type} className="p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="font-sans text-sm font-semibold text-ink">
                        {errorLabel(pattern.error_type)}
                      </span>
                      <div className="flex items-center gap-2">
                        {pattern.critical_count > 0 && (
                          <span className="badge badge-crit" style={{ fontSize: "9px", padding: "1px 6px" }}>
                            {pattern.critical_count} crit
                          </span>
                        )}
                        <span className="font-mono text-sm font-bold text-cobalt">{pattern.count}</span>
                      </div>
                    </div>
                    <div className="error-bar mb-2">
                      <div
                        className="error-bar-fill bg-cobalt"
                        style={{ width: `${Math.round((pattern.count / topErrorMax) * 100)}%` }}
                      />
                    </div>
                    {pattern.example_line && (
                      <blockquote className="border-l-4 border-chalk-3 pl-3 font-sans text-xs text-ink-3 italic line-clamp-2">
                        {pattern.example_line}
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border-2 border-chalk-3 bg-white p-8 text-center">
                <div className="font-display text-2xl text-ink-3 mb-1">No failures</div>
                <p className="font-sans text-sm text-ink-3">This agent looks clean.</p>
              </div>
            )}
          </section>

          {/* Error evidence */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-ink">Evidence</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-ink-3">{errors.length} total flags</span>
            </div>
            {errors.length === 0 ? (
              <div className="border-2 border-[var(--ok)] bg-[var(--ok-bg)] p-8 text-center shadow-brutal-sm">
                <div className="font-display text-2xl text-ink mb-1">✓ Clean</div>
                <p className="font-sans text-sm text-ink-3">No errors detected in analyzed calls.</p>
              </div>
            ) : (
              <div className="space-y-4 stagger">
                {errors.slice(0, 30).map((error) => {
                  const call = calls.find((c) => c.id === error.call_id);
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
        </div>

        {/* ── Right sidebar ── */}
        <aside className="space-y-5">

          {/* Worst calls */}
          <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
            <h2 className="font-display text-xl font-bold text-ink mb-1">Worst Calls</h2>
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-4">Most errors first</p>
            <div className="divide-y divide-chalk-2">
              {callsWithErrors.map((call) => {
                const callErrors = errorsByCall.get(call.id) ?? [];
                const hasCritical = (call.critical_error_count ?? 0) > 0;
                return (
                  <Link
                    key={call.id}
                    href={`/calls/${encodeURIComponent(call.id)}`}
                    className="flex items-start justify-between gap-3 py-3 group hover:bg-chalk -mx-1 px-1 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-sans text-sm font-semibold text-ink truncate group-hover:text-cobalt transition-colors">
                        {call.summary || call.id}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {hasCritical && <span className="badge badge-crit" style={{ fontSize: "9px", padding: "1px 6px" }}>crit</span>}
                        <span className="font-mono text-[10px] text-ink-3">{callErrors.length || call.error_count || 0} errors</span>
                        <span className="font-mono text-[10px] text-ink-3">{formatDuration(call.duration_seconds)}</span>
                      </div>
                    </div>
                    <span className="text-ink-3 text-xs shrink-0 mt-1 group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                );
              })}
              {callsWithErrors.length === 0 && (
                <div className="py-4 font-sans text-sm text-ink-3">No failed calls for this agent.</div>
              )}
            </div>
          </section>

          {/* Patches */}
          <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
            <h2 className="font-display text-xl font-bold text-ink mb-1">Patches</h2>
            <p className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-4">Prompt improvements</p>
            {patches.length > 0 ? (
              <div className="space-y-3">
                {patches.map((patch) => (
                  <div key={patch.id} className="border border-chalk-3 bg-chalk p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-sans text-sm font-semibold text-ink">{errorLabel(patch.error_type)}</span>
                      <span className="badge" style={{ borderColor: "var(--chalk-3)", fontSize: "9px" }}>{patch.status}</span>
                    </div>
                    {(patch.before_rate != null || patch.after_rate != null) && (
                      <div className="font-mono text-[10px] text-ink-3">
                        {patch.before_rate ?? "—"}% → <span className="text-[var(--ok)] font-bold">{patch.after_rate ?? "—"}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="font-sans text-sm text-ink-3">No patches generated yet. Use Generate Fix on any error.</div>
            )}
          </section>

        </aside>
      </div>
    </main>
  );
}
