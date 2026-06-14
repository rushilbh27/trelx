import { gpt4oJson } from "@/lib/openai";
import type { SimulationResult } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSimulation(value: unknown): SimulationResult {
  if (!isRecord(value) || typeof value.would_error !== "boolean" || typeof value.reason !== "string") {
    throw new Error("Invalid simulation JSON");
  }

  return {
    would_error: value.would_error,
    reason: value.reason
  };
}

function customerTurns(transcript: string): string {
  return transcript
    .split("\n")
    .filter((line) => line.includes("User:"))
    .join("\n")
    .slice(-12000);
}

export async function simulatePatchOnTranscript(input: {
  errorType: string;
  reasoning: string;
  findText: string;
  replaceText: string;
  transcript: string;
}): Promise<SimulationResult | null> {
  return gpt4oJson(
    {
      temperature: 0,
      system:
        "You are simulating how a voice AI agent would behave with a revised system prompt. You are given a past conversation where the agent made a specific error. Determine whether the agent, following the NEW prompt, would still make that error.",
      user: `Original error: ${input.errorType} - ${input.reasoning}
OLD prompt (relevant section): ${input.findText}
NEW prompt (relevant section): ${input.replaceText}
Customer turns from the actual call:
${customerTurns(input.transcript)}

Would the agent still make this error with the new prompt?
Return ONLY valid JSON, no markdown: {"would_error": true|false, "reason": "<one sentence>"}`
    },
    validateSimulation
  );
}
