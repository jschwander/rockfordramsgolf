import { supabase } from './supabase'

const NIL = '00000000-0000-0000-0000-000000000000'

/** Delete every row (admin backup restore). Uses filter so PostgREST accepts the request. */
async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().neq('id', NIL)
  if (error) throw error
}

/**
 * Export full database snapshot for backup (JSON).
 */
export async function exportDatabaseJson() {
  const [seasons, courses, players, rounds, round_scores] = await Promise.all([
    supabase.from('seasons').select('*').order('name'),
    supabase.from('courses').select('*').order('name'),
    supabase.from('players').select('*').order('season_name').order('display_order'),
    supabase.from('rounds').select('*').order('date'),
    supabase.from('round_scores').select('*'),
  ])
  if (seasons.error) throw seasons.error
  if (courses.error) throw courses.error
  if (players.error) throw players.error
  if (rounds.error) throw rounds.error
  if (round_scores.error) throw round_scores.error

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    seasons: seasons.data ?? [],
    courses: courses.data ?? [],
    players: players.data ?? [],
    rounds: rounds.data ?? [],
    round_scores: round_scores.data ?? [],
  }
}

function triggerRoundsUpdated() {
  window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
}

/**
 * Replace all data from a backup object (destructive).
 */
export async function importDatabaseJson(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid backup')
  if (!Array.isArray(data.seasons) || !Array.isArray(data.rounds)) {
    throw new Error('Backup file is missing seasons or rounds arrays')
  }

  await deleteAll('round_scores')
  await deleteAll('rounds')
  await deleteAll('players')
  await deleteAll('courses')
  await deleteAll('seasons')

  if (data.seasons.length) {
    const rows = data.seasons.map(({ id: _i, ...rest }) => rest)
    const { error } = await supabase.from('seasons').insert(rows)
    if (error) throw error
  }
  if (data.courses?.length) {
    const rows = data.courses.map(({ id: _i, ...rest }) => rest)
    const { error } = await supabase.from('courses').insert(rows)
    if (error) throw error
  }
  if (data.players?.length) {
    const rows = data.players.map(({ id: _i, ...rest }) => rest)
    const { error } = await supabase.from('players').insert(rows)
    if (error) throw error
  }

  const roundIdMap = new Map()
  if (data.rounds.length) {
    for (const r of data.rounds) {
      const oldId = r.id
      const { id: _drop, ...rest } = r
      const { data: ins, error } = await supabase
        .from('rounds')
        .insert([rest])
        .select('id')
        .single()
      if (error) throw error
      if (oldId && ins?.id) roundIdMap.set(oldId, ins.id)
    }
  }

  if (data.round_scores?.length) {
    const rows = []
    for (const rs of data.round_scores) {
      const { id: _i, round_id: rid, ...rest } = rs
      const newRid = roundIdMap.get(rid)
      if (!newRid) {
        throw new Error(
          `Backup round_scores references unknown round_id ${rid}`,
        )
      }
      rows.push({ ...rest, round_id: newRid })
    }
    const { error } = await supabase.from('round_scores').insert(rows)
    if (error) throw error
  }

  triggerRoundsUpdated()
}

export function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
