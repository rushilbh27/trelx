import { ERROR_TYPES } from "@/lib/error-types";
import { gpt4oJson } from "@/lib/openai";
import type { CallStage, DetectedError, Severity } from "@/lib/types";

const SEVERITIES: Severity[] = ["low", "medium", "high", "critical"];
const STAGES: CallStage[] = ["greeting", "discovery", "pitch", "close", "save"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
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

    if (!errorType || !(errorType in ERROR_TYPES)) return [];
    if (!severity || !SEVERITIES.includes(severity as Severity)) return [];
    if (!quote) return [];
    if (!callStage || !STAGES.includes(callStage as CallStage)) return [];

    return [{
      error_type: errorType,
      severity: severity as Severity,
      quote,
      call_stage: callStage as CallStage,
      reasoning
    }];
  });
}

function truncateTranscript(transcript: string): string {
  const maxChars = 16000;
  if (transcript.length <= maxChars) return transcript;
  return transcript.slice(-maxChars);
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

export async function detectErrorsForCall(input: {
  agentType: string | null;
  transcript: string;
}): Promise<DetectedError[]> {
  if (input.transcript.trim().length === 0) return [];

  const result = await gpt4oJson(
    {
      temperature: 0,
      system:
        "You are a voice AI agent quality auditor. You analyze call transcripts and detect exactly where the agent made mistakes. You are precise and only flag real errors backed by an exact quote from the transcript.",
      user: `Agent type: ${input.agentType ?? "unknown"}
Agent's job: ${jobForAgentType(input.agentType)}

Error types to detect:
${JSON.stringify(ERROR_TYPES, null, 2)}

Transcript:
${truncateTranscript(input.transcript)}

Return ONLY valid JSON, no markdown:
{
  "errors": [
    {
      "error_type": "<one of the keys>",
      "severity": "low|medium|high|critical",
      "quote": "<exact line from transcript showing the error>",
      "call_stage": "greeting|discovery|pitch|close|save",
      "reasoning": "<one sentence why this is an error>"
    }
  ]
}
If no errors, return {"errors": []}.`
    },
    validateDetection
  );

  return result ?? [];
}
