import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Leaderboard', icon: '🏆', short: 'Leaderboard' },
  { to: '/team-scores', label: 'Team Scores', icon: '📋', short: 'Team' },
  { to: '/advanced', label: 'Advanced Stats', icon: '👤', short: 'Advanced' },
]

export function NavTabs() {
  return (
    <nav className="mb-4 grid grid-cols-3 gap-1 rounded-[10px] border border-[#2a2a2a] bg-[#1A1A1A] p-1.5">
      {tabs.map(({ to, label, icon, short }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            [
              'flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 text-center text-xs font-bold transition-colors sm:flex-row sm:gap-1 sm:text-sm',
              isActive
                ? 'bg-[#E8650A] text-white'
                : 'bg-transparent text-[#888888] hover:bg-[#2a2a2a] hover:text-white',
            ].join(' ')
          }
        >
          <span aria-hidden>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">{short}</span>
        </NavLink>
      ))}
    </nav>
  )
}
