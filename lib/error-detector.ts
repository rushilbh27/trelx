import { ERROR_TYPES } from "@/lib/error-types";
import { gpt4oJson } from "@/lib/openai";
import type { ErrorType } from "@/lib/error-types";
import type { CallStage, DetectedError, Severity } from "@/lib/types";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const STAGES: CallStage[] = ["greeting", "discovery", "pitch", "close", "save"];
const ERROR_ALIASES: Record<string, ErrorType> = {
  no_save: "no_save_answers",
  no_tool_call: "no_save_answers",
  no_save_debt: "no_save_answers",
  made_promise: "broke_promise",
  broken_promise: "broke_promise",
  invented_info: "wrong_info",
  invented_amount: "wrong_info",
  calculated_balance: "wrong_info",
  no_product_context: "wrong_info",
  wrong_company_name: "wrong_info",
  wrong_agent_name: "wrong_info",
  accepted_unknown_location: "accepted_garbled_audio",
  accepted_past_date: "missed_intent",
  accepted_vague_date: "missed_intent",
  skipped_repeat_rule: "missed_intent",
  no_consultation: "missed_intent",
  no_name_collected: "missed_intent",
  wrong_person_handling: "missed_intent",
  no_commitment: "no_clear_close",
  wrong_escalation: "missed_intent",
  wrong_opening: "wrong_call_type",
  wrong_flow: "wrong_call_type",
  restart_loop: "robotic_repetition",
  pushed_back: "ignored_objection",
  spoke_luganda: "language_mismatch"
};
const SEVERITY_ALIASES: Record<string, Severity> = {
  minor: "low",
  major: "high"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function isAgentQuote(quote: string): boolean {
  return quote.includes("Agent:");
}

function normalizeErrorType(value: string): ErrorType | null {
  if (value in ERROR_TYPES) return value as ErrorType;
  return ERROR_ALIASES[value] ?? null;
}

function normalizeSeverity(value: string): Severity | null {
  if (SEVERITIES.includes(value as Severity)) return value as Severity;
  return SEVERITY_ALIASES[value] ?? null;
}

function validateDetection(value: unknown): DetectedError[] {
  if (!isRecord(value) || !Array.isArray(value.errors)) {
    throw new Error("Invalid detection JSON");
  }

  return value.errors.flatMap((item): DetectedError[] => {
    if (!isRecord(item)) return [];
    const errorType = asString(item.error_type);
    const severity = asString(item.severity);
    const quote = asString(item.quote);
    const callStage = asString(item.call_stage);
    const reasoning = asString(item.reasoning) ?? "GPT-4o flagged this as a call-quality failure.";
    const confidence = typeof item.confidence === "number" ? item.confidence : 1;
    const normalizedErrorType = errorType ? normalizeErrorType(errorType) : null;
    const normalizedSeverity = severity ? normalizeSeverity(severity) : null;

    if (!normalizedErrorType) return [];
    if (!normalizedSeverity) return [];
    if (!quote) return [];
    if (!callStage || !STAGES.includes(callStage as CallStage)) return [];
    if (confidence < 0.7) return [];
    if (!isAgentQuote(quote)) return [];

    return [{
      error_type: normalizedErrorType,
      severity: normalizedSeverity,
      quote,
      call_stage: callStage as CallStage,
      reasoning
    }];
  });
}

function truncateTranscript(transcript: string): string {
  const maxChars = 30000;
  if (transcript.length <= maxChars) return transcript;
  const headChars = 6000;
  return `${transcript.slice(0, headChars)}\n[... transcript truncated ...]\n${transcript.slice(-(maxChars - headChars))}`;
}

function jobForAgentType(agentType: string | null): string {
  switch (agentType) {
    case "debt_collection":
      return "Collect exact payment commitments, avoid invented numbers, save debt outcomes.";
    case "receptionist":
      return "Answer inbound caller questions, collect required details, save answers.";
    case "cold_outreach":
      return "Run concise cold outreach, qualify interest, collect name and next step.";
    default:
      return "Qualify prospect, handle objections, collect answers, and close with a clear next step.";
  }
}

function dynamicPromptSection(systemPrompt: string | null | undefined): string {
  if (!systemPrompt || systemPrompt.trim().length === 0) return "";
  return `DYNAMIC AGENT PROMPT:
Evaluate the transcript against this actual live system prompt. Prefer concrete prompt violations over generic taste.

<system_prompt>
${systemPrompt.slice(0, 20000)}
</system_prompt>
`;
}

function rulesForAgentType(agentType: string | null): string {
  switch (agentType) {
    case "debt_collection":
      return `AGENT TYPE RULES - Debt collection
- Goal: get exact payment commitment date OR escalate.
- Must not invent amounts or calculate balances unless values are explicitly present.
- Must not accept vague dates like "soon", "later", "end of month" as final.
- no_save_answers only applies when 4+ Agent turns happened and no Tool message appears in the final 4 transcript messages.
- Do not flag short/truncated calls or customer hangups as agent failures unless the agent clearly caused the failure.`;
    case "receptionist":
      return `AGENT TYPE RULES - Inbound receptionist
- This is inbound. Do NOT flag wrong_call_type for receptionist behavior.
- Goal: answer caller inquiry, collect required details, and save answers when enough info was collected.
- wrong_info requires a clear invented/incorrect claim from the Agent.
- broke_promise requires an Agent promise that cannot be fulfilled or is not logged/saved.
- no_save_answers only applies when 4+ Agent turns happened and no Tool message appears in the final 4 transcript messages.`;
    case "cold_outreach":
      return `AGENT TYPE RULES - Cold outreach
- Goal: concise opener, collect name after interest, answer basic questions, schedule callback/appointment or close politely.
- "I will send details on WhatsApp" is NOT automatically broke_promise. Flag it only if the flow requires a tool/save and no Tool message appears, or if the agent promises impossible details.
- Do not flag polite close as no_clear_close when the customer declined or asked to end.
- accepted_garbled_audio requires unclear customer input AND a following Agent line that treats it as valid and advances.
- no_save_answers only applies when 4+ Agent turns happened and no Tool message appears in the final 4 transcript messages.`;
    default:
      return `AGENT TYPE RULES - Sales
- Goal: qualify prospect, handle objections, collect answers, and close with a clear next step.
- Ask one question at a time. stacked_questions requires multiple unrelated questions in one Agent turn.
- Handle objections; ignored_objection requires a customer objection followed by an Agent line that ignores it.
- wrong_info requires a concrete incorrect/invented fact from the Agent, not a vague sales phrase.
- no_save_answers only applies when 4+ Agent turns happened and no Tool message appears in the final 4 transcript messages.`;
  }
}

export async function detectErrorsForCall(input: {
  agentType: string | null;
  transcript: string;
  systemPrompt?: string | null;
}): Promise<DetectedError[]> {
  if (input.transcript.trim().length === 0) return [];

  const result = await gpt4oJson(
    {
      temperature: 0,
      system:
        "You are a strict voice AI agent quality auditor. You only flag clear, material agent mistakes. You ignore transcription artifacts, ambiguous customer speech, and harmless conversational awkwardness.",
      user: `Agent type: ${input.agentType ?? "unknown"}
Agent's job: ${jobForAgentType(input.agentType)}

Error types to detect:
${JSON.stringify(ERROR_TYPES, null, 2)}

Voxray-style detailed failures may appear in your reasoning, but error_type must be either one of the keys above or one of these aliases that Trelx maps internally:
${JSON.stringify(ERROR_ALIASES, null, 2)}

${dynamicPromptSection(input.systemPrompt)}

${rulesForAgentType(input.agentType)}

STRICT EVIDENCE RULES:
- Return errors only when confidence is 0.70 or higher.
- Quote one exact full Agent transcript line, including the index and role prefix, like "[12] Agent: ...".
- Do NOT quote only a User line. If customer speech triggered the failure, quote the Agent line that mishandled it.
- Do NOT flag accepted_garbled_audio just because the User line is garbled. The Agent must accept it as valid and move forward.
- Do NOT flag broke_promise for normal WhatsApp/detail follow-up language unless it is impossible or unsupported by tool/save evidence.
- Do NOT flag no_clear_close when the Agent politely ends after customer rejection, wrong number, or customer request to call back.
- Do NOT flag no_save_answers unless the transcript has at least 4 Agent turns and no Tool message in the final 4 messages.
- Do flag exact prompt-rule violations when the actual system prompt says the agent MUST do something and the transcript shows the opposite.
- Do NOT invent context. If unsure, return no error.

Transcript:
${truncateTranscript(input.transcript)}

Return ONLY valid JSON, no markdown:
{
  "errors": [
    {
      "error_type": "<one of the keys>",
      "severity": "low|medium|high|critical",
      "quote": "<exact full Agent line from transcript, including [index] Agent: prefix>",
      "call_stage": "greeting|discovery|pitch|close|save",
      "reasoning": "<one sentence why this is a clear material agent error>",
      "confidence": 0.0
    }
  ]
}
If no errors, return {"errors": []}.`
    },
    validateDetection
  );

  if (result === null) {
    throw new Error("Failed to generate or validate JSON from GPT-4o");
  }

  return result;
}
