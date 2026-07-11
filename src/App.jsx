import { useState, useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { supabase } from './lib/supabase'
import { Layout } from './components/ui/Layout'
import { PageLoader } from './components/ui/Spinner'
import AuthPage        from './pages/AuthPage'
import PhysioPage      from './pages/PhysioPage'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#f0f0f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '1rem', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Something went wrong</p>
          <p style={{ color: '#777', fontSize: '0.875rem', textAlign: 'center', maxWidth: '30rem' }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#e8ff47', color: '#000', border: 'none', borderRadius: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
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

  // A physiotherapist invited via email lands here straight from the magic
  // link, without ever visiting the login screen's mode toggle first, so
  // detect physio access from their shared_access rows instead of relying
  // solely on that manual toggle.
  useEffect(() => {
    if (!user) return
    supabase.from('shared_access').select('id').ilike('viewer_email', user.email).limit(1)
      .then(({ data }) => { if (data?.length) setPhysioMode(true) })
  }, [user])

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
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
