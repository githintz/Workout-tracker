-- Workout Tracker Schema
-- Run this in your Supabase SQL editor

-- Enable RLS helper
create extension if not exists "uuid-ossp";

-- ─── WORKOUT PLANS ────────────────────────────────────────────────────────────
create table if not exists workout_plans (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  is_active   boolean default false,
  created_at  timestamptz default now()
);

-- ─── WORKOUT DAYS ─────────────────────────────────────────────────────────────
create table if not exists workout_days (
  id            uuid primary key default uuid_generate_v4(),
  plan_id       uuid references workout_plans(id) on delete cascade not null,
  day_number    int not null,
  title         text not null,
  muscle_groups text[] default '{}',
  created_at    timestamptz default now()
);

-- ─── DAY EXERCISES ────────────────────────────────────────────────────────────
create table if not exists day_exercises (
  id                 uuid primary key default uuid_generate_v4(),
  day_id             uuid references workout_days(id) on delete cascade not null,
  exercise_name      text not null,
  exercise_image_url text,
  muscle_group       text,
  order_index        int not null default 0,
  is_superset        boolean default false,
  superset_group     text,              -- shared UUID string for paired exercises
  notes              text,
  created_at         timestamptz default now()
);

-- ─── WORKOUT SESSIONS ─────────────────────────────────────────────────────────
create table if not exists workout_sessions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  plan_id          uuid references workout_plans(id) on delete set null,
  day_id           uuid references workout_days(id) on delete set null,
  plan_name        text,
  day_title        text,
  muscle_groups    text[] default '{}',
  started_at       timestamptz default now(),
  ended_at         timestamptz,
  duration_seconds int,
  notes            text
);

-- ─── SESSION SETS ─────────────────────────────────────────────────────────────
create table if not exists session_sets (
  id                    uuid primary key default uuid_generate_v4(),
  session_id            uuid references workout_sessions(id) on delete cascade not null,
  exercise_name         text not null,
  set_number            int not null,
  weight                numeric(6,2),
  reps                  int,
  superset_partner_name text,
  partner_weight        numeric(6,2),
  partner_reps          int,
  completed_at          timestamptz default now()
);

-- ─── CARDIO SESSIONS ──────────────────────────────────────────────────────────
create table if not exists cardio_sessions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid references auth.users(id) on delete cascade not null,
  type             text not null check (type in ('run', 'hiit', 'cycle', 'walk', 'other')),
  date             date not null default current_date,
  duration_seconds int,
  distance_km      numeric(6,2),
  notes            text,
  created_at       timestamptz default now()
);

-- ─── HIIT SETS ────────────────────────────────────────────────────────────────
create table if not exists hiit_sets (
  id                     uuid primary key default uuid_generate_v4(),
  cardio_session_id      uuid references cardio_sessions(id) on delete cascade not null,
  speed_high             numeric(5,2),
  speed_low              numeric(5,2),
  high_duration_seconds  int,
  low_duration_seconds   int,
  reps                   int
);

-- ─── USER SETTINGS ────────────────────────────────────────────────────────────
create table if not exists user_settings (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references auth.users(id) on delete cascade not null unique,
  rest_timer_seconds  int default 90,
  weight_unit         text default 'kg' check (weight_unit in ('kg', 'lbs')),
  updated_at          timestamptz default now()
);

-- ─── FEEDBACK ─────────────────────────────────────────────────────────────────
create table if not exists feedback (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete set null,
  page       text not null,
  message    text not null,
  status     text default 'pending' check (status in ('pending', 'done', 'dismissed')),
  created_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
alter table workout_plans    enable row level security;
alter table workout_days     enable row level security;
alter table day_exercises    enable row level security;
alter table workout_sessions enable row level security;
alter table session_sets     enable row level security;
alter table cardio_sessions  enable row level security;
alter table hiit_sets        enable row level security;
alter table user_settings    enable row level security;

-- Plans: own rows only
create policy "plans_own" on workout_plans for all using (auth.uid() = user_id);
-- Days: via plan ownership
create policy "days_own" on workout_days for all using (
  exists (select 1 from workout_plans p where p.id = plan_id and p.user_id = auth.uid())
);
-- Day exercises: via day → plan
create policy "day_exercises_own" on day_exercises for all using (
  exists (
    select 1 from workout_days d
    join workout_plans p on p.id = d.plan_id
    where d.id = day_id and p.user_id = auth.uid()
  )
);
-- Sessions: own rows
create policy "sessions_own" on workout_sessions for all using (auth.uid() = user_id);
-- Sets: via session
create policy "sets_own" on session_sets for all using (
  exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid())
);
-- Cardio: own rows
create policy "cardio_own" on cardio_sessions for all using (auth.uid() = user_id);
-- HIIT sets: via cardio session
create policy "hiit_own" on hiit_sets for all using (
  exists (select 1 from cardio_sessions c where c.id = cardio_session_id and c.user_id = auth.uid())
);
-- Settings: own row
create policy "settings_own" on user_settings for all using (auth.uid() = user_id);
-- Feedback: own rows
alter table feedback enable row level security;
create policy "feedback_own" on feedback for all using (auth.uid() = user_id);
