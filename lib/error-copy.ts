import { ERROR_TYPES } from "@/lib/error-types";

export const ERROR_LABELS: Record<string, string> = {
  wrong_info: "Wrong information",
  no_save_answers: "No save/tool call",
  broke_promise: "Broken promise",
  accepted_garbled_audio: "Accepted unclear audio",
  stacked_questions: "Stacked questions",
  wrong_call_type: "Wrong call flow",
  ignored_objection: "Ignored objection",
  no_clear_close: "No clear close",
  language_mismatch: "Language mismatch",
  premature_hangup: "Premature hangup",
  robotic_repetition: "Robotic repetition",
  missed_intent: "Missed intent"
};

export const ERROR_IMPACT: Record<string, string> = {
  wrong_info: "Agent gave unsupported or incorrect facts. This creates trust and compliance risk.",
  no_save_answers: "Agent collected useful data but did not persist it with a tool call before ending.",
  broke_promise: "Agent promised follow-up or delivery that was not supported by tool evidence.",
  accepted_garbled_audio: "Agent treated unclear speech as valid instead of clarifying.",
  stacked_questions: "Agent combined multiple asks, increasing confusion and bad answers.",
  wrong_call_type: "Agent used a flow that does not match the call type or campaign rules.",
  ignored_objection: "Customer pushed back, but agent continued script instead of handling the objection.",
  no_clear_close: "Call ended without resolution, next step, or clean disposition.",
  language_mismatch: "Agent handled language preference incorrectly.",
  premature_hangup: "Agent ended before the task was complete.",
  robotic_repetition: "Agent repeated itself or restarted a flow instead of adapting.",
  missed_intent: "Agent failed to recognize what the customer actually meant or wanted."
};

export function errorLabel(type: string): string {
  return ERROR_LABELS[type] ?? type.replaceAll("_", " ");
}

export function errorImpact(type: string): string {
  return ERROR_IMPACT[type] ?? ERROR_TYPES[type as keyof typeof ERROR_TYPES] ?? "Detected quality issue.";
}

export function severityTone(severity: string): string {
  if (severity === "critical") return "border-red-500/50 bg-red-950/30 text-red-200";
  if (severity === "high") return "border-orange-400/50 bg-orange-950/20 text-orange-200";
  if (severity === "medium") return "border-yellow-400/50 bg-yellow-950/20 text-yellow-100";
  return "border-zinc-600 bg-zinc-950 text-zinc-300";
}

export function severityText(severity: string): string {
  if (severity === "critical") return "text-red-300";
  if (severity === "high") return "text-orange-300";
  if (severity === "medium") return "text-yellow-300";
  return "text-zinc-400";
}

export function hasAgentEvidence(quote: string | null | undefined): boolean {
  return Boolean(quote?.includes("Agent:"));
}
