# Feedback fix plan

Triage of the 12 open `feedback`-labelled issues in `githintz/workout-tracker`,
as of 2026-07-25. Six of them were already fixed by earlier commits and just
never got closed. Five need real work, and one has a residual gap.

## Triage

### Already shipped — close, no code needed

| Issue | Ask | Where it landed |
|---|---|---|
| #1 | Click a calendar day to see that day's workout | `CalendarHeatmap` day select + session list, `src/pages/AnalyticsPage.jsx:205-253` |
| #3 | Click a history entry to see details without the edit menu | `HistoryTab` card `onView` → `SessionDetailModal`, `src/pages/AnalyticsPage.jsx:889` and `:43-167` |
| #4 | Add a one-off exercise mid-workout | `+ Add` pill and `addCustomExercise`, `src/pages/TrackPage.jsx:517-527` and `:669-672` |
| #6 | Edit a workout's end time from history | `EditSessionModal` start/end `datetime-local` inputs, `src/pages/AnalyticsPage.jsx:811-824` |
| #11 | Entry section overflows, forces horizontal scroll | Commit `2b6a2eb`, `min-w-0` on the weight/reps inputs, `src/pages/TrackPage.jsx:173-184` |
| #10 | "Nice work dude" | No action |

Each of these should get a short closing comment pointing at the commit, so the
list reflects reality.

### Needs work

- **#2** — Exercises list in the Exercises tab is missing exercises.
- **#13** — Exercise names are case-sensitive, so analytics splits `Bench press`
  from `Bench Press`; also asks for renaming an exercise across history.
- **#14** — Show previous workout details when picking an exercise in Analytics.
- **#15** — Some exercises are measured in seconds, not reps.
- **#16** — Add a comment per exercise while tracking.
- **#5** — Partially fixed. `SessionDetailModal` renders both halves of a
  superset (`src/pages/AnalyticsPage.jsx:118-137`), but `EditSessionModal` still
  groups purely by `exercise_name` and shows a single weight/reps pair
  (`:802-856`), so editing a superset workout hides the B side.

## Root causes

**#2** has two independent causes:

1. `src/pages/AnalyticsPage.jsx:962` fetches sets with
   `.order('completed_at').limit(2000)`. That ascending order means the query
   returns the *oldest* 2000 sets, so once history passes that mark, recently
   logged exercises silently stop appearing in the dropdown and in the charts.
2. The dropdown is built only from `allSets` (`:442-446`), so an exercise that
   exists in a plan but has never been logged never shows up at all.

**#13** stems from `exercise_name` being free text compared with exact equality
everywhere: `.eq('exercise_name', name)` in `ExerciseHistoryModal`
(`src/pages/TrackPage.jsx:73`), the `prevSetsMap` keyed by raw name
(`src/pages/TrackPage.jsx:474-479`), and the `Set`/filter grouping in
`ExercisesTab`. Custom names are typed freely in three places
(`TrackPage.addCustomExercise`, `PlanEditPage.ExerciseSearch`, and the same
component in `PlanBuilderPage`), none of which snap to an existing spelling.

## Plan

### Phase 0 — housekeeping

Close #1, #3, #4, #6, #10, #11 with a comment naming the commit that fixed each.
Nothing to build.

### Phase 1 — one schema migration

All the remaining features need schema changes, so do them in a single
`supabase/migrations/2026-07-25_feedback_round.sql` that gets run once in the
Supabase SQL editor (matching the pattern of the existing physio migration).

```sql
-- Case-insensitive exercise identity
alter table session_sets  add column if not exists exercise_key text
  generated always as (lower(trim(exercise_name))) stored;
alter table session_sets  add column if not exists partner_key text
  generated always as (lower(trim(superset_partner_name))) stored;
alter table day_exercises add column if not exists exercise_key text
  generated always as (lower(trim(exercise_name))) stored;
create index if not exists session_sets_exercise_key_idx on session_sets (exercise_key);
create index if not exists session_sets_partner_key_idx  on session_sets (partner_key);

-- Time-based exercises
alter table day_exercises add column if not exists metric text default 'reps'
  check (metric in ('reps', 'time'));
alter table session_sets  add column if not exists metric text default 'reps'
  check (metric in ('reps', 'time'));
alter table session_sets  add column if not exists duration_seconds int;
alter table session_sets  add column if not exists partner_duration_seconds int;

-- Per-exercise comments
create table if not exists session_exercise_notes (
  id            uuid primary key default uuid_generate_v4(),
  session_id    uuid references workout_sessions(id) on delete cascade not null,
  exercise_name text not null,
  note          text not null,
  created_at    timestamptz default now(),
  unique (session_id, exercise_name)
);
alter table session_exercise_notes enable row level security;
create policy "exercise_notes_own" on session_exercise_notes for all using (
  exists (select 1 from workout_sessions s
          where s.id = session_id and s.user_id = auth.uid())
);
create policy "exercise_notes_shared_read" on session_exercise_notes
  for select using (exists (
    select 1 from workout_sessions s join shared_access sa on sa.owner_id = s.user_id
    where s.id = session_id and lower(sa.viewer_email) = lower(auth.jwt() ->> 'email')
  ));
```

Two things worth noting. Generated columns compute for existing rows
automatically, so #13 needs no backfill script. And the physio read policy has
to be added for the new notes table, otherwise shared viewers get a partial
picture — the existing `sessions_shared_read` / `sets_shared_read` policies in
`supabase/schema.sql:171-190` are the model.

Mirror all of it into `supabase/schema.sql` so fresh installs match.

### Phase 2 — the two quick wins (#2, #14)

**#2.** In the `AnalyticsPage` loader (`:958-976`), flip the sets query to
`.order('completed_at', { ascending: false }).limit(5000)` so the newest history
is what survives truncation, and add a fourth query for plan exercise names
(`day_exercises` joined through `workout_days` → `workout_plans` filtered to the
user). Union those names into the `ExercisesTab` dropdown, deduplicating on
`exercise_key` and displaying the most recently used spelling. Exercises with no
logged sets should still be selectable — they just land on the existing
"Not enough data" empty state.

**#14.** Add a "Recent sessions" card to `ExercisesTab`, above the PR card. The
data is already in `rawSets`: group by session date, sort newest first, take the
last five, and render each set as `weight × reps`. Also add a one-line "Last
session" summary at the top of the card, since the actual ask is "tell me what
weight to use" — that answer should be readable without scanning a table. No new
query needed.

### Phase 3 — case-insensitive names and rename (#13)

Two halves.

*Matching.* Switch every exercise lookup to the new key. `ExerciseHistoryModal`
queries become `.eq('exercise_key', key)` / `.eq('partner_key', key)`
(`src/pages/TrackPage.jsx:71-80`); `prevSetsMap` gets keyed by
`lower(trim(name))` with lookups normalized the same way
(`src/pages/TrackPage.jsx:474-479`, read at `:683` and `:692`); `ExercisesTab`
groups on the key rather than the raw string. Display keeps using the stored
name so nothing gets visually lowercased.

*Prevention.* When a custom name is typed, snap it to an existing exercise whose
key matches — in `TrackPage.addCustomExercise` (`:517-527`) and in the
`ExerciseSearch` "Add as custom" branch used by both `PlanEditPage.jsx:38-42`
and `PlanBuilderPage`. This is what stops new variants from being created; the
key column only papers over the ones that already exist.

*Rename.* Add a rename action to the Exercises tab, next to the selector. Three
updates, all filtered by the current key: `session_sets.exercise_name`,
`session_sets.superset_partner_name`, and `day_exercises.exercise_name`. RLS
scopes each to the current user automatically, so no RPC is needed — but the
three statements are not atomic, so the UI should refetch and show the result
rather than assume success.

### Phase 4 — per-exercise comments (#16)

Add a note button to the `ExerciseEntry` and `SupersetEntry` headers
(`src/pages/TrackPage.jsx:282-329` and `:196-279`), opening a small sheet with a
textarea, with a filled-in indicator when a note exists. Hold notes in a
`notes` map in `TrackPage` state alongside `sets`, include it in the
`lift_workout` localStorage blob (`:370-379`) so an interrupted workout doesn't
lose them, and upsert the non-empty ones in `finishWorkout` (`:529-586`) in the
same pass that writes `session_sets`.

Then surface them: per-exercise in `SessionDetailModal`, and in
`ExerciseHistoryModal` so last week's "shoulder felt off, dropped to 40" is
visible while deciding today's weight. That readback is the whole point of the
feature — writing notes nobody sees again isn't worth building.

### Phase 5 — time-based exercises (#15)

Add a reps/time toggle per exercise in the plan editors (`PlanEditPage.jsx:197-205`
and the equivalent list in `PlanBuilderPage`), persisted to `day_exercises.metric`
in the save path (`PlanEditPage.jsx:147-150`).

In `TrackPage`, `SetRow` takes a `metric` prop and renders a seconds input
instead of the reps input when `metric === 'time'`, with the locked-row summary
reading `45s` rather than `45 reps`. `finishWorkout` writes `duration_seconds`
instead of `reps` and stamps `metric` on the row. Stamping the metric on
`session_sets` (not just `day_exercises`) is what makes history render correctly
for exercises added mid-workout, which have no plan row at all. The mid-workout
add sheet (`:726-749`) needs the same toggle.

Downstream, anything that computes reps-based numbers has to opt out for time
exercises: est. 1RM, max reps, and volume load in `ExercisesTab` are meaningless
for a plank. Show duration progression and total time under load instead, and
hide the 1RM card.

### Phase 6 — superset editing (#5 residual)

Rework `EditSessionModal`'s grouping (`src/pages/AnalyticsPage.jsx:802-856`) to
detect `superset_partner_name` and render four inputs per row (A weight/reps,
B weight/reps), the way `SessionDetailModal` already displays them. `addSet` has
to carry `superset_partner_name` onto new rows, or added sets silently
degrade to singles on save.

While in there, two hardening items worth folding in. `save()` deletes all sets
before inserting the new ones (`:784-795`), so a failed insert loses the
workout — wrap it so the delete only commits if the insert succeeds, or write
the new rows first. And `parseFloat(s.weight) || null` turns a legitimate
bodyweight `0` into `null`; it should test for empty string instead.

## Suggested order

Phase 0 is free and makes the issue list honest. Phase 1 unblocks everything
else and is a single SQL run, so it should go in before any UI work. Phase 2 is
the highest value per hour — a real bug plus the most-requested convenience —
and needs no schema beyond the ordering fix. Phases 3 through 5 are independent
of each other and can ship in any order. Phase 6 is small and can ride along
with whichever phase lands next.

Verification is manual: `npm run lint` and `npm run build` catch nothing about
behaviour here, and there is no test suite in the repo, so each phase needs a
pass through the affected screens against a real Supabase instance.
