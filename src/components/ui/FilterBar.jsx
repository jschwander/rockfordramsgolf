/** Shared filter bar layout for leaderboard-style pages (md+ one row; &lt;768 stacked groups). */

/** Maps ROUND_TYPES label → FilterBarPill `tone` prop. */
export const FILTER_BAR_ROUND_TYPE_TONE = {
  Practice: 'practice',
  Conference: 'conference',
  'Non-Conference': 'nonConference',
}

const inactiveToneClass = {
  practice:
    'border-[#2e5e2e] bg-transparent text-[#6abf6a] hover:bg-[#1a2a1a] hover:text-[#8fdf8f]',
  conference:
    'border-[#1e4a8a] bg-transparent text-[#64b5f6] hover:bg-[#1a2438] hover:text-[#90caf9]',
  nonConference:
    'border-[#7a5010] bg-transparent text-[#ffb74d] hover:bg-[#2a2218] hover:text-[#ffcc80]',
}

export function FilterBarRow({ children, className = '' }) {
  const margin =
    className.trim().length > 0 ? '' : 'mb-3 '
  return (
    <div
      className={[
        margin,
        'flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-4 md:gap-y-2',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function FilterBarGroup({ children }) {
  return (
    <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
      {children}
    </div>
  )
}

export function FilterBarDivider() {
  return (
    <span
      className="hidden h-5 w-px shrink-0 bg-[#333333] md:block md:self-center"
      aria-hidden
    />
  )
}

export function FilterBarLabel({ children }) {
  return (
    <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-[#888888]">
      {children}
    </span>
  )
}

export function FilterBarPill({ active, onClick, children, tone }) {
  const inactive =
    tone && inactiveToneClass[tone]
      ? inactiveToneClass[tone]
      : 'border-[#333333] bg-transparent text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white'
  return (
    <button
      type="button"
      className={[
        'min-h-[30px] rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
        active
          ? 'border-[#E8650A] bg-[#E8650A] text-white'
          : inactive,
      ].join(' ')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
