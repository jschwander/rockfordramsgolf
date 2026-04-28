import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function Header({ seasonSubtitle }) {
  const { isAdmin } = useAuth()

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
            <button
              type="button"
              className="min-h-[44px] rounded-md border border-[#444444] bg-[#2a2a2a] px-4 text-sm font-bold text-white opacity-50"
              disabled
            >
              ⚙ Manage Team
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white opacity-50"
              disabled
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
