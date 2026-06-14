-- ============================================================================
-- TRELX — Voxray-style observability upgrade
-- Safe to run multiple times. Does not drop existing data.
-- Paste this whole file into Supabase SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Calls: keep current Trelx table, add Voxray-style analysis/observability fields
-- ----------------------------------------------------------------------------
alter table calls add column if not exists analysis_status text default 'pending'
  check (analysis_status in ('pending', 'analyzing', 'complete', 'skipped', 'error'));
alter table calls add column if not exists error_count int default 0;
alter table calls add column if not exists critical_error_count int default 0;
alter table calls add column if not exists call_errors jsonb;
alter table calls add column if not exists end_reason text;
alter table calls add column if not exists ended_at timestamptz;
alter table calls add column if not exists raw_data jsonb;
alter table calls add column if not exists prompt_hash text;

update calls
set analysis_status = case
  when analyzed = true then 'complete'
  when duration_seconds is not null and duration_seconds < 30 then 'skipped'
  else coalesce(analysis_status, 'pending')
end
where analysis_status is null or analysis_status = 'pending';

-- ----------------------------------------------------------------------------
-- Message-level transcript and tool calls, mirroring Voxray's durable model
-- ----------------------------------------------------------------------------
create table if not exists call_messages (
  id uuid default gen_random_uuid() primary key,
  call_id text not null references calls(id) on delete cascade,
  role text not null,
  text text not null default '',
  ordinal int not null,
  created_at timestamptz default now(),
  unique(call_id, ordinal)
);

create table if not exists call_tools (
  id uuid default gen_random_uuid() primary key,
  call_id text not null references calls(id) on delete cascade,
  tool_name text not null,
  parameters jsonb,
  result jsonb,
  invocation_time timestamptz,
  status text,
  error_message text,
  created_at timestamptz default now()
);

-- Backfill messages from existing transcript text.
insert into call_messages (call_id, role, text, ordinal)
select
  c.id,
  m.role,
  m.text,
  m.ordinal
from calls c
cross join lateral regexp_matches(
  coalesce(c.transcript, ''),
  '^\[(\d+)\]\s*(Agent|User|Tool):\s*(.*)$',
  'gm'
) as raw_match
cross join lateral (
  select
    (raw_match[1])::int as ordinal,
    raw_match[2]::text as role,
    raw_match[3]::text as text
) m
on conflict (call_id, ordinal) do update
set role = excluded.role,
    text = excluded.text;

-- Backfill tool rows from calls.tool_calls if it is an array.
insert into call_tools (call_id, tool_name, parameters, result, invocation_time, status, error_message)
select
  c.id,
  coalesce(tool->>'name', tool->>'toolName', 'tool') as tool_name,
  tool->'parameters' as parameters,
  tool->'result' as result,
  nullif(tool->>'invocationTime', '')::timestamptz as invocation_time,
  case when tool ? 'errorMessage' then 'error' else 'success' end as status,
  tool->>'errorMessage' as error_message
from calls c
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(c.tool_calls) = 'array' then c.tool_calls else '[]'::jsonb end
) as tool
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- LLM traces: same purpose as Voxray, but model is GPT-4o in Trelx
-- ----------------------------------------------------------------------------
create table if not exists llm_traces (
  id uuid default gen_random_uuid() primary key,
  call_id text,
  model text not null,
  purpose text not null,
  agent_type text,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  cost_usd numeric(10,8),
  success boolean not null default true,
  error_message text,
  prompt_hash text,
  created_at timestamptz default now()
);

create table if not exists prompt_versions (
  id uuid default gen_random_uuid() primary key,
  agent_id text not null,
  prompt_hash text not null,
  first_seen timestamptz default now(),
  last_seen timestamptz default now(),
  unique(agent_id, prompt_hash)
);

create table if not exists false_positives (
  id uuid default gen_random_uuid() primary key,
  call_id text not null references calls(id) on delete cascade,
  error_type text not null,
  created_at timestamptz default now(),
  unique(call_id, error_type)
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists calls_analysis_status_idx on calls(analysis_status);
create index if not exists calls_created_idx on calls(created_at desc);
create index if not exists calls_error_count_idx on calls(error_count desc);
create index if not exists call_messages_call_idx on call_messages(call_id, ordinal);
create index if not exists call_tools_call_idx on call_tools(call_id);
create index if not exists call_tools_name_idx on call_tools(tool_name);
create index if not exists llm_traces_created_idx on llm_traces(created_at desc);
create index if not exists llm_traces_call_idx on llm_traces(call_id);

-- ----------------------------------------------------------------------------
-- Backfill analysis JSON from existing call_errors rows
-- ----------------------------------------------------------------------------
with grouped as (
  select
    c.id as call_id,
    count(e.id)::int as error_count,
    count(e.id) filter (where e.severity = 'critical')::int as critical_error_count,
    jsonb_build_object(
      'errors',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', e.id,
            'type', e.error_type,
            'severity', e.severity,
            'agent_line', e.quote,
            'call_stage', e.call_stage,
            'what_went_wrong', e.error_type,
            'confidence', 1.0
          )
          order by e.detected_at desc
        ) filter (where e.id is not null),
        '[]'::jsonb
      ),
      'summary',
      case when count(e.id) = 0 then 'No material agent failures detected.' else 'Transcript-backed failures detected.' end,
      'goal_achieved',
      count(e.id) = 0,
      'goal_outcome',
      case when count(e.id) = 0 then 'clean' else 'needs_review' end
    ) as call_errors
  from calls c
  left join call_errors e on e.call_id = c.id
  group by c.id
)
update calls c
set
  error_count = grouped.error_count,
  critical_error_count = grouped.critical_error_count,
  call_errors = grouped.call_errors,
  analysis_status = case
    when c.duration_seconds is not null and c.duration_seconds < 30 then 'skipped'
    when c.analyzed = true then 'complete'
    else coalesce(c.analysis_status, 'pending')
  end
from grouped
where grouped.call_id = c.id;

-- ----------------------------------------------------------------------------
-- RPCs matching Voxray-style dashboards, adapted to Trelx table names
-- ----------------------------------------------------------------------------
create or replace function get_trelx_dashboard_aggregates()
returns table (
  total_calls bigint,
  eligible_calls bigint,
  total_analyzed bigint,
  pending_calls bigint,
  calls_with_errors bigint,
  total_errors bigint,
  critical_errors bigint,
  avg_duration double precision
) language sql stable as $$
  select
    count(*)::bigint,
    count(*) filter (where duration_seconds >= 30)::bigint,
    count(*) filter (where analysis_status = 'complete')::bigint,
    count(*) filter (where analysis_status in ('pending', 'analyzing'))::bigint,
    count(*) filter (where error_count > 0)::bigint,
    coalesce(sum(error_count), 0)::bigint,
    coalesce(sum(critical_error_count), 0)::bigint,
    coalesce(avg(case when duration_seconds > 0 then duration_seconds::double precision end), 0)::double precision
  from calls;
$$;

create or replace function get_trelx_agent_error_summary()
returns table (
  agent_id text,
  agent_name text,
  agent_type text,
  total_calls bigint,
  analyzed_calls bigint,
  calls_with_errors bigint,
  error_rate numeric,
  error_count bigint,
  critical_count bigint,
  top_error_type text
) language sql stable as $$
  select
    c.agent_id,
    coalesce(max(c.agent_name), c.agent_id)::text,
    coalesce(max(c.agent_type), 'unknown')::text,
    count(*) filter (where c.duration_seconds >= 30)::bigint,
    count(*) filter (where c.analysis_status = 'complete' and c.duration_seconds >= 30)::bigint,
    count(*) filter (where c.error_count > 0 and c.duration_seconds >= 30)::bigint,
    round(
      count(*) filter (where c.error_count > 0 and c.duration_seconds >= 30)::numeric /
      nullif(count(*) filter (where c.analysis_status = 'complete' and c.duration_seconds >= 30), 0) * 100,
      1
    ) as error_rate,
    coalesce(sum(c.error_count) filter (where c.duration_seconds >= 30), 0)::bigint,
    coalesce(sum(c.critical_error_count) filter (where c.duration_seconds >= 30), 0)::bigint,
    (
      select ce.error_type
      from call_errors ce
      join calls c2 on c2.id = ce.call_id
      where c2.agent_id = c.agent_id
        and c2.duration_seconds >= 30
      group by ce.error_type
      order by count(*) desc
      limit 1
    )::text
  from calls c
  group by c.agent_id
  order by calls_with_errors desc, total_calls desc;
$$;

create or replace function get_trelx_error_frequency(
  p_since timestamptz default null,
  p_agent_id text default null
)
returns table (
  error_type text,
  count bigint,
  critical_count bigint,
  example_call_id text,
  example_line text,
  agents text[]
) language sql stable as $$
  select
    e.error_type,
    count(*)::bigint,
    count(*) filter (where e.severity = 'critical')::bigint,
    min(e.call_id)::text,
    min(e.quote)::text,
    array_agg(distinct coalesce(c.agent_name, c.agent_id))::text[]
  from call_errors e
  join calls c on c.id = e.call_id
  where c.duration_seconds >= 30
    and (p_since is null or c.created_at >= p_since)
    and (p_agent_id is null or p_agent_id = '' or c.agent_id = p_agent_id)
    and e.quote ilike '%Agent:%'
  group by e.error_type
  order by count(*) desc;
$$;

create or replace function get_trelx_weekly_trend()
returns table (
  week text,
  agent text,
  analyzed bigint,
  errors bigint
) language sql stable as $$
  select
    to_char(date_trunc('week', c.created_at), 'IYYY-"W"IW')::text,
    coalesce(c.agent_name, c.agent_id)::text,
    count(*) filter (where c.analysis_status = 'complete')::bigint,
    count(*) filter (where c.error_count > 0)::bigint
  from calls c
  where c.created_at > now() - interval '12 weeks'
    and c.duration_seconds >= 30
  group by date_trunc('week', c.created_at), coalesce(c.agent_name, c.agent_id)
  order by date_trunc('week', c.created_at) asc;
$$;

create or replace function get_trelx_pipeline_stats()
returns table (
  p50_latency_ms double precision,
  p95_latency_ms double precision,
  cost_today double precision,
  success_rate_7d double precision,
  traces_today bigint
) language sql stable as $$
  select
    percentile_cont(0.5) within group (order by latency_ms)::double precision,
    percentile_cont(0.95) within group (order by latency_ms)::double precision,
    coalesce(sum(cost_usd) filter (where created_at > now() - interval '24 hours'), 0)::double precision,
    coalesce(avg(case when success then 1.0 else 0.0 end) filter (where created_at > now() - interval '7 days'), 1.0)::double precision,
    count(*) filter (where created_at > now() - interval '24 hours')::bigint
  from llm_traces
  where latency_ms is not null;
$$;

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table call_messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table call_tools;
exception when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- RLS disabled for hackathon speed
-- ----------------------------------------------------------------------------
alter table call_messages disable row level security;
alter table call_tools disable row level security;
alter table llm_traces disable row level security;
alter table prompt_versions disable row level security;
alter table false_positives disable row level security;
