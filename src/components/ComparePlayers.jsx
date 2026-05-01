import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import '../chartSetup'
import { supabase } from '../utils/supabase'
import { ROUND_TYPES } from '../constants'
import { calcDiff, calcPlayerStats, calcScramble } from '../utils/stats'
import { playerDisplayName } from '../utils/players'
import {
  addDaysUtc,
  formatDateMD,
  startOfThisMonthUtcYMD,
  todayUtcYMD,
} from '../utils/dates'
import {
  FILTER_BAR_ROUND_TYPE_TONE,
  FilterBarDivider,
  FilterBarGroup,
  FilterBarLabel,
  FilterBarPill,
  FilterBarRow,
} from './ui/FilterBar'

const ORANGE = '#E8650A'

function avg(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function fmtNum(v, dec = 2) {
  return v != null && Number.isFinite(v) ? v.toFixed(dec) : '—'
}

function fmtInt(v) {
  return v != null && Number.isFinite(v) ? String(Math.round(v)) : '—'
}

function isBetter(a, b, betterIs) {
  if (a == null || b == null) return null
  if (a === b) return null
  if (betterIs === 'lower') return a < b
  if (betterIs === 'higher') return a > b
  return null
}

const CONSIST_RANK = {
  Elite: 4,
  Strong: 3,
  Average: 2,
  Inconsistent: 1,
}

function consistToRank(s) {
  return CONSIST_RANK[s] ?? null
}

function valueClass(outcome) {
  if (outcome === true) return 'text-[#4caf50]'
  if (outcome === false) return 'text-[#ef5350]'
  return 'text-[#dddddd]'
}

function resolveRange(datePreset, fromDate, toDate) {
  const today = todayUtcYMD()
  if (datePreset === 'all') return { from: null, to: null }
  if (datePreset === 'last30') return { from: addDaysUtc(today, -30), to: today }
  if (datePreset === 'thisMonth') return { from: startOfThisMonthUtcYMD(), to: today }
  if (datePreset === 'custom')
    return { from: fromDate.trim() || null, to: toDate.trim() || null }
  return { from: null, to: null }
}

function buildLineData({ labels, p1, p2, yLabel, key, color1, color2 }) {
  const mapSeries = (arr) => {
    const m = new Map()
    for (const r of arr) m.set(r.date, r[key])
    return m
  }
  const m1 = mapSeries(p1)
  const m2 = mapSeries(p2)
  return {
    labels,
    datasets: [
      {
        label: 'Player 1',
        data: labels.map((d) => (m1.has(d) ? m1.get(d) : null)),
        borderColor: color1,
        backgroundColor: 'transparent',
        pointBackgroundColor: color1,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
        spanGaps: true,
      },
      {
        label: 'Player 2',
        data: labels.map((d) => (m2.has(d) ? m2.get(d) : null)),
        borderColor: color2,
        backgroundColor: 'transparent',
        pointBackgroundColor: color2,
        pointRadius: 4,
        tension: 0.3,
        fill: false,
        spanGaps: true,
      },
    ],
    _meta: { yLabel },
  }
}

function chartOpts() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#888888', font: { size: 9 }, boxWidth: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#888888', font: { size: 9 } },
        grid: { color: '#2a2a2a' },
        border: { color: '#2a2a2a' },
      },
      y: {
        ticks: { color: '#888888', font: { size: 9 } },
        grid: { color: '#2a2a2a' },
        border: { color: '#2a2a2a' },
        beginAtZero: false,
      },
    },
  }
}

export function ComparePlayers() {
  const { setSeasonLine } = useOutletContext() ?? {}

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [seasons, setSeasons] = useState([])
  const [season, setSeason] = useState('2026')
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])

  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [typeFilter, setTypeFilter] = useState(() => new Set(ROUND_TYPES))
  const [datePreset, setDatePreset] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const range = useMemo(
    () => resolveRange(datePreset, fromDate, toDate),
    [datePreset, fromDate, toDate],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const roundsQ = supabase
      .from('rounds')
      .select(
        `
          id,
          season_name,
          type,
          date,
          course_name,
          course_rating,
          course_slope,
          round_scores (
            player_name,
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
            other
          )
        `,
      )
      .order('date', { ascending: true })

    if (range.from) roundsQ.gte('date', range.from)
    if (range.to) roundsQ.lte('date', range.to)

    const [seasonRes, playersRes, roundsRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select('first_name,last_name,season_name,display_order,active')
        .eq('active', true)
        .order('display_order'),
      roundsQ,
    ])

    if (seasonRes.error) {
      setError(seasonRes.error.message)
      setLoading(false)
      return
    }
    if (playersRes.error) {
      setError(playersRes.error.message)
      setLoading(false)
      return
    }
    if (roundsRes.error) {
      setError(roundsRes.error.message)
      setLoading(false)
      return
    }

    setSeasons((seasonRes.data ?? []).map((r) => r.name))
    setPlayers(playersRes.data ?? [])
    setRounds(roundsRes.data ?? [])
    setLoading(false)
  }, [range.from, range.to])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setSeasonLine?.('Compare players — head-to-head')
    return () =>
      setSeasonLine?.('Season 2026 — course-adjusted performance tracker')
  }, [setSeasonLine])

  useEffect(() => {
    if (!seasons.length) return
    setSeason((prev) => {
      if (seasons.includes(prev)) return prev
      if (seasons.includes('2026')) return '2026'
      return seasons[seasons.length - 1]
    })
  }, [seasons])

  const rosterForSeason = useMemo(() => {
    return players
      .filter((p) => p.season_name === season)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((p) => playerDisplayName(p))
      .filter(Boolean)
  }, [players, season])

  useEffect(() => {
    // If season changes and selected players aren’t in that roster, clear them.
    setPlayer1((p) => (p && rosterForSeason.includes(p) ? p : ''))
    setPlayer2((p) => (p && rosterForSeason.includes(p) ? p : ''))
  }, [rosterForSeason])

  function toggleType(t) {
    setTypeFilter((prev) => {
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

  const filteredRounds = useMemo(() => {
    return rounds.filter((r) => {
      if (r.season_name !== season) return false
      if (!typeFilter.has(r.type ?? 'Practice')) return false
      return true
    })
  }, [rounds, season, typeFilter])

  const playerSeries = useCallback(
    (playerName) => {
      if (!playerName) return []
      const out = []
      for (const r of filteredRounds) {
        const rs = (r.round_scores ?? []).find(
          (x) => (x.player_name ?? '').trim() === playerName,
        )
        if (!rs || rs.score == null) continue
        const diff = calcDiff(rs.score, r.course_rating, r.course_slope)
        const ds =
          rs.gir != null ||
          rs.fir != null ||
          rs.putts != null ||
          rs.penalties != null ||
          rs.updowns != null
            ? {
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
            : null
        const scramblePct =
          ds && ds.gir != null && ds.updowns != null
            ? calcScramble(ds.gir, ds.updowns)
            : null
        out.push({
          date: r.date,
          dateLabel: formatDateMD(r.date),
          type: r.type ?? 'Practice',
          course: r.course_name,
          score: rs.score,
          diff: diff != null ? Number.parseFloat(diff.toFixed(2)) : null,
          ds,
          scramblePct,
          _forStats: {
            score: rs.score,
            round: { course_rating: r.course_rating, course_slope: r.course_slope },
          },
        })
      }
      out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      return out
    },
    [filteredRounds],
  )

  const p1Rounds = useMemo(() => playerSeries(player1), [player1, playerSeries])
  const p2Rounds = useMemo(() => playerSeries(player2), [player2, playerSeries])

  const p1Stats = useMemo(() => {
    const forCalc = p1Rounds.map((r) => r._forStats)
    return calcPlayerStats(forCalc)
  }, [p1Rounds])

  const p2Stats = useMemo(() => {
    const forCalc = p2Rounds.map((r) => r._forStats)
    return calcPlayerStats(forCalc)
  }, [p2Rounds])

  const p1Advanced = useMemo(() => {
    const withDs = p1Rounds.filter((r) => r.ds)
    if (!withDs.length) return null
    const avgGir = avg(withDs.map((r) => r.ds.gir).filter((v) => v != null))
    const avgFir = avg(withDs.map((r) => r.ds.fir).filter((v) => v != null))
    const avgPutts = avg(withDs.map((r) => r.ds.putts).filter((v) => v != null))
    const avgPen = avg(
      withDs.map((r) => r.ds.penalties).filter((v) => v != null),
    )
    const avgUd = avg(withDs.map((r) => r.ds.updowns).filter((v) => v != null))
    const scrAvg = avg(
      withDs.map((r) => r.scramblePct).filter((v) => v != null),
    )
    return { avgGir, avgFir, avgPutts, avgPen, avgUd, scrAvg }
  }, [p1Rounds])

  const p2Advanced = useMemo(() => {
    const withDs = p2Rounds.filter((r) => r.ds)
    if (!withDs.length) return null
    const avgGir = avg(withDs.map((r) => r.ds.gir).filter((v) => v != null))
    const avgFir = avg(withDs.map((r) => r.ds.fir).filter((v) => v != null))
    const avgPutts = avg(withDs.map((r) => r.ds.putts).filter((v) => v != null))
    const avgPen = avg(
      withDs.map((r) => r.ds.penalties).filter((v) => v != null),
    )
    const avgUd = avg(withDs.map((r) => r.ds.updowns).filter((v) => v != null))
    const scrAvg = avg(
      withDs.map((r) => r.scramblePct).filter((v) => v != null),
    )
    return { avgGir, avgFir, avgPutts, avgPen, avgUd, scrAvg }
  }, [p2Rounds])

  const canRender = Boolean(player1 && player2)

  const compareRows = useMemo(() => {
    if (!canRender) return []

    const projRange = (s) =>
      s?.projLow != null && s?.projHigh != null ? `${s.projLow}–${s.projHigh}` : '—'

    const rows = [
      {
        label: 'Avg Score',
        v1: p1Stats?.avgRaw ?? null,
        v2: p2Stats?.avgRaw ?? null,
        betterIs: 'lower',
        fmt: (v) => (v != null ? v.toFixed(1) : '—'),
      },
      {
        label: 'Avg Diff',
        v1: p1Stats?.avgDiff ?? null,
        v2: p2Stats?.avgDiff ?? null,
        betterIs: 'lower',
        fmt: (v) => fmtNum(v, 2),
      },
      {
        label: 'Trend (L4)',
        v1: p1Stats?.trendVal ?? null,
        v2: p2Stats?.trendVal ?? null,
        betterIs: 'lower',
        fmt: (v) => fmtNum(v, 2),
      },
      {
        label: 'Handicap',
        v1: p1Stats?.hcap ?? null,
        v2: p2Stats?.hcap ?? null,
        betterIs: 'lower',
        fmt: (v) => fmtNum(v, 2),
      },
      {
        label: 'Proj Range',
        v1: p1Stats,
        v2: p2Stats,
        betterIs: null,
        fmt: (s) => projRange(s),
      },
      {
        label: 'Best Score',
        v1: p1Stats?.bestRaw ?? null,
        v2: p2Stats?.bestRaw ?? null,
        betterIs: 'lower',
        fmt: (v) => fmtInt(v),
      },
      {
        label: 'Worst Score',
        v1: p1Stats?.worstRaw ?? null,
        v2: p2Stats?.worstRaw ?? null,
        betterIs: 'lower',
        fmt: (v) => fmtInt(v),
      },
      {
        label: 'Consistency',
        v1: consistToRank(p1Stats?.consist),
        v2: consistToRank(p2Stats?.consist),
        betterIs: 'higher',
        fmt: () => p1Stats?.consist ?? '—',
        fmt2: () => p2Stats?.consist ?? '—',
      },
      {
        label: 'Rounds',
        v1: p1Stats?.rounds ?? null,
        v2: p2Stats?.rounds ?? null,
        betterIs: 'higher',
        fmt: (v) => fmtInt(v),
      },
    ]

    return rows
  }, [canRender, p1Stats, p2Stats])

  const advancedRows = useMemo(() => {
    if (!canRender || !p1Advanced || !p2Advanced) return null
    return [
      { label: 'Avg GIR', v1: p1Advanced.avgGir, v2: p2Advanced.avgGir, betterIs: 'higher', fmt: (v) => fmtNum(v, 1) },
      { label: 'Avg FIR', v1: p1Advanced.avgFir, v2: p2Advanced.avgFir, betterIs: 'higher', fmt: (v) => fmtNum(v, 1) },
      { label: 'Avg Putts', v1: p1Advanced.avgPutts, v2: p2Advanced.avgPutts, betterIs: 'lower', fmt: (v) => fmtNum(v, 1) },
      { label: 'Avg Penalties', v1: p1Advanced.avgPen, v2: p2Advanced.avgPen, betterIs: 'lower', fmt: (v) => fmtNum(v, 1) },
      { label: 'Avg U&D', v1: p1Advanced.avgUd, v2: p2Advanced.avgUd, betterIs: 'higher', fmt: (v) => fmtNum(v, 1) },
      { label: 'Scramble %', v1: p1Advanced.scrAvg, v2: p2Advanced.scrAvg, betterIs: 'higher', fmt: (v) => (v != null ? `${Math.round(v)}%` : '—') },
    ]
  }, [canRender, p1Advanced, p2Advanced])

  const chartLabels = useMemo(() => {
    const set = new Set()
    for (const r of p1Rounds) set.add(r.date)
    for (const r of p2Rounds) set.add(r.date)
    return [...set].sort()
  }, [p1Rounds, p2Rounds])

  const scoreChart = useMemo(() => {
    if (!canRender) return null
    return buildLineData({
      labels: chartLabels,
      p1: p1Rounds,
      p2: p2Rounds,
      yLabel: 'Score',
      key: 'score',
      color1: ORANGE,
      color2: '#ffffff',
    })
  }, [canRender, chartLabels, p1Rounds, p2Rounds])

  const diffChart = useMemo(() => {
    if (!canRender) return null
    return buildLineData({
      labels: chartLabels,
      p1: p1Rounds,
      p2: p2Rounds,
      yLabel: 'Diff',
      key: 'diff',
      color1: ORANGE,
      color2: '#ffffff',
    })
  }, [canRender, chartLabels, p1Rounds, p2Rounds])

  if (loading) return <p className="text-sm text-[#888888]">Loading compare…</p>
  if (error) {
    return (
      <div className="rounded-lg border border-[#5e2e2e] bg-[#3a1a1a] px-4 py-3 text-sm text-[#ef5350]">
        {error}
      </div>
    )
  }

  return (
    <div>
      <FilterBarRow className="mb-4">
        <FilterBarGroup>
          <FilterBarLabel>Season:</FilterBarLabel>
          {seasons.map((s) => (
            <FilterBarPill key={s} active={season === s} onClick={() => setSeason(s)}>
              {s}
            </FilterBarPill>
          ))}
        </FilterBarGroup>
      </FilterBarRow>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
            Select Player 1
          </div>
          <select
            value={player1}
            onChange={(e) => setPlayer1(e.target.value)}
            className="mt-2 w-full rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm font-bold text-white"
          >
            <option value="">—</option>
            {rosterForSeason.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
            Select Player 2
          </div>
          <select
            value={player2}
            onChange={(e) => setPlayer2(e.target.value)}
            className="mt-2 w-full rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm font-bold text-white"
          >
            <option value="">—</option>
            {rosterForSeason.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <FilterBarRow>
        <FilterBarGroup>
          <FilterBarLabel>Type:</FilterBarLabel>
          {ROUND_TYPES.map((t) => (
            <FilterBarPill
              key={t}
              tone={FILTER_BAR_ROUND_TYPE_TONE[t]}
              active={typeFilter.has(t)}
              onClick={() => toggleType(t)}
            >
              {t}
            </FilterBarPill>
          ))}
        </FilterBarGroup>
        <FilterBarDivider />
        <FilterBarGroup>
          <FilterBarLabel>Date:</FilterBarLabel>
          {[
            ['all', 'All'],
            ['last30', 'Last 30 days'],
            ['thisMonth', 'This month'],
            ['custom', 'Custom'],
          ].map(([k, lbl]) => (
            <FilterBarPill key={k} active={datePreset === k} onClick={() => setDatePreset(k)}>
              {lbl}
            </FilterBarPill>
          ))}
          {datePreset === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-[#888888]">
                From
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-md border border-[#333333] bg-[#111111] px-2 py-1 text-xs text-white"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-[#888888]">
                To
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-md border border-[#333333] bg-[#111111] px-2 py-1 text-xs text-white"
                />
              </label>
            </div>
          ) : null}
        </FilterBarGroup>
      </FilterBarRow>

      {!canRender ? (
        <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4 text-sm text-[#888888]">
          Select two players to compare.
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
            <div className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
              Comparison
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#888888]">
                      Metric
                    </th>
                    <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                      {player1}
                    </th>
                    <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                      {player2}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => {
                    const better = row.betterIs ? isBetter(row.v1, row.v2, row.betterIs) : null
                    const v1Txt = row.fmt ? row.fmt(row.v1) : '—'
                    const v2Txt = row.fmt2 ? row.fmt2(row.v2) : row.fmt ? row.fmt(row.v2) : '—'
                    return (
                      <tr key={row.label} className="even:bg-[#1f1f1f]">
                        <td className="border-b border-[#252525] px-3 py-2 text-[13px] font-bold text-[#dddddd]">
                          {row.label}
                        </td>
                        <td className={`border-b border-[#252525] px-3 py-2 text-center font-bold ${valueClass(better)}`}>
                          {v1Txt}
                        </td>
                        <td className={`border-b border-[#252525] px-3 py-2 text-center font-bold ${valueClass(better === null ? null : !better)}`}>
                          {v2Txt}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {advancedRows ? (
            <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
              <div className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
                Advanced stats
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-[#888888]">
                        Metric
                      </th>
                      <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                        {player1}
                      </th>
                      <th className="border-b border-[#252525] bg-[#111111] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white">
                        {player2}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {advancedRows.map((row) => {
                      const better = isBetter(row.v1, row.v2, row.betterIs)
                      return (
                        <tr key={row.label} className="even:bg-[#1f1f1f]">
                          <td className="border-b border-[#252525] px-3 py-2 text-[13px] font-bold text-[#dddddd]">
                            {row.label}
                          </td>
                          <td className={`border-b border-[#252525] px-3 py-2 text-center font-bold ${valueClass(better)}`}>
                            {row.fmt(row.v1)}
                          </td>
                          <td className={`border-b border-[#252525] px-3 py-2 text-center font-bold ${valueClass(better === null ? null : !better)}`}>
                            {row.fmt(row.v2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
            <div className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
              Charts
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
                <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
                  Score trend (season)
                </div>
                <div className="relative h-[220px]">
                  {scoreChart ? <Line data={scoreChart} options={chartOpts()} /> : null}
                </div>
                <p className="mt-2 text-center text-[10px] text-[#666666]">
                  X-axis dates: {chartLabels.map((d) => formatDateMD(d)).join(' · ') || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
                <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
                  Differential trend (season)
                </div>
                <div className="relative h-[220px]">
                  {diffChart ? <Line data={diffChart} options={chartOpts()} /> : null}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

