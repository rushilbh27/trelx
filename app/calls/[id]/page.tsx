import Link from "next/link";
import { notFound } from "next/navigation";
import { ErrorEvidenceCard } from "@/app/components/ErrorEvidenceCard";
import { TranscriptBubble } from "@/app/components/TranscriptBubble";
import { createServerSupabase } from "@/lib/supabase";
import { errorLabel, hasAgentEvidence, severityText } from "@/lib/error-copy";
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
  if (value == null) return "-";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const callId = decodeURIComponent(params.id);
  const supabase = createServerSupabase();
  const [callResult, errorsResult, messagesResult, toolsResult, recordingUrl] = await Promise.all([
    supabase.from("calls").select("*").eq("id", callId).single(),
    supabase.from("call_errors").select("*").eq("call_id", callId).order("detected_at", { ascending: false }),
    supabase.from("call_messages").select("call_id,role,text,ordinal").eq("call_id", callId).order("ordinal", { ascending: true }),
    supabase.from("call_tools").select("call_id,tool_name,parameters,result,invocation_time,status,error_message").eq("call_id", callId).order("invocation_time", { ascending: true }),
    getCallRecordingUrl(callId).catch(() => null)
  ]);

  if (callResult.error || !callResult.data) notFound();
  if (errorsResult.error) throw errorsResult.error;

  const call = callResult.data as Call;
  const errors = ((errorsResult.data ?? []) as CallError[]).filter((error) => hasAgentEvidence(error.quote));
  const messageRows = messagesResult.error ? [] : ((messagesResult.data ?? []) as CallMessage[]);
  const toolRows = toolsResult.error ? [] : ((toolsResult.data ?? []) as CallTool[]);
  const lines: TranscriptLine[] = messageRows.length > 0
    ? messageRowsToTranscriptLines(messageRows)
    : parseTranscript(call.transcript);
  const quotes = errors.map((error) => error.quote);
  const critical = errors.filter((error) => error.severity === "critical").length;
  const status = call.analysis_status === "complete"
    ? errors.length === 0 ? "clean" : `${errors.length} error${errors.length === 1 ? "" : "s"}`
    : call.analysis_status ?? "pending";
  const analysis = (call.call_errors && typeof call.call_errors === "object" ? call.call_errors : null) as StoredCallAnalysis | null;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em]">
        <Link href="/calls" className="text-zinc-500 hover:text-white">Back to calls</Link>
        <span className="text-zinc-700">/</span>
        <Link href={`/dashboard/${encodeURIComponent(call.agent_id)}`} className="text-zinc-500 hover:text-white">{call.agent_name ?? call.agent_id}</Link>
      </div>

      <section className="mb-6 border border-white/10 bg-black p-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={errors.length > 0 ? severityText(critical > 0 ? "critical" : "high") : call.analysis_status === "complete" ? "text-emerald-300" : "text-yellow-300"}>{status}</span>
              <span className="text-xs text-zinc-600">duration {formatDuration(call.duration_seconds)}</span>
              <span className="text-xs text-zinc-600">{new Date(call.created_at).toLocaleString()}</span>
              {call.end_reason ? <span className="text-xs text-zinc-600">ended {call.end_reason}</span> : null}
            </div>
            <h1 className="mt-3 text-2xl font-black text-white">{call.summary || "Call detail"}</h1>
            <div className="mt-2 break-all text-xs text-zinc-500">{call.id}</div>
            {analysis?.summary ? <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">{analysis.summary}</p> : null}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="border border-white/10 px-4 py-3">
              <div className="text-zinc-500">Messages</div>
              <div className="mt-1 text-xl font-black text-white">{lines.length}</div>
            </div>
            <div className="border border-white/10 px-4 py-3">
              <div className="text-zinc-500">Tools</div>
              <div className="mt-1 text-xl font-black text-white">{toolRows.length}</div>
            </div>
            <div className="border border-white/10 px-4 py-3">
              <div className="text-zinc-500">Errors</div>
              <div className="mt-1 text-xl font-black text-white">{errors.length}</div>
            </div>
            <div className="border border-white/10 px-4 py-3">
              <div className="text-zinc-500">Critical</div>
              <div className="mt-1 text-xl font-black text-red-300">{critical}</div>
            </div>
          </div>
        </div>
      </section>

      {recordingUrl ? (
        <section className="mb-6 border border-white/10 bg-black p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Recording</h2>
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={recordingUrl} className="w-full" />
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-white/10 bg-black">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Transcript</h2>
            <span className="text-xs text-zinc-500">red = failed agent turn</span>
          </div>
          <div className="max-h-[76vh] space-y-3 overflow-y-auto p-4">
            {lines.length > 0 ? lines.map((line) => (
              <TranscriptBubble key={`${line.index}-${line.role}-${line.text.slice(0, 12)}`} line={line} quotes={quotes} />
            )) : (
              <div className="p-8 text-sm text-zinc-500">No transcript saved for this call.</div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-white/10 bg-black p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Analysis summary</h2>
            {errors.length === 0 ? (
              <div className="mt-4 border border-emerald-300/20 bg-emerald-950/10 p-4 text-sm text-emerald-200">
                {call.analysis_status === "complete" ? "No material failures detected for this call." : "Call not analyzed yet. Auto pipeline will pick it up."}
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {Object.entries(errors.reduce<Record<string, number>>((acc, error) => {
                  acc[error.error_type] = (acc[error.error_type] ?? 0) + 1;
                  return acc;
                }, {})).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between border border-white/10 px-3 py-2 text-xs">
                    <span>{errorLabel(type)}</span>
                    <span className="text-emerald-300">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {analysis?.goal_outcome ? (
              <div className="mt-4 border border-white/10 bg-zinc-950 p-3 text-xs text-zinc-400">
                Goal outcome: <span className="text-white">{analysis.goal_outcome}</span>
                {analysis.goal_achieved === true ? <span className="ml-2 text-emerald-300">achieved</span> : null}
              </div>
            ) : null}
          </section>

          <section className="border border-white/10 bg-black p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Tool activity</h2>
            <div className="mt-4 grid gap-2">
              {toolRows.map((tool, index) => (
                <div key={`${tool.tool_name}-${tool.invocation_time ?? index}`} className="border border-white/10 p-3 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black text-white">{tool.tool_name}</span>
                    <span className={tool.status === "error" ? "text-red-300" : "text-emerald-300"}>{tool.status ?? "ok"}</span>
                  </div>
                  {tool.error_message ? <div className="mt-2 text-red-200">{tool.error_message}</div> : null}
                  <div className="mt-2 text-zinc-500">args: {excerpt(tool.parameters)}</div>
                  <div className="mt-1 text-zinc-500">result: {excerpt(tool.result)}</div>
                </div>
              ))}
              {toolRows.length === 0 ? <div className="text-sm text-zinc-500">No tool calls saved for this call.</div> : null}
            </div>
          </section>

          {Array.isArray(analysis?.missed_opportunities) && analysis.missed_opportunities.length > 0 ? (
            <section className="border border-white/10 bg-black p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-300">Coaching notes</h2>
              <div className="mt-4 grid gap-2">
                {analysis.missed_opportunities.slice(0, 6).map((item) => (
                  <div key={item} className="border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">{item}</div>
                ))}
              </div>
            </section>
          ) : null}

          {errors.map((error) => (
            <ErrorEvidenceCard key={error.id} error={error} transcriptLines={lines} showFix />
          ))}
        </aside>
      </div>
    </main>
  );
}
