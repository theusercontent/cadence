import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  Check,
  Database,
  Download,
  HardDrive,
  KeyRound,
  LockKeyhole,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sun,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { useStore } from '../store/store'
import { PageHeader } from '../components/TaskRow'
import { Avatar, ConfirmDialog, RoleBadge } from '../components/ui'
import { AVATAR_TONES } from '../data/seed'
import { passwordProblem } from '../lib/auth'
import { storageFootprint } from '../lib/storage'
import { permissionSummary } from '../lib/permissions'
import { cx } from '../lib/utils'
import type { ThemePreference } from '../types'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function SettingsPage() {
  const {
    data,
    currentUser,
    settings,
    storageHealthy,
    updateProfile,
    updateSettings,
    changePassword,
    exportWorkspace,
    exportPersonal,
    importWorkspace,
    resetWorkspace,
    logout,
    notify,
  } = useStore()
  const user = currentUser!
  const [name, setName] = useState(user.name)
  const [title, setTitle] = useState(user.title)
  const [tone, setTone] = useState(user.tone)
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [importError, setImportError] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [swReady, setSwReady] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const footprint = storageFootprint(data)
  const isAdmin = user.role === 'admin'

  useEffect(() => {
    setName(user.name)
    setTitle(user.title)
    setTone(user.tone)
  }, [user.name, user.title, user.tone])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => setSwReady(Boolean(registration.active))).catch(() => setSwReady(false))
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const saveProfile = () => {
    setProfileError('')
    try {
      updateProfile({ name, title, tone })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile.')
    }
  }

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault()
    setPasswordError('')
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }
    const problem = passwordProblem(newPassword)
    if (problem) {
      setPasswordError(problem)
      return
    }
    setPasswordBusy(true)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImportError('')
    try {
      const text = await file.text()
      const result = await importWorkspace(text)
      if (!result.ok) setImportError(result.error ?? 'Could not import that file.')
    } catch {
      setImportError('The backup could not be read.')
    } finally {
      event.target.value = ''
    }
  }

  const install = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      notify('Cadence was installed on this device.')
      setInstallPrompt(null)
    }
  }

  const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'Auto', icon: Monitor },
  ]

  return (
    <div className="page page-settings">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Make Cadence feel right, and keep your local workspace in good hands."
        actions={
          <button className="button button-secondary" onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        }
      />

      <div className="settings-layout">
        <div className="settings-main">
          <section className="card settings-card">
            <div className="settings-head">
              <span className="settings-icon"><UserRound size={18} /></span>
              <div>
                <h2>Profile</h2>
                <p>How you appear to the rest of the workspace.</p>
              </div>
              <RoleBadge role={user.role} />
            </div>
            <div className="profile-editor">
              <div className="profile-avatar-block">
                <Avatar name={name || user.name} tone={tone} size="xl" />
                <span className="profile-role-caption">{user.department}</span>
              </div>
              <div className="profile-fields">
                <div className="form-grid two">
                  <label className="field">
                    <span className="field-label">Full name</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">Job title</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">Email</span>
                  <input value={user.email} disabled />
                  <span className="field-hint">Email changes are managed by a workspace admin.</span>
                </label>
                <div className="field">
                  <span className="field-label">Avatar tone</span>
                  <div className="color-swatches compact-swatches">
                    {AVATAR_TONES.map((swatch) => (
                      <button
                        key={swatch}
                        className={cx('color-swatch', tone === swatch && 'is-selected')}
                        style={{ background: swatch }}
                        onClick={() => setTone(swatch)}
                        aria-label={`Use avatar color ${swatch}`}
                        aria-pressed={tone === swatch}
                      >
                        {tone === swatch && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                {profileError && <div className="form-error" role="alert">{profileError}</div>}
                <div className="settings-action-row">
                  <span className="field-hint">Changes are stored locally and immediately.</span>
                  <button
                    className="button button-secondary button-compact"
                    onClick={saveProfile}
                    disabled={!name.trim() || !title.trim() || (name === user.name && title === user.title && tone === user.tone)}
                  >
                    Save profile
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-head">
              <span className="settings-icon"><Palette size={18} /></span>
              <div>
                <h2>Appearance</h2>
                <p>A quieter surface for the work.</p>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Theme</strong>
                <span>Follow your system, or choose a surface.</span>
              </div>
              <div className="segmented theme-switch">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      className={cx(settings.theme === option.value && 'is-active')}
                      onClick={() => updateSettings({ theme: option.value })}
                    >
                      <Icon size={14} /> {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Week starts on</strong>
                <span>Used by the calendar and weekly views.</span>
              </div>
              <div className="segmented">
                <button className={cx(settings.weekStartsOn === 0 && 'is-active')} onClick={() => updateSettings({ weekStartsOn: 0 })}>Sunday</button>
                <button className={cx(settings.weekStartsOn === 1 && 'is-active')} onClick={() => updateSettings({ weekStartsOn: 1 })}>Monday</button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Reduce motion</strong>
                <span>Turn off gentle transitions and animating surfaces.</span>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.reduceMotion}
                  onChange={(event) => updateSettings({ reduceMotion: event.target.checked })}
                />
                <span className="switch-track"><span /></span>
              </label>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-head">
              <span className="settings-icon"><LockKeyhole size={18} /></span>
              <div>
                <h2>Password & security</h2>
                <p>Local credentials, hashed with PBKDF2 in your browser.</p>
              </div>
            </div>
            <form className="password-form" onSubmit={submitPassword}>
              <label className="field">
                <span className="field-label">Current password</span>
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" />
              </label>
              <div className="form-grid two">
                <label className="field">
                  <span className="field-label">New password</span>
                  <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
                </label>
                <label className="field">
                  <span className="field-label">Confirm new password</span>
                  <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                </label>
              </div>
              {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
              <div className="settings-action-row">
                <span className="field-hint">At least 8 characters, including a letter and a number.</span>
                <button className="button button-secondary button-compact" disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}>
                  {passwordBusy ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
            <div className="security-note">
              <ShieldCheck size={16} />
              <span>Passwords never leave this browser. The workspace is local, so account recovery is handled by an admin resetting a password from Team.</span>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-head">
              <span className="settings-icon"><Database size={18} /></span>
              <div>
                <h2>Local data</h2>
                <p>Backup, restore, or start fresh.</p>
              </div>
              <span className={cx('status-pill', storageHealthy ? 'is-active' : 'is-inactive')}>
                <span /> {storageHealthy ? 'Saving' : 'Storage issue'}
              </span>
            </div>
            <div className="data-summary">
              <div><span>Workspace size</span><strong>{footprint.label}</strong></div>
              <div><span>Tasks</span><strong>{data.tasks.length}</strong></div>
              <div><span>Projects</span><strong>{data.projects.length}</strong></div>
              <div><span>Activity records</span><strong>{data.activities.length}</strong></div>
            </div>
            <div className="data-actions">
              <button className="button button-secondary" onClick={exportPersonal}>
                <Download size={15} /> Export my data
              </button>
              {isAdmin && (
                <button className="button button-secondary" onClick={exportWorkspace}>
                  <HardDrive size={15} /> Full workspace backup
                </button>
              )}
              {isAdmin && (
                <button className="button button-secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={15} /> Restore backup
                </button>
              )}
              <input ref={fileRef} type="file" accept="application/json,.json" onChange={(event) => void importFile(event)} hidden />
            </div>
            {importError && <div className="form-error" role="alert">{importError}</div>}
            <p className="data-note">
              A backup contains the full workspace, including hashed passwords. Keep it somewhere safe. Restoring replaces everything currently on this device.
            </p>
            {isAdmin && (
              <div className="danger-zone">
                <div>
                  <strong>Reset demo workspace</strong>
                  <span>Restore the original seeded workspace and sign out. This removes all local changes.</span>
                </div>
                <button className="button button-danger button-compact" onClick={() => setResetOpen(true)}>
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            )}
          </section>
        </div>

        <aside className="settings-aside">
          <section className="card access-summary-card">
            <span className="settings-icon"><ShieldCheck size={18} /></span>
            <span className="card-eyebrow">Your access</span>
            <h2>{user.role === 'admin' ? 'Workspace admin' : user.role === 'manager' ? 'Manager' : user.role === 'viewer' ? 'Viewer' : 'Employee'}</h2>
            <p>{permissionSummary(user)}</p>
            <div className="access-summary-meta">
              <span>{user.department}</span>
              <RoleBadge role={user.role} />
            </div>
            <button className="button button-secondary button-compact full-width" onClick={() => navigateTeam()}>
              <Users size={14} /> View team & roles
            </button>
          </section>

          <section className="card offline-card">
            <div className="offline-card-head">
              <Smartphone size={18} />
              <span className={cx('local-dot', swReady && 'is-live')} />
            </div>
            <h2>Offline by design</h2>
            <p>
              Cadence lives entirely in this browser. Your tasks, people, and memory do not touch a server.
            </p>
            <div className="offline-points">
              <span><Check size={13} /> Local storage</span>
              <span><Check size={13} /> {swReady ? 'App shell cached' : 'Offline cache available in production'}</span>
              <span><Check size={13} /> No tracking</span>
            </div>
            {installPrompt && (
              <button className="button button-primary button-compact full-width" onClick={() => void install()}>
                <Download size={14} /> Install Cadence
              </button>
            )}
          </section>

          <section className="card settings-about">
            <span className="card-eyebrow">About</span>
            <h2>Cadence 1.0</h2>
            <p>Work, in focus.</p>
            <dl>
              <div><dt>Storage</dt><dd>Browser local</dd></div>
              <div><dt>Theme</dt><dd>{settings.theme}</dd></div>
              <div><dt>Account</dt><dd>{user.email}</dd></div>
            </dl>
            <p className="about-foot">A local-first task manager for focused teams. Built to be quiet.</p>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset the demo workspace?"
        description="All tasks, projects, comments, and local accounts will be replaced with the original seeded workspace. You will be signed out. This cannot be undone."
        confirmLabel={resetBusy ? 'Resetting…' : 'Reset workspace'}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          setResetBusy(true)
          try {
            await resetWorkspace()
            setResetOpen(false)
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Could not reset the workspace.', 'error')
          } finally {
            setResetBusy(false)
          }
        }}
      />
    </div>
  )

  function navigateTeam() {
    window.location.hash = '/team'
  }
}
