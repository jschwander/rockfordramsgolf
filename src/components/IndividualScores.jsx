import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { calcPlayerStats, calcScramble } from '../utils/stats'
import { playerDisplayName, playerInitials } from '../utils/players'
import {
  addDaysUtc,
  startOfThisMonthUtcYMD,
  todayUtcYMD,
} from '../utils/dates'
import { Tooltip } from './ui/Tooltip'
import {
  FilterBarDivider,
  FilterBarGroup,
  FilterBarLabel,
  FilterBarPill,
  FilterBarRow,
} from './ui/FilterBar'

function parseSortNumber(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function avg(arr) {
  if (!arr.length) return null
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function compareAdvancedRows(a, b, key, dir) {
  const isString = key === 'player'
  const av = a[key]
  const bv = b[key]
  const na =
    av === null ||
    av === undefined ||
    Number.isNaN(av) ||
    (isString && String(av).trim() === '')
  const nb =
    bv === null ||
    bv === undefined ||
    Number.isNaN(bv) ||
    (isString && String(bv).trim() === '')

  // Missing values always sort to bottom (both directions).
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1

  if (isString) return dir * String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' })
  if (av !== bv) return dir * (av - bv)
  return 0
}

export function IndividualScores() {
  console.log('[IndividualScores] render')
  const { setSeasonLine } = useOutletContext() ?? {}

  const [seasons, setSeasons] = useState([])
  const [seasonFilter, setSeasonFilter] = useState('2026')
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [detailedScoreRows, setDetailedScoreRows] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [datePreset, setDatePreset] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortKey, setSortKey] = useState('avgGir')
  const [sortDir, setSortDir] = useState(-1)

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

  const loadData = useCallback(async () => {
    console.log('[IndividualScores] loadData: starting Supabase parallel fetch')
    console.log(
      `[IndividualScores] queries: ${JSON.stringify({
        seasons: 'from(seasons).select(name).order(name)',
        players:
          'from(players).select(...).eq(active,true).order(display_order)',
        rounds:
          'from(rounds).select(season_name, course_rating, course_slope, round_scores(player_name, score))',
        detailed:
          'from(round_scores).select(player_name,gir,..., rounds(season_name,date)).not(gir,is,null)',
      })}`,
    )
    setLoadError(null)
    const roundsQ = supabase
      .from('rounds')
      .select(
        `
          season_name,
          date,
          course_rating,
          course_slope,
          round_scores ( player_name, score )
        `,
      )
      .order('date', { ascending: true })
    if (resolvedRange.from) roundsQ.gte('date', resolvedRange.from)
    if (resolvedRange.to) roundsQ.lte('date', resolvedRange.to)

    const detailedQ = supabase
      .from('round_scores')
      .select(
        `
          player_name,
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
          rounds ( season_name, date )
        `,
      )
      .not('gir', 'is', null)

    const [seasonRes, playersRes, roundsRes, detailedRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select(
          'first_name,last_name,season_name,grade,display_order,active',
        )
        .eq('active', true)
        .order('display_order'),
      roundsQ,
      detailedQ,
    ])

    console.log(
      `[IndividualScores] seasons response: ${JSON.stringify({
        data: seasonRes.data,
        error: seasonRes.error?.message ?? null,
        count: seasonRes.data?.length,
      })}`,
    )
    console.log(
      `[IndividualScores] players response: ${JSON.stringify({
        data: playersRes.data,
        error: playersRes.error?.message ?? null,
        count: playersRes.data?.length,
      })}`,
    )
    const roundsData = roundsRes.data ?? []
    console.log(
      `[IndividualScores] rounds response: ${JSON.stringify({
        error: roundsRes.error?.message ?? null,
        count: roundsData.length,
        sample: roundsData.slice(0, 2).map((r) => ({
          season_name: r.season_name,
          scoreRows: (r.round_scores ?? []).length,
        })),
      })}`,
    )

    if (seasonRes.error) {
      console.error('[IndividualScores] seasons error:', seasonRes.error)
      setLoadError(seasonRes.error.message)
      return
    }
    if (playersRes.error) {
      console.error('[IndividualScores] players error:', playersRes.error)
      setLoadError(playersRes.error.message)
      return
    }
    if (roundsRes.error) {
      console.error('[IndividualScores] rounds error:', roundsRes.error)
      setLoadError(roundsRes.error.message)
      return
    }
    if (detailedRes.error) {
      console.error('[IndividualScores] detailed round_scores error:', detailedRes.error)
      setLoadError(detailedRes.error.message)
      return
    }

    const seasonNames = (seasonRes.data ?? []).map((r) => r.name)
    setSeasons(seasonNames)
    setPlayers(playersRes.data ?? [])
    setRounds(roundsRes.data ?? [])
    setDetailedScoreRows(detailedRes.data ?? [])
    console.log(
      `[IndividualScores] loadData: success, state updated ${JSON.stringify({
        seasonNames,
        playersCount: playersRes.data?.length,
        roundsCount: roundsRes.data?.length,
        detailedCount: detailedRes.data?.length,
      })}`,
    )
  }, [resolvedRange.from, resolvedRange.to])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const fn = () => loadData()
    window.addEventListener('rams:rounds-updated', fn)
    return () => window.removeEventListener('rams:rounds-updated', fn)
  }, [loadData])

  useEffect(() => {
    if (!seasons.length) return
    setSeasonFilter((prev) => {
      if (seasons.includes(prev)) return prev
      if (seasons.includes('2026')) return '2026'
      return seasons[0]
    })
  }, [seasons])

  const rosterForSeason = useMemo(() => {
    return players
      .filter((p) => p.season_name === seasonFilter)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }, [players, seasonFilter])

  const roundsForSeason = useMemo(() => {
    return rounds.filter((r) => r.season_name === seasonFilter)
  }, [rounds, seasonFilter])

  const cards = useMemo(() => {
    console.log(
      `[IndividualScores] cards useMemo ${JSON.stringify({
        seasonFilter,
        rosterForSeasonCount: rosterForSeason.length,
        roundsForSeasonCount: roundsForSeason.length,
      })}`,
    )
    return rosterForSeason.map((p) => {
      const name = playerDisplayName(p)
      const rows = []
      for (const r of roundsForSeason) {
        const rs = (r.round_scores ?? []).find((x) => x.player_name === name)
        if (!rs) continue
        rows.push({
          score: rs.score,
          round: {
            course_rating: r.course_rating,
            course_slope: r.course_slope,
          },
        })
      }
      const stats = calcPlayerStats(rows)
      const avgDiff =
        stats?.avgDiff != null ? stats.avgDiff.toFixed(2) : '—'
      const rounds_n = stats?.rounds ?? 0
      const grade = (p.grade ?? '').trim()
      const metaBits = [grade || seasonFilter, `${rounds_n} round${rounds_n !== 1 ? 's' : ''}`]
      return {
        id: `${seasonFilter}-${name}`,
        name,
        initials: playerInitials(name),
        metaLine: metaBits.join(' · '),
        avgDiff,
      }
    })
  }, [rosterForSeason, roundsForSeason, seasonFilter])

  const advancedRows = useMemo(() => {
    const from = resolvedRange.from
    const to = resolvedRange.to

    const byPlayer = new Map()
    for (const row of detailedScoreRows) {
      const pn = (row?.player_name ?? '').trim()
      if (!pn) continue
      const r = row?.rounds
      const season = r?.season_name
      const date = r?.date
      if (!season || season !== seasonFilter) continue
      if (from && String(date) < from) continue
      if (to && String(date) > to) continue
      if (!byPlayer.has(pn)) byPlayer.set(pn, [])
      byPlayer.get(pn).push(row)
    }

    const fmt = (v, dec = 1) =>
      v != null && !Number.isNaN(v) ? v.toFixed(dec) : '—'
    const fmtPct = (v) =>
      v != null && !Number.isNaN(v) ? `${Math.round(v)}%` : '—'

    const rows = rosterForSeason.map((p) => {
      const name = playerDisplayName(p)
      const arr = byPlayer.get(name) ?? []
      const n = arr.length
      if (!n) {
        return {
          id: name,
          player: name,
          rounds: null,
          avgGir: null,
          avgFir: null,
          avgPutts: null,
          avgPen: null,
          avgUd: null,
          scrPct: null,
          avgEagles: null,
          avgBirdies: null,
          avgPars: null,
          avgBogeys: null,
          avgDoubles: null,
          avgOther: null,
          display: {
            rounds: '—',
            avgGir: '—',
            avgFir: '—',
            avgPutts: '—',
            avgPen: '—',
            avgUd: '—',
            scrPct: '—',
            avgEagles: '—',
            avgBirdies: '—',
            avgPars: '—',
            avgBogeys: '—',
            avgDoubles: '—',
            avgOther: '—',
          },
        }
      }

      const girs = arr.map((r) => parseSortNumber(r.gir)).filter((v) => v != null)
      const firs = arr.map((r) => parseSortNumber(r.fir)).filter((v) => v != null)
      const putts = arr.map((r) => parseSortNumber(r.putts)).filter((v) => v != null)
      const pens = arr.map((r) => parseSortNumber(r.penalties)).filter((v) => v != null)
      const uds = arr.map((r) => parseSortNumber(r.updowns)).filter((v) => v != null)

      const scrs = arr
        .map((r) => calcScramble(parseSortNumber(r.gir), parseSortNumber(r.updowns)))
        .filter((v) => v != null)

      const eagles = arr.map((r) => parseSortNumber(r.eagles ?? 0) ?? 0)
      const birdies = arr.map((r) => parseSortNumber(r.birdies ?? 0) ?? 0)
      const pars = arr.map((r) => parseSortNumber(r.pars ?? 0) ?? 0)
      const bogeys = arr.map((r) => parseSortNumber(r.bogeys ?? 0) ?? 0)
      const doubles = arr.map((r) => parseSortNumber(r.doubles ?? 0) ?? 0)
      const other = arr.map((r) => parseSortNumber(r.other ?? 0) ?? 0)

      const stats = {
        rounds: n,
        avgGir: avg(girs),
        avgFir: avg(firs),
        avgPutts: avg(putts),
        avgPen: avg(pens),
        avgUd: avg(uds),
        scrPct: avg(scrs),
        avgEagles: avg(eagles),
        avgBirdies: avg(birdies),
        avgPars: avg(pars),
        avgBogeys: avg(bogeys),
        avgDoubles: avg(doubles),
        avgOther: avg(other),
      }

      return {
        id: name,
        player: name,
        ...stats,
        display: {
          rounds: String(n),
          avgGir: fmt(stats.avgGir, 1),
          avgFir: fmt(stats.avgFir, 1),
          avgPutts: fmt(stats.avgPutts, 1),
          avgPen: fmt(stats.avgPen, 1),
          avgUd: fmt(stats.avgUd, 1),
          scrPct: fmtPct(stats.scrPct),
          avgEagles: fmt(stats.avgEagles, 2),
          avgBirdies: fmt(stats.avgBirdies, 2),
          avgPars: fmt(stats.avgPars, 2),
          avgBogeys: fmt(stats.avgBogeys, 2),
          avgDoubles: fmt(stats.avgDoubles, 2),
          avgOther: fmt(stats.avgOther, 2),
        },
      }
    })

    rows.sort((a, b) => {
      const c = compareAdvancedRows(a, b, sortKey, sortDir)
      if (c !== 0) return c
      return a.player.localeCompare(b.player)
    })

    return rows
  }, [detailedScoreRows, resolvedRange.from, resolvedRange.to, rosterForSeason, seasonFilter, sortDir, sortKey])

  const subtitle = `Advanced stats — ${seasonFilter} roster`
  useEffect(() => {
    setSeasonLine?.(subtitle)
  }, [subtitle, setSeasonLine])

  if (loadError) {
    return (
      <div className="rounded-lg border border-[#5e2e2e] bg-[#3a1a1a] px-4 py-3 text-sm text-[#ef5350]">
        {loadError}
      </div>
    )
  }

  return (
    <div>
      <FilterBarRow className="mb-4">
        <FilterBarGroup>
          <FilterBarLabel>Season:</FilterBarLabel>
          {seasons.map((s) => (
            <FilterBarPill
              key={s}
              active={seasonFilter === s}
              onClick={() => setSeasonFilter(s)}
            >
              {s}
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
          ].map(([key, label]) => (
            <FilterBarPill
              key={key}
              active={datePreset === key}
              onClick={() => setDatePreset(key)}
            >
              {label}
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

      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3.5 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
          Advanced stats — {seasonFilter} roster
        </div>
        <p className="note mb-4 text-xs leading-snug text-[#777777]">
          Click any player to view their full season stats and charts.
        </p>

        {!cards.length ? (
          <p className="text-[13px] text-[#555555]">
            No players on the {seasonFilter} roster yet. Add them via Manage Team
            → Roster.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {cards.map((c) => (
              <Link
                key={c.id}
                to={`/player/${encodeURIComponent(c.name)}`}
                className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[#2a2a2a] bg-[#1A1A1A] p-4 transition-colors hover:border-[#E8650A] hover:bg-[#252525]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8650A] text-lg font-bold text-white">
                  {c.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">
                    {c.name}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#888888]">
                    {c.metaLine}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#E8650A]">
                    Avg Diff: {c.avgDiff}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-[#2a2a2a] pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white">
            Advanced stats table
          </div>
          <p className="note mb-3 text-xs leading-snug text-[#777777]">
            Only rounds with detailed stats are included (GIR is not null).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-xs">
              <thead>
                <tr>
                  <HeaderCell
                    label="Player"
                    tip="Player name (click to open profile)"
                    sorted={sortKey === 'player'}
                    dir={sortDir}
                    onSort={() => setSort('player')}
                    align="left"
                  />
                  <HeaderCell
                    label="Rounds"
                    tip="Number of rounds that include detailed stats (GIR recorded)"
                    sorted={sortKey === 'rounds'}
                    dir={sortDir}
                    onSort={() => setSort('rounds')}
                  />
                  <HeaderCell
                    label="Avg GIR"
                    tip="Average Greens in Regulation per round out of 9. Higher is better."
                    sorted={sortKey === 'avgGir'}
                    dir={sortDir}
                    onSort={() => setSort('avgGir')}
                  />
                  <HeaderCell
                    label="Avg FIR"
                    tip="Average Fairways in Regulation per round out of 9. Higher is better."
                    sorted={sortKey === 'avgFir'}
                    dir={sortDir}
                    onSort={() => setSort('avgFir')}
                  />
                  <HeaderCell
                    label="Avg Putts"
                    tip="Average total putts per round. Lower is better."
                    sorted={sortKey === 'avgPutts'}
                    dir={sortDir}
                    onSort={() => setSort('avgPutts')}
                  />
                  <HeaderCell
                    label="Avg Penalties"
                    tip="Average penalty strokes per round (OB, hazards, lost balls). Lower is better."
                    sorted={sortKey === 'avgPen'}
                    dir={sortDir}
                    onSort={() => setSort('avgPen')}
                  />
                  <HeaderCell
                    label="Avg U&D"
                    tip="Average up-and-downs per round after missing a green."
                    sorted={sortKey === 'avgUd'}
                    dir={sortDir}
                    onSort={() => setSort('avgUd')}
                  />
                  <HeaderCell
                    label="Scramble %"
                    tip="Average scramble % across rounds with both GIR and U&D recorded. Higher is better."
                    sorted={sortKey === 'scrPct'}
                    dir={sortDir}
                    onSort={() => setSort('scrPct')}
                  />
                  <HeaderCell
                    label="Avg Eagles"
                    tip="Average eagles per round (2 under par holes)."
                    sorted={sortKey === 'avgEagles'}
                    dir={sortDir}
                    onSort={() => setSort('avgEagles')}
                  />
                  <HeaderCell
                    label="Avg Birdies"
                    tip="Average birdies per round (1 under par holes)."
                    sorted={sortKey === 'avgBirdies'}
                    dir={sortDir}
                    onSort={() => setSort('avgBirdies')}
                  />
                  <HeaderCell
                    label="Avg Pars"
                    tip="Average pars per round."
                    sorted={sortKey === 'avgPars'}
                    dir={sortDir}
                    onSort={() => setSort('avgPars')}
                  />
                  <HeaderCell
                    label="Avg Bogeys"
                    tip="Average bogeys per round (1 over par holes)."
                    sorted={sortKey === 'avgBogeys'}
                    dir={sortDir}
                    onSort={() => setSort('avgBogeys')}
                  />
                  <HeaderCell
                    label="Avg Doubles"
                    tip="Average doubles per round (2 over par holes)."
                    sorted={sortKey === 'avgDoubles'}
                    dir={sortDir}
                    onSort={() => setSort('avgDoubles')}
                  />
                  <HeaderCell
                    label="Avg Other"
                    tip="Average 'other' per round (3+ over par holes)."
                    sorted={sortKey === 'avgOther'}
                    dir={sortDir}
                    onSort={() => setSort('avgOther')}
                  />
                </tr>
              </thead>
              <tbody>
                {advancedRows.map((r) => (
                  <tr
                    key={r.id}
                    className="even:bg-[#1f1f1f] hover:bg-[#2a2a2a]"
                  >
                    <td className="border-b border-[#252525] py-2 pl-3 text-left font-semibold text-[#dddddd]">
                      <Link
                        to={`/player/${encodeURIComponent(r.player)}`}
                        className="hover:text-[#E8650A] hover:underline"
                      >
                        {r.player}
                      </Link>
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.rounds}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgGir}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgFir}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgPutts}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgPen}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgUd}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.scrPct}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgEagles}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgBirdies}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgPars}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgBogeys}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgDoubles}
                    </td>
                    <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                      {r.display.avgOther}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeaderCell({ label, tip, sorted, dir, onSort, align = 'center' }) {
  return (
    <th
      className={[
        'cursor-pointer select-none border-b-2 border-[#E8650A] bg-[#111111] py-2.5 text-[11px] font-bold whitespace-nowrap hover:text-[#E8650A]',
        align === 'left' ? 'pl-3 text-left' : 'px-2 text-center',
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
