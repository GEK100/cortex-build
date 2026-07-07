-- ============================================================
-- Cortex Database Schema — Week 4
-- DECISIONS — lifecycle rows derived from decision-labelled events.
--
-- Same reasoning as AD-017 for actions: the captured event is immutable
-- evidence of when and how a decision was recorded; the decision itself has a
-- lifecycle (recorded → implemented → superseded → reversed) that the event
-- cannot carry. One decision row per decision-labelled event (unique on
-- source_event_id), created by the extraction persist step, mutated by the
-- decisions view.
-- Apply AFTER 003 in the Supabase SQL Editor.
-- ============================================================
create table public.decisions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references auth.users(id),
  source_event_id       uuid not null references public.events(id) on delete cascade,

  statement             text not null,
  rationale             text,
  decided_by_entity_id  uuid references public.entities(id) on delete set null,
  decided_at            timestamptz not null default now(),

  status                text not null default 'recorded'
    check (status in ('recorded', 'implemented', 'superseded', 'reversed')),
  superseded_by         uuid references public.decisions(id) on delete set null,

  is_deleted            boolean not null default false,
  deleted_at            timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (source_event_id)
);

create index idx_decisions_user_status on public.decisions(user_id, status)
  where is_deleted = false;
create index idx_decisions_decided_at on public.decisions(decided_at desc);

create trigger decisions_updated_at
  before update on public.decisions
  for each row execute function public.update_updated_at();

alter table public.decisions enable row level security;

create policy "Users can view own decisions"
  on public.decisions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own decisions"
  on public.decisions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own decisions"
  on public.decisions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: soft-delete via is_deleted only.
