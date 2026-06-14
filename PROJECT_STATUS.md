# Trelx Project Status

Date: 2026-06-14
Repo: `rushilbh27/trelx`
Branch: `main`
Latest commit: `bc552d1`

## Product goal

Trelx should behave like Voxray for Ultravox agents, but:

- transcript-only
- GPT-4o only
- no Claude/Haiku
- no audio pipeline
- no automatic Ultravox patch/apply workflow as a product requirement right now

## Hard product constraints

- Transcript-only analysis.
- No recording/audio dependency.
- Ultravox analysis inputs come from documented REST `GET` endpoints.
- Major user priority is system correctness, not interface polish.

## Layer status

### Layer 1 — Ingest

Status: working

- Ultravox calls sync works.
- 500-call sync completed in this session.
- Message-level transcript ingestion works through `call_messages`.
- Tool/result persistence works through `call_tools`.
- Existing webhook route exists:
  - `/api/webhook/ultravox`
  - alias `/api/webhook/call-ended`

### Layer 2 — Eval

Status: working, needs more accuracy tuning

- GPT-4o call analysis works.
- Uses transcript/message context.
- Pulls actual live agent prompt context.
- Stores:
  - `call_errors`
  - `calls.error_count`
  - `calls.critical_error_count`
  - `calls.call_errors`
  - `calls.analysis_status`

Known remaining issue:

- Eval quality still needs tuning for false positives.

### Layer 3 — Fix

Status: mostly working from existing flow

- Generate Fix UI exists.
- Simulation UI exists.
- Patch/apply path exists in repo, but not current priority.

### Layer 4 — Synthesize

Status: existing path present, not main focus this session

- Blueprint page and route exist.
- Not deeply re-audited this session.

### Layer 5 — Loop

Status: partial

- Dashboard auto-pipeline now runs automatically.
- It does initial 500-call pass and minute polling after that.
- Real webhook exists, but end-to-end verification after latest schema/pipeline changes is still pending.

## What changed this session

### 1. Voxray-style Supabase Node fix

Problem:

- Direct sync/reanalysis from Node route context failed with:
  - `Node.js 20 detected without native WebSocket support.`

Cause:

- Supabase realtime client in Node needed explicit websocket transport.

Fix:

- Mirrored Voxray exactly.
- Added `ws` transport to server-side Supabase client in:
  - [lib/supabase.ts](/Users/rushilbhor/trelx/lib/supabase.ts)

Result:

- Direct route invocation for sync/reanalysis started working.

### 2. SQL migration fix

Problem:

- Supabase SQL editor failed with:
  - `column "calls_with_errors" does not exist`

Cause:

- `get_trelx_agent_error_summary()` ordered by output names without explicit aliases.

Fix:

- Added explicit aliases in:
  - [supabase/trelx_voxray_upgrade.sql](/Users/rushilbhor/trelx/supabase/trelx_voxray_upgrade.sql)

Result:

- User successfully ran migration.

### 3. Transcript ordinal bug fix

Problem:

- Error quotes and highlighted failed turns could drift from real Ultravox message positions.

Cause:

- `formatTranscript()` used local array index instead of Ultravox `callStageMessageIndex`.

Fix:

- Preserve true ordinal in:
  - [lib/ultravox.ts](/Users/rushilbhor/trelx/lib/ultravox.ts)

Result:

- Evidence alignment is much more reliable.

### 4. Sync corruption bug fix

Problem:

- Running sync on existing calls could reset analysis state and wipe stored analysis fields.

Cause:

- Enhanced upsert row initialized:
  - `analysis_status`
  - `error_count`
  - `critical_error_count`
  - `call_errors`
  for both new and existing calls.

Fix:

- Split sync behavior in:
  - [lib/pipeline.ts](/Users/rushilbhor/trelx/lib/pipeline.ts)
- Existing calls now get transcript/raw/tool refresh only.
- New calls get pending-analysis initialization.

Result:

- Sync no longer trashes analyzed calls.

### 5. Message-level evidence views

Implemented:

- `/calls`
- `/calls/[id]`
- `/dashboard`
- `/dashboard/[agentId]`

What improved:

- call log now shows status from `analysis_status`
- call detail shows transcript + tool activity + analysis summary
- agent page shows failure leaderboard with example lines
- dashboard uses RPC-backed aggregates instead of building all summary logic client-side

### 6. Auto pipeline behavior

Changed:

- dashboard auto-pipeline now runs automatically
- first pass:
  - sync latest 500
  - analyze in batches
- ongoing:
  - every 60s sync latest 100
  - analyze pending batches

This matches user requirement better:

- no manual button-driven flow needed

## Detailed error / fix log

### Error: SQL migration alias failure

- Error text:
  - `column "calls_with_errors" does not exist`
- Fix:
  - explicit aliases in `get_trelx_agent_error_summary()`

### Error: Missing Ultravox env during direct route invocation

- Error text:
  - `Missing env var ULTRAVOX_API_KEY`
- Cause:
  - shell route invocation did not source `.env.local`
- Fix:
  - source `.env.local` before invoking built route modules

### Error: sandboxed direct fetch failure

- Error text:
  - `fetch failed`
- Cause:
  - sandbox blocked outbound network for direct Node route invocation
- Fix:
  - reran with escalated network permission

### Error: Supabase websocket failure in Node

- Error text:
  - `Node.js 20 detected without native WebSocket support.`
- Cause:
  - Supabase realtime in Node without transport override
- Fix:
  - used Voxray pattern: `realtime: { transport: ws }`

### Error: stale `.next/types` during typecheck

- Error text:
  - multiple `.next/types/... not found`
- Cause:
  - stale Next generated types before build
- Fix:
  - run `npm run build` then rerun `npm run typecheck`

### Error: dirty dev hot-reload bundle state

- Error text:
  - missing webpack chunk / vendor chunk / server chunk errors in browser console
- Cause:
  - dev server state got dirty after build + repeated hot reload
- Fix:
  - restart clean dev server on fresh port `3012`

### Error: zsh bracket glob with file paths

- Error text:
  - `zsh:1: no matches found: app/calls/[id]/page.tsx`
- Cause:
  - shell treated brackets as glob pattern
- Fix:
  - use `git add -A` instead of bracketed explicit path list

### Error: git metadata write blocked

- Error text:
  - `Unable to create '.git/index.lock': Operation not permitted`
- Cause:
  - sandbox blocked git metadata write
- Fix:
  - reran commit with escalated permission

## Current observed system state

Observed on clean dev server at `http://localhost:3012`:

- Dashboard loads successfully.
- Agent profile loads successfully.
- Call detail loads successfully.
- No console errors on fresh run.

Observed dashboard counts:

- eligible calls: `223`
- analyzed calls: `223`
- pending: `0`
- total flagged errors: `37`
- critical errors: `5`
- calls with errors: `35`

Observed route reanalysis result:

```json
{"ok":true,"analyzed":223,"errors":24,"skippedShort":0}
```

Important note:

- There is still a count discrepancy to audit between route-level returned `errors` and dashboard aggregate totals.
- This should be checked next session.

## Verification done

Passed:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Live smoke done:

- `/dashboard`
- `/dashboard/[agentId]`
- `/calls/[id]`

Operational verification done:

- 500-call sync completed
- latest eligible calls reanalyzed

## Important files

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

## Current known gaps

- False positive tuning still needed.
- Webhook path exists but needs end-to-end validation after latest pipeline changes.
- `llm_traces` table exists but writes are not yet wired in.
- Aggregate/error count consistency needs audit.
- Auto-pipeline is dashboard-driven right now; webhook should become trusted live path.

## Recommended next-session plan

1. Verify real Ultravox webhook delivery to `/api/webhook/ultravox`.
2. Compare flagged calls against Voxray behavior and tighten eval prompt/rules.
3. Audit discrepancy between `call_errors` row count and aggregate totals.
4. Add `llm_traces` persistence for:
   - detection
   - patch generation
   - simulation
   - blueprint
5. Re-run 500-call reanalysis after eval-tuning changes.

## Commits relevant to this state

- `bc552d1` Harden Voxray-style transcript analysis flow
- `a6661db` Add schema upgrade for message-level analysis
- `89f4a95` Add Voxray-style evidence views
- `b90714b` Improve core analysis pipeline
- `6d9ed25` Fix dashboard error rate calculation
