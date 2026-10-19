import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'
import { useStore } from '../store/store'
import { BrandMark } from '../components/BrandMark'
import { Avatar, RoleBadge } from '../components/ui'
import { DEMO_ACCOUNTS } from '../data/seed'
import { cx } from '../lib/utils'

export function LoginPage() {
  const { data, login, quickLogin } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [quickBusy, setQuickBusy] = useState<string | null>(null)

  const demos = useMemo(
    () =>
      DEMO_ACCOUNTS.map((demo) => ({
        ...demo,
        user: data.users.find((user) => user.id === demo.userId),
      })).filter((demo) => demo.user?.active),
    [data.users],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await login(email, password, remember)
      if (!result.ok) setError(result.error ?? 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const handleQuickLogin = async (userId: string) => {
    setError('')
    setQuickBusy(userId)
    try {
      const result = await quickLogin(userId)
      if (!result.ok) setError(result.error ?? 'Could not sign in.')
    } finally {
      setQuickBusy(null)
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-glow login-glow-a" aria-hidden="true" />
        <div className="login-glow login-glow-b" aria-hidden="true" />
        <header className="login-brand">
          <BrandMark />
          <span>Cadence</span>
        </header>

        <div className="login-story-copy">
          <span className="eyebrow">Work, in focus.</span>
          <h1>A calmer way to get good work done.</h1>
          <p>
            One quiet place for your tasks, projects, and team. No feeds. No noise. Just the work
            that matters, remembered on your device.
          </p>
        </div>

        <div className="login-preview" aria-hidden="true">
          <div className="preview-card preview-focus">
            <div className="preview-card-head">
              <div>
                <span className="preview-kicker">Monday</span>
                <strong>Today’s focus</strong>
              </div>
              <span className="preview-badge">3 tasks</span>
            </div>
            <div className="preview-task">
              <span className="preview-check is-done"><Check size={11} strokeWidth={3} /></span>
              <span className="preview-task-copy">
                <s>Finalize brand lockups</s>
                <small>Brand System</small>
              </span>
              <span className="preview-flag preview-flag-blue" />
            </div>
            <div className="preview-task">
              <span className="preview-check" />
              <span className="preview-task-copy">
                <span>Synthesize usability findings</span>
                <small>Atlas · Today</small>
              </span>
              <span className="preview-avatar">MP</span>
            </div>
            <div className="preview-task">
              <span className="preview-check" />
              <span className="preview-task-copy">
                <span>Review gesture transitions</span>
                <small>Mobile 2.4 · Tomorrow</small>
              </span>
              <span className="preview-avatar preview-avatar-warm">MP</span>
            </div>
          </div>
          <div className="preview-card preview-memory">
            <span className="preview-memory-dot" />
            <div>
              <strong>Remembered locally</strong>
              <small>Your work is here when you return.</small>
            </div>
          </div>
          <div className="preview-orbit" />
        </div>

        <footer className="login-story-footer">
          <span><ShieldCheck size={15} /> Local-first by design</span>
          <span className="login-story-rule" />
          <span><WifiOff size={15} /> Works without a connection</span>
        </footer>
      </section>

      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <BrandMark />
            <span>Cadence</span>
          </div>
          <div className="login-heading">
            <span className="eyebrow">Your workspace</span>
            <h2>Welcome back.</h2>
            <p>Sign in to pick up exactly where you left off.</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <label className="field">
              <span className="field-label">Work email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>
            <label className="field">
              <span className="field-label">Password</span>
              <span className="input-with-action">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="input-action"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            <div className="login-form-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>
              <span className="login-local-hint"><LockKeyhole size={13} /> Local only</span>
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="button button-primary login-submit" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="login-divider"><span>or continue as a demo teammate</span></div>

          <div className="demo-accounts">
            {demos.map((demo) => (
              <button
                key={demo.userId}
                className="demo-account"
                onClick={() => void handleQuickLogin(demo.userId)}
                disabled={Boolean(quickBusy) || busy}
              >
                {demo.user && <Avatar name={demo.user.name} tone={demo.user.tone} size="sm" />}
                <span className="demo-account-copy">
                  <span className="demo-account-name">
                    {demo.user?.name}
                    <RoleBadge role={demo.user!.role} subtle />
                  </span>
                  <small>{demo.description}</small>
                </span>
                <span className={cx('demo-account-arrow', quickBusy === demo.userId && 'is-busy')}>
                  {quickBusy === demo.userId ? <span className="mini-spinner" /> : <ArrowRight size={16} />}
                </span>
              </button>
            ))}
          </div>

          <details className="demo-credentials">
            <summary>Manual sign-in credentials</summary>
            <div className="demo-credentials-list">
              {demos.map((demo) => (
                <div key={demo.userId}>
                  <span>{demo.user?.email}</span>
                  <code>{demo.password}</code>
                </div>
              ))}
            </div>
          </details>

          <p className="login-privacy">
            <LockKeyhole size={13} />
            Cadence stores this workspace in your browser. Nothing is uploaded, synced, or shared.
          </p>
        </div>
      </section>
    </main>
  )
}
