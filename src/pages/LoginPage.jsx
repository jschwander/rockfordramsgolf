import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setSubmitting(false)
    if (signErr) {
      setError(signErr.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link
        to="/"
        className="mb-6 text-sm text-[#888888] hover:text-[#E8650A] hover:underline"
      >
        ← Back to leaderboard
      </Link>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-6">
        <h1 className="mb-1 text-lg font-bold text-white">Admin login</h1>
        <p className="mb-6 text-xs text-[#666666]">
          Sign in with the team admin account from Supabase Auth.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2.5 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2.5 text-sm text-white focus:border-[#E8650A] focus:outline-none"
              required
            />
          </div>
          {error ? (
            <p className="rounded-md border border-[#5e2e2e] bg-[#3a1a1a] px-3 py-2 text-sm text-[#ef5350]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] rounded-md bg-[#E8650A] text-sm font-bold text-white hover:bg-[#B84E07] disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
