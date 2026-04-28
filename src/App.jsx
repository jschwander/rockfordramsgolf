import { useEffect, useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Header } from './components/Header'
import { NavTabs } from './components/NavTabs'
import { Leaderboard } from './components/Leaderboard'
import { TeamScores } from './components/TeamScores'
import { IndividualScores } from './components/IndividualScores'
import { LoginPage } from './pages/LoginPage'
import { NotFound } from './pages/NotFound'

function ShellLayout() {
  const [seasonLine, setSeasonLine] = useState(
    'Season 2026 — course-adjusted performance tracker',
  )
  return (
    <div className="mx-auto max-w-[1060px] px-4 pb-8 pt-4">
      <Header seasonSubtitle={seasonLine} />
      <NavTabs />
      <Outlet context={{ setSeasonLine }} />
    </div>
  )
}

function StubPage({ subtitle, message }) {
  const { setSeasonLine } = useOutletContext()
  useEffect(() => {
    setSeasonLine(subtitle)
  }, [subtitle, setSeasonLine])
  return (
    <p className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-6 text-sm text-[#888888]">
      {message}
    </p>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ShellLayout />}>
            <Route index element={<Leaderboard />} />
            <Route path="team-scores" element={<TeamScores />} />
            <Route path="individual" element={<IndividualScores />} />
            <Route
              path="player/:name"
              element={
                <StubPage
                  subtitle="Player profile"
                  message="Player profile page will be added in a follow-up."
                />
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
