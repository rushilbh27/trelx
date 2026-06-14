import { gpt4oText } from "@/lib/openai";

export async function synthesizeBlueprint(input: {
  agentType: string;
  callCount: number;
  errorCount: number;
  topPatterns: string;
}): Promise<string> {
  return gpt4oText({
    temperature: 0.25,
    system:
      "You are an elite voice AI prompt architect. You synthesize a production-grade system prompt for a given agent type, hardened against every failure pattern observed across thousands of real calls. The output is a complete, deployable system prompt.",
    user: `Agent type: ${input.agentType}
Based on ${input.callCount} analyzed calls and ${input.errorCount} detected errors.

Top failure patterns (frequency, type, example):
${input.topPatterns}

Write a complete, production-ready system prompt for this agent type that structurally prevents these failure patterns. Include sections: Role, Core Rules, Conversation Flow, Error Prevention (mapped to the patterns above), Tool Usage, Closing.

Return the system prompt as plain text.`
  });
}
