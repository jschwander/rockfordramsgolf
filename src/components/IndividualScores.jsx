import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { calcPlayerStats } from '../utils/stats'
import { playerDisplayName, playerInitials } from '../utils/players'

export function IndividualScores() {
  console.log('[IndividualScores] render')
  const { setSeasonLine } = useOutletContext() ?? {}

  const [seasons, setSeasons] = useState([])
  const [seasonFilter, setSeasonFilter] = useState('2026')
  const [players, setPlayers] = useState([])
  const [rounds, setRounds] = useState([])
  const [loadError, setLoadError] = useState(null)

  const loadData = useCallback(async () => {
    console.log('[IndividualScores] loadData: starting Supabase parallel fetch')
    console.log(
      `[IndividualScores] queries: ${JSON.stringify({
        seasons: 'from(seasons).select(name).order(name)',
        players:
          'from(players).select(...).eq(active,true).order(display_order)',
        rounds:
          'from(rounds).select(season_name, course_rating, course_slope, round_scores(player_name, score))',
      })}`,
    )
    setLoadError(null)
    const [seasonRes, playersRes, roundsRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select(
          'first_name,last_name,season_name,grade,display_order,active',
        )
        .eq('active', true)
        .order('display_order'),
      supabase.from('rounds').select(`
          season_name,
          course_rating,
          course_slope,
          round_scores ( player_name, score )
        `),
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

    const seasonNames = (seasonRes.data ?? []).map((r) => r.name)
    setSeasons(seasonNames)
    setPlayers(playersRes.data ?? [])
    setRounds(roundsRes.data ?? [])
    console.log(
      `[IndividualScores] loadData: success, state updated ${JSON.stringify({
        seasonNames,
        playersCount: playersRes.data?.length,
        roundsCount: roundsRes.data?.length,
      })}`,
    )
  }, [])

  useEffect(() => {
    loadData()
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

  const subtitle = `Individual scores — ${seasonFilter} roster`
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
          Season:
        </span>
        {seasons.map((s) => (
          <button
            key={s}
            type="button"
            className={[
              'rounded-full border px-3.5 py-1 text-xs font-bold transition-colors',
              seasonFilter === s
                ? 'border-[#E8650A] bg-[#E8650A] text-white'
                : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white',
            ].join(' ')}
            onClick={() => setSeasonFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
        <div className="mb-3.5 border-b-2 border-[#E8650A] pb-2 text-[11px] font-bold uppercase tracking-wide text-white">
          Individual scores — {seasonFilter} roster
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
      </div>
    </div>
  )
}
