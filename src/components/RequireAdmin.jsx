import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/', { replace: true })
  }, [loading, isAdmin, navigate])

  if (loading) {
    return (
      <p className="text-sm text-[#888888]">Loading…</p>
    )
  }
  if (!isAdmin) return null
  return children
}
