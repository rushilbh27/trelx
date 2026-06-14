const ULTRAVOX_API_URL = "https://api.ultravox.ai/api";

export type UltravoxCall = {
  callId: string;
  agentId: string | null;
  ended: string | null;
  endReason?: string | null;
  billedDuration?: string | null;
  created: string;
  agent?: { agentId: string; name: string } | null;
  shortSummary?: string | null;
  systemPrompt?: string | null;
  [key: string]: unknown;
};

export type UltravoxMessage = {
  role: string;
  text: string;
  callStageMessageIndex?: number;
  medium?: string;
  callStageId?: string;
};

export type UltravoxTool = {
  name: string;
  parameters?: unknown;
  result?: unknown;
  invocationTime?: string;
  errorMessage?: string;
};

export type UltravoxAgent = {
  agentId: string;
  name: string;
  systemPrompt?: string | null;
  callTemplate?: { systemPrompt?: string | null };
  [key: string]: unknown;
};

export type EnrichedUltravoxCall = UltravoxCall & {
  messages: UltravoxMessage[];
  tools: UltravoxTool[];
  transcript: string;
};

function headers() {
  const key = process.env.ULTRAVOX_API_KEY;
  if (!key) throw new Error("Missing env var ULTRAVOX_API_KEY");
  return { "X-API-Key": key };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!response.ok) throw new Error(`Ultravox GET failed ${response.status} for ${url}`);
  return response.json() as Promise<T>;
}

type Paginated<T> = {
  results?: T[];
  next?: string | null;
};

async function fetchPaginated<T>(startUrl: string, maxPages: number): Promise<T[]> {
  const rows: T[] = [];
  let url: string | null = startUrl;
  let pages = 0;

  while (url && pages < maxPages) {
    const data: Paginated<T> = await fetchJson<Paginated<T>>(url);
    rows.push(...(data.results ?? []));
    url = data.next ?? null;
    pages += 1;
  }

  return rows;
}

export function parseDurationSeconds(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const parsed = Number.parseFloat(duration.replace("s", ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function inferAgentType(name: string | null | undefined): string {
  const normalized = name?.toLowerCase() ?? "";
  if (normalized.includes("debt")) return "debt_collection";
  if (normalized.includes("cold") || normalized.includes("outreach")) return "cold_outreach";
  if (normalized.includes("reception") || normalized.includes("inbound")) return "receptionist";
  return "sales";
}

export function formatTranscript(messages: UltravoxMessage[]): string {
  return [...messages]
    .sort((a, b) => (a.callStageMessageIndex ?? 0) - (b.callStageMessageIndex ?? 0))
    .map((message, index) => {
      const role = message.role.includes("AGENT")
        ? "Agent"
        : message.role.includes("TOOL")
          ? "Tool"
          : "User";
      return `[${index}] ${role}: ${message.text ?? ""}`;
    })
    .join("\n");
}

export async function getCallMessages(callId: string): Promise<UltravoxMessage[]> {
  return fetchPaginated<UltravoxMessage>(
    `${ULTRAVOX_API_URL}/calls/${callId}/messages?limit=100`,
    25
  );
}

export async function getCallDetails(callId: string): Promise<UltravoxCall> {
  return fetchJson<UltravoxCall>(`${ULTRAVOX_API_URL}/calls/${callId}`);
}

export async function getCallTools(callId: string): Promise<UltravoxTool[]> {
  try {
    return fetchPaginated<UltravoxTool>(`${ULTRAVOX_API_URL}/calls/${callId}/tools?limit=100`, 10);
  } catch {
    return [];
  }
}

export async function getCalls(opts: { limit?: number; all?: boolean } = {}): Promise<EnrichedUltravoxCall[]> {
  const limit = opts.limit ?? 100;
  const maxPages = opts.all ? 50 : 1;
  const calls = await fetchPaginated<UltravoxCall>(
    `${ULTRAVOX_API_URL}/calls?limit=${limit}&ordering=-created`,
    maxPages
  );

  const endedCalls = calls.filter((call) => Boolean(call.ended));
  return Promise.all(
    endedCalls.map(async (call) => {
      const [messages, tools] = await Promise.all([
        getCallMessages(call.callId),
        getCallTools(call.callId)
      ]);

      return {
        ...call,
        messages,
        tools,
        transcript: formatTranscript(messages)
      };
    })
  );
}

export async function getAgents(): Promise<UltravoxAgent[]> {
  const agents = await fetchPaginated<UltravoxAgent>(`${ULTRAVOX_API_URL}/agents?limit=100`, 10);
  return agents.map((agent) => ({
    ...agent,
    systemPrompt: agent.callTemplate?.systemPrompt ?? agent.systemPrompt ?? null
  }));
}

export async function getAgentPrompt(agentId: string): Promise<{ systemPrompt: string; agent: UltravoxAgent }> {
  const agent = await fetchJson<UltravoxAgent>(`${ULTRAVOX_API_URL}/agents/${agentId}`);
  const systemPrompt = agent.callTemplate?.systemPrompt ?? agent.systemPrompt ?? "";
  return {
    agent: { ...agent, systemPrompt },
    systemPrompt
  };
}
