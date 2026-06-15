import { detectErrorsForCall } from "@/lib/error-detector";
import {
  MAX_ANALYSIS_SECONDS,
  MIN_ANALYSIS_SECONDS,
  SALES_AI_AGENT_ID,
  SALES_AI_TARGET_CALLS,
  TARGET_PROCESSED_CALLS,
  isEligibleAnalysisDuration
} from "@/lib/analysis-window";
import { createServerSupabase } from "@/lib/supabase";
import {
  enrichCalls,
  formatTranscript,
  getCallDetails,
  getCallMessages,
  getCallTools,
  getAgentDisplayName,
  getAgentPrompt,
  inferAgentType,
  listCalls,
  parseDurationSeconds,
  type EnrichedUltravoxCall,
  type UltravoxCall
} from "@/lib/ultravox";
import type { Call, DetectedError } from "@/lib/types";

/** Mirror of isAgentCall from ultravox.ts for use inside pipeline. */
function isAgentCallRecord(call: UltravoxCall): boolean {
  const agentId = call.agentId ?? call.agent?.agentId ?? null;
  if (!agentId) return false;
  const medium = call.medium as Record<string, unknown> | null | undefined;
  if (medium && typeof medium === "object" && "webRtc" in medium) return false;
  return true;
}

type PipelineSummary = {
  synced: number;
  analyzed: number;
  errors: number;
  skippedShort: number;
};

type AnalysisSummary = Omit<PipelineSummary, "synced">;
type PromptCache = Map<string, string | null>;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchExistingCallIds(callIds: string[]): Promise<Set<string>> {
  if (callIds.length === 0) return new Set<string>();
  const supabase = createServerSupabase();
  const found = new Set<string>();
  for (const chunk of chunkArray(callIds, 80)) {
    const { data, error } = await supabase
      .from("calls")
      .select("id")
      .in("id", chunk);
    if (error) throw error;
    for (const row of data ?? []) found.add(String(row.id));
  }
  return found;
}

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
  const eligible = isEligibleAnalysisDuration(base.duration_seconds);
  return {
    ...base,
    analyzed: !eligible,
    analysis_status: eligible ? "pending" : "skipped",
    error_count: 0,
    critical_error_count: 0,
    call_errors: null,
    end_reason: call.endReason ?? null,
    ended_at: call.ended ?? null,
    raw_data: call
  };
}

function syncOnlyCallToRow(call: EnrichedUltravoxCall | (UltravoxCall & { transcript: string; tools: unknown[] })) {
  const base = callToRow(call);
  return {
    ...base,
    end_reason: call.endReason ?? null,
    ended_at: call.ended ?? null,
    raw_data: call
  };
}

function callMetadataToRow(call: UltravoxCall) {
  const agentId = call.agentId ?? call.agent?.agentId ?? "unknown";
  const agentName = getAgentDisplayName(agentId, call.agent?.name ?? null, null);
  const durationSeconds = parseDurationSeconds(call.billedDuration);

  return {
    id: call.callId,
    agent_id: agentId,
    agent_name: agentName,
    agent_type: inferAgentType(agentName, agentId),
    summary: call.shortSummary ?? null,
    duration_seconds: durationSeconds,
    created_at: call.created,
    end_reason: call.endReason ?? null,
    ended_at: call.ended ?? null,
    raw_data: call
  };
}

function enhancedMetadataRow(call: UltravoxCall) {
  const base = callMetadataToRow(call);
  const eligible = isEligibleAnalysisDuration(base.duration_seconds);

  return {
    ...base,
    transcript: null,
    tool_calls: [],
    analyzed: !eligible,
    analysis_status: eligible ? "pending" : "skipped",
    error_count: 0,
    critical_error_count: 0,
    call_errors: null
  };
}

function pickDemoCalls(calls: UltravoxCall[], targetCount: number): UltravoxCall[] {
  const eligible = calls.filter((call) => isEligibleAnalysisDuration(parseDurationSeconds(call.billedDuration)));
  const sales = eligible.filter((call) => (call.agentId ?? call.agent?.agentId ?? null) === SALES_AI_AGENT_ID).slice(0, SALES_AI_TARGET_CALLS);
  const used = new Set(sales.map((call) => call.callId));
  const rest = eligible.filter((call) => !used.has(call.callId)).slice(0, Math.max(targetCount - sales.length, 0));
  return [...sales, ...rest]
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
    .slice(0, targetCount);
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
  const callIds = calls.map((call) => call.callId);
  const existingIds = await fetchExistingCallIds(callIds);
  const newCalls = calls.filter((call) => !existingIds.has(call.callId));
  const existingCalls = calls.filter((call) => existingIds.has(call.callId));

  if (existingCalls.length > 0) {
    const syncRows = existingCalls.map(syncOnlyCallToRow);
    for (const chunk of chunkArray(syncRows, 100)) {
      const enhancedExisting = await supabase.from("calls").upsert(chunk, { onConflict: "id" });
      if (enhancedExisting.error) {
        const { error } = await supabase.from("calls").upsert(chunk.map((r) => existingCalls.find((c) => c.callId === r.id)).filter(Boolean).map(callToRow), { onConflict: "id" });
        if (error) throw error;
      }
    }
  }

  if (newCalls.length > 0) {
    for (const chunk of chunkArray(newCalls, 100)) {
      const enhancedNew = await supabase.from("calls").insert(chunk.map(enhancedCallToRow));
      if (enhancedNew.error) {
        const baseRows = chunk.map((call) => ({
          ...callToRow(call),
          analyzed: false
        }));
        const { error } = await supabase.from("calls").insert(baseRows);
        if (error) throw error;
      }
    }
  }
}

async function upsertCallMetadata(calls: UltravoxCall[]) {
  if (calls.length === 0) return;

  const supabase = createServerSupabase();
  const callIds = calls.map((call) => call.callId);
  const existingIds = await fetchExistingCallIds(callIds);
  const newCalls = calls.filter((call) => !existingIds.has(call.callId));
  const existingCalls = calls.filter((call) => existingIds.has(call.callId));

  if (existingCalls.length > 0) {
    for (const chunk of chunkArray(existingCalls, 100)) {
      const { error } = await supabase.from("calls").upsert(chunk.map(callMetadataToRow), { onConflict: "id" });
      if (error) throw error;
    }
  }

  if (newCalls.length > 0) {
    for (const chunk of chunkArray(newCalls, 100)) {
      const enhancedNew = await supabase.from("calls").insert(chunk.map(enhancedMetadataRow));
      const { error } = enhancedNew.error
        ? await supabase.from("calls").insert(
          chunk.map((call) => ({
            ...callMetadataToRow(call),
            transcript: null,
            tool_calls: [],
            analyzed: false
          }))
        )
        : { error: null };
      if (error) throw error;
    }
  }
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
    for (const chunk of chunkArray(messageRows, 500)) {
      await supabase.from("call_messages").upsert(chunk, { onConflict: "call_id,ordinal" });
    }
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
    for (const chunk of chunkArray(calls.map((call) => call.callId), 80)) {
      await supabase
        .from("call_tools")
        .delete()
        .in("call_id", chunk);
    }
    for (const chunk of chunkArray(toolRows, 500)) {
      await supabase.from("call_tools").insert(chunk);
    }
  }
}

export async function syncLatestCalls(limit = 100, all = false): Promise<{ synced: number }> {
  const targetCount = Math.max(1, limit);
  const calls = all || targetCount >= TARGET_PROCESSED_CALLS
    ? pickDemoCalls(await listCalls({ all: true }), targetCount >= TARGET_PROCESSED_CALLS ? TARGET_PROCESSED_CALLS : targetCount)
    : (await listCalls({ limit })).filter((call) => isEligibleAnalysisDuration(parseDurationSeconds(call.billedDuration)));
  if (calls.length === 0) return { synced: 0 };

  await upsertCallMetadata(calls);

  const supabase = createServerSupabase();
  const transcriptById = new Map<string, string | null>();
  for (const chunk of chunkArray(calls.map((call) => call.callId), 80)) {
    const { data: existingRows, error: existingError } = await supabase
      .from("calls")
      .select("id, transcript")
      .in("id", chunk);
    if (existingError) throw existingError;
    for (const row of existingRows ?? []) {
      transcriptById.set(String(row.id), typeof row.transcript === "string" ? row.transcript : null);
    }
  }
  const callsNeedingDetails = calls.filter((call) => {
    const transcript = transcriptById.get(call.callId);
    return !transcript || transcript.trim().length === 0;
  });

  if (callsNeedingDetails.length > 0) {
    const detailedCalls = await enrichCalls(callsNeedingDetails);
    await upsertCalls(detailedCalls);
    await saveMessagesAndTools(detailedCalls).catch(() => {
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

export async function analyzeEligibleCalls(limit = 100): Promise<AnalysisSummary> {
  const supabase = createServerSupabase();

  // --- Repair pass: heal rows where analyzed=true but analysis_status='pending' ---
  // These are permanently stuck because the main query filters on analyzed=false.
  // Reset the analyzed flag so they get picked up in the next batch.
  const { data: stuckRows } = await supabase
    .from("calls")
    .select("id")
    .eq("analyzed", true)
    .eq("analysis_status", "pending")
    .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
    .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
    .not("transcript", "is", null)
    .limit(200);
  const stuckIds = (stuckRows ?? []).map((row) => String(row.id));
  if (stuckIds.length > 0) {
    for (const chunk of chunkArray(stuckIds, 80)) {
      await supabase.from("calls").update({ analyzed: false }).in("id", chunk);
    }
  }

  // --- Mark short / over-long calls as skipped ---
  const { data: shortRows, error: shortError } = await supabase
    .from("calls")
    .select("id")
    .eq("analyzed", false)
    .or("analysis_status.eq.pending,analysis_status.is.null")
    .or(`duration_seconds.lt.${MIN_ANALYSIS_SECONDS},duration_seconds.gt.${MAX_ANALYSIS_SECONDS}`)
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

  // --- Pick calls ready for analysis ---
  const { data: calls, error } = await supabase
    .from("calls")
    .select("*")
    .eq("analyzed", false)
    .or("analysis_status.eq.pending,analysis_status.is.null")
    .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
    .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const typedCalls = (calls ?? []) as Call[];
  const promptCache = await loadAgentPrompts(typedCalls);
  const summaries = await runPool(typedCalls, 3, async (call) => {
    try {
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
    } catch {
      await supabase
        .from("calls")
        .update({ analysis_status: "error" })
        .eq("id", call.id);
      return { call_id: call.id, errors: 0 };
    }
  });

  return {
    analyzed: summaries.length,
    errors: summaries.reduce((total, item) => total + item.errors, 0),
    skippedShort: shortIds.length
  };
}

export async function analyzeAllEligibleCalls(limit = 100): Promise<AnalysisSummary> {
  const total: AnalysisSummary = { analyzed: 0, errors: 0, skippedShort: 0 };

  for (let batch = 0; batch < 250; batch += 1) {
    const summary = await analyzeEligibleCalls(limit);
    total.analyzed += summary.analyzed;
    total.errors += summary.errors;
    total.skippedShort += summary.skippedShort;

    if (summary.analyzed === 0 && summary.skippedShort === 0) break;
  }

  return total;
}

export async function runInitialPipeline(limit = 100, all = false): Promise<PipelineSummary> {
  const sync = await syncLatestCalls(limit, all);
  const analysis = all ? await analyzeAllEligibleCalls(Math.min(limit, 100)) : await analyzeEligibleCalls(limit);
  return { synced: sync.synced, ...analysis };
}

export async function ingestAndAnalyzeCall(callId: string): Promise<PipelineSummary & { call_id: string }> {
  const [call, messages, tools] = await Promise.all([
    getCallDetails(callId),
    getCallMessages(callId),
    getCallTools(callId)
  ]);

  // Skip WebRTC / no-agent calls — these are browser tests, not production telephony
  if (!isAgentCallRecord(call)) {
    return { call_id: callId, synced: 0, analyzed: 0, errors: 0, skippedShort: 0 };
  }

  const transcript = formatTranscript(messages);
  const row = callToRow({ ...call, transcript, tools });

  const supabase = createServerSupabase();
  const { data: existing, error: existingLookupError } = await supabase.from("calls").select("id").eq("id", callId).maybeSingle();
  if (existingLookupError) throw existingLookupError;
  if (existing?.id) {
    const enhancedSync = await supabase.from("calls").upsert(syncOnlyCallToRow({ ...call, transcript, tools }), { onConflict: "id" });
    const { error: updateError } = enhancedSync.error
      ? await supabase.from("calls").upsert(row, { onConflict: "id" })
      : { error: null };
    if (updateError) throw updateError;
  } else {
    const enhancedInsert = await supabase.from("calls").insert(enhancedCallToRow({ ...call, transcript, tools }));
    const { error: insertError } = enhancedInsert.error
      ? await supabase.from("calls").insert({ ...row, analyzed: false })
      : { error: null };
    if (insertError) throw insertError;
  }
  await saveMessagesAndTools([{ ...call, messages, transcript, tools }]).catch(() => {});

  if (!isEligibleAnalysisDuration(row.duration_seconds)) {
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

export async function reanalyzeRecentCalls(limit = 100, all = false): Promise<AnalysisSummary> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("calls")
    .select("id")
    .gte("duration_seconds", MIN_ANALYSIS_SECONDS)
    .lte("duration_seconds", MAX_ANALYSIS_SECONDS)
    .not("transcript", "is", null)
    .order("created_at", { ascending: false });

  if (!all) {
    query = query.limit(limit);
  }

  const { data: calls, error } = await query;
  if (error) throw error;

  const callIds = (calls ?? []).map((call) => String(call.id));
  if (callIds.length === 0) {
    return { analyzed: 0, errors: 0, skippedShort: 0 };
  }

  for (const chunk of chunkArray(callIds, 80)) {
    const { error: deleteError } = await supabase
      .from("call_errors")
      .delete()
      .in("call_id", chunk);
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
      .in("id", chunk);
    const { error: updateError } = enhancedUpdate.error
      ? await supabase
      .from("calls")
      .update({ analyzed: false })
          .in("id", chunk)
      : { error: null };
    if (updateError) throw updateError;
  }

  return all ? analyzeAllEligibleCalls(Math.min(limit, 100)) : analyzeEligibleCalls(limit);
}
