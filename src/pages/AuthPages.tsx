import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useI18n } from '../i18n'
import { ErrorBox, errText } from '../components/ui'
import { NexoMark, IconGoogle, IconEye, IconEyeOff, IconBack } from '../components/icons'

const DRAFT_KEY = 'nexo_auth_draft'
function loadDraft(): Record<string, string> {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') } catch { return {} }
}
function saveDraft(patch: Record<string, string>) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...loadDraft(), ...patch })) } catch { /* ignore */ }
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="auth-wrap">
      <div className="auth-card glass card">
        <Link className="auth-back" to="/"><IconBack size={15} /> {t('auth.backWelcome')}</Link>
        <div className="auth-logo">
          <div className="logo-badge"><NexoMark size={26} /></div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.3px' }}>NEXO</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12 }}>MESSENGER</div>
          </div>
        </div>
        {children}
        <p className="auth-switch"><a href="./privacy.html">{t('welcome.privacy')}</a></p>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, autoComplete, placeholder }: {
  value: string; onChange: (v: string) => void; autoComplete: string; placeholder: string
}) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <div className="password-wrap">
      <input className="input" type={show ? 'text' : 'password'} required autoComplete={autoComplete}
        placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="password-eye" aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        onClick={() => setShow(!show)}>{show ? <IconEyeOff size={17} /> : <IconEye size={17} />}</button>
    </div>
  )
}

function GoogleButton() {
  const { t } = useI18n()
  const [error, setError] = useState(() => {
    const status = new URL(window.location.href).searchParams.get('google_auth')
    return status === 'conflict' ? t('google.conflict') : status === 'cancel' ? t('google.cancel') : status === 'error' ? t('google.failed') : ''
  })
  const [busy, setBusy] = useState(false)
  const click = async () => {
    setBusy(true); setError('')
    try { await api.signInWithGoogle() } catch (e) {
      const code = e instanceof Error ? e.message : ''
      setError(code === 'GOOGLE_NOT_CONFIGURED' ? t('google.notConfigured') : code === 'GOOGLE_ORIGIN_MISMATCH' ? t('google.origin') : code.startsWith('GOOGLE_') ? t('google.failed') : errText(e, t))
    } finally { setBusy(false) }
  }
  return (
    <div>
      <ErrorBox error={error} />
      <button className="btn google-btn" onClick={click} disabled={busy} type="button">
        <IconGoogle size={18} /> {busy ? t('auth.redirecting') : t('auth.google')}
      </button>
    </div>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { t } = useI18n()
  const draft = loadDraft()
  const [email, setEmail] = useState(draft.email || '')
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
      setError(err instanceof Error ? err.message : t('error.generic'))
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="auth-title">{t('auth.welcomeBack')}</h1>
      <p className="auth-sub">{t('auth.signInSub')}</p>
      {api.mode === 'local' && <div className="notice-box">{t('auth.demoNotice')}</div>}
      <ErrorBox error={error} />
      <form onSubmit={submit}>
        <div className="field"><label>{t('auth.email')}</label>
          <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email}
            onChange={(e) => { setEmail(e.target.value); saveDraft({ email: e.target.value }) }} /></div>
        <div className="field"><label>{t('auth.password')}</label>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('auth.signingIn') : t('auth.signIn')}</button>
      </form>
      <div style={{ textAlign: 'right', marginTop: 10 }}>
        <Link to="/forgot" style={{ fontSize: 13, color: 'var(--text-2)' }}>{t('auth.forgot')}</Link>
      </div>
      <div className="divider">{t('auth.or')}</div>
      <GoogleButton />
      <p className="auth-switch">{t('auth.newTo')} <Link to="/register">{t('auth.createLink')}</Link></p>
    </Shell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const { t } = useI18n()
  const draft = loadDraft()
  const [displayName, setDisplayName] = useState(draft.displayName || '')
  const [username, setUsername] = useState(draft.username || '')
  const [email, setEmail] = useState(draft.email || '')
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
      else setNotice(t('auth.createdNotice'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'))
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <h1 className="auth-title">{t('auth.createTitle')}</h1>
      <p className="auth-sub">{t('auth.createSub')}</p>
      <ErrorBox error={error} />
      {notice && <div className="notice-box">{notice}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>{t('auth.displayName')}</label>
          <input className="input" required placeholder="Alex Rivera" value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); saveDraft({ displayName: e.target.value }) }} /></div>
        <div className="field"><label>{t('auth.username')}</label>
          <input className="input" required placeholder="@alex" value={username}
            onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''); setUsername(v); saveDraft({ username: v }) }} />
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>{t('auth.usernameHint')}</div></div>
        <div className="field"><label>{t('auth.email')}</label>
          <input className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email}
            onChange={(e) => { setEmail(e.target.value); saveDraft({ email: e.target.value }) }} /></div>
        <div className="field"><label>{t('auth.password')}</label>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" placeholder={t('auth.passwordHint')} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('auth.creating') : t('auth.createTitle')}</button>
      </form>
      <div className="divider">{t('auth.or')}</div>
      <GoogleButton />
      <p className="auth-switch">{t('auth.alreadyHave')} <Link to="/login">{t('auth.signInLink')}</Link></p>
    </Shell>
  )
}

export function ForgotPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState(loadDraft().email || '')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await api.resetPassword(email.trim()); setSent(true) } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'))
    } finally { setBusy(false) }
  }
  return (
    <Shell>
      <h1 className="auth-title">{t('auth.resetTitle')}</h1>
      <p className="auth-sub">{t('auth.resetSub')}</p>
      <ErrorBox error={error} />
      {sent ? <div className="notice-box">{t('auth.resetSent')}</div> : (
        <form onSubmit={submit}>
          <div className="field"><label>{t('auth.email')}</label>
            <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('auth.sending') : t('auth.sendReset')}</button>
        </form>
      )}
      <p className="auth-switch"><Link to="/login">{t('auth.backToSignIn')}</Link></p>
    </Shell>
  )
}
