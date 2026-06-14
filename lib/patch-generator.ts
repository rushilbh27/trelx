import { gpt4oJson } from "@/lib/openai";
import type { GeneratedPatch } from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid patch JSON: ${field}`);
  }
  return value;
}

function validatePatch(value: unknown): GeneratedPatch {
  if (!isRecord(value)) throw new Error("Invalid patch JSON");
  return {
    find_text: requiredString(value.find_text, "find_text"),
    replace_text: requiredString(value.replace_text, "replace_text"),
    reason: requiredString(value.reason, "reason")
  };
}

export async function generatePatch(input: {
  errorType: string;
  reasoning: string;
  quote: string;
  systemPrompt: string;
}): Promise<GeneratedPatch | null> {
  const patch = await gpt4oJson(
    {
      temperature: 0.1,
      system:
        "You are a prompt engineer for voice AI agents. Given an error an agent made and its current system prompt, write a precise find/replace patch that would prevent this error. The find text must be an EXACT substring of the current prompt.",
      user: `Error type: ${input.errorType}
What went wrong: ${input.reasoning}
Example quote: ${input.quote}
Current system prompt:
${input.systemPrompt}

Return ONLY valid JSON, no markdown:
{
  "find_text": "<exact substring from the current prompt to replace>",
  "replace_text": "<the improved version>",
  "reason": "<why this fixes the error>"
}`
    },
    validatePatch
  );

  if (!patch) return null;
  if (!input.systemPrompt.includes(patch.find_text)) return null;
  return patch;
}
