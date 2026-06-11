-- Physiotherapist read-only sharing
-- Run this in your Supabase SQL editor

-- ─── SHARED ACCESS ────────────────────────────────────────────────────────────
-- Owner grants a viewer (e.g. their physiotherapist) read-only access to logs.
create table if not exists shared_access (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid references auth.users(id) on delete cascade not null,
  owner_email  text not null,
  viewer_email text not null,
  created_at   timestamptz default now(),
  unique (owner_id, viewer_email)
);

alter table shared_access enable row level security;

-- Owner manages their own grants
create policy "shared_owner_all" on shared_access
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Viewer can see grants addressed to their login email
create policy "shared_viewer_read" on shared_access
  for select using (lower(viewer_email) = lower(auth.jwt() ->> 'email'));

-- ─── READ-ONLY POLICIES FOR VIEWERS ──────────────────────────────────────────
-- Viewers get SELECT only; insert/update/delete remain owner-only.

create policy "sessions_shared_read" on workout_sessions
  for select using (
    exists (
      select 1 from shared_access sa
      where sa.owner_id = user_id
        and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "sets_shared_read" on session_sets
  for select using (
    exists (
      select 1 from workout_sessions s
      join shared_access sa on sa.owner_id = s.user_id
      where s.id = session_id
        and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "cardio_shared_read" on cardio_sessions
  for select using (
    exists (
      select 1 from shared_access sa
      where sa.owner_id = user_id
        and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
    )
  );

create policy "hiit_shared_read" on hiit_sets
  for select using (
    exists (
      select 1 from cardio_sessions c
      join shared_access sa on sa.owner_id = c.user_id
      where c.id = cardio_session_id
        and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
    )
  );
