import { Capacitor } from '@capacitor/core'
import { HealthConnect as _hc } from '@kiwi-health/capacitor-health-connect'

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

const EXERCISE_TYPE = {
  OTHER:    0,
  BIKING:   8,
  HIIT:     32,
  RUNNING:  56,
  STRENGTH: 70,
  WALKING:  79,
}

const CARDIO_TYPE_MAP = {
  run:   EXERCISE_TYPE.RUNNING,
  walk:  EXERCISE_TYPE.WALKING,
  cycle: EXERCISE_TYPE.BIKING,
  hiit:  EXERCISE_TYPE.HIIT,
  other: EXERCISE_TYPE.OTHER,
}

function getPlugin() {
  return Capacitor.isNativePlatform() ? _hc : null
}

export function checkAvailability() {
  return Promise.resolve(Capacitor.isNativePlatform() ? 'Available' : 'NotSupported')
}

export async function requestPermissions() {
  const hc = getPlugin()
  if (!hc) return false
  try {
    const result = await withTimeout(hc.requestHealthPermissions({
      read: ['ExerciseSession', 'Steps'],
      write: ['ExerciseSession'],
    }), 60000)
    return result?.hasAllPermissions ?? false
  } catch {
    return false
  }
}

export async function hasPermissions() {
  const hc = getPlugin()
  if (!hc) return false
  try {
    const result = await withTimeout(hc.checkHealthPermissions({
      read: ['ExerciseSession', 'Steps'],
      write: ['ExerciseSession'],
    }), 5000)
    return result?.hasAllPermissions ?? false
  } catch {
    return false
  }
}

export async function hasStepsPermission() {
  const hc = getPlugin()
  if (!hc) return false
  try {
    const result = await withTimeout(hc.checkHealthPermissions({
      read: ['Steps'],
      write: [],
    }), 5000)
    return result?.hasAllPermissions ?? false
  } catch {
    return false
  }
}

export async function openSettings() {
  const hc = getPlugin()
  if (!hc) return
  try { await hc.openHealthConnectSetting() } catch {}
}

export async function readStepsToday() {
  const hc = getPlugin()
  if (!hc) return null
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const result = await withTimeout(hc.readRecords({
      type: 'Steps',
      timeRangeFilter: { startTime: start.toISOString(), endTime: new Date().toISOString() },
    }), 5000)
    return (result?.records || []).reduce((sum, r) => sum + (r.count || 0), 0)
  } catch {
    return null
  }
}

export async function readStepsHistory(days = 30) {
  const hc = getPlugin()
  if (!hc) return {}
  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    start.setHours(0, 0, 0, 0)
    const result = await withTimeout(hc.readRecords({
      type: 'Steps',
      timeRangeFilter: { startTime: start.toISOString(), endTime: end.toISOString() },
    }), 10000)
    const byDate = {}
    for (const r of result?.records || []) {
      const date = new Date(r.startTime).toISOString().split('T')[0]
      byDate[date] = (byDate[date] || 0) + (r.count || 0)
    }
    return byDate
  } catch {
    return {}
  }
}

export async function writeWorkoutSession(session) {
  const hc = getPlugin()
  if (!hc || !session?.started_at || !session?.ended_at) return false
  try {
    await hc.insertRecords({
      records: [{
        type: 'ExerciseSession',
        startTime: new Date(session.started_at),
        endTime: new Date(session.ended_at),
        exerciseType: EXERCISE_TYPE.STRENGTH,
        title: session.day_title || 'Workout',
        notes: session.notes || '',
      }],
    })
    return true
  } catch {
    return false
  }
}

export async function writeCardioSession(session) {
  const hc = getPlugin()
  if (!hc) return false
  try {
    const startTime = new Date(`${session.date}T00:00:00`)
    const endTime = session.duration_seconds
      ? new Date(startTime.getTime() + session.duration_seconds * 1000)
      : new Date(startTime.getTime() + 3_600_000)

    const records = [{
      type: 'ExerciseSession',
      startTime,
      endTime,
      exerciseType: CARDIO_TYPE_MAP[session.type] ?? EXERCISE_TYPE.OTHER,
      title: session.type.charAt(0).toUpperCase() + session.type.slice(1),
      notes: session.notes || '',
    }]

    if (session.distance_km) {
      records.push({
        type: 'Distance',
        startTime,
        endTime,
        distance: { unit: 'kilometer', value: session.distance_km },
      })
    }

    await hc.insertRecords({ records })
    return true
  } catch {
    return false
  }
}

const SYNCED_KEY = 'hc_synced'

function getSyncedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(SYNCED_KEY) || '[]')) } catch { return new Set() }
}

function addSynced(ids) {
  const s = getSyncedSet()
  ids.forEach(id => s.add(id))
  localStorage.setItem(SYNCED_KEY, JSON.stringify([...s]))
}

export async function syncAllSessions(supabase, userId) {
  const hc = getPlugin()
  if (!hc) return { synced: 0, failed: 0 }

  const already = getSyncedSet()

  const [{ data: workouts }, { data: cardios }] = await Promise.all([
    supabase.from('workout_sessions').select('*').eq('user_id', userId).not('ended_at', 'is', null),
    supabase.from('cardio_sessions').select('*').eq('user_id', userId),
  ])

  const queue = []

  for (const s of workouts || []) {
    if (already.has(s.id)) continue
    queue.push({
      id: s.id,
      records: [{
        type: 'ExerciseSession',
        startTime: new Date(s.started_at),
        endTime: new Date(s.ended_at),
        exerciseType: EXERCISE_TYPE.STRENGTH,
        title: s.day_title || 'Workout',
        notes: s.notes || '',
      }],
    })
  }

  for (const s of cardios || []) {
    const key = `c_${s.id}`
    if (already.has(key)) continue
    const startTime = new Date(`${s.date}T00:00:00`)
    const endTime = s.duration_seconds
      ? new Date(startTime.getTime() + s.duration_seconds * 1000)
      : new Date(startTime.getTime() + 3_600_000)
    const records = [{
      type: 'ExerciseSession',
      startTime,
      endTime,
      exerciseType: CARDIO_TYPE_MAP[s.type] ?? EXERCISE_TYPE.OTHER,
      title: s.type.charAt(0).toUpperCase() + s.type.slice(1),
      notes: s.notes || '',
    }]
    if (s.distance_km) {
      records.push({ type: 'Distance', startTime, endTime, distance: { unit: 'kilometer', value: s.distance_km } })
    }
    queue.push({ id: key, records })
  }

  let synced = 0, failed = 0
  for (const item of queue) {
    try {
      await hc.insertRecords({ records: item.records })
      addSynced([item.id])
      synced++
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
