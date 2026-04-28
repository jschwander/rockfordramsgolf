import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-[1060px] flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-[#888888]">That URL does not exist.</p>
      <Link
        to="/"
        className="mt-6 min-h-[44px] rounded-md bg-[#E8650A] px-6 py-3 text-sm font-bold text-white hover:bg-[#B84E07]"
      >
        Go to leaderboard
      </Link>
    </div>
  )
}
