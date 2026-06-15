import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorEvidenceCard } from "@/app/components/ErrorEvidenceCard";
import { TranscriptBubble } from "@/app/components/TranscriptBubble";
import { createServerSupabase } from "@/lib/supabase";
import { hasAgentEvidence, severityText, errorLabel } from "@/lib/error-copy";
import { formatDuration, messageRowsToTranscriptLines, parseTranscript } from "@/lib/transcript";
import { getCallRecordingUrl } from "@/lib/ultravox";
import type { Call, CallError, CallMessage, CallTool } from "@/lib/types";
import type { TranscriptLine } from "@/lib/transcript";

export const dynamic = "force-dynamic";

type StoredCallAnalysis = {
  summary?: string;
  goal_achieved?: boolean;
  goal_outcome?: string;
  missed_opportunities?: string[];
};

function excerpt(value: unknown): string {
  if (value == null) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

function StatusBadge({ status, errors, critical }: { status: string; errors: number; critical: number }) {
  if (status !== "complete") {
    return <span className="badge badge-cobalt">{status}</span>;
  }
  if (errors === 0) return <span className="badge badge-ok">✓ Clean</span>;
  if (critical > 0)  return <span className="badge badge-crit">🔴 {errors} error{errors !== 1 ? "s" : ""}</span>;
  return <span className="badge badge-warn">⚠ {errors} error{errors !== 1 ? "s" : ""}</span>;
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const callId = decodeURIComponent(params.id);
  let call: Call | null = null;
  let errors: CallError[] = [];
  let messageRows: CallMessage[] = [];
  let toolRows: CallTool[] = [];
  let recordingUrl: string | null = null;
  let setupError: string | null = null;

  try {
    const supabase = createServerSupabase();
    const [callResult, errorsResult, messagesResult, toolsResult, recordingResult] = await Promise.all([
      supabase.from("calls").select("*").eq("id", callId).single(),
      supabase.from("call_errors").select("*").eq("call_id", callId).order("detected_at", { ascending: false }),
      supabase.from("call_messages").select("call_id,role,text,ordinal").eq("call_id", callId).order("ordinal", { ascending: true }),
      supabase.from("call_tools").select("call_id,tool_name,parameters,result,invocation_time,status,error_message").eq("call_id", callId).order("invocation_time", { ascending: true }),
      getCallRecordingUrl(callId).catch(() => null)
    ]);

    if (callResult.error || !callResult.data) notFound();
    if (errorsResult.error) throw errorsResult.error;

    call = callResult.data as Call;
    errors = ((errorsResult.data ?? []) as CallError[]).filter((e) => hasAgentEvidence(e.quote));
    messageRows = messagesResult.error ? [] : ((messagesResult.data ?? []) as CallMessage[]);
    toolRows = toolsResult.error ? [] : ((toolsResult.data ?? []) as CallTool[]);
    recordingUrl = recordingResult;
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error);
  }

  if (setupError) {
    return (
      <main className="mx-auto max-w-[1440px] px-5 py-12 md:px-8">
        <div className="border-2 border-[var(--warn)] bg-[var(--warn-bg)] p-8 shadow-brutal">
          <div className="font-display text-2xl font-bold text-ink mb-3">Connection Error</div>
          <p className="font-sans text-sm text-ink-2 leading-relaxed mb-5">
            Unable to connect to Supabase. The database may be paused or unreachable.
          </p>
          <pre className="font-mono text-xs text-ink-2 bg-white border-2 border-chalk-3 p-4 overflow-auto whitespace-pre-wrap max-h-[400px]">{setupError}</pre>
        </div>
      </main>
    );
  }

  if (!call) notFound();
  const lines: TranscriptLine[] = messageRows.length > 0
    ? messageRowsToTranscriptLines(messageRows)
    : parseTranscript(call.transcript);
  const quotes = errors.map((e) => e.quote);
  const critical = errors.filter((e) => e.severity === "critical").length;
  const status = call.analysis_status === "complete"
    ? errors.length === 0 ? "complete" : "complete"
    : call.analysis_status ?? "pending";
  const analysis = (call.call_errors && typeof call.call_errors === "object" ? call.call_errors : null) as StoredCallAnalysis | null;

  const agentLines = lines.filter((l) => l.role === "Agent").length;
  const userLines = lines.filter((l) => l.role === "User").length;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <nav className="mb-6 flex flex-wrap items-center gap-2 animate-fade-in" aria-label="Breadcrumb">
        <Link
          href="/calls"
          className="btn-brutal"
          style={{ padding: "6px 12px", fontSize: "10px" }}
        >
          ← All Calls
        </Link>
        <span className="font-mono text-ink-3 text-xs">/</span>
        <Link
          href={`/dashboard/${encodeURIComponent(call.agent_id)}`}
          className="font-mono text-xs text-cobalt hover:text-cobalt-2 underline underline-offset-2 transition-colors"
        >
          {call.agent_name ?? call.agent_id}
        </Link>
        <span className="font-mono text-ink-3 text-xs">/</span>
        <span className="font-mono text-xs text-ink-3 truncate max-w-[200px]">{call.id}</span>
      </nav>

      {/* ── Call header card ────────────────────────────────────────────────── */}
      <section className="bg-white border-2 border-ink shadow-brutal mb-6 p-6 animate-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            {/* Status + meta row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusBadge status={status} errors={errors.length} critical={critical} />
              <span className="font-mono text-xs text-ink-3">{formatDuration(call.duration_seconds)}</span>
              <span className="font-mono text-xs text-ink-3">
                {new Date(call.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              {call.end_reason && (
                <span className="badge">{call.end_reason}</span>
              )}
            </div>

            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink leading-tight mb-2">
              {call.summary || call.agent_name || "Call Detail"}
            </h1>
            <div className="font-mono text-[10px] text-ink-3 break-all">{call.id}</div>

            {analysis?.summary && (
              <p className="mt-4 font-sans text-sm text-ink-2 leading-relaxed max-w-2xl border-l-4 border-cobalt pl-4">
                {analysis.summary}
              </p>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Messages", value: lines.length },
              { label: "Agent turns", value: agentLines },
              { label: "Tools", value: toolRows.length },
              { label: "Errors", value: errors.length, highlight: errors.length > 0 },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`border-2 p-4 text-center ${highlight ? "border-[var(--crit)] bg-[var(--crit-bg)]" : "border-chalk-3 bg-chalk"}`}
              >
                <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-1">{label}</div>
                <div className={`font-display text-3xl font-bold ${highlight ? "text-[var(--crit)]" : "text-ink"}`}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Recording player ────────────────────────────────────────────────── */}
      {recordingUrl && (
        <section className="bg-white border-2 border-ink shadow-brutal-sm mb-6 p-5 animate-fade-in" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="dot-live" />
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink">Recording</h2>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={recordingUrl} className="w-full" style={{ height: "40px" }} />
        </section>
      )}

      {/* ── Main grid: Transcript + Sidebar ─────────────────────────────────── */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">

        {/* Transcript panel */}
        <section
          className="bg-white border-2 border-ink shadow-brutal lg:sticky lg:top-[72px] overflow-hidden"
          style={{ animationDelay: "150ms" }}
        >
          {/* Header */}
          <div className="border-b-2 border-ink flex items-center justify-between px-5 py-3 bg-chalk">
            <div className="flex items-center gap-3">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-ink">Transcript</h2>
              <span className="badge badge-cobalt">{lines.length} turns</span>
              {quotes.length > 0 && (
                <span className="badge badge-crit">{quotes.length} flagged</span>
              )}
            </div>
            <span className="font-mono text-[9px] text-ink-3">Agent →  ·  ← User</span>
          </div>

          {/* Scrollable conversation */}
          <div
            className="max-h-[calc(100vh-200px)] min-h-[480px] overflow-y-auto p-4 space-y-3"
            id="transcript-scroll"
          >
            {lines.length > 0 ? (
              lines.map((line) => (
                <TranscriptBubble
                  key={`${line.index}-${line.role}-${line.text.slice(0, 8)}`}
                  line={line}
                  quotes={quotes}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="font-display text-2xl text-ink-3 mb-2">No transcript</div>
                <p className="font-sans text-sm text-ink-3">Transcript not saved for this call.</p>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar */}
        <aside className="space-y-5" style={{ animation: "slide-in-right 0.4s ease-out both", animationDelay: "200ms" }}>

          {/* Error cards */}
          {errors.map((error) => (
            <ErrorEvidenceCard
              key={error.id}
              error={error}
              transcriptLines={lines}
              showFix
            />
          ))}

          {/* Analysis summary */}
          <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
            <h2 className="font-display text-xl font-bold text-ink mb-4">Analysis Summary</h2>

            {errors.length === 0 ? (
              <div className={`border-2 p-4 ${call.analysis_status === "complete" ? "border-[var(--ok)] bg-[var(--ok-bg)]" : "border-chalk-3 bg-chalk"}`}>
                <div className="font-sans text-sm text-ink-2 leading-relaxed">
                  {call.analysis_status === "complete"
                    ? "✓ No material failures detected for this call."
                    : "Call not analyzed yet. Auto pipeline will pick it up shortly."}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(errors.reduce<Record<string, number>>((acc, e) => {
                  acc[e.error_type] = (acc[e.error_type] ?? 0) + 1;
                  return acc;
                }, {})).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between border border-chalk-3 bg-chalk px-3 py-2">
                    <span className="font-sans text-sm text-ink">{errorLabel(type)}</span>
                    <span className="font-mono text-sm font-bold text-cobalt">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {analysis?.goal_outcome && (
              <div className="mt-4 border border-chalk-3 bg-chalk-2 p-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-ink-3 mb-1">Goal outcome</div>
                <p className="font-sans text-sm text-ink leading-relaxed m-0">
                  {analysis.goal_outcome}
                  {analysis.goal_achieved === true && (
                    <span className="badge badge-ok ml-2">Achieved</span>
                  )}
                </p>
              </div>
            )}
          </section>

          {/* Tool activity */}
          {toolRows.length > 0 && (
            <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
              <h2 className="font-display text-xl font-bold text-ink mb-4">
                Tool Activity
                <span className="font-mono text-base font-normal text-ink-3 ml-2">{toolRows.length}</span>
              </h2>
              <div className="space-y-3">
                {toolRows.map((tool, index) => (
                  <div
                    key={`${tool.tool_name}-${tool.invocation_time ?? index}`}
                    className={`border p-3 ${tool.status === "error" ? "border-[var(--crit)] bg-[var(--crit-bg)]" : "border-chalk-3 bg-chalk"}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-ink">{tool.tool_name}</span>
                      <span
                        className={`badge ${tool.status === "error" ? "badge-crit" : "badge-ok"}`}
                        style={{ fontSize: "9px", padding: "1px 6px" }}
                      >
                        {tool.status ?? "ok"}
                      </span>
                    </div>
                    {tool.error_message && (
                      <div className="font-mono text-xs text-[var(--crit)] mb-2">{tool.error_message}</div>
                    )}
                    <div className="font-mono text-[10px] text-ink-3">
                      <span className="text-ink-2">args:</span> {excerpt(tool.parameters)}
                    </div>
                    <div className="font-mono text-[10px] text-ink-3 mt-1">
                      <span className="text-ink-2">result:</span> {excerpt(tool.result)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Coaching notes */}
          {Array.isArray(analysis?.missed_opportunities) && (analysis.missed_opportunities?.length ?? 0) > 0 && (
            <section className="bg-white border-2 border-ink shadow-brutal-sm p-5">
              <h2 className="font-display text-xl font-bold text-ink mb-4">Coaching Notes</h2>
              <div className="space-y-2">
                {analysis!.missed_opportunities!.slice(0, 6).map((item) => (
                  <div key={item} className="border-l-4 border-cobalt bg-[var(--cobalt-bg)] px-3 py-2">
                    <p className="font-sans text-sm text-ink-2 m-0">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

        </aside>
      </div>
    </main>
  );
}
