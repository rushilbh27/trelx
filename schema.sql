-- ============================================================================
-- TRELX — Supabase Schema
-- Run this entire file in the Supabase SQL Editor at 9:00 AM
-- ============================================================================

drop table if exists call_errors cascade;
drop table if exists patches cascade;
drop table if exists blueprints cascade;
drop table if exists calls cascade;

-- ----------------------------------------------------------------------------
-- calls: fetched from Ultravox
-- ----------------------------------------------------------------------------
create table calls (
  id text primary key,                    -- Ultravox call id
  agent_id text not null,
  agent_name text,
  agent_type text,                        -- 'sales' | 'receptionist' | 'debt_collection'
  transcript text,
  summary text,
  tool_calls jsonb,
  duration_seconds int,
  created_at timestamptz default now(),
  analyzed boolean default false
);

-- ----------------------------------------------------------------------------
-- call_errors: errors detected per call by GPT-4o
-- ----------------------------------------------------------------------------
create table call_errors (
  id uuid default gen_random_uuid() primary key,
  call_id text references calls(id),
  agent_id text not null,
  error_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  quote text,
  call_stage text,                        -- 'greeting'|'discovery'|'pitch'|'close'|'save'
  detected_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- patches: generated prompt fixes with simulation scores
-- ----------------------------------------------------------------------------
create table patches (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  error_type text not null,
  find_text text not null,
  replace_text text not null,
  reason text,
  before_rate numeric,                    -- actual error rate before
  after_rate numeric,                     -- simulated error rate after
  status text default 'draft' check (status in ('draft','simulated','applied')),
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- blueprints: synthesized optimized system prompts
-- ----------------------------------------------------------------------------
create table blueprints (
  id uuid default gen_random_uuid() primary key,
  agent_type text not null,
  system_prompt text not null,
  based_on_calls int,
  based_on_errors int,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index calls_agent_idx on calls (agent_id);
create index calls_analyzed_idx on calls (analyzed);
create index call_errors_agent_idx on call_errors (agent_id);
create index call_errors_call_idx on call_errors (call_id);

-- ----------------------------------------------------------------------------
-- Realtime for live dashboard
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table calls;
alter publication supabase_realtime add table call_errors;

-- ----------------------------------------------------------------------------
-- RLS disabled for hackathon speed
-- ----------------------------------------------------------------------------
alter table calls disable row level security;
alter table call_errors disable row level security;
alter table patches disable row level security;
alter table blueprints disable row level security;
