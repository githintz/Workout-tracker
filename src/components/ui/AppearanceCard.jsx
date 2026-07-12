import { useState } from 'react'
import { Card } from './Card'
import { ACCENTS, applyAccent, getAccentKey } from '../../lib/theme'

export function AppearanceCard() {
  const [theme, setTheme] = useState(() => localStorage.getItem('lift_theme') || 'light')
  const [accent, setAccent] = useState(getAccentKey)

  const toggleTheme = (next) => {
    setTheme(next)
    localStorage.setItem('lift_theme', next)
    if (next === 'light') document.documentElement.classList.add('light')
    else document.documentElement.classList.remove('light')
  }

  const chooseAccent = (key) => {
    setAccent(key)
    applyAccent(key)
  }

  return (
    <Card>
      <p className="text-white font-semibold mb-1">Appearance</p>
      <p className="text-[#555] text-sm mb-4">Choose your preferred theme</p>
      <div className="flex gap-3">
        {[
          { key: 'dark',  label: '🌙 Dark'  },
          { key: 'light', label: '☀️ Light' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => toggleTheme(key)}
            className={`flex-1 h-12 rounded-2xl text-base font-semibold transition-all active:scale-95 ${
              theme === key ? 'bg-accent text-black' : 'bg-[#1e1e1e] border border-[#2e2e2e] text-white'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <p className="text-[#555] text-sm mt-5 mb-3">Accent color</p>
      <div className="flex gap-3 flex-wrap">
        {Object.entries(ACCENTS).map(([key, a]) => (
          <button key={key} onClick={() => chooseAccent(key)} aria-label={a.name} title={a.name}
            className={`w-10 h-10 rounded-full transition-all active:scale-90 ${
              accent === key ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111]' : ''
            }`}
            style={{ background: a.hex }} />
        ))}
      </div>
    </Card>
  )
}
