import { useEffect, useState, type FormEvent } from 'react'
import { Check, KeyRound, UserPlus } from 'lucide-react'
import { useStore } from '../store/store'
import { Avatar, Overlay, RoleBadge } from '../components/ui'
import { AVATAR_TONES, DEPARTMENTS } from '../data/seed'
import { cx } from '../lib/utils'
import type { Role, User } from '../types'
import { ROLE_LABELS } from '../types'

const ROLE_HINTS: Record<Role, string> = {
  admin: 'Full workspace access, people management, and local backups.',
  manager: 'Creates projects for their department and manages work in scope.',
  employee: 'Creates tasks, completes assigned work, and collaborates.',
  viewer: 'Read-only access to work shared with them.',
}

export function UserModal({
  open,
  person,
  onClose,
}: {
  open: boolean
  person?: User | null
  onClose: () => void
}) {
  const { currentUser, createUser, updateUser, resetUserPassword } = useStore()
  const admin = currentUser!
  const editing = Boolean(person)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState(admin.department)
  const [role, setRole] = useState<Role>('employee')
  const [tone, setTone] = useState(AVATAR_TONES[0])
  const [password, setPassword] = useState('')
  const [active, setActive] = useState(true)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [busy, setBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setEmail(person?.email ?? '')
    setTitle(person?.title ?? '')
    setDepartment(person?.department ?? admin.department)
    setRole(person?.role ?? 'employee')
    setTone(person?.tone ?? AVATAR_TONES[Math.floor(Math.random() * AVATAR_TONES.length)])
    setPassword('')
    setActive(person?.active ?? true)
    setNewPassword('')
    setError('')
    setPasswordError('')
    setBusy(false)
    setPasswordBusy(false)
  }, [open, person, admin.department])

  if (!open) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (editing && person) {
        updateUser(person.id, { name, email, title, department, role, tone, active })
      } else {
        await createUser({ name, email, title, department, role, tone, password })
      }
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this person.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    if (!person) return
    setPasswordError('')
    setPasswordBusy(true)
    try {
      await resetUserPassword(person.id, newPassword)
      setNewPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not reset the password.')
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={editing ? 'Edit teammate' : 'Add a teammate'}
      description={editing ? 'Role changes take effect immediately.' : 'Create a local account for someone on your team.'}
      width="md"
      footer={
        <>
          <span className="footer-hint">{editing ? 'Access is enforced across the workspace.' : 'Passwords are hashed locally.'}</span>
          <button className="button button-quiet" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={submit} disabled={busy || !name.trim() || !email.trim()}>
            <UserPlus size={16} /> {editing ? 'Save changes' : 'Add teammate'}
          </button>
        </>
      }
    >
      <form className="user-form" onSubmit={submit}>
        <div className="user-preview">
          <Avatar name={name || 'New teammate'} tone={tone} size="lg" />
          <div>
            <strong>{name || 'New teammate'}</strong>
            <span>{title || 'Role pending'} · {department}</span>
          </div>
          <RoleBadge role={role} />
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Full name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jordan Lee" autoFocus required />
          </label>
          <label className="field">
            <span className="field-label">Work email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jordan@company.com" required />
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Job title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product Manager" required />
          </label>
          <label className="field">
            <span className="field-label">Department</span>
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Role</span>
            <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((value) => (
                <option key={value} value={value}>{ROLE_LABELS[value]}</option>
              ))}
            </select>
            <span className="field-hint">{ROLE_HINTS[role]}</span>
          </label>
          <div className="field">
            <span className="field-label">Avatar tone</span>
            <div className="color-swatches compact-swatches">
              {AVATAR_TONES.map((swatch) => (
                <button
                  type="button"
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
        </div>

        {editing && person ? (
          <div className="active-control">
            <div>
              <strong>Workspace access</strong>
              <span>{active ? 'This person can sign in and use Cadence.' : 'Their account is paused. Existing work remains.'}</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
                disabled={person.id === admin.id}
              />
              <span className="switch-track"><span /></span>
            </label>
          </div>
        ) : (
          <label className="field">
            <span className="field-label">Temporary password</span>
            <span className="input-with-icon">
              <KeyRound size={15} />
              <input
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters, one number"
                autoComplete="new-password"
              />
            </span>
            <span className="field-hint">Share it with them once. They can change it in Settings.</span>
          </label>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="sr-only">Save teammate</button>
      </form>

      {editing && person && (
        <div className="password-reset-panel">
          <div className="password-reset-head">
            <KeyRound size={16} />
            <div>
              <strong>Reset password</strong>
              <span>Set a new temporary password for {person.name}.</span>
            </div>
          </div>
          <div className="password-reset-row">
            <input
              type="text"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              autoComplete="new-password"
            />
            <button
              className="button button-secondary button-compact"
              onClick={resetPassword}
              disabled={passwordBusy || newPassword.length < 8}
            >
              {passwordBusy ? 'Resetting…' : 'Reset'}
            </button>
          </div>
          {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
        </div>
      )}
    </Overlay>
  )
}
