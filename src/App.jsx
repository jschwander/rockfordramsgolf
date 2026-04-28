import { useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { Header } from './components/Header'
import { NavTabs } from './components/NavTabs'
import { Leaderboard } from './components/Leaderboard'
import { TeamScores } from './components/TeamScores'
import { IndividualScores } from './components/IndividualScores'
import { PlayerProfile } from './components/PlayerProfile'
import { AddRoundModal } from './components/AddRoundModal'
import { RequireAdmin } from './components/RequireAdmin'
import { ManageRoster } from './pages/manage/ManageRoster'
import { ManageCourses } from './pages/manage/ManageCourses'
import { ManageSeasons } from './pages/manage/ManageSeasons'
import { ManageExport } from './pages/manage/ManageExport'
import { LoginPage } from './pages/LoginPage'
import { NotFound } from './pages/NotFound'

function ShellLayout() {
  const [seasonLine, setSeasonLine] = useState(
    'Season 2026 — course-adjusted performance tracker',
  )
  const [addRoundOpen, setAddRoundOpen] = useState(false)

  return (
    <div className="mx-auto max-w-[1060px] px-4 pb-8 pt-4">
      <Header
        seasonSubtitle={seasonLine}
        onOpenAddRound={() => setAddRoundOpen(true)}
      />
      <NavTabs />
      <Outlet context={{ setSeasonLine }} />
      <AddRoundModal
        open={addRoundOpen}
        onClose={() => setAddRoundOpen(false)}
        onSaved={() => {
          window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
        }}
      />
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
            <Route
              path="manage/roster"
              element={
                <RequireAdmin>
                  <ManageRoster />
                </RequireAdmin>
              }
            />
            <Route
              path="manage/courses"
              element={
                <RequireAdmin>
                  <ManageCourses />
                </RequireAdmin>
              }
            />
            <Route
              path="manage/seasons"
              element={
                <RequireAdmin>
                  <ManageSeasons />
                </RequireAdmin>
              }
            />
            <Route
              path="manage/export"
              element={
                <RequireAdmin>
                  <ManageExport />
                </RequireAdmin>
              }
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
