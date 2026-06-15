# Trelx – Ultravox QA Engine

Trelx is a self-improving evaluation layer for Ultravox voice agents. It ingests live production calls, uses GPT-4o to isolate exact failure points in transcripts, generates safer prompt patches, and synthesizes hardened blueprints from what broke in production.

**Built for the Codex Community Hackathon Pune.**

---

## 🏗️ Architecture & Data Pipeline

Trelx operates in a continuous integration loop for Voice AI. Here is the exact data pipeline:

1. **Ingestion (Ultravox API)**: Trelx pulls production calls from Ultravox via the `GET /api/calls` endpoint. It extracts the `transcript` and `summary` for each call. Calls under 30 seconds are skipped as noise.
2. **Analysis Trigger (Next.js Background)**: Once new calls are saved to the Supabase Postgres database, Trelx triggers a serverless background job (`/api/analyze`) using `Promise.all` concurrency to analyze un-analyzed calls in batches.
3. **Evaluation (GPT-4o)**: The transcript is passed to GPT-4o with a strict system prompt. GPT-4o is instructed to map agent failures to a specific taxonomy (e.g., `robotic_repetition`, `wrong_information`, `ignored_objection`) and return the exact transcript quote where the failure occurred.
4. **Storage & Display (Supabase & React)**: The evaluation results are stored in the `call_errors` table in Supabase. The Next.js frontend fetches this data to render the dashboard, agent profiles, and exact failure quotes using interactive UI components.

---

## 🧠 Analysis Logic (GPT-4o)

Trelx does not rely on simple keyword matching. It uses deep LLM reasoning to evaluate complex conversational flows.

### Defining "Failure"
We define failure using a strict taxonomy. An agent fails if it:
- Repeats itself in a loop (`robotic_repetition`)
- Provides factually incorrect data (`wrong_information`)
- Ignores a user's explicit question or objection (`ignored_objection`)
- Hallucinates a capability it doesn't have (`hallucination`)

### The Prompt
When analyzing a call, Trelx sends the following structured prompt to GPT-4o:

```text
You are an expert QA auditor for an AI voice agent. 
Analyze this transcript. If the agent makes a mistake, map it to one of these error types: 
[robotic_repetition, wrong_information, ignored_objection, hallucination].
Determine the severity (low, medium, high, critical) and the call stage (greeting, discovery, pitch, close).
You must extract the EXACT quote from the agent that demonstrates the failure.
```

### The Output (JSON)
GPT-4o returns a strictly typed JSON object, which we parse and store in Supabase:

```json
{
  "has_error": true,
  "error_type": "robotic_repetition",
  "severity": "critical",
  "call_stage": "greeting",
  "quote": "Hello... Good morning... Am I speaking to Charles?",
  "reasoning": "The user interrupted the agent, but the agent restarted its greeting instead of adapting."
}
```

---

## 🔌 Integrating Ultravox

Trelx connects directly to the Ultravox REST API. No synthetic data is used.

**Prerequisites:**
You need an `ULTRAVOX_API_KEY` with read access to your agents and calls.

**Integration Pattern:**
Trelx uses the following Ultravox endpoints:
1. **Fetching Calls**: `GET https://api.ultravox.ai/api/calls`
   - We pass `agentId` to fetch transcripts for specific models.
2. **Fetching Prompts**: `GET https://api.ultravox.ai/api/agents/{agentId}`
   - We fetch the current `systemPrompt` to understand the agent's baseline behavior so we can patch it.
3. **Applying Patches (Optional)**: `PATCH https://api.ultravox.ai/api/agents/{agentId}`
   - When a user clicks "Apply Patch" in Trelx, we rewrite the `systemPrompt` with the GPT-4o generated fix to prevent the failure from happening again.

---

## 🚀 Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` and configure your keys:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ULTRAVOX_API_KEY=your_ultravox_key
   OPENAI_API_KEY=your_openai_key
   ```

3. Initialize your Supabase database using `schema.sql`.

4. Start the app:
   ```bash
   npm run dev
   ```
