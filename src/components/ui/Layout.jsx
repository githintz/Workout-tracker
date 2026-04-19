import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { to: '/',          icon: '⚡', label: 'Home'      },
  { to: '/plans',     icon: '📋', label: 'Plans'     },
  { to: '/track',     icon: '🎯', label: 'Track'     },
  { to: '/cardio',    icon: '🏃', label: 'Cardio'    },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
  { to: '/settings',  icon: '⚙️', label: 'Settings'  },
]

export function Layout({ children }) {
  const location = useLocation()

  return (
    <div className="flex flex-col min-h-dvh max-w-2xl mx-auto w-full">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-[#1e1e1e] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-xl z-30">
        <span className="text-[#e8ff47] font-black text-lg tracking-tight">LIFT</span>
        <span className="text-[#555] text-xs">
          {NAV.find(n => n.to === location.pathname)?.label || ''}
        </span>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-[#1e1e1e] z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16">
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 rounded-2xl transition-all min-w-[52px] ${
                  isActive ? 'text-[#e8ff47]' : 'text-[#555]'
                }`
              }
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
