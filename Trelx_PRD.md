# Trelx — MVP PRD

> **The self-improving eval engine for voice AI agents.**
> Detect. Fix. Prove. Synthesize. Loop.
> Codex Community Hackathon Pune · June 14, 2026
> Team Naturally Dumb — Rushil Bhor + Varad Adake

---

## Context for Codex (read this first, every time)

You are building **Trelx** from scratch in **9 hours**. Trelx is an evaluation and self-improvement engine for **Ultravox voice AI agents**. It fetches real call data, detects exactly where the agent messed up, generates a prompt fix, proves the fix works by simulating it against past calls, and finally synthesizes battle-tested agent blueprints from thousands of analyzed calls.

This is built for a Codex hackathon. **You (Codex) are the only builder.** Humans direct and review. Use OpenAI models (GPT-4o) for all AI reasoning — the team has OpenAI credits and judges want OpenAI usage front and center.

**Golden rules:**
- Working ugly beats broken pretty. Ship the demo path first.
- The team has 2,000+ real Ultravox calls already available to analyze.
- NEVER POST/PATCH/DELETE to Ultravox except the single apply-fix endpoint (and only on an allowlisted demo agent).
- Speed over elegance. No tests, no auth beyond basic, no refactors.

---

## The Problem

Every voice AI team flies blind when their agent breaks. They listen to calls manually, guess what went wrong, tweak the system prompt, and pray it works. There's no way to know if a fix actually helps until real customers hit the new version in production.

Three gaps:
1. **Detection is manual** — someone listens to calls to find errors
2. **Fixes are guesses** — no proof a prompt change improves anything
3. **Knowledge is lost** — every agent starts from scratch, mistakes repeat across agents

---

## The Solution — 5 Layers

```
LAYER 1 — INGEST
  Fetch calls from Ultravox API (transcript + summary + tool outputs)
  Store in Supabase

LAYER 2 — EVAL
  GPT-4o detects errors per call
  Error types + severity + exact transcript quote + which call stage failed

LAYER 3 — FIX
  GPT-4o generates a dynamic prompt patch for each error
  Simulate patch against past transcripts → before/after score
  Human approves → patch applied to Ultravox agent

LAYER 4 — SYNTHESIZE (the twist)
  After N calls analyzed, Trelx runs a synthesis job
  GPT-4o reads all error patterns across all agents
  Generates a "Blueprint" — a production-ready system prompt
  for that agent type, built from real failure data

LAYER 5 — LOOP
  New agent deployed → Trelx monitors it → new errors feed back
  Blueprint keeps improving with every call
```

---

## How "Simulation" Works (important — no re-dialing)

Trelx does NOT re-run live calls. It simulates on existing transcripts:

1. Take a past call transcript where the agent made error X
2. Feed GPT-4o: the OLD prompt, the NEW patched prompt, and the customer's turns from that transcript
3. Ask GPT-4o: "With the new prompt, would the agent still make error X on this conversation? Respond pass/fail with reason."
4. Run this across the last N calls that had errors
5. Score: error rate before (actual) vs after (simulated). Show the delta.

This is fully feasible with transcripts already in Supabase. One GPT-4o call per simulated call.

---

## MVP Scope

### IN SCOPE (must ship for demo)

| # | Layer | Feature | Definition of Done |
|---|-------|---------|---------------------|
| 1 | Ingest | Ultravox call sync | Fetch calls via GET, store transcript+summary+tools in Supabase |
| 2 | Eval | GPT-4o error detection | Per call: error types, severity, exact quote, call stage |
| 3 | Eval | Agent dashboard | Grid of agents with error rate, call count, critical count |
| 4 | Eval | Per-agent profile | Error leaderboard + transcript examples for one agent |
| 5 | Fix | GPT-4o patch generation | Given an error, generate find/replace prompt patch |
| 6 | Fix | Simulation engine | Replay past transcripts through patched prompt → before/after score |
| 7 | Fix | Apply button | PATCH the Ultravox agent prompt (allowlisted demo agent only) |
| 8 | Synthesize | Blueprint generator | Button → GPT-4o reads error patterns → outputs full optimized system prompt |

### OUT OF SCOPE (do not build)

- Real-time webhooks (use manual sync / cron)
- Multi-user auth (single basic login or none)
- Llama / self-hosted models (OpenAI only for the hackathon)
- Telegram alerts
- Cost tracking
- CSV export, MCP server, CLI
- Layer 5 automation (describe it in pitch, don't build the full loop)

---

## Architecture

Single **Next.js 14 (App Router)** app. TypeScript. Tailwind. Supabase. Deploy on Vercel.

```
app/
  api/
    sync/route.ts              GET: pull calls from Ultravox, store in Supabase
    analyze/route.ts           POST: run GPT-4o error detection on unanalyzed calls
    fix/generate/route.ts      POST: GPT-4o generates a patch for an error
    fix/simulate/route.ts      POST: replay transcripts through patch → score
    fix/apply/route.ts         POST: PATCH Ultravox agent prompt (allowlist only)
    blueprint/route.ts         POST: GPT-4o synthesizes optimized prompt from patterns
  dashboard/page.tsx           Agent grid
  dashboard/[agentId]/page.tsx Per-agent profile (errors, patches, simulate, apply)
  blueprint/page.tsx           Blueprint generator UI
  page.tsx                     Landing page
  layout.tsx

lib/
  ultravox.ts                  Ultravox API client (GET calls, GET prompt, PATCH prompt)
  openai.ts                    OpenAI client wrapper (GPT-4o calls)
  error-detector.ts            GPT-4o error detection prompt + parser
  patch-generator.ts           GPT-4o patch generation prompt + parser
  simulator.ts                 Replay logic: transcript + new prompt → pass/fail
  blueprint.ts                 GPT-4o synthesis prompt + parser
  supabase.ts                  Supabase client (server + browser)
  types.ts                     All shared types
  error-types.ts               The error taxonomy (see below)
```

---

## Supabase Schema

```sql
-- calls fetched from Ultravox
create table calls (
  id text primary key,                    -- Ultravox call id
  agent_id text not null,
  agent_name text,
  agent_type text,                        -- 'sales' | 'receptionist' | 'debt_collection' | etc
  transcript text,
  summary text,
  tool_calls jsonb,
  duration_seconds int,
  created_at timestamptz default now(),
  analyzed boolean default false
);

-- errors detected per call
create table call_errors (
  id uuid default gen_random_uuid() primary key,
  call_id text references calls(id),
  agent_id text not null,
  error_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  quote text,                             -- exact transcript line showing the error
  call_stage text,                        -- 'greeting' | 'discovery' | 'pitch' | 'close' | 'save'
  detected_at timestamptz default now()
);

-- generated patches
create table patches (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  error_type text not null,
  find_text text not null,
  replace_text text not null,
  reason text,
  before_rate numeric,                    -- error rate before (actual)
  after_rate numeric,                     -- error rate after (simulated)
  status text default 'draft' check (status in ('draft','simulated','applied')),
  created_at timestamptz default now()
);

-- generated blueprints
create table blueprints (
  id uuid default gen_random_uuid() primary key,
  agent_type text not null,
  system_prompt text not null,
  based_on_calls int,
  based_on_errors int,
  created_at timestamptz default now()
);

create index calls_agent_idx on calls (agent_id);
create index calls_analyzed_idx on calls (analyzed);
create index call_errors_agent_idx on call_errors (agent_id);
create index call_errors_call_idx on call_errors (call_id);

alter publication supabase_realtime add table calls;
alter publication supabase_realtime add table call_errors;
```

---

## Error Taxonomy (`lib/error-types.ts`)

Voice agent error types. GPT-4o classifies each call against these.

```typescript
export const ERROR_TYPES = {
  wrong_info: "Agent stated factually incorrect information about product/service/price",
  no_save_answers: "Agent collected info but failed to call the save/tool function",
  broke_promise: "Agent promised an action (callback, email) that wasn't logged or fulfilled",
  accepted_garbled_audio: "Agent proceeded on clearly garbled/misheard input without confirming",
  stacked_questions: "Agent asked multiple questions in one turn, confusing the customer",
  wrong_call_type: "Agent treated the call as wrong direction (inbound as outbound, etc.)",
  ignored_objection: "Customer raised an objection the agent ignored or steamrolled",
  no_clear_close: "Call ended without a clear next step or resolution",
  language_mismatch: "Agent responded in wrong language vs customer preference",
  premature_hangup: "Agent ended the call before the goal was met",
  robotic_repetition: "Agent repeated the same phrase/line multiple times (loop behavior)",
  missed_intent: "Agent failed to recognize what the customer actually wanted",
} as const;

export type ErrorType = keyof typeof ERROR_TYPES;
```

---

## GPT-4o Prompts (the AI core)

### Error Detection (`lib/error-detector.ts`)

```
SYSTEM:
You are a voice AI agent quality auditor. You analyze call transcripts and detect
exactly where the agent made mistakes. You are precise and only flag real errors
backed by an exact quote from the transcript.

USER:
Agent type: {agent_type}
Agent's job: {one-line description}

Error types to detect:
{ERROR_TYPES as JSON}

Transcript:
{transcript}

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
If no errors, return {"errors": []}.
```

### Patch Generation (`lib/patch-generator.ts`)

```
SYSTEM:
You are a prompt engineer for voice AI agents. Given an error an agent made and
its current system prompt, you write a precise find/replace patch that would
prevent this error. The find text must be an EXACT substring of the current prompt.

USER:
Error type: {error_type}
What went wrong: {reasoning}
Example quote: {quote}
Current system prompt:
{system_prompt}

Return ONLY valid JSON:
{
  "find_text": "<exact substring from the current prompt to replace>",
  "replace_text": "<the improved version>",
  "reason": "<why this fixes the error>"
}
```

### Simulation (`lib/simulator.ts`)

```
SYSTEM:
You are simulating how a voice AI agent would behave with a revised system prompt.
You are given a past conversation where the agent made a specific error. Determine
whether the agent, following the NEW prompt, would still make that error.

USER:
Original error: {error_type} — {reasoning}
OLD prompt (relevant section): {find_text}
NEW prompt (relevant section): {replace_text}
Customer turns from the actual call:
{customer_turns_from_transcript}

Would the agent still make this error with the new prompt?
Return ONLY JSON: {"would_error": true|false, "reason": "<one sentence>"}
```

### Blueprint Synthesis (`lib/blueprint.ts`)

```
SYSTEM:
You are an elite voice AI prompt architect. You synthesize a production-grade system
prompt for a given agent type, hardened against every failure pattern observed across
thousands of real calls. The output is a complete, deployable system prompt.

USER:
Agent type: {agent_type}
Based on {call_count} analyzed calls and {error_count} detected errors.

Top failure patterns (frequency, type, example):
{top_patterns}

Write a complete, production-ready system prompt for this agent type that structurally
prevents these failure patterns. Include sections: Role, Core Rules, Conversation Flow,
Error Prevention (mapped to the patterns above), Tool Usage, Closing.

Return the system prompt as plain text.
```

---

## 9-Hour Build Plan

> Workflow: Human writes prompt referencing PRD section → Codex generates → Human reviews diff → curl test → commit. Use git worktrees so Rushil and Varad build in parallel.

| Time | Owner | Task |
|------|-------|------|
| 9:00–9:30 | Both | Setup: `create-next-app`, Supabase project + schema, Vercel link, env vars, Codex CLI auth verified. Drop AGENTS.md + PRD.md in repo. |
| 9:30–11:00 | Rushil | LAYER 1: `lib/ultravox.ts` + `app/api/sync/route.ts`. Pull real calls into Supabase. Verify 2000+ calls land. |
| 9:30–11:00 | Varad | LAYER 2 backend: `lib/error-detector.ts` + `app/api/analyze/route.ts`. GPT-4o detects errors, writes to `call_errors`. |
| 11:00–12:30 | Rushil | LAYER 2 frontend: `dashboard/page.tsx` (agent grid) + `dashboard/[agentId]/page.tsx` (profile with error leaderboard + transcript examples). |
| 11:00–12:30 | Varad | LAYER 3a: `lib/patch-generator.ts` + `app/api/fix/generate/route.ts`. Generate a patch for a selected error. |
| 12:30–13:30 | Both | Lunch + integration: sync → analyze → dashboard shows real errors end-to-end. |
| 13:30–15:00 | Rushil | LAYER 3b: `lib/simulator.ts` + `app/api/fix/simulate/route.ts`. The before/after score. THE differentiator — build carefully. |
| 13:30–15:00 | Varad | LAYER 3c: `app/api/fix/apply/route.ts` (allowlist guard) + apply button UI with before/after display. |
| 15:00–16:00 | Both | LAYER 4: `lib/blueprint.ts` + `app/api/blueprint/route.ts` + `blueprint/page.tsx`. Generate optimized prompt from patterns. |
| 16:00–17:00 | Both | End-to-end demo dry run x3. Pre-select the demo agent + demo error. Tune timing. |
| 17:00–17:30 | Rushil | Pitch script + memorize the 5-layer story. |
| 17:00–17:30 | Varad | Final deploy + landing page polish. |
| 17:30–18:00 | Both | Rehearsal x3 with timer. Record backup demo video. |

### Cut order if behind
1. Cut Blueprint UI polish (show raw output in a textarea)
2. Cut apply-to-Ultravox (show the curl command instead of clicking)
3. Cut simulation across many calls (simulate just 3 calls live)
4. NEVER cut: sync → analyze → dashboard showing real errors. That's the spine.

---

## The Demo (3 Minutes)

**Minute 1 — Hook + Real Data**
> "Every voice AI team flies blind when their agent breaks. They listen to calls by hand, guess the fix, and pray. We built Trelx."
Open dashboard live. Show the agent grid populated with REAL Ultravox calls. "These are real production calls — over 2,000 of them. Real agents. Real errors Trelx caught."

**Minute 2 — The Loop**
Click into an agent with a high error rate. Show the top error with an exact transcript quote. 
- Click **Generate Fix** → GPT-4o writes the patch live
- Click **Simulate** → Trelx replays past calls through the new prompt → "Error rate before: 38%. After: 12%."
- "We didn't guess. We proved the fix works before shipping it. No other eval tool does this."

**Minute 3 — The Twist + Close**
Go to Blueprint page. Click **Generate Blueprint** for "sales agent."
> "Trelx just read every mistake every sales agent made across thousands of calls, and wrote the perfect sales agent prompt from scratch. Battle-tested by real failure data. Deploy in one click."
Close: "Detect. Fix. Prove. Synthesize. Trelx doesn't just monitor agents — it makes better ones. Built entirely with Codex today."

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 App Router + TypeScript | One app, one deploy |
| Styling | Tailwind CSS | Speed |
| Database | Supabase | Realtime + Postgres, free tier |
| AI | OpenAI GPT-4o | Judges want OpenAI; team has credits; better than Haiku for synthesis |
| Voice platform | Ultravox (GET + 1 PATCH) | Where the real agents + calls live |
| Deploy | Vercel | One command, live URL |
| Builder | OpenAI Codex | Required — Codex writes all the code |

---

## Production Safety (Ultravox)

- **GET only** on `api.ultravox.ai` EXCEPT the single apply-fix PATCH.
- Apply-fix allowlist: ONE demo agent UUID only. All other UUIDs → 403.
- Pre-flight: verify `find_text` exists in the live prompt before PATCH. If not, 409.
- Preserve `...agent.callTemplate` spread — only `systemPrompt` changes.

---

## Env Vars

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ULTRAVOX_API_KEY=
OPENAI_API_KEY=
TRELX_DEMO_AGENT_ID=        # the ONE allowlisted agent for apply-fix
```

---

## Win Conditions

- Dashboard shows REAL calls and REAL detected errors (not mock data)
- The simulate step shows a believable before/after drop live
- The blueprint generates a genuinely good-looking system prompt
- The 5-layer story is told cleanly: Detect, Fix, Prove, Synthesize, Loop
- Codex visibly built it
- One-liner lands: **"Trelx doesn't just monitor agents. It makes better ones."**

---

**Naturally Dumb · Codex Hackathon Pune · June 14, 2026 · Let's win this.**
