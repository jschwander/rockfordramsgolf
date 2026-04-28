// Course rating is 18-hole — divide by 2 for 9-hole
export function calcDiff(score, rating, slope) {
  if (score == null || !rating || !slope) return null
  return (score - rating / 2) * 113 / slope
}

export function calcPlayerStats(playerRoundScores) {
  const diffs = []
  const raws = []

  playerRoundScores.forEach((rs) => {
    if (rs.score != null) raws.push(rs.score)
    const d = calcDiff(rs.score, rs.round.course_rating, rs.round.course_slope)
    if (d != null) diffs.push(d)
  })

  if (!raws.length) return null

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const avgRaw = avg(raws)
  const bestRaw = Math.min(...raws)
  const worstRaw = Math.max(...raws)
  const avgDiff = diffs.length ? avg(diffs) : null

  const sortedDiffs = [...diffs].sort((a, b) => a - b)
  const hcap = sortedDiffs.length
    ? avg(sortedDiffs.slice(0, Math.min(3, sortedDiffs.length)))
    : null

  const stddev =
    diffs.length > 1
      ? Math.sqrt(
          diffs.map((d) => (d - avgDiff) ** 2).reduce((a, b) => a + b, 0) /
            (diffs.length - 1),
        )
      : 0

  const consist =
    stddev < 2 ? 'Elite' : stddev < 3 ? 'Strong' : stddev < 4 ? 'Average' : 'Inconsistent'

  // Projected score range (mean ± stddev, rounded)
  const projLow = stddev > 0 ? Math.round(avgRaw - stddev) : null
  const projHigh = stddev > 0 ? Math.round(avgRaw + stddev) : null

  // Trend: last 4 diffs vs overall avg
  let trend = null
  let trendVal = null
  if (diffs.length >= 2) {
    const last4 = diffs.slice(-Math.min(4, diffs.length))
    const prior = diffs.slice(0, -Math.min(4, diffs.length))
    const last4avg = avg(last4)
    const baseAvg = prior.length ? avg(prior) : avgDiff
    trendVal = parseFloat((last4avg - baseAvg).toFixed(2))
    trend = Math.abs(trendVal) < 0.5 ? 'flat' : trendVal < 0 ? 'up' : 'down'
  }

  return {
    avgRaw,
    bestRaw,
    worstRaw,
    avgDiff,
    hcap,
    stddev,
    consist,
    projLow,
    projHigh,
    trend,
    trendVal,
    rounds: raws.length,
  }
}

// Sum of top 4 scores from a round
export function calcTeamScore(scores) {
  const valid = scores.filter((s) => s != null).sort((a, b) => a - b)
  if (valid.length < 4) return null
  return valid.slice(0, 4).reduce((a, b) => a + b, 0)
}

export function calcScramble(gir, updowns) {
  if (gir == null || updowns == null) return null
  const missedGreens = 9 - gir
  if (missedGreens <= 0) return null // hit every green, no scramble chances
  return Math.round((updowns / missedGreens) * 100)
}
