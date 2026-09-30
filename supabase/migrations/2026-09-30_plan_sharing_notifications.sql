-- Plan sharing between users + in-app notifications
-- Run this in your Supabase SQL editor

-- ─── PLAN SHARES ──────────────────────────────────────────────────────────────
-- A user sends one of their plans to someone else's login email. When the
-- recipient accepts, a full copy of the plan is created in their account.
create table if not exists plan_shares (
  id              uuid primary key default uuid_generate_v4(),
  plan_id         uuid references workout_plans(id) on delete cascade not null,
  plan_name       text not null,
  sender_id       uuid references auth.users(id) on delete cascade not null,
  sender_email    text not null,
  recipient_email text not null,
  message         text,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  copied_plan_id  uuid references workout_plans(id) on delete set null,
  created_at      timestamptz default now(),
  responded_at    timestamptz
);

-- Only one pending share of the same plan per recipient
create unique index if not exists plan_shares_one_pending
  on plan_shares (plan_id, lower(recipient_email)) where status = 'pending';

alter table plan_shares enable row level security;

-- Helpers run as definer so the policies below don't recurse into each other
-- (plan_shares checks workout_plans, workout_plans checks plan_shares).
create or replace function owns_plan(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from workout_plans where id = pid and user_id = auth.uid())
$$;

create or replace function has_pending_plan_share(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_shares
    where plan_id = pid and status = 'pending'
      and lower(recipient_email) = lower(auth.jwt() ->> 'email')
  )
$$;

-- Sender manages shares of their own plans
create policy "plan_shares_sender_all" on plan_shares
  for all using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id and owns_plan(plan_id));

-- Recipient can see shares addressed to their login email
-- (accept/decline go through the functions below)
create policy "plan_shares_recipient_read" on plan_shares
  for select using (lower(recipient_email) = lower(auth.jwt() ->> 'email'));

-- Recipient can preview a plan while the share is pending
create policy "plans_shared_preview" on workout_plans
  for select using (has_pending_plan_share(id));

create policy "days_shared_preview" on workout_days
  for select using (has_pending_plan_share(plan_id));

create policy "day_exercises_shared_preview" on day_exercises
  for select using (exists (
    select 1 from workout_days d
    where d.id = day_exercises.day_id and has_pending_plan_share(d.plan_id)
  ));

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
-- Messages from other users. Created only by the triggers/functions below,
-- so users can't send arbitrary notifications to each other.
create table if not exists notifications (
  id              uuid primary key default uuid_generate_v4(),
  recipient_email text not null,
  sender_id       uuid references auth.users(id) on delete set null,
  sender_email    text,
  type            text not null,  -- plan_shared | plan_accepted | plan_declined
  title           text not null,
  body            text,
  plan_share_id   uuid references plan_shares(id) on delete cascade,
  read            boolean not null default false,
  created_at      timestamptz default now()
);

create index if not exists notifications_recipient_idx
  on notifications (lower(recipient_email), created_at desc);

alter table notifications enable row level security;

create policy "notifications_recipient_read" on notifications
  for select using (lower(recipient_email) = lower(auth.jwt() ->> 'email'));
create policy "notifications_recipient_update" on notifications
  for update using (lower(recipient_email) = lower(auth.jwt() ->> 'email'))
  with check (lower(recipient_email) = lower(auth.jwt() ->> 'email'));
create policy "notifications_recipient_delete" on notifications
  for delete using (lower(recipient_email) = lower(auth.jwt() ->> 'email'));

-- Live updates for the notification bell
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when others then null;
end $$;

-- ─── NOTIFY RECIPIENT WHEN A PLAN IS SHARED ───────────────────────────────────
create or replace function notify_plan_shared() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_email, sender_id, sender_email, type, title, body, plan_share_id)
  values (
    lower(new.recipient_email), new.sender_id, new.sender_email, 'plan_shared',
    new.sender_email || ' shared a workout plan with you',
    coalesce(nullif(new.message, ''), '"' || new.plan_name || '"'),
    new.id
  );
  return new;
end $$;

drop trigger if exists plan_shares_notify on plan_shares;
create trigger plan_shares_notify after insert on plan_shares
  for each row execute function notify_plan_shared();

-- ─── ACCEPT: COPY THE PLAN INTO THE RECIPIENT'S ACCOUNT ───────────────────────
create or replace function accept_plan_share(share_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s        plan_shares%rowtype;
  src      workout_plans%rowtype;
  new_plan uuid;
  d        record;
  new_day  uuid;
  me       text := lower(auth.jwt() ->> 'email');
begin
  select * into s from plan_shares where id = share_id for update;
  if not found or lower(s.recipient_email) <> me then
    raise exception 'Share not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'This share was already %', s.status;
  end if;

  select * into src from workout_plans where id = s.plan_id;
  if not found then
    raise exception 'The shared plan no longer exists';
  end if;

  insert into workout_plans (user_id, name, description, is_active)
  values (auth.uid(), src.name, src.description, false)
  returning id into new_plan;

  for d in select * from workout_days where plan_id = src.id order by day_number loop
    insert into workout_days (plan_id, day_number, title, muscle_groups)
    values (new_plan, d.day_number, d.title, d.muscle_groups)
    returning id into new_day;

    insert into day_exercises (day_id, exercise_name, exercise_image_url, muscle_group,
                               order_index, is_superset, superset_group, notes)
    select new_day, exercise_name, exercise_image_url, muscle_group,
           order_index, is_superset, superset_group, notes
    from day_exercises where day_id = d.id;
  end loop;

  update plan_shares
    set status = 'accepted', copied_plan_id = new_plan, responded_at = now()
    where id = share_id;

  update notifications set read = true where plan_share_id = share_id and lower(recipient_email) = me;

  insert into notifications (recipient_email, sender_id, sender_email, type, title, body, plan_share_id)
  values (lower(s.sender_email), auth.uid(), me, 'plan_accepted',
          me || ' accepted your plan', '"' || s.plan_name || '"', share_id);

  return new_plan;
end $$;

-- ─── DECLINE ──────────────────────────────────────────────────────────────────
create or replace function decline_plan_share(share_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s  plan_shares%rowtype;
  me text := lower(auth.jwt() ->> 'email');
begin
  select * into s from plan_shares where id = share_id for update;
  if not found or lower(s.recipient_email) <> me then
    raise exception 'Share not found';
  end if;
  if s.status <> 'pending' then
    raise exception 'This share was already %', s.status;
  end if;

  update plan_shares set status = 'declined', responded_at = now() where id = share_id;
  update notifications set read = true where plan_share_id = share_id and lower(recipient_email) = me;

  insert into notifications (recipient_email, sender_id, sender_email, type, title, body, plan_share_id)
  values (lower(s.sender_email), auth.uid(), me, 'plan_declined',
          me || ' declined your plan', '"' || s.plan_name || '"', share_id);
end $$;

grant execute on function accept_plan_share(uuid)  to authenticated;
grant execute on function decline_plan_share(uuid) to authenticated;
