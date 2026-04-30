import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../utils/supabase'
import { calcTeamScore } from '../utils/stats'
import { playerDisplayName } from '../utils/players'

const DSTAT_FIELDS = ['gir', 'fir', 'putts', 'penalties', 'updowns']
const HOLE_FIELDS = ['eagles', 'birdies', 'pars', 'bogeys', 'doubles', 'other']

function emptyDStats() {
  const d = {}
  for (const f of [...DSTAT_FIELDS, ...HOLE_FIELDS]) d[f] = ''
  return d
}

function parseOptionalInt(v) {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number.parseInt(s, 10)
  return Number.isNaN(n) ? null : n
}

/**
 * Admin: insert a new round + round_scores (same fields as EditRoundModal).
 */
export function AddRoundModal({ open, onClose, onSaved }) {
  const [seasons, setSeasons] = useState([])
  const [rosterRows, setRosterRows] = useState([])
  const [courses, setCourses] = useState([])
  const [loadErr, setLoadErr] = useState(null)
  const [loading, setLoading] = useState(false)

  const [seasonName, setSeasonName] = useState('')
  const [type, setType] = useState('Practice')
  const [date, setDate] = useState('')
  const [courseName, setCourseName] = useState('')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [finish, setFinish] = useState('')
  const [winScore, setWinScore] = useState('')
  const [scores, setScores] = useState({})
  const [dStats, setDStats] = useState({})
  const [teamScoreOverride, setTeamScoreOverride] = useState(false)
  const [teamScoreManual, setTeamScoreManual] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const orderedPlayerNames = useMemo(() => {
    return rosterRows
      .filter(
        (p) => p.season_name === seasonName && p.active !== false,
      )
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map(playerDisplayName)
      .filter((n, i, arr) => arr.indexOf(n) === i)
  }, [rosterRows, seasonName])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadErr(null)
      const [seasonRes, rosterRes, coursesRes] = await Promise.all([
        supabase.from('seasons').select('name').order('name'),
        supabase
          .from('players')
          .select(
            'first_name,last_name,season_name,display_order,active',
          )
          .eq('active', true)
          .order('season_name')
          .order('display_order'),
        supabase
          .from('courses')
          .select('id,name,full_name,rating,slope')
          .order('name'),
      ])
      if (cancelled) return
      if (seasonRes.error) {
        setLoadErr(seasonRes.error.message)
        setLoading(false)
        return
      }
      if (rosterRes.error) {
        setLoadErr(rosterRes.error.message)
        setLoading(false)
        return
      }
      if (coursesRes.error) {
        setLoadErr(coursesRes.error.message)
        setLoading(false)
        return
      }
      const snames = (seasonRes.data ?? []).map((r) => r.name)
      setSeasons(snames)
      setRosterRows(rosterRes.data ?? [])
      setCourses(coursesRes.data ?? [])
      const defaultSeason = snames.includes('2026')
        ? '2026'
        : snames[0] ?? ''
      setSeasonName(defaultSeason)
      setType('Practice')
      setDate('')
      setCourseName('')
      setRating('')
      setSlope('')
      setFinish('')
      setWinScore('')
      setScores({})
      setDStats({})
      setTeamScoreOverride(false)
      setTeamScoreManual('')
      setErr(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || loading) return
    setScores((prev) => {
      const next = {}
      for (const n of orderedPlayerNames) {
        next[n] = prev[n] ?? ''
      }
      return next
    })
  }, [open, loading, orderedPlayerNames])

  const playingPlayers = useMemo(() => {
    if (type === 'Practice') return []
    return orderedPlayerNames.filter((name) => {
      const v = scores[name]?.trim()
      return v != null && v !== ''
    })
  }, [orderedPlayerNames, scores, type])

  useEffect(() => {
    if (!open || loading) return
    if (type === 'Practice') return
    if (!playingPlayers.length) return
    setDStats((prev) => {
      const next = { ...prev }
      for (const p of playingPlayers) {
        if (!next[p]) next[p] = emptyDStats()
      }
      return next
    })
  }, [open, loading, type, playingPlayers])

  function holeSumFor(playerName) {
    const d = dStats[playerName] ?? emptyDStats()
    let total = 0
    let any = false
    for (const f of HOLE_FIELDS) {
      const n = parseOptionalInt(d[f])
      if (n != null) {
        any = true
        total += n
      }
    }
    return { total, any, ok: any ? total === 9 : null }
  }

  async function handleSave(e) {
    e.preventDefault()
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

    if (type !== 'Practice') {
      for (const playerName of playingPlayers) {
        const hs = holeSumFor(playerName)
        if (hs.any && hs.total !== 9) {
          setErr(
            `${playerName}: hole breakdown must total 9 (currently ${hs.total}).`,
          )
          setSaving(false)
          return
        }
      }
    }

    const teamScore = calcTeamScore(numericScores)
    const manualTeamScore = parseOptionalInt(teamScoreManual)
    if (teamScoreOverride && manualTeamScore == null) {
      setErr('Enter a manual Team Score, or uncheck override.')
      setSaving(false)
      return
    }
    const wsRaw =
      type !== 'Practice' && winScore.trim()
        ? parseInt(winScore, 10)
        : null

    const payload = {
      season_name: seasonName,
      type,
      date: date.trim(),
      course_name: courseName.trim(),
      course_rating: ratingNum,
      course_slope: slopeNum,
      team_score: teamScoreOverride ? manualTeamScore : teamScore,
      team_score_override: !!teamScoreOverride,
      finish:
        type !== 'Practice' && finish.trim() ? finish.trim() : null,
      win_score: Number.isFinite(wsRaw) ? wsRaw : null,
    }

    const { data: inserted, error: insRoundErr } = await supabase
      .from('rounds')
      .insert([payload])
      .select('id')
      .single()

    if (insRoundErr || !inserted?.id) {
      setErr(insRoundErr?.message ?? 'Could not create round.')
      setSaving(false)
      return
    }

    const inserts = orderedPlayerNames
      .map((player_name, i) => {
        const score = numericScores[i]
        const ds = type !== 'Practice' ? dStats[player_name] : null
        return {
          round_id: inserted.id,
          player_name,
          score,
          gir: score != null ? parseOptionalInt(ds?.gir) : null,
          fir: score != null ? parseOptionalInt(ds?.fir) : null,
          putts: score != null ? parseOptionalInt(ds?.putts) : null,
          penalties: score != null ? parseOptionalInt(ds?.penalties) : null,
          updowns: score != null ? parseOptionalInt(ds?.updowns) : null,
          eagles: score != null ? parseOptionalInt(ds?.eagles) : null,
          birdies: score != null ? parseOptionalInt(ds?.birdies) : null,
          pars: score != null ? parseOptionalInt(ds?.pars) : null,
          bogeys: score != null ? parseOptionalInt(ds?.bogeys) : null,
          doubles: score != null ? parseOptionalInt(ds?.doubles) : null,
          other: score != null ? parseOptionalInt(ds?.other) : null,
        }
      })
      .filter((row) => row.score != null)

    if (inserts.length) {
      const { error: insErr } = await supabase
        .from('round_scores')
        .insert(inserts)
      if (insErr) {
        setErr(insErr.message)
        setSaving(false)
        await supabase.from('rounds').delete().eq('id', inserted.id)
        return
      }
    }

    setSaving(false)
    onSaved?.()
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-round-title"
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
          id="add-round-title"
          className="mb-4 border-b-2 border-[#E8650A] pb-2.5 text-[15px] font-bold text-white"
        >
          Add round
        </h3>

        {loadErr ? (
          <p className="mb-3 rounded-md border border-[#5e2e2e] bg-[#3a1a1a] px-3 py-2 text-sm text-[#ef5350]">
            {loadErr}
          </p>
        ) : null}

        {loading ? (
          <p className="mb-4 text-sm text-[#888888]">Loading…</p>
        ) : (
          <>
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
                key={String(open)}
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

            <div className="mb-4 grid grid-cols-1 gap-2 border-t border-[#2a2a2a] pt-4 sm:grid-cols-3 sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                  Team Score
                </span>
                <input
                  type="number"
                  value={
                    teamScoreOverride
                      ? teamScoreManual
                      : (() => {
                          const nums = orderedPlayerNames
                            .map((n) => parseOptionalInt(scores[n]))
                            .filter((v) => v != null)
                          const auto = calcTeamScore(nums)
                          return auto != null ? String(auto) : ''
                        })()
                  }
                  disabled={!teamScoreOverride}
                  onChange={(e) => setTeamScoreManual(e.target.value)}
                  placeholder="—"
                  className={[
                    'rounded-md border px-3 py-2 text-sm text-white focus:outline-none',
                    teamScoreOverride
                      ? 'border-[#333333] bg-[#111111] focus:border-[#E8650A]'
                      : 'border-[#333333] bg-[#111111] opacity-70',
                  ].join(' ')}
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-[#aaaaaa] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={teamScoreOverride}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setTeamScoreOverride(checked)
                    if (checked) {
                      const nums = orderedPlayerNames
                        .map((n) => parseOptionalInt(scores[n]))
                        .filter((v) => v != null)
                      const auto = calcTeamScore(nums)
                      setTeamScoreManual(auto != null ? String(auto) : '')
                    }
                  }}
                  className="h-4 w-4 accent-[#E8650A]"
                />
                <span className="font-bold">Override auto-calculation</span>
              </label>
            </div>

            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              9-hole scores — blank = did not play
            </p>
            {orderedPlayerNames.length === 0 ? (
              <p className="mb-4 text-sm text-[#ef5350]">
                No active players for this season. Add players under Manage Team →
                Roster.
              </p>
            ) : (
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
                {orderedPlayerNames.map((name) => (
                  <label key={name} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] font-bold text-[#E8650A]">
                      {name}
                    </span>
                    <input
                      type="number"
                      min={20}
                      max={70}
                      placeholder="—"
                      value={scores[name] ?? ''}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [name]: e.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-[#333333] bg-[#111111] px-2 py-2 text-center text-[15px] text-white focus:border-[#E8650A] focus:outline-none"
                    />
                  </label>
                ))}
              </div>
            )}

            {type !== 'Practice' && playingPlayers.length ? (
              <div className="mb-4 border-t border-[#2a2a2a] pt-4">
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-white">
                  Detailed stats{' '}
                  <span className="text-[#888888] normal-case">
                    (Conference &amp; Non-Conference only)
                  </span>
                </div>
                <div className="space-y-3">
                  {playingPlayers.map((playerName) => {
                    const key = playerName
                    const ds = dStats[key] ?? emptyDStats()
                    const hs = holeSumFor(playerName)
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-[#333333] bg-[#111111] p-3"
                      >
                        <div className="mb-2 text-sm font-bold text-white">
                          {playerName}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {[
                            ['gir', 'GIR', 9],
                            ['fir', 'FIR', 9],
                            ['putts', 'Putts', 99],
                            ['penalties', 'Pen', 99],
                            ['updowns', 'U&D', 99],
                          ].map(([field, label, max]) => (
                            <label
                              key={field}
                              className="flex flex-col gap-1"
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                                {label}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={max}
                                value={ds[field] ?? ''}
                                placeholder="—"
                                onChange={(e) =>
                                  setDStats((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...(prev[key] ?? emptyDStats()),
                                      [field]: e.target.value,
                                    },
                                  }))
                                }
                                className="rounded-md border border-[#333333] bg-[#1A1A1A] px-2 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
                              />
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {[
                            ['eagles', 'Eagles'],
                            ['birdies', 'Birdies'],
                            ['pars', 'Pars'],
                            ['bogeys', 'Bogeys'],
                            ['doubles', 'Doubles'],
                            ['other', 'Other'],
                          ].map(([field, label]) => (
                            <label key={field} className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                                {label}
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={9}
                                value={ds[field] ?? ''}
                                placeholder="0"
                                onChange={(e) =>
                                  setDStats((prev) => ({
                                    ...prev,
                                    [key]: {
                                      ...(prev[key] ?? emptyDStats()),
                                      [field]: e.target.value,
                                    },
                                  }))
                                }
                                className="rounded-md border border-[#333333] bg-[#1A1A1A] px-2 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
                              />
                            </label>
                          ))}
                        </div>

                        {hs.ok === null ? null : (
                          <div
                            className={[
                              'mt-2 text-xs font-bold',
                              hs.ok ? 'text-[#4caf50]' : 'text-[#ef5350]',
                            ].join(' ')}
                          >
                            Hole total: {hs.total}/9 {hs.ok ? '✓' : '— must equal 9'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

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
                disabled={
                  saving || loading || !!loadErr || orderedPlayerNames.length === 0
                }
                className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white hover:bg-[#B84E07] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add round'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
