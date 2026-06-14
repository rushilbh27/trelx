# Trelx — Project Context for Codex

You are building **Trelx**, a self-improving evaluation engine for **Ultravox voice AI agents**. You are the only builder. Humans direct and review every diff.

Trelx fetches real call data from Ultravox, uses GPT-4o to detect where the agent messed up, generates prompt fixes, proves they work by simulating against past transcripts, and synthesizes battle-tested agent blueprints from thousands of analyzed calls.

This is a 9-hour hackathon MVP. **Working ugly beats broken pretty.** Build the demo path first.

Full spec is in `/PRD.md`. That is the source of truth. Re-read it when unsure.

---

## The 5 Layers

1. **INGEST** — fetch Ultravox calls (transcript, summary, tool calls) -> Supabase
2. **EVAL** — GPT-4o detects errors per call -> `call_errors` table
3. **FIX** — GPT-4o generates patch -> simulate against past transcripts -> before/after score -> apply to Ultravox
4. **SYNTHESIZE** — GPT-4o reads all error patterns -> generates an optimized system prompt ("Blueprint")
5. **LOOP** — (described in pitch, not fully built) new agent monitored -> blueprint improves

---

## Stack

- **Next.js 14 (App Router)** — frontend + backend, one app
- **TypeScript** — strict, no `any`, no `@ts-ignore`
- **Tailwind CSS** — utility classes only, no custom CSS files
- **Supabase** — Postgres + realtime
- **OpenAI GPT-4o** — ALL AI reasoning (detection, patching, simulation, synthesis)
- **Ultravox API** — GET calls + GET prompt + ONE allowlisted PATCH
- **Vercel** — deploy

**Do NOT add:** Express, Docker, Redis, Prisma, tRPC, Anthropic/Claude, Llama, auth libraries beyond basic, state management libs, testing frameworks, Telegram, MCP, CLI.

---

## File map

```
app/
  api/
    sync/route.ts              GET  — pull calls from Ultravox -> Supabase
    analyze/route.ts           POST — GPT-4o error detection on unanalyzed calls
    fix/generate/route.ts      POST — GPT-4o generates a patch for an error
    fix/simulate/route.ts      POST — replay transcripts through patch -> score
    fix/apply/route.ts         POST — PATCH Ultravox agent prompt (allowlist only)
    blueprint/route.ts         POST — GPT-4o synthesizes optimized prompt
  dashboard/page.tsx           Agent grid
  dashboard/[agentId]/page.tsx Per-agent profile
  blueprint/page.tsx           Blueprint generator UI
  page.tsx                     Landing
  layout.tsx
lib/
  ultravox.ts                  Ultravox client: getCalls, getPrompt, patchPrompt
  openai.ts                    OpenAI client wrapper (GPT-4o)
  error-detector.ts            Detection prompt + parser
  patch-generator.ts           Patch prompt + parser
  simulator.ts                 Replay logic
  blueprint.ts                 Synthesis prompt + parser
  supabase.ts                  Supabase client (server + browser exports)
  types.ts                     Shared types
  error-types.ts               Error taxonomy (12 types, defined in PRD)
```

---

## Core types (`lib/types.ts`)

```typescript
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type CallStage = 'greeting' | 'discovery' | 'pitch' | 'close' | 'save';
export type PatchStatus = 'draft' | 'simulated' | 'applied';

export type Call = {
  id: string;
  agent_id: string;
  agent_name: string | null;
  agent_type: string | null;
  transcript: string | null;
  summary: string | null;
  tool_calls: unknown;
  duration_seconds: number | null;
  created_at: string;
  analyzed: boolean;
};

export type CallError = {
  id: string;
  call_id: string;
  agent_id: string;
  error_type: string;
  severity: Severity;
  quote: string | null;
  call_stage: CallStage | null;
};

export type Patch = {
  id: string;
  agent_id: string;
  error_type: string;
  find_text: string;
  replace_text: string;
  reason: string | null;
  before_rate: number | null;
  after_rate: number | null;
  status: PatchStatus;
};
```

---

## Conventions (follow strictly)

- All API responses are JSON
- All GPT-4o calls go through `lib/openai.ts` — never call OpenAI inline elsewhere
- GPT-4o prompts must demand "return ONLY valid JSON, no markdown" and you must strip ```json fences before `JSON.parse`
- Wrap every `JSON.parse` of an LLM response in try/catch; on failure, retry once then skip
- All Supabase writes from API routes / server, never the client
- Use Supabase realtime for dashboard live updates (fall back to polling if flaky)
- Tailwind utilities only. Sharp corners. Clean, dense, technical look.
- Brand name: **Trelx**, always capitalized exactly that way
- Severity colors: critical=red, high=orange, medium=yellow, low=gray
- Use `Promise.all` to parallelize independent queries

---

## GPT-4o usage rules

- Model string: `gpt-4o`
- Always set a system message + user message per the prompts in PRD
- For batch analysis, cap concurrency at 3 to avoid rate limits; add simple retry with backoff on 429
- Detection, patching, simulation: expect JSON back. Synthesis: expect plain text.
- Truncate very long transcripts to last ~4000 tokens for detection

---

## What NOT to do

- Do NOT POST/PATCH/DELETE to `api.ultravox.ai` except `fix/apply` on the allowlisted demo agent
- Do NOT use any model other than GPT-4o (no Claude, no Llama)
- Do NOT build webhooks, Telegram, MCP, CLI, CSV export
- Do NOT add auth beyond a basic gate (or skip auth — it's a demo)
- Do NOT write tests
- Do NOT refactor working code
- Do NOT add dependencies without asking the human
- Do NOT use mock data on the dashboard — it must show REAL synced calls

---

## Ultravox client (`lib/ultravox.ts`)

Three functions only:
- `getCalls(opts)` — `GET /api/calls` paginated, returns calls with transcript + summary
- `getAgentPrompt(agentId)` — `GET /api/agents/{id}` returns systemPrompt + callTemplate
- `patchAgentPrompt(agentId, newPrompt)` — `PATCH /api/agents/{id}` — **only** if agentId === `TRELX_DEMO_AGENT_ID`, else throw. Preserve `...agent.callTemplate`, change only `systemPrompt`. Pre-flight check that find_text exists in the current prompt.

---

## Demo path (this MUST work flawlessly — protect it)

1. `/api/sync` pulls real calls -> dashboard shows agent grid with real error rates
2. Click an agent -> profile shows top errors with exact transcript quotes
3. Click Generate Fix -> patch appears
4. Click Simulate -> before/after error rate shown
5. Click Generate Blueprint -> optimized system prompt appears

Pre-pick the demo agent and demo error during rehearsal. Make those specific paths bulletproof.

---

## When in doubt

- Re-read `/PRD.md`
- Default to NOT adding things
- If a task would take more than 15 minutes, tell the human to cut scope
- Protect the demo path above everything else

---

**Naturally Dumb · Codex Hackathon Pune · June 14, 2026 · Let's win this.**
