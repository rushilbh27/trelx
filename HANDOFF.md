# Trelx Handoff

Date: 2026-06-14
Branch: `main`
Latest pushed commit: `bc552d1` (`Harden Voxray-style transcript analysis flow`)
Previous important commit: `a6661db` (`Add schema upgrade for message-level analysis`)

## Core constraints

- Transcript-only analysis. No recording/audio processing.
- Use Ultravox `GET` data only for analysis flow.
- No frontend polish work until system quality is stable.
- Goal is "Voxray-level system, Trelx way".

## What was done this session

- Applied Voxray-style Supabase Node fix:
  - `lib/supabase.ts` now uses `ws` transport for server-side Supabase client.
- Applied schema upgrade:
  - `supabase/trelx_voxray_upgrade.sql`
  - User already ran this in Supabase.
- Switched system toward message-level analysis:
  - `call_messages`
  - `call_tools`
  - richer `calls` analysis fields
  - RPC-backed summaries
- Fixed transcript index bug:
  - `lib/ultravox.ts` now preserves Ultravox `callStageMessageIndex` in formatted transcript.
- Fixed sync corruption bug:
  - syncing existing calls no longer resets `analyzed`, `analysis_status`, `error_count`, `critical_error_count`, or `call_errors`.
  - only new calls initialize pending analysis state.
- Upgraded evidence views:
  - `/dashboard`
  - `/dashboard/[agentId]`
  - `/calls`
  - `/calls/[id]`
- Added tool activity panel on call detail.
- Changed dashboard auto-pipeline:
  - initial pass tries latest 500 calls
  - then minute polling for new ended calls
  - no manual button flow needed
- Synced latest 500 calls successfully.
- Reanalyzed latest eligible calls successfully after fixes.

## Current observed state

Fresh smoke was done on `http://localhost:3012`.

Observed on fresh dashboard:

- Eligible calls: `223`
- Analyzed calls: `223`
- Pending calls: `0`
- Total flagged errors shown on dashboard: `37`
- Critical errors shown on dashboard: `5`
- Calls with errors shown on dashboard: `35`

Observed direct reanalysis route result:

- `analyzed: 223`
- `errors: 24`
- `skippedShort: 0`

Important:

- Dashboard is currently functional on clean dev restart.
- Agent page is functional.
- Call detail page is functional.
- Console was clean on fresh server after restart.
- Repo is clean after push.

## Files that matter most next session

- [lib/pipeline.ts](/Users/rushilbhor/trelx/lib/pipeline.ts)
- [lib/supabase.ts](/Users/rushilbhor/trelx/lib/supabase.ts)
- [lib/ultravox.ts](/Users/rushilbhor/trelx/lib/ultravox.ts)
- [lib/error-detector.ts](/Users/rushilbhor/trelx/lib/error-detector.ts)
- [app/components/DashboardActions.tsx](/Users/rushilbhor/trelx/app/components/DashboardActions.tsx)
- [app/dashboard/page.tsx](/Users/rushilbhor/trelx/app/dashboard/page.tsx)
- [app/dashboard/[agentId]/page.tsx](/Users/rushilbhor/trelx/app/dashboard/[agentId]/page.tsx)
- [app/calls/page.tsx](/Users/rushilbhor/trelx/app/calls/page.tsx)
- [app/calls/[id]/page.tsx](/Users/rushilbhor/trelx/app/calls/[id]/page.tsx)
- [supabase/trelx_voxray_upgrade.sql](/Users/rushilbhor/trelx/supabase/trelx_voxray_upgrade.sql)

## First things to do next session

1. Verify webhook path end-to-end with a real Ultravox ended-call event hitting `/api/webhook/ultravox`.
2. Audit false positives in current eval output:
   - `accepted_garbled_audio`
   - `language_mismatch`
   - `ignored_objection`
   - `wrong_call_type`
3. Check why dashboard aggregate count and direct reanalysis error count differ.
4. Add `llm_traces` writes for detection / patch / simulation / blueprint calls.
5. Confirm minute auto-poll behavior does not reprocess already-analyzed calls incorrectly.

## Useful commands

Build / checks:

```bash
npm run typecheck
npm run lint
npm run build
```

Fresh dev server:

```bash
npm run dev -- -p 3012
```

Pages to open:

```text
/dashboard
/dashboard/74c435db-0382-45d4-8f84-65343c0dde5f
/calls
/errors
```

## Things not to waste time on next session

- Frontend polish
- Audio/recording analysis
- Re-explaining Voxray concept
- Rebuilding schema from scratch

## Last note

System is materially closer now.
Next session should be about eval accuracy + live webhook verification, not UI work.
