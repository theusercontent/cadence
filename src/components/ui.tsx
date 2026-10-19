import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Check, CheckCircle2, Info, X } from 'lucide-react'
import type { Project, Role, TaskPriority, User } from '../types'
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS, type TaskStatus } from '../types'
import { cx, initials, toneWithAlpha } from '../lib/utils'
import { useStore } from '../store/store'

export function Avatar({
  name,
  tone,
  size = 'md',
  className,
  title,
}: {
  name: string
  tone: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  title?: string
}) {
  return (
    <span
      className={cx('avatar', `avatar-${size}`, className)}
      style={{ background: toneWithAlpha(tone, '1f'), color: tone }}
      title={title ?? name}
      aria-label={title ?? name}
    >
      {initials(name)}
    </span>
  )
}

export function UserAvatar({ user, size = 'md', className, title }: { user: User; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string; title?: string }) {
  return <Avatar name={user.name} tone={user.tone} size={size} className={className} title={title ?? user.name} />
}

export function AvatarStack({ users, max = 4, size = 'sm' }: { users: User[]; max?: number; size?: 'xs' | 'sm' | 'md' }) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length
  return (
    <span className="avatar-stack" aria-label={`${users.length} members`}>
      {shown.map((user, index) => (
        <UserAvatar key={user.id} user={user} size={size} className="avatar-stacked" title={user.name} />
      ))}
      {extra > 0 && (
        <span className={cx('avatar', `avatar-${size}`, 'avatar-stacked', 'avatar-more')}>+{extra}</span>
      )}
      <span className="sr-only">{users.map((user) => user.name).join(', ')}</span>
    </span>
  )
}

export function RoleBadge({ role, subtle = false }: { role: Role; subtle?: boolean }) {
  return <span className={cx('badge', `badge-role-${role}`, subtle && 'badge-subtle')}>{ROLE_LABELS[role]}</span>
}

export function StatusDot({ status }: { status: TaskStatus }) {
  return <span className={cx('status-dot', `status-${status}`)} aria-label={STATUS_LABELS[status]} />
}

export function PriorityFlag({ priority, withLabel = false }: { priority: TaskPriority; withLabel?: boolean }) {
  return (
    <span className={cx('priority', `priority-${priority}`)} title={`${PRIORITY_LABELS[priority]} priority`}>
      <span className="priority-bar" aria-hidden="true" />
      {withLabel && <span>{PRIORITY_LABELS[priority]}</span>}
    </span>
  )
}

export function ProjectChip({ project, showDot = true }: { project: Project; showDot?: boolean }) {
  return (
    <span className="project-chip">
      {showDot && <span className="project-dot" style={{ background: project.color }} />}
      <span className="project-chip-label">{project.name}</span>
    </span>
  )
}

export function ProjectGlyph({ project, size = 'md' }: { project: Project; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cx('project-glyph', `project-glyph-${size}`)}
      style={{ background: toneWithAlpha(project.color, '18'), color: project.color }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 8.5h14M5 15.5h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function ProgressBar({ value, tone, className }: { value: number; tone?: string; className?: string }) {
  return (
    <span className={cx('progress-track', className)} aria-label={`${value}% complete`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
    </span>
  )
}

export function ProgressRing({
  value,
  size = 116,
  stroke = 8,
  label,
  sublabel,
}: {
  value: number
  size?: number
  stroke?: number
  label?: string
  sublabel?: string
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference
  return (
    <span className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle className="progress-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle
          className="progress-ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="progress-ring-label">
        <strong>{label ?? `${value}%`}</strong>
        {sublabel && <small>{sublabel}</small>}
      </span>
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={cx('empty-state', compact && 'empty-state-compact')}>
      {icon && <span className="empty-icon">{icon}</span>}
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function Overlay({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'modal',
  width = 'md',
  closeLabel = 'Close',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  variant?: 'modal' | 'sheet'
  width?: 'sm' | 'md' | 'lg' | 'xl'
  closeLabel?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    window.setTimeout(() => {
      const auto = panelRef.current?.querySelector<HTMLElement>('[autofocus], input, textarea, select, button')
      auto?.focus()
    }, 30)

    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className={cx('overlay-layer', variant === 'sheet' && 'overlay-sheet-layer')}>
      <button className="overlay-backdrop" aria-label={closeLabel} onClick={onClose} tabIndex={-1} />
      <div
        ref={panelRef}
        className={cx(
          'overlay-panel',
          variant === 'sheet' ? 'sheet-panel' : 'modal-panel',
          `overlay-${width}`,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className="overlay-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button className="icon-button icon-button-soft" onClick={onClose} aria-label={closeLabel}>
            <X size={18} />
          </button>
        </header>
        <div className="overlay-content">{children}</div>
        {footer && <footer className="overlay-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={title}
      width="sm"
      footer={
        <>
          <button className="button button-quiet" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className={cx('button', tone === 'danger' ? 'button-danger' : 'button-primary')} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-copy">{description}</p>
    </Overlay>
  )
}

export function ToastViewport() {
  const { toasts, dismissToast } = useStore()
  const icons = {
    success: <CheckCircle2 size={17} />,
    error: <AlertCircle size={17} />,
    info: <Info size={17} />,
  }
  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cx('toast', `toast-${toast.tone}`)}>
          <span className="toast-icon">{icons[toast.tone]}</span>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function CheckToggle({
  done,
  onToggle,
  disabled,
  label,
  size = 'md',
}: {
  done: boolean
  onToggle: () => void
  disabled?: boolean
  label: string
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <button
      className={cx('check-toggle', `check-${size}`, done && 'is-done')}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
      aria-label={done ? `Mark ${label} as not done` : `Mark ${label} as done`}
      aria-pressed={done}
    >
      <Check size={size === 'lg' ? 18 : size === 'sm' ? 12 : 14} strokeWidth={3} />
    </button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}
