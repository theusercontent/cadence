import type { ReactNode } from 'react'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { Project, Task, User } from '../types'
import { formatDueDate, isOverdue } from '../lib/dates'
import { cx } from '../lib/utils'
import { Avatar, CheckToggle, ProjectChip } from './ui'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function TaskRow({
  task,
  project,
  assignee,
  onOpen,
  onToggle,
  canEdit,
  showProject = true,
  compact = false,
}: {
  task: Task
  project?: Project
  assignee?: User
  onOpen: () => void
  onToggle: () => void
  canEdit: boolean
  showProject?: boolean
  compact?: boolean
}) {
  const done = task.status === 'done'
  const overdue = isOverdue(task.dueDate, done)
  return (
    <article
      className={cx('task-row', done && 'is-completed', compact && 'task-row-compact')}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          onOpen()
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${task.title}${done ? ', completed' : ''}`}
    >
      <CheckToggle done={done} onToggle={onToggle} disabled={!canEdit} label={task.title} />
      <div className="task-row-copy">
        <span className="task-row-title">{task.title}</span>
        <span className="task-row-meta">
          {showProject && project && <ProjectChip project={project} />}
          {task.labels.slice(0, compact ? 1 : 2).map((label) => (
            <span className="task-label" key={label}>{label}</span>
          ))}
          {task.subtasks.length > 0 && (
            <span className="task-meta-count">
              {task.subtasks.filter((subtask) => subtask.done).length}/{task.subtasks.length} steps
            </span>
          )}
        </span>
      </div>
      <div className="task-row-side">
        {task.dueDate && (
          <span className={cx('due-chip', overdue && 'due-overdue', done && 'due-done')}>
            <CalendarDays size={13} />
            {formatDueDate(task.dueDate, done)}
          </span>
        )}
        <span className={cx('priority-inline', `priority-${task.priority}`)} title={`${task.priority} priority`}>
          <span />
        </span>
        {assignee ? (
          <Avatar name={assignee.name} tone={assignee.tone} size="xs" title={assignee.name} />
        ) : (
          <span className="avatar avatar-xs avatar-empty" title="Unassigned" aria-label="Unassigned">—</span>
        )}
        <ChevronRight size={15} className="task-row-chevron" />
      </div>
    </article>
  )
}
