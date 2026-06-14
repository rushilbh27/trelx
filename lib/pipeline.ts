import { detectErrorsForCall } from "@/lib/error-detector";
import { createServerSupabase } from "@/lib/supabase";
import {
  formatTranscript,
  getCallDetails,
  getCallMessages,
  getCallTools,
  getCalls,
  getAgentDisplayName,
  getAgentPrompt,
  inferAgentType,
  parseDurationSeconds,
  type EnrichedUltravoxCall,
  type UltravoxCall
} from "@/lib/ultravox";
import type { Call, DetectedError } from "@/lib/types";

const MIN_ANALYSIS_SECONDS = 30;

type PipelineSummary = {
  synced: number;
  analyzed: number;
  errors: number;
  skippedShort: number;
};

type PromptCache = Map<string, string | null>;

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runOne() {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      results.push(await worker(item));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runOne));
  return results;
}

function callToRow(call: EnrichedUltravoxCall | (UltravoxCall & { transcript: string; tools: unknown[] })) {
  const agentId = call.agentId ?? call.agent?.agentId ?? "unknown";
  const agentName = getAgentDisplayName(agentId, call.agent?.name ?? null, call.systemPrompt ?? null);

  return {
    id: call.callId,
    agent_id: agentId,
    agent_name: agentName,
    agent_type: inferAgentType(agentName, agentId),
    transcript: call.transcript,
    summary: call.shortSummary ?? null,
    tool_calls: call.tools,
    duration_seconds: parseDurationSeconds(call.billedDuration),
    created_at: call.created
  };
}

function enhancedCallToRow(call: EnrichedUltravoxCall | (UltravoxCall & { transcript: string; tools: unknown[] })) {
  const base = callToRow(call);
  return {
    ...base,
    analysis_status: (base.duration_seconds ?? 0) < MIN_ANALYSIS_SECONDS ? "skipped" : "pending",
    error_count: 0,
    critical_error_count: 0,
    end_reason: call.endReason ?? null,
    ended_at: call.ended ?? null,
    raw_data: call
  };
}

function analysisJson(errors: DetectedError[]) {
  return {
    errors: errors.map((error) => ({
      type: error.error_type,
      severity: error.severity,
      agent_line: error.quote,
      call_stage: error.call_stage,
      what_went_wrong: error.reasoning,
      should_have_said: "",
      confidence: 1
    })),
    goal_achieved: errors.length === 0,
    goal_outcome: errors.length === 0 ? "clean" : "needs_review",
    missed_opportunities: errors.map((error) => error.reasoning),
    summary: errors.length === 0
      ? "No material agent failures detected."
      : `${errors.length} transcript-backed agent failure${errors.length === 1 ? "" : "s"} detected.`,
    error_count: errors.length,
    critical_error_count: errors.filter((error) => error.severity === "critical").length
  };
}

async function upsertCalls(calls: EnrichedUltravoxCall[]) {
  const supabase = createServerSupabase();
  const enhancedRows = calls.map(enhancedCallToRow);
  const enhanced = await supabase.from("calls").upsert(enhancedRows, { onConflict: "id" });
  if (!enhanced.error) return;

  const baseRows = calls.map(callToRow);
  const { error } = await supabase.from("calls").upsert(baseRows, { onConflict: "id" });
  if (error) throw error;
}

async function saveMessagesAndTools(calls: EnrichedUltravoxCall[]) {
  const supabase = createServerSupabase();
  const messageRows = calls.flatMap((call) =>
    call.messages.map((message, index) => ({
      call_id: call.callId,
      role: message.role.includes("AGENT") ? "Agent" : message.role.includes("TOOL") ? "Tool" : "User",
      text: message.text ?? "",
      ordinal: message.callStageMessageIndex ?? index
    }))
  );
  if (messageRows.length > 0) {
    await supabase.from("call_messages").upsert(messageRows, { onConflict: "call_id,ordinal" });
  }

  const toolRows = calls.flatMap((call) =>
    call.tools.map((tool) => ({
      call_id: call.callId,
      tool_name: tool.name,
      parameters: tool.parameters ?? null,
      result: tool.result ?? null,
      invocation_time: tool.invocationTime ?? null,
      status: tool.errorMessage ? "error" : "success",
      error_message: tool.errorMessage ?? null
    }))
  );
  if (toolRows.length > 0) {
    await supabase
      .from("call_tools")
      .delete()
      .in("call_id", calls.map((call) => call.callId));
    await supabase.from("call_tools").insert(toolRows);
  }
}

export async function syncLatestCalls(limit = 100): Promise<{ synced: number }> {
  const calls = await getCalls({ limit });
  if (calls.length > 0) {
    await upsertCalls(calls);
    await saveMessagesAndTools(calls).catch(() => {
      // Enhanced schema may not have been pasted yet; base pipeline still works.
    });
  }

  return { synced: calls.length };
}

async function loadAgentPrompts(calls: Call[]): Promise<PromptCache> {
  const agentIds = [...new Set(calls.map((call) => call.agent_id).filter((id) => id !== "unknown"))];
  const entries = await runPool(agentIds, 3, async (agentId) => {
    try {
      const { systemPrompt } = await getAgentPrompt(agentId);
      return [agentId, systemPrompt] as const;
    } catch {
      return [agentId, null] as const;
    }
  });
  return new Map(entries);
}

export async function analyzeEligibleCalls(limit = 100): Promise<Omit<PipelineSummary, "synced">> {
  const supabase = createServerSupabase();
  const { data: shortRows, error: shortError } = await supabase
    .from("calls")
    .select("id")
    .eq("analyzed", false)
    .lt("duration_seconds", MIN_ANALYSIS_SECONDS)
    .limit(500);
  if (shortError) throw shortError;

  const shortIds = (shortRows ?? []).map((row) => String(row.id));
  if (shortIds.length > 0) {
    const enhancedShort = await supabase
      .from("calls")
      .update({ analyzed: true, analysis_status: "skipped" })
      .in("id", shortIds);
    const { error: markShortError } = enhancedShort.error
      ? await supabase
      .from("calls")
      .update({ analyzed: true })
          .in("id", shortIds)
      : { error: null };
    if (markShortError) throw markShortError;
  }

  const { data: calls, error } = await supabase
    .from("calls")
    .select("*")
    .eq("analyzed", false)
    .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const typedCalls = (calls ?? []) as Call[];
  const promptCache = await loadAgentPrompts(typedCalls);
  const summaries = await runPool(typedCalls, 3, async (call) => {
    await supabase
      .from("calls")
      .update({ analysis_status: "analyzing" })
      .eq("id", call.id);

    const detected = await detectErrorsForCall({
      agentType: call.agent_type,
      transcript: call.transcript ?? "",
      systemPrompt: promptCache.get(call.agent_id) ?? null
    });

    if (detected.length > 0) {
      const { error: insertError } = await supabase.from("call_errors").insert(
        detected.map((detectedError) => ({
          call_id: call.id,
          agent_id: call.agent_id,
          error_type: detectedError.error_type,
          severity: detectedError.severity,
          quote: detectedError.quote,
          call_stage: detectedError.call_stage
        }))
      );
      if (insertError) throw insertError;
    }

    const callAnalysis = analysisJson(detected);
    const enhancedUpdate = await supabase
      .from("calls")
      .update({
        analyzed: true,
        analysis_status: "complete",
        error_count: callAnalysis.error_count,
        critical_error_count: callAnalysis.critical_error_count,
        call_errors: callAnalysis
      })
      .eq("id", call.id);
    const { error: updateError } = enhancedUpdate.error
      ? await supabase
      .from("calls")
      .update({ analyzed: true })
          .eq("id", call.id)
      : { error: null };
    if (updateError) throw updateError;

    return { call_id: call.id, errors: detected.length };
  });

  return {
    analyzed: summaries.length,
    errors: summaries.reduce((total, item) => total + item.errors, 0),
    skippedShort: shortIds.length
  };
}

export async function runInitialPipeline(limit = 100): Promise<PipelineSummary> {
  const sync = await syncLatestCalls(limit);
  const analysis = await analyzeEligibleCalls(limit);
  return { synced: sync.synced, ...analysis };
}

export async function ingestAndAnalyzeCall(callId: string): Promise<PipelineSummary & { call_id: string }> {
  const [call, messages, tools] = await Promise.all([
    getCallDetails(callId),
    getCallMessages(callId),
    getCallTools(callId)
  ]);
  const transcript = formatTranscript(messages);
  const row = callToRow({ ...call, transcript, tools });

  const supabase = createServerSupabase();
  const enhancedRow = enhancedCallToRow({ ...call, transcript, tools });
  const enhancedUpsert = await supabase.from("calls").upsert(enhancedRow, { onConflict: "id" });
  const { error: upsertError } = enhancedUpsert.error
    ? await supabase.from("calls").upsert(row, { onConflict: "id" })
    : { error: null };
  if (upsertError) throw upsertError;
  await saveMessagesAndTools([{ ...call, messages, transcript, tools }]).catch(() => {});

  if ((row.duration_seconds ?? 0) < MIN_ANALYSIS_SECONDS) {
    const enhancedShort = await supabase
      .from("calls")
      .update({ analyzed: true, analysis_status: "skipped" })
      .eq("id", callId);
    const { error } = enhancedShort.error
      ? await supabase.from("calls").update({ analyzed: true }).eq("id", callId)
      : { error: null };
    if (error) throw error;
    return { call_id: callId, synced: 1, analyzed: 0, errors: 0, skippedShort: 1 };
  }

  const analysis = await analyzeEligibleCalls(1);
  return { call_id: callId, synced: 1, ...analysis };
}

export async function reanalyzeRecentCalls(limit = 100): Promise<Omit<PipelineSummary, "synced">> {
  const supabase = createServerSupabase();
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id")
    .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const callIds = (calls ?? []).map((call) => String(call.id));
  if (callIds.length === 0) {
    return { analyzed: 0, errors: 0, skippedShort: 0 };
  }

  const { error: deleteError } = await supabase
    .from("call_errors")
    .delete()
    .in("call_id", callIds);
  if (deleteError) throw deleteError;

  const enhancedUpdate = await supabase
    .from("calls")
    .update({
      analyzed: false,
      analysis_status: "pending",
      error_count: 0,
      critical_error_count: 0,
      call_errors: null
    })
    .in("id", callIds);
  const { error: updateError } = enhancedUpdate.error
    ? await supabase
    .from("calls")
    .update({ analyzed: false })
        .in("id", callIds)
    : { error: null };
  if (updateError) throw updateError;

  return analyzeEligibleCalls(limit);
}
