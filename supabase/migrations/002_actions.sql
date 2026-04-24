-- ============================================================
-- ACTIONS — derived lifecycle rows from commitment / RFI / TQ extractions
--
-- Per AD-017: actions are not events. Events are immutable captured evidence.
-- An action is the live tracked obligation that *points back* to the source
-- event as its evidence. Actions have a lifecycle (open / closed / disputed
-- / cancelled) and a due date; events have neither. One row per identified
-- obligation. The source_event_id is the claims-defensible anchor.
-- ============================================================
create table public.actions (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id),
  source_event_id      uuid not null references public.events(id) on delete cascade,

  description          text not null,
  source_kind          text not null default 'commitment'
    check (source_kind in ('commitment', 'rfi', 'tq')),

  raised_by_entity_id  uuid references public.entities(id) on delete set null,
  owner_entity_id      uuid references public.entities(id) on delete set null,
  raised_at            timestamptz not null default now(),
  due_at               timestamptz,
  closed_at            timestamptz,

  status               text not null default 'open'
    check (status in ('open', 'closed', 'disputed', 'cancelled')),
  evidence             text,

  is_deleted           boolean not null default false,
  deleted_at           timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_actions_user_status on public.actions(user_id, status)
  where is_deleted = false;
create index idx_actions_source_event on public.actions(source_event_id);
create index idx_actions_owner on public.actions(owner_entity_id)
  where owner_entity_id is not null;
create index idx_actions_due_open on public.actions(due_at)
  where status = 'open' and is_deleted = false;

create trigger actions_updated_at
  before update on public.actions
  for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.actions enable row level security;

create policy "Users can view own actions"
  on public.actions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own actions"
  on public.actions for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own actions"
  on public.actions for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy: soft-delete via is_deleted flag only.
