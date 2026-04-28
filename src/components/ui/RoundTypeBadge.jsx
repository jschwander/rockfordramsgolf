/**
 * Practice | Conference | Non-Conference — matches golf_team_stats.html .rt-* styles.
 */
export function RoundTypeBadge({ type }) {
  const t = type ?? 'Practice'
  const slug = t.replace(/-/g, '').replace(/ /g, '').toLowerCase()
  const cls =
    slug === 'practice'
      ? 'border-[#2e5e2e] bg-[#1a3a1a] text-[#4caf50]'
      : slug === 'conference'
        ? 'border-[#1e4a8a] bg-[#1a2a4a] text-[#64b5f6]'
        : 'border-[#7a5010] bg-[#3a2a1a] text-[#ffb74d]'
  return (
    <span
      className={`inline-block rounded-[10px] border px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
    >
      {t}
    </span>
  )
}
