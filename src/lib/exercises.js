// Bundled exercise library — no API key needed
// Images from wger.de open database
export const EXERCISES = [
  // Chest
  { name: 'Bench Press', muscle: 'Chest', img: 'https://wger.de/static/images/exercises/medium/chest-1.jpg' },
  { name: 'Incline Bench Press', muscle: 'Chest', img: null },
  { name: 'Decline Bench Press', muscle: 'Chest', img: null },
  { name: 'Dumbbell Fly', muscle: 'Chest', img: null },
  { name: 'Cable Fly', muscle: 'Chest', img: null },
  { name: 'Push-Up', muscle: 'Chest', img: null },
  { name: 'Chest Dip', muscle: 'Chest', img: null },
  { name: 'Incline Dumbbell Press', muscle: 'Chest', img: null },
  { name: 'Machine Chest Press', muscle: 'Chest', img: null },
  { name: 'Pec Deck', muscle: 'Chest', img: null },

  // Back
  { name: 'Pull-Up', muscle: 'Back', img: null },
  { name: 'Chin-Up', muscle: 'Back', img: null },
  { name: 'Barbell Row', muscle: 'Back', img: null },
  { name: 'Dumbbell Row', muscle: 'Back', img: null },
  { name: 'Seated Cable Row', muscle: 'Back', img: null },
  { name: 'Lat Pulldown', muscle: 'Back', img: null },
  { name: 'T-Bar Row', muscle: 'Back', img: null },
  { name: 'Deadlift', muscle: 'Back', img: null },
  { name: 'Face Pull', muscle: 'Back', img: null },
  { name: 'Hyperextension', muscle: 'Back', img: null },
  { name: 'Single-Arm Cable Row', muscle: 'Back', img: null },

  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders', img: null },
  { name: 'Dumbbell Shoulder Press', muscle: 'Shoulders', img: null },
  { name: 'Lateral Raise', muscle: 'Shoulders', img: null },
  { name: 'Front Raise', muscle: 'Shoulders', img: null },
  { name: 'Arnold Press', muscle: 'Shoulders', img: null },
  { name: 'Upright Row', muscle: 'Shoulders', img: null },
  { name: 'Cable Lateral Raise', muscle: 'Shoulders', img: null },
  { name: 'Rear Delt Fly', muscle: 'Shoulders', img: null },
  { name: 'Shrugs', muscle: 'Shoulders', img: null },

  // Biceps
  { name: 'Barbell Curl', muscle: 'Biceps', img: null },
  { name: 'Dumbbell Curl', muscle: 'Biceps', img: null },
  { name: 'Hammer Curl', muscle: 'Biceps', img: null },
  { name: 'Preacher Curl', muscle: 'Biceps', img: null },
  { name: 'Incline Dumbbell Curl', muscle: 'Biceps', img: null },
  { name: 'Cable Curl', muscle: 'Biceps', img: null },
  { name: 'Concentration Curl', muscle: 'Biceps', img: null },
  { name: 'Spider Curl', muscle: 'Biceps', img: null },

  // Triceps
  { name: 'Tricep Pushdown', muscle: 'Triceps', img: null },
  { name: 'Skull Crusher', muscle: 'Triceps', img: null },
  { name: 'Overhead Tricep Extension', muscle: 'Triceps', img: null },
  { name: 'Tricep Dip', muscle: 'Triceps', img: null },
  { name: 'Close-Grip Bench Press', muscle: 'Triceps', img: null },
  { name: 'Cable Overhead Extension', muscle: 'Triceps', img: null },
  { name: 'Diamond Push-Up', muscle: 'Triceps', img: null },

  // Legs
  { name: 'Squat', muscle: 'Legs', img: null },
  { name: 'Romanian Deadlift', muscle: 'Legs', img: null },
  { name: 'Leg Press', muscle: 'Legs', img: null },
  { name: 'Leg Extension', muscle: 'Legs', img: null },
  { name: 'Leg Curl', muscle: 'Legs', img: null },
  { name: 'Lunge', muscle: 'Legs', img: null },
  { name: 'Bulgarian Split Squat', muscle: 'Legs', img: null },
  { name: 'Calf Raise', muscle: 'Legs', img: null },
  { name: 'Hack Squat', muscle: 'Legs', img: null },
  { name: 'Sumo Squat', muscle: 'Legs', img: null },
  { name: 'Hip Thrust', muscle: 'Glutes', img: null },
  { name: 'Glute Kickback', muscle: 'Glutes', img: null },

  // Core
  { name: 'Plank', muscle: 'Core', img: null },
  { name: 'Crunch', muscle: 'Core', img: null },
  { name: 'Sit-Up', muscle: 'Core', img: null },
  { name: 'Russian Twist', muscle: 'Core', img: null },
  { name: 'Leg Raise', muscle: 'Core', img: null },
  { name: 'Ab Wheel Rollout', muscle: 'Core', img: null },
  { name: 'Cable Crunch', muscle: 'Core', img: null },
  { name: 'Hanging Knee Raise', muscle: 'Core', img: null },
  { name: 'Mountain Climber', muscle: 'Core', img: null },

  // Full Body
  { name: 'Clean and Press', muscle: 'Full Body', img: null },
  { name: 'Burpee', muscle: 'Full Body', img: null },
  { name: 'Kettlebell Swing', muscle: 'Full Body', img: null },
  { name: 'Thruster', muscle: 'Full Body', img: null },
]

export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Core', 'Full Body', 'Cardio',
]

export function searchExercises(query) {
  if (!query || query.length < 1) return []
  const q = query.toLowerCase()
  return EXERCISES.filter(e =>
    e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
  ).slice(0, 8)
}

// Matches the `exercise_key` generated column in Postgres — keep the two in step.
export function exerciseKey(name) {
  return (name || '').trim().toLowerCase()
}

// Snap a freely typed name onto an existing spelling so analytics doesn't end up
// with "Bench press" and "Bench Press" as separate exercises.
export function canonicalName(name, knownNames = []) {
  const key = exerciseKey(name)
  if (!key) return (name || '').trim()
  const match = [...knownNames, ...EXERCISES.map(e => e.name)]
    .find(n => exerciseKey(n) === key)
  return match || name.trim()
}

// The second number of a logged set, rendered in whichever metric it was
// recorded — seconds for time-based exercises, reps for everything else.
export const setDisplayValue     = (s) => s.metric === 'time'
  ? formatDuration(s.duration_seconds) : (s.reps ?? '—')
export const partnerDisplayValue = (s) => s.partner_metric === 'time'
  ? formatDuration(s.partner_duration_seconds) : (s.partner_reps ?? '—')

// Time-based exercises log seconds; everything else logs reps.
export function formatDuration(secs) {
  const n = Number(secs)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n < 60) return `${n}s`
  const m = Math.floor(n / 60), s = n % 60
  return s ? `${m}m ${s}s` : `${m}m`
}
