import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { calcTeamScore } from '../utils/stats'
import { ROUND_TYPES } from '../constants'
import { RoundTypeBadge } from './ui/RoundTypeBadge'
import { EditRoundModal } from './EditRoundModal'
import { useAuth } from '../hooks/useAuth'

function shortName(fullName) {
  const first = fullName.split(/\s+/)[0] ?? ''
  return first.substring(0, 5)
}

/** Column order: first appearance of each player in filtered rounds (matches prototype). */
function collectPlayerColumnNames(filteredRounds) {
  const names = []
  const seen = new Set()
  for (const r of filteredRounds) {
    for (const rs of r.round_scores ?? []) {
      const n = rs.player_name
      if (n && !seen.has(n)) {
        seen.add(n)
        names.push(n)
      }
    }
  }
  return names
}

export function TeamScores() {
  console.log('[TeamScores] render')
  const { setSeasonLine } = useOutletContext() ?? {}
  const { isAdmin } = useAuth()

  const [seasons, setSeasons] = useState([])
  const [roster, setRoster] = useState([])
  const [courses, setCourses] = useState([])
  const [rounds, setRounds] = useState([])
  const [loadError, setLoadError] = useState(null)

  const [tsSeasonFilter, setTsSeasonFilter] = useState('2026')
  const [tsTypeFilter, setTsTypeFilter] = useState(() => new Set(ROUND_TYPES))

  const [editRound, setEditRound] = useState(null)

  const loadData = useCallback(async () => {
    console.log('[TeamScores] loadData: starting Supabase parallel fetch')
    console.log(
      `[TeamScores] queries: ${JSON.stringify({
        seasons: 'from(seasons).select(name).order(name)',
        players:
          'from(players).select(...).eq(active,true).order(season_name).order(display_order)',
        courses: 'from(courses).select(id,name,full_name,rating,slope).order(name)',
        rounds:
          'from(rounds).select(..., round_scores(player_name, score)).order(date)',
      })}`,
    )
    setLoadError(null)
    const [seasonRes, rosterRes, coursesRes, roundsRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select(
          'first_name,last_name,season_name,display_order,active',
        )
        .eq('active', true)
        .order('season_name')
        .order('display_order'),
      supabase.from('courses').select('id,name,full_name,rating,slope').order('name'),
      supabase
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
          team_score,
          finish,
          win_score,
          round_scores ( player_name, score )
        `,
        )
        .order('date'),
    ])

    console.log(
      `[TeamScores] seasons response: ${JSON.stringify({
        data: seasonRes.data,
        error: seasonRes.error?.message ?? null,
        count: seasonRes.data?.length,
      })}`,
    )
    console.log(
      `[TeamScores] players response: ${JSON.stringify({
        data: rosterRes.data,
        error: rosterRes.error?.message ?? null,
        count: rosterRes.data?.length,
      })}`,
    )
    console.log(
      `[TeamScores] courses response: ${JSON.stringify({
        data: coursesRes.data,
        error: coursesRes.error?.message ?? null,
        count: coursesRes.data?.length,
      })}`,
    )
    const roundsData = roundsRes.data ?? []
    console.log(
      `[TeamScores] rounds response: ${JSON.stringify({
        error: roundsRes.error?.message ?? null,
        count: roundsData.length,
        sample: roundsData.slice(0, 2).map((r) => ({
          id: r.id,
          season_name: r.season_name,
          date: r.date,
          type: r.type,
          scoreRows: (r.round_scores ?? []).length,
        })),
      })}`,
    )

    if (seasonRes.error) {
      console.error('[TeamScores] seasons error:', seasonRes.error)
      setLoadError(seasonRes.error.message)
      return
    }
    if (rosterRes.error) {
      console.error('[TeamScores] players error:', rosterRes.error)
      setLoadError(rosterRes.error.message)
      return
    }
    if (coursesRes.error) {
      console.error('[TeamScores] courses error:', coursesRes.error)
      setLoadError(coursesRes.error.message)
      return
    }
    if (roundsRes.error) {
      console.error('[TeamScores] rounds error:', roundsRes.error)
      setLoadError(roundsRes.error.message)
      return
    }

    const seasonNames = (seasonRes.data ?? []).map((r) => r.name)
    setSeasons(seasonNames)
    setRoster(rosterRes.data ?? [])
    setCourses(coursesRes.data ?? [])
    setRounds(roundsRes.data ?? [])
    console.log(
      `[TeamScores] loadData: success, state updated ${JSON.stringify({
        seasonNames,
        rosterCount: rosterRes.data?.length,
        coursesCount: coursesRes.data?.length,
        roundsCount: roundsRes.data?.length,
      })}`,
    )
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!seasons.length) return
    setTsSeasonFilter((prev) => {
      if (seasons.includes(prev)) return prev
      if (seasons.includes('2026')) return '2026'
      return seasons[0] ?? 'all'
    })
  }, [seasons])

  const filtered = useMemo(() => {
    const out = rounds.filter((r) => {
      const sOk =
        tsSeasonFilter === 'all' || r.season_name === tsSeasonFilter
      return sOk && tsTypeFilter.has(r.type ?? 'Practice')
    })
    console.log(
      `[TeamScores] filtered rounds ${JSON.stringify({
        tsSeasonFilter,
        typeFilter: [...tsTypeFilter],
        totalRounds: rounds.length,
        filteredCount: out.length,
      })}`,
    )
    return out
  }, [rounds, tsSeasonFilter, tsTypeFilter])

  const allNames = useMemo(
    () => collectPlayerColumnNames(filtered),
    [filtered],
  )

  const subtitle = 'Team scores — all rounds'
  useEffect(() => {
    setSeasonLine?.(subtitle)
  }, [setSeasonLine])

  function toggleType(t) {
    setTsTypeFilter((prev) => {
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

  async function handleDelete(id) {
    if (!confirm('Delete this round permanently?')) return
    const { error } = await supabase.from('rounds').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await loadData()
  }

  function scoreForPlayer(round, playerName) {
    const rs = round.round_scores ?? []
    const row = rs.find((x) => x.player_name === playerName)
    return row?.score ?? null
  }

  function teamScoreForRound(r) {
    const nums = (r.round_scores ?? [])
      .map((x) => x.score)
      .filter((s) => s != null)
    return r.team_score ?? calcTeamScore(nums)
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-[#5e2e2e] bg-[#3a1a1a] px-4 py-3 text-sm text-[#ef5350]">
        {loadError}
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#E8650A] pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-white">
            Team scores{' '}
            <span className="rounded-[10px] bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-bold normal-case text-[#aaaaaa]">
              {filtered.length} rounds
            </span>
          </span>
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
                tsSeasonFilter === s
                  ? 'border-[#E8650A] bg-[#E8650A] text-white'
                  : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white',
              ].join(' ')}
              onClick={() => setTsSeasonFilter(s)}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
            Type:
          </span>
          {ROUND_TYPES.map((t) => {
            const active = tsTypeFilter.has(t)
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

        <p className="note mb-2.5 text-xs leading-snug text-[#777777]">
          Click ✏ to edit a round including detailed stats.
        </p>

        <div className="max-h-[420px] overflow-auto rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-[1400px] w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="min-w-[55px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Season
                  </th>
                  <th className="min-w-[100px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Type
                  </th>
                  <th className="min-w-[48px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Date
                  </th>
                  <th className="min-w-[180px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 pl-2.5 text-left text-[11px] font-bold whitespace-nowrap text-white">
                    Course
                  </th>
                  <th className="min-w-[55px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Team Score
                  </th>
                  <th className="min-w-[55px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Finish
                  </th>
                  <th className="min-w-[65px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    1st Score
                  </th>
                  <th className="min-w-[50px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Rating
                  </th>
                  <th className="min-w-[46px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                    Slope
                  </th>
                  {allNames.map((n) => (
                    <th
                      key={n}
                      className="min-w-[42px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-1 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white"
                    >
                      {shortName(n)}
                    </th>
                  ))}
                  {isAdmin ? (
                    <>
                      <th className="min-w-[40px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                        Edit
                      </th>
                      <th className="min-w-[36px] cursor-default border-b-2 border-[#E8650A] bg-[#111111] px-2 py-2.5 text-center text-[11px] font-bold whitespace-nowrap text-white">
                        Del
                      </th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ts = teamScoreForRound(r)
                  const tsStr =
                    ts != null ? (
                      <span className="font-bold text-[#4caf50]">{ts}</span>
                    ) : (
                      <span className="text-[#444444]">—</span>
                    )
                  const finStr = r.finish ?? (
                    <span className="text-[#444444]">—</span>
                  )
                  const winStr =
                    r.win_score != null ? (
                      r.win_score
                    ) : (
                      <span className="text-[#444444]">—</span>
                    )
                  return (
                    <tr
                      key={r.id}
                      className="even:bg-[#1f1f1f] hover:bg-[#2a2a2a]"
                    >
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {r.season_name ?? '—'}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center">
                        <RoundTypeBadge type={r.type} />
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {r.date}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 pl-2.5 text-left text-[#dddddd]">
                        {r.course_name}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center">
                        {tsStr}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {finStr}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {winStr}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {r.course_rating ?? '—'}
                      </td>
                      <td className="border-b border-[#252525] px-2 py-2 text-center text-[#dddddd]">
                        {r.course_slope ?? '—'}
                      </td>
                      {allNames.map((name) => {
                        const s = scoreForPlayer(r, name)
                        return (
                          <td
                            key={name}
                            className="border-b border-[#252525] px-1 py-2 text-center text-[#dddddd] whitespace-nowrap"
                          >
                            {s != null ? s : '—'}
                          </td>
                        )
                      })}
                      {isAdmin ? (
                        <>
                          <td className="border-b border-[#252525] px-2 py-2 text-center">
                            <button
                              type="button"
                              className="rounded-md border border-[#333333] px-2 py-1 text-[10px] font-bold text-[#aaaaaa] hover:bg-[#2a2a2a]"
                              onClick={() => setEditRound(r)}
                              aria-label="Edit round"
                            >
                              ✏
                            </button>
                          </td>
                          <td className="border-b border-[#252525] px-2 py-2 text-center">
                            <button
                              type="button"
                              className="rounded-md border border-[#ef5350] px-2 py-1 text-[10px] font-bold text-[#ef5350] hover:bg-[#2a1515]"
                              onClick={() => handleDelete(r.id)}
                              aria-label="Delete round"
                            >
                              ✕
                            </button>
                          </td>
                        </>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EditRoundModal
        open={!!editRound}
        round={editRound}
        seasons={seasons}
        rosterRows={roster}
        courses={courses}
        onClose={() => setEditRound(null)}
        onSaved={loadData}
      />
    </div>
  )
}
