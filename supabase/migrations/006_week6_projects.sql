-- ============================================================
-- Cortex Database Schema — Week 6
-- PROJECTS — freeform spaces so captures can be split across sites.
--
-- A project is any bucket the user wants: a construction site, "Personal",
-- a client. There is no hard-coded "construction only" — projects are
-- user-created. events.project_id NULL is the built-in "General" space
-- (notes-to-remember, personal notes, notes about a person). One project per
-- event, reassignable at any time. match_events gains optional project
-- filters so semantic search scopes to the active space too.
-- Apply AFTER 005 in the Supabase SQL Editor.
-- ============================================================
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id),

  name        text not null,
  colour      text,                       -- optional hex for the switcher chip

  status      text not null default 'active'
    check (status in ('active', 'archived')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, name)
);

create index idx_projects_user_status on public.projects(user_id, status);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

alter table public.projects enable row level security;

create policy "Users can view own projects"
  on public.projects for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No delete policy: projects are archived (status = 'archived'), never removed,
-- so an archived project's events keep their filing. Reassign then archive if
-- you want them empty.

-- ============================================================
-- events.project_id — NULL = General. on delete set null is defensive; there
-- is no delete path, but if a project row ever went, its events fall back to
-- General rather than cascade-deleting immutable capture evidence (AD-004).
-- ============================================================
alter table public.events
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists idx_events_project on public.events(user_id, project_id);

-- ============================================================
-- Re-declare match_events (005) with optional project scoping. Drop first so
-- the added parameters replace the function rather than creating an overload
-- (which would make unqualified rpc('match_events') calls ambiguous).
-- filter_project = a project id to scope to; filter_general = true to scope to
-- the General space (project_id is null). Both omitted = search everything.
-- ============================================================
drop function if exists public.match_events(vector, int, float);

create or replace function public.match_events(
  query_embedding vector(1536),
  match_count int default 20,
  similarity_threshold float default 0.2,
  filter_project uuid default null,
  filter_general boolean default false
)
returns table (id uuid, similarity float)
language sql
stable
as $$
  select e.id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.events e
  where e.user_id = auth.uid()
    and e.is_deleted = false
    and e.embedding is not null
    and (filter_project is null or e.project_id = filter_project)
    and (filter_general = false or e.project_id is null)
    and 1 - (e.embedding <=> query_embedding) > similarity_threshold
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
