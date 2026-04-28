import { useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Header } from './components/Header'
import { NavTabs } from './components/NavTabs'
import { Leaderboard } from './components/Leaderboard'
import { TeamScores } from './components/TeamScores'
import { IndividualScores } from './components/IndividualScores'
import { PlayerProfile } from './components/PlayerProfile'
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
            <Route path="player/:name" element={<PlayerProfile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
