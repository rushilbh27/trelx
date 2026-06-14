# Trelx

Self-improving evaluation engine for Ultravox voice AI agents.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ULTRAVOX_API_KEY=
OPENAI_API_KEY=
```

3. Run Supabase schema from `schema.sql`.

4. Start app:

```bash
npm run dev
```

## Demo flow

- `/dashboard` automatically syncs latest 100 Ultravox ended calls, skips calls under 30 seconds, and analyzes eligible calls with GPT-4o.
- `/api/webhook/ultravox` accepts Ultravox call-ended webhook events and analyzes new ended calls.
- `/blueprint` generates system prompt blueprints from observed failure patterns.

Ultravox mutations are disabled. Trelx uses GET-only Ultravox access; prompt apply stays manual.
