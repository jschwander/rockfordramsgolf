import { Link, NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export function Header({ seasonSubtitle, onOpenAddRound }) {
  const { isAdmin, signOut } = useAuth()
  const [manageOpen, setManageOpen] = useState(false)
  const manageRef = useRef(null)

  useEffect(() => {
    if (!manageOpen) return
    const onDoc = (e) => {
      if (manageRef.current && !manageRef.current.contains(e.target)) {
        setManageOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [manageOpen])

  const linkClass = ({ isActive }) =>
    [
      'block w-full border-none px-4 py-2.5 text-left text-sm font-bold transition-colors',
      isActive
        ? 'bg-[#2a2a2a] text-[#E8650A]'
        : 'bg-transparent text-white hover:bg-[#2a2a2a]',
    ].join(' ')

  return (
    <header className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[#2a2a2a] bg-[#1A1A1A] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <img
          src="/ramhead.png"
          alt="Rockford Rams logo"
          width={60}
          height={60}
          className="h-[60px] w-[60px] shrink-0 rounded-full object-contain"
          decoding="async"
        />
        <div>
          <h1 className="text-xl font-bold text-white">
            Rockford Rams Varsity Golf
          </h1>
          <p className="mt-0.5 text-xs text-[#888888]">{seasonSubtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {isAdmin ? (
          <>
            {/* Spec §6: these must stay enabled and fully opaque — no disabled, no opacity-50 */}
            <div className="relative" ref={manageRef}>
              <button
                type="button"
                aria-expanded={manageOpen}
                aria-haspopup="menu"
                className="min-h-[44px] rounded-md border border-[#444444] bg-[#2a2a2a] px-4 text-sm font-bold text-white hover:bg-[#333333]"
                onClick={() => setManageOpen((o) => !o)}
              >
                ⚙ Manage Team
              </button>
              {manageOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] z-[200] min-w-[240px] overflow-hidden rounded-lg border border-[#444444] bg-[#1A1A1A] py-1 shadow-xl"
                  role="menu"
                >
                  <NavLink
                    to="/manage/roster"
                    role="menuitem"
                    className={linkClass}
                    onClick={() => setManageOpen(false)}
                  >
                    👥 Roster
                  </NavLink>
                  <NavLink
                    to="/manage/courses"
                    role="menuitem"
                    className={linkClass}
                    onClick={() => setManageOpen(false)}
                  >
                    ⛳ Courses
                  </NavLink>
                  <NavLink
                    to="/manage/seasons"
                    role="menuitem"
                    className={linkClass}
                    onClick={() => setManageOpen(false)}
                  >
                    📅 Seasons
                  </NavLink>
                  <NavLink
                    to="/manage/export"
                    role="menuitem"
                    className={linkClass}
                    onClick={() => setManageOpen(false)}
                  >
                    💾 Export / Import
                  </NavLink>
                  <NavLink
                    to="/compare"
                    role="menuitem"
                    className={linkClass}
                    onClick={() => setManageOpen(false)}
                  >
                    ⚖ Compare Players
                  </NavLink>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full border-t border-[#333333] px-4 py-2.5 text-left text-sm font-bold text-[#aaaaaa] hover:bg-[#2a2a2a] hover:text-white"
                    onClick={() => {
                      setManageOpen(false)
                      void signOut()
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white hover:bg-[#B84E07]"
              onClick={() => onOpenAddRound?.()}
            >
              ＋ Add Round
            </button>
          </>
        ) : (
          <Link
            to="/login"
            className="text-xs text-[#666666] underline-offset-2 hover:text-[#888888] hover:underline"
          >
            Admin Login
          </Link>
        )}
      </div>
    </header>
  )
}
