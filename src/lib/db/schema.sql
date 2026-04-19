-- ============================================================
-- Cortex Database Schema — Week 1
-- All timestamps in UTC. British English in comments.
-- Run this in the Supabase SQL Editor after creating the project.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- EVENTS: the atomic unit of capture
-- One captured utterance / text note / photo = one event row.
-- Raw content is IMMUTABLE — never overwrite after creation.
-- Corrected/edited versions live in separate fields.
-- ============================================================
create table public.events (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id),

  -- Capture metadata
  event_type            text not null check (event_type in ('voice', 'text', 'photo', 'email')),
  created_at            timestamptz not null default now(),
  captured_at           timestamptz not null default now(),

  -- Content: raw is IMMUTABLE, edited is mutable
  raw_content           text,
  edited_content        text,

  -- Media references (Supabase Storage paths)
  audio_url             text,
  photo_url             text,

  -- Voice-specific
  audio_duration_seconds numeric,

  -- Photo-specific
  photo_caption_raw     text,
  photo_caption_edited  text,
  ocr_text              text,

  -- Extraction status
  extraction_status     text not null default 'pending'
    check (extraction_status in ('pending', 'processing', 'complete', 'failed', 'skipped')),
  extraction_run_at     timestamptz,

  -- Soft delete (no hard deletes — every destructive action is undoable)
  is_deleted            boolean not null default false,
  deleted_at            timestamptz,

  -- Offline sync
  source_device         text,
  offline_id            text unique,

  updated_at            timestamptz not null default now()
);

create index idx_events_user_created on public.events(user_id, created_at desc);
create index idx_events_extraction_pending on public.events(extraction_status)
  where extraction_status = 'pending';
create index idx_events_offline_id on public.events(offline_id)
  where offline_id is not null;

-- ============================================================
-- LABELS: multi-label extraction results
-- A single event can have many labels (RFI + commitment + risk).
-- ============================================================
create type public.label_type as enum (
  'rfi', 'tq', 'commitment', 'decision', 'risk',
  'variation', 'snag', 'site_diary', 'meeting_note',
  'observation', 'thought'
);

create table public.event_labels (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references public.events(id) on delete cascade,
  label       public.label_type not null,
  confidence  numeric not null check (confidence >= 0 and confidence <= 1),
  reasoning   text,
  created_at  timestamptz not null default now(),

  unique(event_id, label)
);

create index idx_event_labels_event on public.event_labels(event_id);
create index idx_event_labels_label on public.event_labels(label);

-- ============================================================
-- ENTITIES: people, organisations, trades, locations, etc.
-- Single table with type discriminator — not separate tables.
-- ============================================================
create type public.entity_type as enum (
  'person', 'organisation', 'trade_package', 'location',
  'drawing', 'document'
);

create table public.entities (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id),
  entity_type     public.entity_type not null,
  canonical_name  text not null,
  aliases         text[] default '{}',
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique(user_id, entity_type, canonical_name)
);

create index idx_entities_user_type on public.entities(user_id, entity_type);

-- ============================================================
-- EVENT_ENTITIES: junction table linking events to entities
-- ============================================================
create table public.event_entities (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references public.events(id) on delete cascade,
  entity_id   uuid not null references public.entities(id) on delete cascade,
  role        text,
  context     text,
  created_at  timestamptz not null default now(),

  unique(event_id, entity_id, role)
);

create index idx_event_entities_event on public.event_entities(event_id);
create index idx_event_entities_entity on public.event_entities(entity_id);

-- ============================================================
-- EXTRACTION_RESULTS: full extraction response per run
-- ============================================================
create table public.extraction_results (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid not null references public.events(id) on delete cascade,
  model_used        text not null,
  raw_response      jsonb not null,
  parsed_result     jsonb not null,
  sentiment         text check (sentiment in ('positive', 'negative', 'neutral', 'mixed')),
  significance      integer check (significance >= 1 and significance <= 5),
  timeline_worthy   boolean default false,
  timeline_headline text,
  linked_event_ids  uuid[] default '{}',
  tokens_used       integer,
  latency_ms        integer,
  created_at        timestamptz not null default now()
);

create index idx_extraction_results_event on public.extraction_results(event_id);

-- ============================================================
-- AUDIT LOG: append-only, immutable, disclosure-ready
-- No updates, no deletes. Every mutation writes a row.
-- ============================================================
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id),
  action      text not null,
  table_name  text not null,
  record_id   uuid not null,
  before_data jsonb,
  after_data  jsonb not null,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index idx_audit_log_record on public.audit_log(table_name, record_id);
create index idx_audit_log_created on public.audit_log(created_at desc);

-- ============================================================
-- TRIGGERS: enforce immutability on raw capture fields
-- ============================================================
-- Database-level enforcement: raw_content, photo_caption_raw,
-- and ocr_text are write-once. Any UPDATE that attempts to
-- change these columns from their original value is rejected.
-- This is NOT application-level convention — it's a hard gate.
-- ============================================================
create or replace function public.enforce_raw_immutability()
returns trigger as $$
begin
  if old.raw_content is distinct from new.raw_content then
    raise exception 'raw_content is immutable and cannot be modified after creation'
      using errcode = 'restrict_violation';
  end if;
  if old.photo_caption_raw is distinct from new.photo_caption_raw then
    raise exception 'photo_caption_raw is immutable and cannot be modified after creation'
      using errcode = 'restrict_violation';
  end if;
  if old.ocr_text is distinct from new.ocr_text then
    -- ocr_text is set by extraction pipeline after initial insert,
    -- so allow setting it once (NULL -> value) but block changes thereafter.
    if old.ocr_text is not null then
      raise exception 'ocr_text is immutable once set and cannot be modified'
        using errcode = 'restrict_violation';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_events_raw_immutability
  before update on public.events
  for each row execute function public.enforce_raw_immutability();

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at();

create trigger entities_updated_at
  before update on public.entities
  for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Events
alter table public.events enable row level security;

create policy "Users can view own events"
  on public.events for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own events"
  on public.events for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own events"
  on public.events for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy: soft-delete only via update

-- Event Labels
alter table public.event_labels enable row level security;

create policy "Users can view own event labels"
  on public.event_labels for select to authenticated
  using (exists (
    select 1 from public.events
    where events.id = event_labels.event_id and events.user_id = auth.uid()
  ));

create policy "Users can insert own event labels"
  on public.event_labels for insert to authenticated
  with check (exists (
    select 1 from public.events
    where events.id = event_labels.event_id and events.user_id = auth.uid()
  ));

-- Entities
alter table public.entities enable row level security;

create policy "Users can view own entities"
  on public.entities for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own entities"
  on public.entities for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own entities"
  on public.entities for update to authenticated
  using (auth.uid() = user_id);

-- Event Entities
alter table public.event_entities enable row level security;

create policy "Users can view own event entities"
  on public.event_entities for select to authenticated
  using (exists (
    select 1 from public.events
    where events.id = event_entities.event_id and events.user_id = auth.uid()
  ));

create policy "Users can insert own event entities"
  on public.event_entities for insert to authenticated
  with check (exists (
    select 1 from public.events
    where events.id = event_entities.event_id and events.user_id = auth.uid()
  ));

-- Extraction Results
alter table public.extraction_results enable row level security;

create policy "Users can view own extraction results"
  on public.extraction_results for select to authenticated
  using (exists (
    select 1 from public.events
    where events.id = extraction_results.event_id and events.user_id = auth.uid()
  ));

create policy "Service role can insert extraction results"
  on public.extraction_results for insert to authenticated
  with check (exists (
    select 1 from public.events
    where events.id = extraction_results.event_id and events.user_id = auth.uid()
  ));

-- Audit Log: append-only — read for authenticated, insert via service role only
alter table public.audit_log enable row level security;

create policy "Users can view own audit logs"
  on public.audit_log for select to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies for authenticated users.
-- Audit log writes go through service-role client (bypasses RLS).

-- ============================================================
-- STORAGE SETUP (run after schema)
-- ============================================================
-- 1. Create bucket 'captures' (private) via Supabase dashboard
-- 2. Add storage policies:
--    - INSERT: authenticated, path matches captures/{auth.uid()}/*
--    - SELECT: authenticated, path matches captures/{auth.uid()}/*
