-- Feedback round: case-insensitive exercises, time-based exercises,
-- per-exercise notes.
-- Run this in your Supabase SQL editor.

-- ─── CASE-INSENSITIVE EXERCISE IDENTITY ───────────────────────────────────────
-- Exercise names are free text, so "Bench press" and "Bench Press" were treated
-- as two different exercises. These generated columns give every row a folded
-- key to group and query on. Generated columns are computed for existing rows
-- too, so no backfill is needed.
alter table session_sets  add column if not exists exercise_key text
  generated always as (lower(trim(exercise_name))) stored;
alter table session_sets  add column if not exists partner_key text
  generated always as (lower(trim(superset_partner_name))) stored;
alter table day_exercises add column if not exists exercise_key text
  generated always as (lower(trim(exercise_name))) stored;

create index if not exists session_sets_exercise_key_idx  on session_sets  (exercise_key);
create index if not exists session_sets_partner_key_idx   on session_sets  (partner_key);
create index if not exists day_exercises_exercise_key_idx on day_exercises (exercise_key);

-- ─── TIME-BASED EXERCISES ─────────────────────────────────────────────────────
-- Planks, dead hangs and the like are measured in seconds rather than reps.
-- The metric lives on day_exercises as the plan default, and is stamped onto
-- each logged set so exercises added mid-workout (which have no plan row)
-- still render correctly in history.
alter table day_exercises add column if not exists metric text default 'reps'
  check (metric in ('reps', 'time'));
alter table session_sets  add column if not exists metric text default 'reps'
  check (metric in ('reps', 'time'));
alter table session_sets  add column if not exists partner_metric text default 'reps'
  check (partner_metric in ('reps', 'time'));
alter table session_sets  add column if not exists duration_seconds int;
alter table session_sets  add column if not exists partner_duration_seconds int;

-- ─── PER-EXERCISE NOTES ───────────────────────────────────────────────────────
-- One free-text note per exercise per session, e.g. "shoulder felt off,
-- dropped to 40".
create table if not exists session_exercise_notes (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references workout_sessions(id) on delete cascade not null,
  exercise_name text not null,
  note          text not null,
  created_at    timestamptz default now(),
  unique (session_id, exercise_name)
);

create index if not exists session_exercise_notes_session_idx
  on session_exercise_notes (session_id);

alter table session_exercise_notes enable row level security;

-- Owner: full access via session ownership
create policy "exercise_notes_own" on session_exercise_notes for all using (
  exists (
    select 1 from workout_sessions s
    where s.id = session_id and s.user_id = auth.uid()
  )
);

-- Physio / shared viewer: read-only, mirroring sets_shared_read
create policy "exercise_notes_shared_read" on session_exercise_notes
  for select using (exists (
    select 1 from workout_sessions s
    join shared_access sa on sa.owner_id = s.user_id
    where s.id = session_id
      and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
  ));
