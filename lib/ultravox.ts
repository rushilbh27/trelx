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

function isRetriableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: headers(), cache: "no-store" });
    if (response.ok) return response.json() as Promise<T>;
    lastStatus = response.status;
    if (!isRetriableStatus(response.status) || attempt === 3) break;
    const retryAfter = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1200 * (attempt + 1);
    await sleep(waitMs);
  }
  throw new Error(`Ultravox GET failed ${lastStatus} for ${url}`);
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

export function parseDurationSeconds(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const parsed = Number.parseFloat(duration.replace("s", ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const KNOWN_AGENTS: Record<string, string> = {
  "65ae3d7d-5a1f-4880-89f4-1ce690efae89": "Sales AI",
  "52db715f-fc68-4265-a354-7f64a27cd3b9": "Debt Collector",
  "428d7591-3ba5-4b60-8aa5-a92012d12451": "NECTOR Demo",
  "74c435db-0382-45d4-8f84-65343c0dde5f": "Cold Outreach",
  "0a5b5ccc-4f75-456c-94c8-f9e7293f9d81": "Davansh Investment",
  "bfea3820-a447-4444-bd41-53ff919bbfe3": "Edifice Properties",
  "5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1": "Ramco Gas",
  "efecb97c-2937-4507-a550-8db5e8882c82": "Real Estate AI",
  "4be98966-7c89-4149-8f10-e2ac16291f66": "Debt Collection 2",
  "3983f5c0-4a95-42e3-a95a-9dbe57e11c78": "Follow-Up Debt Bot",
  "2dfe90c6-569f-49e0-84f4-e67d9e770255": "Debt Welcome Bot"
};

export function getAgentDisplayName(
  agentId: string | null | undefined,
  agentName: string | null | undefined,
  systemPrompt?: string | null
): string {
  if (agentId && KNOWN_AGENTS[agentId]) return KNOWN_AGENTS[agentId];
  if (agentName) return agentName;
  const promptCompany = systemPrompt?.match(/receptionist for ([^.]+)/i)?.[1]?.trim();
  return promptCompany || "Unknown";
}

export function inferAgentType(name: string | null | undefined, agentId?: string | null): string {
  if (agentId && KNOWN_AGENTS[agentId]) {
    return inferAgentType(KNOWN_AGENTS[agentId]);
  }
  const normalized = name?.toLowerCase() ?? "";
  if (normalized.includes("debt")) return "debt_collection";
  if (normalized.includes("cold") || normalized.includes("outreach")) return "cold_outreach";
  if (
    normalized.includes("reception") ||
    normalized.includes("inbound") ||
    normalized.includes("edifice") ||
    normalized.includes("davansh") ||
    normalized.includes("nector") ||
    normalized.includes("ramco") ||
    normalized.includes("uganda")
  ) return "receptionist";
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
  const pageSize = Math.min(Math.max(limit, 1), 100);
  const maxPages = opts.all ? 50 : Math.ceil(limit / pageSize);
  const calls = await fetchPaginated<UltravoxCall>(
    `${ULTRAVOX_API_URL}/calls?limit=${pageSize}&ordering=-created`,
    maxPages
  );

  const endedCalls = calls.filter((call) => Boolean(call.ended)).slice(0, limit);
  return runPool(
    endedCalls,
    5,
    async (call) => {
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
    }
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
