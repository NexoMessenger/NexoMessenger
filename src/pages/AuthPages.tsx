import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { ErrorBox } from '../components/ui'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card glass card">
        <div className="auth-logo">
          <div className="logo-badge">N</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>NEXO</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>MESSENGER</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function GoogleButton() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true); setError('')
    try { await api.signInWithGoogle() } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed')
    } finally { setBusy(false) }
  }
  return (
    <div>
      <ErrorBox error={error} />
      <button className="btn google-btn" onClick={click} disabled={busy} type="button">
        <span style={{ fontWeight: 800 }}>G</span> {busy ? 'Redirecting…' : 'Continue with Google'}
      </button>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await api.signIn(email.trim(), password)
      await refresh()
      navigate('/chats')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Sign in to continue to NEXO Messenger.</p>
      {api.mode === 'local' && (
        <div className="notice-box">Demo account: <strong>demo@nexo.app</strong> / <strong>demo1234</strong> — or register a new account below. Data stays in this browser until Supabase is connected.</div>
      )}
      <ErrorBox error={error} />
      <form onSubmit={submit}>
        <div className="field"><label>Email</label>
          <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label>
          <input className="input" type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <Link className="link-btn" to="/forgot" style={{ textDecoration: 'underline', fontSize: 13, color: 'var(--text-2)' }}>Forgot password?</Link>
      </div>
      <div className="divider">or</div>
      <GoogleButton />
      <p className="auth-switch">New to NEXO? <Link to="/register">Create an account</Link></p>
    </Shell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api.signUp(email.trim(), password, username, displayName.trim())
      await refresh()
      const p = await api.getCurrentProfile()
      if (p) navigate('/chats')
      else setNotice('Account created. If email confirmation is enabled in Supabase, confirm your email, then sign in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-sub">Choose a unique @username — it is how people find you on NEXO.</p>
      <ErrorBox error={error} />
      {notice && <div className="notice-box">{notice}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Display name</label>
          <input className="input" required placeholder="Alex Rivera" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
        <div className="field"><label>Username</label>
          <input className="input" required placeholder="@alex" value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>3–24 chars: lowercase letters, digits, _ or . Uniqueness is enforced by the database.</div></div>
        <div className="field"><label>Email</label>
          <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label>
          <input className="input" type="password" required autoComplete="new-password" placeholder="At least 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <div className="divider">or</div>
      <GoogleButton />
      <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
    </Shell>
  )
}

export function ForgotPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.resetPassword(email.trim()); setSent(true) } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally { setBusy(false) }
  }
  return (
    <Shell>
      <h1 className="auth-title">Reset password</h1>
      <p className="auth-sub">We will email you a secure reset link via the auth provider.</p>
      <ErrorBox error={error} />
      {sent ? <div className="notice-box">Check your inbox for a password reset link.</div> : (
        <form onSubmit={submit}>
          <div className="field"><label>Email</label>
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="auth-switch"><Link to="/login">← Back to sign in</Link></p>
    </Shell>
  )
}
