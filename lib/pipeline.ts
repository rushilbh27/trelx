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
import type { Call } from "@/lib/types";

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

export async function syncLatestCalls(limit = 100): Promise<{ synced: number }> {
  const calls = await getCalls({ limit });
  const rows = calls.map(callToRow);

  if (rows.length > 0) {
    const { error } = await createServerSupabase()
      .from("calls")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  return { synced: rows.length };
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
    const { error: markShortError } = await supabase
      .from("calls")
      .update({ analyzed: true })
      .in("id", shortIds);
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

    const { error: updateError } = await supabase
      .from("calls")
      .update({ analyzed: true })
      .eq("id", call.id);
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
  const { error: upsertError } = await supabase.from("calls").upsert(row, { onConflict: "id" });
  if (upsertError) throw upsertError;

  if ((row.duration_seconds ?? 0) < MIN_ANALYSIS_SECONDS) {
    const { error } = await supabase.from("calls").update({ analyzed: true }).eq("id", callId);
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

  const { error: updateError } = await supabase
    .from("calls")
    .update({ analyzed: false })
    .in("id", callIds);
  if (updateError) throw updateError;

  return analyzeEligibleCalls(limit);
}
