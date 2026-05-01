import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { calcPlayerStats } from '../utils/stats'
import { Tooltip } from './ui/Tooltip'
import { ROUND_TYPES } from '../constants'
import {
  addDaysUtc,
  startOfThisMonthUtcYMD,
  todayUtcYMD,
} from '../utils/dates'

const CONSIST_ORDER = { Elite: 0, Strong: 1, Average: 2, Inconsistent: 3 }

function playerDisplayName(row) {
  return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.first_name
}

function sortValue(row, key) {
  switch (key) {
    case 'avgDiff':
      return row.avgDiff ?? Number.POSITIVE_INFINITY
    case 'hcap':
      return row.hcap ?? Number.POSITIVE_INFINITY
    case 'trendVal':
      if (row.trendVal == null) return null
      return row.trendVal
    case 'projLow':
      if (row.projLow != null && row.projHigh != null) {
        return row.projHigh - row.projLow
      }
      return Number.POSITIVE_INFINITY
    case 'bestRaw':
      return row.bestRaw ?? Number.POSITIVE_INFINITY
    case 'worstRaw':
      return row.worstRaw ?? Number.POSITIVE_INFINITY
    case 'rounds':
      return row.rounds ?? 0
    case 'consist':
      return CONSIST_ORDER[row.consist] ?? 99
    case 'avgRaw':
      return row.avgRaw ?? Number.POSITIVE_INFINITY
    default:
      return 0
  }
}

function compareSortRows(a, b, key, dir) {
  const av = sortValue(a, key)
  const bv = sortValue(b, key)
  const na = av === null || av === undefined || Number.isNaN(av)
  const nb = bv === null || bv === undefined || Number.isNaN(bv)
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  if (av !== bv) return dir * (av - bv)
  return 0
}

export function Leaderboard() {
  const { setSeasonLine } = useOutletContext() ?? {}
  const [seasons, setSeasons] = useState([])
  const [roster, setRoster] = useState([])
  const [rounds, setRounds] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [filterSeason, setFilterSeason] = useState('all')
  const [filterTypes, setFilterTypes] = useState(
    () => new Set(ROUND_TYPES),
  )
  const [datePreset, setDatePreset] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortKey, setSortKey] = useState('avgRaw')
  const [sortDir, setSortDir] = useState(1)

  const resolvedRange = useMemo(() => {
    const today = todayUtcYMD()
    if (datePreset === 'all') return { from: null, to: null }
    if (datePreset === 'last30')
      return { from: addDaysUtc(today, -30), to: today }
    if (datePreset === 'thisMonth')
      return { from: startOfThisMonthUtcYMD(), to: today }
    if (datePreset === 'custom')
      return {
        from: fromDate.trim() || null,
        to: toDate.trim() || null,
      }
    return { from: null, to: null }
  }, [datePreset, fromDate, toDate])

  const loadData = useCallback(async () => {
    setLoadError(null)
    const roundsQ = supabase
      .from('rounds')
      .select(`
          id,
          season_name,
          type,
          date,
          course_name,
          course_rating,
          course_slope,
          round_scores ( player_name, score )
        `)
      .order('date', { ascending: true })
    if (resolvedRange.from) roundsQ.gte('date', resolvedRange.from)
    if (resolvedRange.to) roundsQ.lte('date', resolvedRange.to)

    const [seasonRes, rosterRes, roundsRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select('first_name,last_name,season_name,display_order,active')
        .eq('active', true)
        .order('season_name')
        .order('display_order'),
      roundsQ,
    ])
    if (seasonRes.error) {
      setLoadError(seasonRes.error.message)
      return
    }
    if (rosterRes.error) {
      setLoadError(rosterRes.error.message)
      return
    }
    if (roundsRes.error) {
      setLoadError(roundsRes.error.message)
      return
    }
    setSeasons((seasonRes.data ?? []).map((r) => r.name))
    setRoster(rosterRes.data ?? [])
    setRounds(roundsRes.data ?? [])
  }, [resolvedRange.from, resolvedRange.to])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const fn = () => loadData()
    window.addEventListener('rams:rounds-updated', fn)
    return () => window.removeEventListener('rams:rounds-updated', fn)
  }, [loadData])

  const filteredRounds = useMemo(() => {
    return rounds.filter(
      (r) =>
        (filterSeason === 'all' || r.season_name === filterSeason) &&
        filterTypes.has(r.type ?? 'Practice'),
    )
  }, [rounds, filterSeason, filterTypes])

  const playerOrder = useMemo(() => {
    const fromScores = new Set()
    for (const r of filteredRounds) {
      for (const rs of r.round_scores ?? []) {
        if (rs.player_name) fromScores.add(rs.player_name)
      }
    }
    if (filterSeason !== 'all') {
      const ordered = roster
        .filter((p) => p.season_name === filterSeason)
        .map(playerDisplayName)
      const out = []
      const seen = new Set()
      for (const n of ordered) {
        if (!seen.has(n)) {
          seen.add(n)
          out.push(n)
        }
      }
      for (const n of fromScores) {
        if (!seen.has(n)) out.push(n)
      }
      return out
    }
    const out = []
    const seen = new Set()
    for (const p of roster) {
      const n = playerDisplayName(p)
      if (!seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    for (const n of fromScores) {
      if (!seen.has(n)) out.push(n)
    }
    return out
  }, [filteredRounds, roster, filterSeason])

  const rows = useMemo(() => {
    const byPlayer = {}
    for (const name of playerOrder) {
      byPlayer[name] = []
    }
    for (const r of filteredRounds) {
      for (const rs of r.round_scores ?? []) {
        const name = rs.player_name
        if (!name) continue
        if (!byPlayer[name]) byPlayer[name] = []
        byPlayer[name].push({
          score: rs.score,
          round: {
            course_rating: r.course_rating,
            course_slope: r.course_slope,
          },
        })
      }
    }
    const nameList = [
      ...playerOrder.filter((n) => byPlayer[n]?.length),
      ...Object.keys(byPlayer)
        .filter((n) => !playerOrder.includes(n))
        .sort((a, b) => a.localeCompare(b)),
    ]
    const list = []
    for (const name of nameList) {
      const arr = byPlayer[name]
      if (!arr.length) continue
      const stats = calcPlayerStats(arr)
      if (!stats) continue
      list.push({
        name,
        rank: 0,
        ...stats,
      })
    }
    list.sort((a, b) => {
      const c = compareSortRows(a, b, sortKey, sortDir)
      if (c !== 0) return c
      return a.name.localeCompare(b.name)
    })
    return list.map((s, i) => ({ ...s, rank: i + 1 }))
  }, [filteredRounds, playerOrder, sortKey, sortDir])

  const seasonSubtitle =
    filterSeason === 'all'
      ? 'All seasons — course-adjusted performance tracker'
      : `Season ${filterSeason} — course-adjusted performance tracker`

  useEffect(() => {
    setSeasonLine?.(seasonSubtitle)
  }, [seasonSubtitle, setSeasonLine])

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

  function setSort(nextKey) {
    setSortKey((prev) => {
      if (prev === nextKey) {
        setSortDir((d) => -d)
        return prev
      }
      setSortDir(1)
      return nextKey
    })
  }

  const sortButtons = [
    { key: 'avgRaw', label: 'Avg Score' },
    { key: 'avgDiff', label: 'Avg Differential' },
    { key: 'trendVal', label: 'Trending' },
    { key: 'hcap', label: 'Handicap' },
    { key: 'projLow', label: 'Proj Range' },
    { key: 'bestRaw', label: 'Best Score' },
    { key: 'consist', label: 'Consistency' },
  ]

  if (loadError) {
    return (
      <div className="rounded-lg border border-[#5e2e2e] bg-[#3a1a1a] px-4 py-3 text-sm text-[#ef5350]">
        <p className="font-bold">Could not load data</p>
        <p className="mt-1 text-[#ccc]">{loadError}</p>
        <p className="mt-2 text-xs text-[#888]">
          Run the Section 4 SQL in Supabase and confirm{' '}
          <code className="text-[#E8650A]">.env</code> has{' '}
          <code className="text-[#E8650A]">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-[#E8650A]">VITE_SUPABASE_PUBLISHABLE_KEY</code>
          .
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3.5 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
          Team leaderboard
        </div>

        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
            Season:
          </span>
          {['all', ...seasons].map((s) => (
            <button
              key={s}
              type="button"
              className={[
                'rounded-full border px-3.5 py-1 text-xs font-bold transition-colors',
                filterSeason === s
                  ? 'border-[#E8650A] bg-[#E8650A] text-white'
                  : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white',
              ].join(' ')}
              onClick={() => setFilterSeason(s)}
            >
              {s === 'all' ? 'All-Time' : s}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
            Type:
          </span>
          {ROUND_TYPES.map((t) => {
            const active = filterTypes.has(t)
            const key = t.replace(/-/g, '').replace(/ /g, '').toLowerCase()
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
                  'flex min-h-[36px] cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors hover:bg-[#2a2a2a]',
                  checkedClass,
                ].join(' ')}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            )
          })}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
            Date:
          </span>
          {[
            ['all', 'All'],
            ['last30', 'Last 30 days'],
            ['thisMonth', 'This month'],
            ['custom', 'Custom'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={[
                'rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
                datePreset === key
                  ? 'border-[#E8650A] bg-[#E8650A] text-white'
                  : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white',
              ].join(' ')}
              onClick={() => setDatePreset(key)}
            >
              {label}
            </button>
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
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
            Sort:
          </span>
          {sortButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={[
                'whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
                sortKey === key
                  ? 'border-[#E8650A] bg-[#E8650A] text-white'
                  : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white',
              ].join(' ')}
              onClick={() => setSort(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-[1] cursor-default select-none border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 pl-3 text-left text-[11px] font-bold text-white">
                  Rank
                </th>
                <th className="sticky left-12 z-[1] cursor-default select-none border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-left text-[11px] font-bold text-white">
                  Player
                </th>
                <HeaderCell
                  label="Avg Score"
                  tip="Average 9-hole score, no course adjustment."
                  sorted={sortKey === 'avgRaw'}
                  dir={sortDir}
                  onSort={() => setSort('avgRaw')}
                />
                <HeaderCell
                  label="Avg Diff"
                  tip="How many strokes above/below scratch, adjusted for course difficulty."
                  sorted={sortKey === 'avgDiff'}
                  dir={sortDir}
                  onSort={() => setSort('avgDiff')}
                />
                <HeaderCell
                  label="Trend (L4)"
                  tip="Last 4 rounds vs overall average. ▲ = improving (lower diff). ▼ = higher diff lately."
                  sorted={sortKey === 'trendVal'}
                  dir={sortDir}
                  onSort={() => setSort('trendVal')}
                />
                <HeaderCell
                  label="Handicap"
                  tip="Avg of 3 best diffs — peak potential, not typical performance."
                  sorted={sortKey === 'hcap'}
                  dir={sortDir}
                  onSort={() => setSort('hcap')}
                />
                <HeaderCell
                  label="Proj Range"
                  tip="Typical score window from avg ± stddev. Smaller = more consistent."
                  sorted={sortKey === 'projLow'}
                  dir={sortDir}
                  onSort={() => setSort('projLow')}
                />
                <HeaderCell
                  label="Best Score"
                  tip="Lowest 9-hole score in the selected filter."
                  sorted={sortKey === 'bestRaw'}
                  dir={sortDir}
                  onSort={() => setSort('bestRaw')}
                />
                <HeaderCell
                  label="Worst Score"
                  tip="Highest 9-hole score in the selected filter."
                  sorted={sortKey === 'worstRaw'}
                  dir={sortDir}
                  onSort={() => setSort('worstRaw')}
                />
                <HeaderCell
                  label="Consistency"
                  tip="Elite &lt;2 | Strong &lt;3 | Average &lt;4 | Inconsistent 4+ (diff stddev)."
                  sorted={sortKey === 'consist'}
                  dir={sortDir}
                  onSort={() => setSort('consist')}
                />
                <HeaderCell
                  label="Rounds"
                  tip="Total rounds in the selected filter."
                  sorted={sortKey === 'rounds'}
                  dir={sortDir}
                  onSort={() => setSort('rounds')}
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.name}
                  className="even:bg-[#1f1f1f] hover:bg-[#2a2a2a]"
                >
                  <td className="sticky left-0 z-[1] border-b border-[#252525] bg-[#111111] px-2 py-2 pl-3 even:bg-[#1a1a1a]">
                    <span
                      className={[
                        'inline-flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold',
                        s.rank <= 3
                          ? s.rank === 1
                            ? 'bg-[#FFD700] text-[#7a5c00]'
                            : s.rank === 2
                              ? 'bg-[#C0C0C0] text-[#333333]'
                              : 'bg-[#CD7F32] text-white'
                          : 'bg-[#2a2a2a] text-[#aaaaaa]',
                      ].join(' ')}
                    >
                      {s.rank}
                    </span>
                  </td>
                  <td className="sticky left-12 z-[1] border-b border-[#252525] bg-[#111111] px-2 py-2 text-left font-bold text-white even:bg-[#1a1a1a]">
                    <Link
                      to={`/player/${encodeURIComponent(s.name)}`}
                      className="text-white hover:text-[#E8650A] hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                    {s.avgRaw != null ? s.avgRaw.toFixed(1) : '—'}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                    {s.avgDiff != null ? (
                      <span
                        className={
                          s.avgDiff < 3
                            ? 'font-bold text-[#4caf50]'
                            : s.avgDiff < 6
                              ? 'font-semibold text-[#E8650A]'
                              : 'font-semibold text-[#ef5350]'
                        }
                      >
                        {s.avgDiff.toFixed(2)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center">
                    {s.trend == null ? (
                      <span className="text-[13px] text-[#888888]">—</span>
                    ) : s.trend === 'up' ? (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[15px] font-bold text-[#4caf50]">
                          ▲
                        </span>
                        <span className="text-[10px] text-[#666666]">
                          {Math.abs(s.trendVal).toFixed(2)}
                        </span>
                      </div>
                    ) : s.trend === 'down' ? (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[15px] font-bold text-[#ef5350]">
                          ▼
                        </span>
                        <span className="text-[10px] text-[#666666]">
                          {Math.abs(s.trendVal).toFixed(2)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-[13px] text-[#888888]">—</span>
                        <span className="text-[10px] text-[#666666]">
                          {Math.abs(s.trendVal).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                    {s.hcap != null ? s.hcap.toFixed(1) : '—'}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center">
                    {s.projLow != null && s.projHigh != null ? (
                      <span className="text-xs font-bold text-[#E8650A]">
                        <span className="text-[#4caf50]">{s.projLow}</span>
                        {' – '}
                        <span className="text-[#ef5350]">{s.projHigh}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center font-bold text-[#4caf50]">
                    {s.bestRaw ?? '—'}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center font-semibold text-[#ef5350]">
                    {s.worstRaw ?? '—'}
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center">
                    <span
                      className={
                        s.consist === 'Elite'
                          ? 'font-bold text-[#4caf50]'
                          : s.consist === 'Strong'
                            ? 'font-semibold text-[#E8650A]'
                            : s.consist === 'Average'
                              ? 'text-[#aaaaaa]'
                              : 'font-semibold text-[#ef5350]'
                      }
                    >
                      {s.consist}
                    </span>
                  </td>
                  <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                    {s.rounds}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="col-hint mt-2 text-[10px] italic text-[#444444]">
          Click column headers to sort. Sort bar matches default prototype.
        </p>
      </div>

    </div>
  )
}

function HeaderCell({ label, tip, sorted, dir, onSort }) {
  return (
    <th
      className={[
        'cursor-pointer select-none border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap hover:text-[#E8650A]',
        sorted ? 'text-[#E8650A]' : 'text-white',
      ].join(' ')}
      onClick={(e) => {
        e.stopPropagation()
        onSort()
      }}
    >
      <Tooltip label={label} tip={tip} />
      <span className={`ml-0.5 text-[9px] ${sorted ? 'opacity-100' : 'opacity-50'}`}>
        {sorted ? (dir === 1 ? '▲' : '▼') : '▲'}
      </span>
    </th>
  )
}
