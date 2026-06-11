import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const NAV = [
  { to: '/',          icon: '⚡', label: 'Home'      },
  { to: '/plans',     icon: '📋', label: 'Plans'     },
  { to: '/track',     icon: '🎯', label: 'Track'     },
  { to: '/cardio',    icon: '🏃', label: 'Cardio'    },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/settings',  icon: '⚙️', label: 'Settings'  },
]

function FeedbackModal({ open, onClose, page }) {
  const { user }    = useAuth()
  const [text, setText]   = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone]   = useState(false)

  const submit = async () => {
    if (!text.trim()) return
    setSaving(true)

    await supabase.from('feedback').insert({ user_id: user?.id, page, message: text.trim() })

    const ghToken = import.meta.env.VITE_GITHUB_ISSUES_TOKEN
    if (ghToken) {
      await fetch('https://api.github.com/repos/githintz/workout-tracker/issues', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ghToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          title: `[Feedback] ${page} — ${new Date().toLocaleDateString()}`,
          body: `**Page:** ${page}\n\n${text.trim()}`,
          labels: ['feedback'],
        }),
      }).catch(() => {})
    }

    setSaving(false)
    setDone(true)
    setTimeout(() => { setDone(false); setText(''); onClose() }, 1500)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-[#141414] border border-[#2e2e2e] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-semibold">Feedback</p>
            <p className="text-[#555] text-xs mt-0.5">Page: {page}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2e2e2e] text-[#777] text-xl">×</button>
        </div>
        {done ? (
          <p className="text-[#4fdf7c] text-center py-4 font-semibold">✓ Feedback saved!</p>
        ) : (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="Describe the change you'd like…"
              className="px-4 py-3 rounded-2xl bg-[#1e1e1e] border border-[#2e2e2e] text-white text-sm
                placeholder:text-[#444] focus:outline-none focus:border-accent/50 resize-none w-full"
              autoFocus
            />
            <button
              onClick={submit}
              disabled={saving || !text.trim()}
              className="h-12 rounded-2xl bg-accent text-black font-semibold text-base
                disabled:opacity-40 active:scale-95 transition-all"
            >
              {saving ? 'Saving…' : 'Submit Feedback'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function Layout({ children }) {
  const location  = useLocation()
  const [showFeedback, setShowFeedback] = useState(false)
  const currentPage = NAV.find(n => n.to === location.pathname)?.label || location.pathname

  useEffect(() => {
    const saved = localStorage.getItem('lift_theme') || 'dark'
    if (saved === 'light') document.documentElement.classList.add('light')
    else document.documentElement.classList.remove('light')
  }, [])

  return (
    <div className="flex flex-col min-h-dvh max-w-2xl mx-auto w-full">
      {/* Top bar — padding-top pushes content below the Android status bar */}
      <header
        className="flex items-center justify-between px-5 shrink-0 border-b border-[#1e1e1e] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-30"
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(3.5rem + env(safe-area-inset-top))' }}
      >
        <span className="text-accent font-black text-xl tracking-tight">LIFT</span>
        <span className="text-[#555] text-xs font-medium">{currentPage}</span>
        <button
          onClick={() => setShowFeedback(true)}
          className="h-8 px-3 rounded-full bg-[#1e1e1e] border border-[#2e2e2e] text-[#777] text-xs font-medium
            hover:border-accent/40 hover:text-accent transition-colors active:scale-95"
        >
          Feedback
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-32">
        {children}
      </main>

      {/* Floating island nav */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-30 pointer-events-none"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <nav className="pointer-events-auto bg-[#111] border border-[#1e1e1e] rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-around h-16 px-1">
            {NAV.map(({ to, icon, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all min-w-[48px] ${
                    isActive ? 'bg-accent text-black' : 'text-[#555]'
                  }`
                }
              >
                <span className="text-xl leading-none">{icon}</span>
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      <FeedbackModal open={showFeedback} onClose={() => setShowFeedback(false)} page={currentPage} />
    </div>
  )
}
