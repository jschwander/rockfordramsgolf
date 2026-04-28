import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabase'
import { calcTeamScore } from '../utils/stats'
import { playerDisplayName } from '../utils/players'

/**
 * Simplified round editor: core fields + per-player scores (matches prototype workflow).
 * Detailed stats (GIR/FIR/…) stay unchanged in DB unless we add inputs later.
 */
export function EditRoundModal({
  round,
  seasons,
  rosterRows,
  courses,
  open,
  onClose,
  onSaved,
}) {
  const [seasonName, setSeasonName] = useState('')
  const [type, setType] = useState('Practice')
  const [date, setDate] = useState('')
  const [courseName, setCourseName] = useState('')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [finish, setFinish] = useState('')
  const [winScore, setWinScore] = useState('')
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const orderedPlayerNames = useMemo(() => {
    if (!round) return []
    const rsNames = (round.round_scores ?? []).map((r) => r.player_name)
    const rosterForSeason = rosterRows
      .filter((p) => p.season_name === round.season_name && p.active !== false)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(playerDisplayName)
    const seen = new Set()
    const out = []
    for (const n of rosterForSeason) {
      if (!seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    for (const n of rsNames) {
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }, [round, rosterRows])

  useEffect(() => {
    if (!open || !round) return
    setSeasonName(round.season_name ?? '')
    setType(round.type ?? 'Practice')
    setDate(round.date ?? '')
    setCourseName(round.course_name ?? '')
    setRating(round.course_rating != null ? String(round.course_rating) : '')
    setSlope(round.course_slope != null ? String(round.course_slope) : '')
    setFinish(round.finish ?? '')
    setWinScore(round.win_score != null ? String(round.win_score) : '')
    const map = {}
    for (const rs of round.round_scores ?? []) {
      if (rs.player_name && rs.score != null) map[rs.player_name] = String(rs.score)
      else if (rs.player_name) map[rs.player_name] = ''
    }
    for (const n of orderedPlayerNames) {
      if (!(n in map)) map[n] = ''
    }
    setScores(map)
    setErr(null)
  }, [open, round, orderedPlayerNames])

  async function handleSave(e) {
    e.preventDefault()
    if (!round) return
    setErr(null)
    setSaving(true)

    const ratingNum = parseFloat(rating)
    const slopeNum = parseInt(slope, 10)
    if (!date.trim()) {
      setErr('Date is required.')
      setSaving(false)
      return
    }
    if (!courseName.trim()) {
      setErr('Course name is required.')
      setSaving(false)
      return
    }
    if (Number.isNaN(ratingNum) || Number.isNaN(slopeNum)) {
      setErr('Valid rating and slope are required.')
      setSaving(false)
      return
    }

    const numericScores = orderedPlayerNames.map((name) => {
      const v = scores[name]?.trim()
      if (v === '') return null
      const n = parseInt(v, 10)
      return Number.isNaN(n) ? null : n
    })

    if (numericScores.every((s) => s == null)) {
      setErr('Enter at least one score.')
      setSaving(false)
      return
    }

    const teamScore = calcTeamScore(numericScores)

    const payload = {
      season_name: seasonName,
      type,
      date: date.trim(),
      course_name: courseName.trim(),
      course_rating: ratingNum,
      course_slope: slopeNum,
      team_score: teamScore,
      finish:
        type !== 'Practice' && finish.trim() ? finish.trim() : null,
      win_score:
        type !== 'Practice' && winScore.trim()
          ? parseInt(winScore, 10)
          : null,
    }

    const { error: upErr } = await supabase
      .from('rounds')
      .update(payload)
      .eq('id', round.id)

    if (upErr) {
      setErr(upErr.message)
      setSaving(false)
      return
    }

    const { error: delErr } = await supabase
      .from('round_scores')
      .delete()
      .eq('round_id', round.id)

    if (delErr) {
      setErr(delErr.message)
      setSaving(false)
      return
    }

    const inserts = orderedPlayerNames
      .map((player_name, i) => ({
        round_id: round.id,
        player_name,
        score: numericScores[i],
      }))
      .filter((row) => row.score != null)

    if (inserts.length) {
      const { error: insErr } = await supabase.from('round_scores').insert(inserts)
      if (insErr) {
        setErr(insErr.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
    onClose()
  }

  if (!open || !round) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-round-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        className="my-auto w-full max-w-[560px] rounded-xl border border-[#333333] bg-[#1A1A1A] p-6"
        onSubmit={handleSave}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="edit-round-title"
          className="mb-4 border-b-2 border-[#E8650A] pb-2.5 text-[15px] font-bold text-white"
        >
          Edit round
        </h3>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Season
            </span>
            <select
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Type
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
            >
              <option value="Practice">Practice</option>
              <option value="Conference">Conference</option>
              <option value="Non-Conference">Non-Conference</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Date
            </span>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              placeholder="e.g. 4/13"
              required
            />
          </label>
        </div>

        <label className="mb-3 flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
            Course catalog (optional)
          </span>
          <select
            className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value
              if (!id) return
              const c = courses.find((x) => x.id === id)
              if (c) {
                setCourseName(c.full_name ?? c.name)
                setRating(String(c.rating))
                setSlope(String(c.slope))
              }
            }}
          >
            <option value="">— Fill from catalog —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Course name
            </span>
            <input
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Rating (18h)
            </span>
            <input
              type="number"
              step="0.1"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Slope
            </span>
            <input
              type="number"
              value={slope}
              onChange={(e) => setSlope(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            />
          </label>
        </div>

        {type !== 'Practice' ? (
          <div className="mb-4 grid grid-cols-1 gap-3 border-t border-[#2a2a2a] pt-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                Finish (e.g. 1st)
              </span>
              <input
                value={finish}
                onChange={(e) => setFinish(e.target.value)}
                className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                Winning team score (1st score)
              </span>
              <input
                type="number"
                value={winScore}
                onChange={(e) => setWinScore(e.target.value)}
                className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              />
            </label>
          </div>
        ) : null}

        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#888888]">
          9-hole scores — blank = did not play
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {orderedPlayerNames.map((name) => (
            <label key={name} className="flex flex-col items-center gap-1">
              <span className="text-[11px] font-bold text-[#E8650A]">{name}</span>
              <input
                type="number"
                min={20}
                max={70}
                placeholder="—"
                value={scores[name] ?? ''}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [name]: e.target.value }))
                }
                className="w-full rounded-md border border-[#333333] bg-[#111111] px-2 py-2 text-center text-[15px] text-white focus:border-[#E8650A] focus:outline-none"
              />
            </label>
          ))}
        </div>

        {err ? (
          <p className="mb-3 rounded-md border border-[#5e2e2e] bg-[#3a1a1a] px-3 py-2 text-sm text-[#ef5350]">
            {err}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm font-bold text-[#aaaaaa] hover:bg-[#2a2a2a]"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white hover:bg-[#B84E07] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
