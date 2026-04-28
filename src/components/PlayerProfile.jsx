import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { calcDiff, calcPlayerStats, calcScramble } from '../utils/stats'
import { playerDisplayName } from '../utils/players'
import { ROUND_TYPES } from '../constants'
import { RoundTypeBadge } from './ui/RoundTypeBadge'
import { Tooltip } from './ui/Tooltip'
import { ProfileCharts } from './charts/ProfileCharts'

/** @typedef {{
 *   date: string,
 *   course: string,
 *   type: string,
 *   score: number|null,
 *   course_rating: number,
 *   course_slope: number,
 *   diff: number|null,
 *   ds: object|null,
 *   scramblePct: number|null,
 * }} PlayerRoundRow */

function buildDs(rs) {
  if (!rs) return null
  const keys = [
    'gir',
    'fir',
    'putts',
    'penalties',
    'updowns',
    'eagles',
    'birdies',
    'pars',
    'bogeys',
    'doubles',
    'other',
  ]
  if (!keys.some((k) => rs[k] != null && rs[k] !== '')) return null
  return {
    gir: rs.gir,
    fir: rs.fir,
    putts: rs.putts,
    penalties: rs.penalties,
    updowns: rs.updowns,
    eagles: rs.eagles ?? 0,
    birdies: rs.birdies ?? 0,
    pars: rs.pars ?? 0,
    bogeys: rs.bogeys ?? 0,
    doubles: rs.doubles ?? 0,
    other: rs.other ?? 0,
  }
}

export function PlayerProfile() {
  const { name: nameParam } = useParams()
  const navigate = useNavigate()
  const { setSeasonLine } = useOutletContext() ?? {}

  const playerName = nameParam ? decodeURIComponent(nameParam) : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [gradeLine, setGradeLine] = useState(null)
  /** @type {[PlayerRoundRow[], function]} */
  const [allRows, setAllRows] = useState([])
  const [filterTypes, setFilterTypes] = useState(
    () => new Set(ROUND_TYPES),
  )
  const [chartsOpen, setChartsOpen] = useState(false)

  const load = useCallback(async () => {
    if (!playerName) return
    setLoading(true)
    setError(null)

    const [scoresRes, playersRes] = await Promise.all([
      supabase
        .from('round_scores')
        .select(
          `
          id,
          score,
          gir,
          fir,
          putts,
          penalties,
          updowns,
          eagles,
          birdies,
          pars,
          bogeys,
          doubles,
          other,
          rounds (
            id,
            season_name,
            type,
            date,
            course_name,
            course_rating,
            course_slope
          )
        `,
        )
        .eq('player_name', playerName),
      supabase
        .from('players')
        .select('first_name,last_name,grade,season_name')
        .eq('active', true),
    ])

    if (scoresRes.error) {
      setError(scoresRes.error.message)
      setLoading(false)
      return
    }
    if (playersRes.error) {
      setError(playersRes.error.message)
      setLoading(false)
      return
    }

    const rosterMatch = (playersRes.data ?? []).find(
      (p) => playerDisplayName(p) === playerName,
    )
    setGradeLine(
      rosterMatch?.grade?.trim()
        ? rosterMatch.grade
        : `${rosterMatch?.season_name ?? '2026'} Season`,
    )

    const raw = scoresRes.data ?? []
    const mapped = raw
      .filter((row) => row.rounds)
      .map((row) => {
        const r = row.rounds
        const ds = buildDs(row)
        const diff = calcDiff(
          row.score,
          r.course_rating,
          r.course_slope,
        )
        const scramblePct =
          ds && ds.gir != null && ds.updowns != null
            ? calcScramble(ds.gir, ds.updowns)
            : null
        return {
          rowId: row.id,
          roundId: r.id,
          date: r.date,
          course: r.course_name,
          type: r.type ?? 'Practice',
          score: row.score,
          course_rating: r.course_rating,
          course_slope: r.course_slope,
          diff,
          ds,
          scramblePct,
        }
      })
      .sort((a, b) => {
        const parse = (d) => {
          const parts = String(d).split('/')
          if (parts.length >= 2) {
            const m = Number.parseInt(parts[0], 10)
            const day = Number.parseInt(parts[1], 10)
            const y = parts[2]
              ? Number.parseInt(parts[2], 10)
              : new Date().getFullYear()
            if (!Number.isNaN(m) && !Number.isNaN(day))
              return new Date(y, m - 1, day).getTime()
          }
          return 0
        }
        return parse(a.date) - parse(b.date)
      })

    setAllRows(mapped)
    setLoading(false)
  }, [playerName])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setSeasonLine?.(
      playerName
        ? `${playerName} — player profile`
        : 'Player profile',
    )
    return () => setSeasonLine?.('Season 2026 — course-adjusted performance tracker')
  }, [playerName, setSeasonLine])

  const playerRounds = useMemo(() => {
    return allRows.filter((row) => filterTypes.has(row.type ?? 'Practice'))
  }, [allRows, filterTypes])

  const chartLabels = useMemo(
    () => playerRounds.map((_, i) => `Rnd ${i + 1}`),
    [playerRounds],
  )

  const stats = useMemo(() => {
    const forCalc = playerRounds.map((r) => ({
      score: r.score,
      round: {
        course_rating: r.course_rating,
        course_slope: r.course_slope,
      },
    }))
    const ps = calcPlayerStats(forCalc)

    const avg = (arr) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    const withDs = playerRounds.filter((r) => r.ds)
    const avgGir = avg(
      withDs.map((r) => r.ds.gir).filter((v) => v != null),
    )
    const avgFir = avg(
      withDs.map((r) => r.ds.fir).filter((v) => v != null),
    )
    const avgPutts = avg(
      withDs.map((r) => r.ds.putts).filter((v) => v != null),
    )
    const avgPen = avg(
      withDs.map((r) => r.ds.penalties).filter((v) => v != null),
    )
    const scrPcts = playerRounds
      .map((r) => r.scramblePct)
      .filter((v) => v != null)
    const avgScr = scrPcts.length ? Math.round(avg(scrPcts)) : null

    const fmt = (v, dec = 1) =>
      v != null && !Number.isNaN(v) ? v.toFixed(dec) : '—'

    return {
      avgScore: ps?.avgRaw != null ? fmt(ps.avgRaw, 1) : '—',
      avgDiff: ps?.avgDiff != null ? fmt(ps.avgDiff, 2) : '—',
      avgGir: fmt(avgGir, 1),
      avgFir: fmt(avgFir, 1),
      avgPutts: fmt(avgPutts, 1),
      avgPen: fmt(avgPen, 1),
      avgScr:
        avgScr != null && !Number.isNaN(avgScr) ? `${avgScr}%` : '—',
    }
  }, [playerRounds])

  function toggleType(t) {
    setFilterTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) {
        if (next.size === 1) return prev
        next.delete(t)
      } else {
        next.add(t)
      }
      return next
    })
  }

  const statCards = [
    {
      lbl: 'Avg Score',
      val: stats.avgScore,
      tip: 'Average 9-hole raw score across all rounds in the selected filter',
    },
    {
      lbl: 'Avg Diff',
      val: stats.avgDiff,
      tip:
        'Average score differential — how many strokes above or below a scratch golfer you typically shoot, adjusted for course difficulty',
    },
    {
      lbl: 'Avg GIR',
      val: stats.avgGir,
      tip:
        'Average Greens in Regulation per round out of 9. A green is hit in regulation when you reach it in par minus 2 strokes',
    },
    {
      lbl: 'Avg FIR',
      val: stats.avgFir,
      tip:
        'Average Fairways in Regulation per round out of 9. Measures how often your tee shot lands in the fairway',
    },
    {
      lbl: 'Avg Putts',
      val: stats.avgPutts,
      tip: 'Average total putts per round. Lower is better',
    },
    {
      lbl: 'Avg Pen',
      val: stats.avgPen,
      tip:
        'Average penalty strokes per round including out of bounds, water hazards, lost balls',
    },
    {
      lbl: 'Scramble %',
      val: stats.avgScr,
      tip:
        'Percentage of times you made par or better after missing a green. Shows short game and recovery ability',
    },
  ]

  if (!playerName) {
    return (
      <p className="text-sm text-[#888888]">Missing player name.</p>
    )
  }

  if (loading) {
    return (
      <p className="text-sm text-[#888888]">Loading profile…</p>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#5e2e2e] bg-[#3a1a1a] px-4 py-3 text-sm text-[#ef5350]">
        {error}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3.5 rounded-[10px] border border-[#2a2a2a] bg-[#1A1A1A] px-4 py-3.5">
        <button
          type="button"
          className="shrink-0 rounded-md border-none bg-[#2a2a2a] px-3.5 py-2 text-[13px] font-bold text-[#aaaaaa] hover:bg-[#333333] hover:text-white"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>
        <div>
          <div className="text-[22px] font-bold text-white">{playerName}</div>
          <div className="mt-0.5 text-xs text-[#888888]">
            {gradeLine ?? '—'}
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
          Season stats
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {ROUND_TYPES.map((t) => {
            const active = filterTypes.has(t)
            const checkedClass = active
              ? {
                  Practice: 'border-[#2e5e2e] bg-[#1a3a1a] text-[#4caf50]',
                  Conference: 'border-[#1e4a8a] bg-[#1a2a4a] text-[#64b5f6]',
                  'Non-Conference':
                    'border-[#7a5010] bg-[#3a2a1a] text-[#ffb74d]',
                }[t]
              : 'border-[#333333] text-[#aaaaaa]'
            return (
              <button
                key={t}
                type="button"
                className={[
                  'flex min-h-[36px] cursor-pointer items-center rounded-full border px-3 py-1 text-[11px] font-bold transition-colors hover:bg-[#2a2a2a]',
                  checkedClass,
                ].join(' ')}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {statCards.map((s) => (
            <div
              key={s.lbl}
              className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] px-1.5 py-2.5 text-center"
            >
              <div className="text-lg font-bold text-[#E8650A]">{s.val}</div>
              <div className="mt-1 flex justify-center text-[9px] font-bold uppercase tracking-wide text-[#666666]">
                <Tooltip label={s.lbl} tip={s.tip} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="mb-3 flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] px-4 py-3 text-left transition-colors hover:border-[#E8650A] select-none"
        aria-expanded={chartsOpen}
        onClick={() => setChartsOpen((o) => !o)}
      >
        <span className="text-[11px] font-bold uppercase tracking-wide text-white">
          📊 Performance Charts
        </span>
        <span
          className={`text-[11px] text-[#888888] transition-transform ${chartsOpen ? 'rotate-180 text-[#E8650A]' : ''}`}
        >
          ▼
        </span>
      </button>
      {chartsOpen ? (
        <div className="mb-4 border border-t-0 border-[#2a2a2a] bg-[#1A1A1A] p-3 pt-0 md:border-t md:pt-3">
          <ProfileCharts labels={chartLabels} playerRounds={playerRounds} />
        </div>
      ) : null}

      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
          Round-by-round
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] py-2.5 pl-3 text-left text-[11px] font-bold text-white">
                  Date
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] py-2.5 text-center text-[11px] font-bold text-white">
                  Type
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] py-2.5 text-center text-[11px] font-bold text-white">
                  Course
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] py-2.5 text-center text-[11px] font-bold text-white">
                  Score
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] py-2.5 text-center text-[11px] font-bold text-white">
                  Diff
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="GIR"
                      tip="Greens in Regulation out of 9"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="FIR"
                      tip="Fairways in Regulation out of 9"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Putts"
                      tip="Total putts taken during the round"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Pen"
                      tip="Penalty strokes — out of bounds, hazards, lost balls"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="U&D"
                      tip="Up and Downs — times you got up and down after missing a green"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Scr%"
                      tip="Scramble % — Up & Downs divided by greens missed. Higher is better"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Eagles"
                      tip="Holes completed 2 under par"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Birdies"
                      tip="Holes completed 1 under par"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Pars"
                      tip="Holes completed at par"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Bogeys"
                      tip="Holes completed 1 over par"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Doubles"
                      tip="Holes completed 2 over par"
                    />
                  </div>
                </th>
                <th className="cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold text-white">
                  <div className="flex justify-center">
                    <Tooltip
                      label="Other"
                      tip="Holes completed 3 or more over par"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {playerRounds.length === 0 ? (
                <tr>
                  <td
                    colSpan={17}
                    className="py-8 text-center text-[#555555]"
                  >
                    No rounds found for selected filters.
                  </td>
                </tr>
              ) : (
                playerRounds.map((r) => {
                  const diffStr =
                    r.diff != null ? r.diff.toFixed(2) : '—'
                  const diffCls =
                    r.diff != null
                      ? r.diff < 3
                        ? 'text-[#4caf50]'
                        : r.diff < 6
                          ? 'text-[#E8650A]'
                          : 'text-[#ef5350]'
                      : ''
                  const ds = r.ds
                  const scr =
                    r.scramblePct != null ? `${r.scramblePct}%` : '—'
                  const dsOr = (f) =>
                    ds && ds[f] != null ? ds[f] : '—'
                  return (
                    <tr
                      key={r.rowId ?? `${r.roundId}-${r.date}`}
                      className="even:bg-[#1f1f1f] hover:bg-[#2a2a2a]"
                    >
                      <td className="border-b border-[#252525] py-2 pl-3 text-left font-semibold text-[#dddddd]">
                        {r.date}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center">
                        <RoundTypeBadge type={r.type} />
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {r.course}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {r.score ?? '—'}
                      </td>
                      <td
                        className={`border-b border-[#252525] py-2 text-center font-semibold ${diffCls}`}
                      >
                        {diffStr}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('gir')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('fir')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('putts')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('penalties')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('updowns')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {scr}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('eagles')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('birdies')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('pars')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('bogeys')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('doubles')}
                      </td>
                      <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                        {dsOr('other')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-[#555555]">
        <Link to="/individual" className="text-[#888888] hover:text-[#E8650A] hover:underline">
          Browse roster
        </Link>
      </p>
    </div>
  )
}
