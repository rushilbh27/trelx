import OpenAI from "openai";

type GptInput = {
  system: string;
  user: string;
  temperature?: number;
};

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function isRateLimit(error: unknown): boolean {
  const message = String(error);
  return message.includes("429") || message.toLowerCase().includes("rate");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function gpt4oText(input: GptInput): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await getClient().chat.completions.create({
        model: "gpt-4o",
        temperature: input.temperature ?? 0.2,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user }
        ]
      });

      return response.choices[0]?.message.content ?? "";
    } catch (error) {
      lastError = error;
      if (isRateLimit(error) && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function gpt4oJson<T>(
  input: GptInput,
  validate: (value: unknown) => T
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await gpt4oText(input);
    try {
      return validate(JSON.parse(stripJsonFences(raw)));
    } catch {
      if (attempt === 1) return null;
    }
  }

  return null;
}
