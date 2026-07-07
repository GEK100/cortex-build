-- ============================================================
-- Cortex Database Schema — Week 3
-- Chat, email ingest, Google Calendar, and the agent-run substrate
-- that Weeks 4–5 build on (nightly synthesiser, gap-finder, meeting-prep,
-- weekly reviewer). All timestamps UTC. British English in comments.
-- Apply AFTER 002_actions.sql in the Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- SETTINGS: single-user key/value configuration.
-- Holds the intake email address, meeting-prep lead time, the
-- Cortex-Ops calendar id, and any other operator-tunable knobs.
-- Kept out of env vars deliberately — these are data the user
-- edits at runtime, not deploy-time secrets.
-- ------------------------------------------------------------
create table public.settings (
  user_id     uuid not null references auth.users(id),
  key         text not null,
  value       jsonb not null default '{}',
  updated_at  timestamptz not null default now(),

  primary key (user_id, key)
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- OAUTH_TOKENS: provider access/refresh tokens (Google Calendar).
-- One row per (user, provider). Refresh token is long-lived;
-- access token is refreshed on demand by the calendar client.
-- Written only by the service-role client during the OAuth
-- callback and token refresh — never read into browser code.
-- ------------------------------------------------------------
create table public.oauth_tokens (
  user_id        uuid not null references auth.users(id),
  provider       text not null check (provider in ('google')),
  access_token   text not null,
  refresh_token  text,
  scope          text,
  token_type     text,
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  primary key (user_id, provider)
);

create trigger oauth_tokens_updated_at
  before update on public.oauth_tokens
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- CALENDAR_EVENTS: a local cache of the user's Google Calendar,
-- pulled from the Cortex-Ops calendar (and optionally others).
-- Context notes captured against a meeting are ordinary `events`
-- rows linked here via context_event_id. Meeting-prep briefs
-- (Week 4) attach to these rows through agent_outputs.ref_id.
-- ------------------------------------------------------------
create table public.calendar_events (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id),

  provider          text not null default 'google',
  external_id       text not null,          -- Google event id
  calendar_id       text,                   -- source calendar id

  summary           text,
  description       text,
  location          text,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  attendees         jsonb default '[]',     -- [{email, displayName, responseStatus}]
  html_link         text,

  -- The most recent context note captured against this meeting.
  context_event_id  uuid references public.events(id) on delete set null,

  -- Meeting-prep dispatch bookkeeping (Week 4).
  prep_sent_at      timestamptz,

  is_cancelled      boolean not null default false,
  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (user_id, provider, external_id)
);

create index idx_calendar_events_user_start on public.calendar_events(user_id, starts_at);
create index idx_calendar_events_prep_pending on public.calendar_events(starts_at)
  where prep_sent_at is null and is_cancelled = false;

create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- PUSH_SUBSCRIPTIONS: Web Push endpoints for meeting-prep and
-- overdue-action alerts (Week 4). One row per device/endpoint.
-- ------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id),
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),

  unique (user_id, endpoint)
);

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- ------------------------------------------------------------
-- AGENT_RUNS: append-ish log of every scheduled/triggered agent
-- invocation (synthesiser, gap-finder, meeting-prep, weekly reviewer).
-- Records model, token cost, latency, and success — the observability
-- spine for the four agents. Rows are written by the service role.
-- ------------------------------------------------------------
create table public.agent_runs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id),
  agent         text not null
    check (agent in ('synthesiser', 'gap_finder', 'meeting_prep', 'weekly_reviewer')),
  status        text not null default 'running'
    check (status in ('running', 'complete', 'failed')),
  model_used    text,
  tokens_used   integer,
  latency_ms    integer,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index idx_agent_runs_user_agent on public.agent_runs(user_id, agent, started_at desc);

-- ------------------------------------------------------------
-- AGENT_OUTPUTS: durable narrative outputs produced by the agents.
-- The tomorrow-brief, gap report, meeting-prep brief, and weekly
-- review all land here as one row, addressable by kind + a natural
-- key (e.g. the date, or the calendar_event id). Distinct from
-- agent_runs, which is the invocation log; this is the content.
-- ------------------------------------------------------------
create table public.agent_outputs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id),
  kind         text not null
    check (kind in ('tomorrow_brief', 'gap_report', 'meeting_prep', 'weekly_review')),
  -- Natural key so re-runs upsert rather than duplicate:
  --   tomorrow_brief / gap_report / weekly_review -> the date (YYYY-MM-DD)
  --   meeting_prep                                -> the calendar_events.id
  ref_key      text not null,
  ref_id       uuid references public.calendar_events(id) on delete cascade,

  title        text,
  body         text not null,           -- markdown narrative
  data         jsonb default '{}',      -- structured payload (proposals, counts)
  run_id       uuid references public.agent_runs(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (user_id, kind, ref_key)
);

create index idx_agent_outputs_user_kind on public.agent_outputs(user_id, kind, created_at desc);

create trigger agent_outputs_updated_at
  before update on public.agent_outputs
  for each row execute function public.update_updated_at();

-- ------------------------------------------------------------
-- EVENTS: source_metadata for email provenance (from/subject/
-- message-id) and any future per-source structured context.
-- Nullable, defaults to empty — existing rows are unaffected.
-- Not covered by the raw-immutability trigger by design: it is
-- provenance metadata, not the claims-defensible raw body.
-- ------------------------------------------------------------
alter table public.events
  add column if not exists source_metadata jsonb not null default '{}';

-- ============================================================
-- ROW LEVEL SECURITY — same single-user pattern as Weeks 1–2.
-- ============================================================

-- Settings
alter table public.settings enable row level security;
create policy "Users manage own settings"
  on public.settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- OAuth tokens: readable by owner for status display; writes go
-- through the service role (OAuth callback / refresh).
alter table public.oauth_tokens enable row level security;
create policy "Users can view own oauth tokens"
  on public.oauth_tokens for select to authenticated
  using (auth.uid() = user_id);

-- Calendar events
alter table public.calendar_events enable row level security;
create policy "Users can view own calendar events"
  on public.calendar_events for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can update own calendar events"
  on public.calendar_events for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Inserts/deletes on the sync cache go through the service role.

-- Push subscriptions
alter table public.push_subscriptions enable row level security;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Agent runs: read-only for the owner; writes via service role.
alter table public.agent_runs enable row level security;
create policy "Users can view own agent runs"
  on public.agent_runs for select to authenticated
  using (auth.uid() = user_id);

-- Agent outputs: read-only for the owner; writes via service role.
alter table public.agent_outputs enable row level security;
create policy "Users can view own agent outputs"
  on public.agent_outputs for select to authenticated
  using (auth.uid() = user_id);
