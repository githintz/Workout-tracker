import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function AuthPage({ onPhysioModeChange }) {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)
  const [physio, setPhysio] = useState(() => localStorage.getItem('lift_physio') === '1')

  const chooseMode = (isPhysio) => {
    setPhysio(isPhysio)
    if (isPhysio) localStorage.setItem('lift_physio', '1')
    else localStorage.removeItem('lift_physio')
    onPhysioModeChange?.(isPhysio)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErr('')
    const { error } = await signInWithEmail(email)
    setLoading(false)
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[#0a0a0a]">
      <div className="w-full max-w-sm flex flex-col gap-8">
        {/* Logo */}
        <div className="text-center">
          <div className="text-accent font-black text-6xl tracking-tighter mb-2">LIFT</div>
          <p className="text-[#555] text-sm">
            {physio ? 'Physiotherapist access' : 'Your personal workout tracker'}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 bg-[#141414] border border-[#1e1e1e] rounded-2xl p-1">
          {[
            { key: false, label: '🏋️ Athlete' },
            { key: true,  label: '🩺 Physiotherapist' },
          ].map(({ key, label }) => (
            <button key={String(key)} onClick={() => chooseMode(key)}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-all ${
                physio === key ? 'bg-accent text-black' : 'text-[#777]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {sent ? (
          <div className="bg-[#141414] border border-[#2e2e2e] rounded-3xl p-6 text-center flex flex-col gap-3">
            <div className="text-4xl">📬</div>
            <p className="text-white font-semibold">Check your email</p>
            <p className="text-[#777] text-sm">We sent a magic link to <span className="text-white">{email}</span>. Tap it to sign in.</p>
            <button onClick={() => setSent(false)} className="text-accent text-sm mt-2">Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            {err && <p className="text-[#ff4f4f] text-sm">{err}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send magic link'}
            </Button>
            <p className="text-center text-[#555] text-xs">
              {physio
                ? "Sign in with the email your client shared their logs with. You'll get read-only access."
                : "No password needed. We'll email you a sign-in link."}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
