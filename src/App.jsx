import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { Layout } from './components/ui/Layout'
import { PageLoader } from './components/ui/Spinner'
import AuthPage        from './pages/AuthPage'
import PhysioPage      from './pages/PhysioPage'
import HomePage        from './pages/HomePage'
import PlansPage       from './pages/PlansPage'
import PlanBuilderPage from './pages/PlanBuilderPage'
import PlanEditPage    from './pages/PlanEditPage'
import TrackPage       from './pages/TrackPage'
import CardioPage      from './pages/CardioPage'
import AnalyticsPage   from './pages/AnalyticsPage'
import SettingsPage    from './pages/SettingsPage'

function AppRoutes() {
  const { user, loading } = useAuth()
  const [physioMode, setPhysioMode] = useState(() => localStorage.getItem('lift_physio') === '1')
  if (loading) return <PageLoader />
  if (!user)   return <AuthPage onPhysioModeChange={setPhysioMode} />
  if (physioMode) {
    return <PhysioPage onExit={() => { localStorage.removeItem('lift_physio'); setPhysioMode(false) }} />
  }
  return (
    <SettingsProvider>
      <Layout>
        <Routes>
          <Route path="/"               element={<HomePage />} />
          <Route path="/plans"          element={<PlansPage />} />
          <Route path="/plans/new"      element={<PlanBuilderPage />} />
          <Route path="/plans/:id/edit" element={<PlanEditPage />} />
          <Route path="/track"          element={<TrackPage />} />
          <Route path="/cardio"         element={<CardioPage />} />
          <Route path="/analytics"      element={<AnalyticsPage />} />
          <Route path="/settings"       element={<SettingsPage />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </SettingsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
