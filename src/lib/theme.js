const ACCENT_KEY = 'lift_accent'

export const ACCENTS = {
  volt:   { name: 'Volt',   hex: '#e8ff47', dim: '#c8df30' },
  orange: { name: 'Orange', hex: '#ff8c42', dim: '#e07429' },
  blue:   { name: 'Blue',   hex: '#4fa8ff', dim: '#3a8de0' },
  green:  { name: 'Green',  hex: '#4fdf7c', dim: '#3bc167' },
  cyan:   { name: 'Cyan',   hex: '#34e0e0', dim: '#23c2c2' },
  purple: { name: 'Purple', hex: '#a78bfa', dim: '#8b6ee0' },
  pink:   { name: 'Pink',   hex: '#ff6bd6', dim: '#e052bb' },
  red:    { name: 'Red',    hex: '#ff5f5f', dim: '#e04848' },
}

export function getAccentKey() {
  const k = localStorage.getItem(ACCENT_KEY)
  return ACCENTS[k] ? k : 'volt'
}

export function getAccent() {
  return ACCENTS[getAccentKey()].hex
}

export function applyAccent(key) {
  const a = ACCENTS[key] || ACCENTS.volt
  const root = document.documentElement
  root.style.setProperty('--accent', a.hex)
  root.style.setProperty('--accent-dim', a.dim)
  localStorage.setItem(ACCENT_KEY, key)
}

export function initTheme() {
  applyAccent(getAccentKey())
  if (localStorage.getItem('lift_theme') !== 'dark') {
    document.documentElement.classList.add('light')
  }
}
