import { gpt4oJson } from "@/lib/openai";
import { getApplicableStructuredPatch } from "@/lib/fix-specs";
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

function promptSections(systemPrompt: string): string[] {
  return systemPrompt
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);
}

function sectionScore(section: string, keywords: string[]): number {
  const normalized = section.toLowerCase();
  return keywords.reduce((score, keyword) => (normalized.includes(keyword) ? score + 1 : score), 0);
}

function keywordsFor(errorType: string, quote: string): string[] {
  const normalizedType = errorType.toLowerCase();
  const normalizedQuote = quote.toLowerCase();

  if (normalizedType.includes("language")) {
    return ["language", "english", "understand", "clarify", "repeat", "slowly"];
  }
  if (normalizedType.includes("unclear") || normalizedType.includes("audio")) {
    return ["clarify", "confirm", "repeat", "name", "unclear", "understand"];
  }
  if (normalizedType.includes("wrong_info")) {
    return ["accurate", "confirm", "facts", "never assume"];
  }
  if (normalizedType.includes("scope")) {
    return ["scope", "only", "cannot", "handoff"];
  }
  if (normalizedType.includes("promise")) {
    return ["promise", "commit", "follow up", "callback"];
  }
  if (normalizedQuote.includes("name")) {
    return ["name", "confirm", "clarify", "repeat"];
  }
  return ["clarify", "confirm", "customer", "ask", "respond"];
}

function pickAnchor(systemPrompt: string, errorType: string, quote: string): string {
  const sections = promptSections(systemPrompt);
  if (sections.length === 0) return systemPrompt.trim();

  const keywords = keywordsFor(errorType, quote);
  const ranked = sections
    .map((section) => ({ section, score: sectionScore(section, keywords) }))
    .sort((a, b) => b.score - a.score || b.section.length - a.section.length);

  return ranked[0]?.section ?? sections[sections.length - 1];
}

function fallbackInstruction(errorType: string, quote: string): string {
  const normalizedType = errorType.toLowerCase();
  const normalizedQuote = quote.toLowerCase();

  if (normalizedType.includes("language")) {
    return "If the customer struggles with English, never guess their language. Slow down, use simple English, ask one short clarifying question, and offer a callback or handoff instead of continuing the script.";
  }
  if (normalizedType.includes("unclear") || normalizedType.includes("audio") || normalizedQuote.includes("name")) {
    return "If the customer's words are unclear, never assume missing details such as their name. Ask them to repeat once in simple words, spell it if needed, and move on only after confirmation.";
  }
  if (normalizedType.includes("wrong_info")) {
    return "Never invent facts. If information is uncertain, say so clearly and ask a clarifying question or hand off rather than guessing.";
  }
  if (normalizedType.includes("scope")) {
    return "Stay inside the assigned task. If the customer asks for something outside scope, explain the limit briefly and hand off instead of improvising.";
  }
  if (normalizedType.includes("promise")) {
    return "Do not promise actions, callbacks, discounts, or outcomes unless explicitly allowed by the prompt and tool flow.";
  }
  return "When the customer is unclear, resistant, or confused, pause the script, clarify the issue in one short question, and only continue after clear confirmation.";
}

async function generateAnchorRewrite(input: {
  errorType: string;
  reasoning: string;
  quote: string;
  systemPrompt: string;
}): Promise<GeneratedPatch | null> {
  const anchor = pickAnchor(input.systemPrompt, input.errorType, input.quote);
  if (!anchor) return null;

  const patch = await gpt4oJson(
    {
      temperature: 0.1,
      system:
        "You are a prompt engineer for voice AI agents. You are given one exact section from the current system prompt. Rewrite ONLY that section so the agent avoids the failure while preserving the rest of the behavior. The find_text must be copied exactly from the provided anchor section.",
      user: `Error type: ${input.errorType}
What went wrong: ${input.reasoning}
Example quote: ${input.quote}
Exact anchor section from current prompt:
${anchor}

Return ONLY valid JSON, no markdown:
{
  "find_text": "<copy the exact anchor section verbatim>",
  "replace_text": "<rewritten anchor section with stronger guardrails>",
  "reason": "<why this fixes the error>"
}`
    },
    validatePatch
  );

  if (!patch) return null;
  if (patch.find_text !== anchor) return null;
  return patch;
}

function deterministicFallback(input: {
  errorType: string;
  quote: string;
  systemPrompt: string;
}): GeneratedPatch | null {
  const anchor = pickAnchor(input.systemPrompt, input.errorType, input.quote);
  if (!anchor) return null;

  return {
    find_text: anchor,
    replace_text: `${anchor}\n\nCritical guardrail: ${fallbackInstruction(input.errorType, input.quote)}`,
    reason: `Added an explicit guardrail for ${input.errorType} using a real prompt section so simulation and manual review can proceed.`
  };
}

export async function generatePatch(input: {
  agentId?: string;
  errorType: string;
  reasoning: string;
  quote: string;
  systemPrompt: string;
}): Promise<GeneratedPatch | null> {
  if (input.agentId) {
    const structuredPatch = getApplicableStructuredPatch({
      agentId: input.agentId,
      errorType: input.errorType,
      systemPrompt: input.systemPrompt
    });
    if (structuredPatch) return structuredPatch;
  }

  const strictPatch = await gpt4oJson(
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

  if (strictPatch && input.systemPrompt.includes(strictPatch.find_text)) {
    return strictPatch;
  }

  const anchorPatch = await generateAnchorRewrite(input);
  if (anchorPatch && input.systemPrompt.includes(anchorPatch.find_text)) {
    return anchorPatch;
  }

  return deterministicFallback(input);
}
