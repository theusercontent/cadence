import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  GripVertical,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader } from '../components/TaskRow'
import { Avatar, EmptyState, ProgressBar, ProjectGlyph } from '../components/ui'
import {
  canCreateTask,
  canEditTask,
  canViewProject,
  isAdmin,
  isManager,
  visibleProjects,
  visibleTasks,
} from '../lib/permissions'
import { formatDueDate, isOverdue, todayISO } from '../lib/dates'
import { EXTERNAL_ASSIGNEE_TONE } from '../lib/assignees'
import { cx, stepProgress } from '../lib/utils'
import type { Task, TaskStatus } from '../types'
import { STATUS_LABELS, STATUS_ORDER } from '../types'

const COLUMN_NOTES: Record<TaskStatus, string> = {
  backlog: 'Ideas with a pulse',
  todo: 'Ready when you are',
  in_progress: 'Heads down',
  review: 'A second look',
  done: 'Out the door',
}

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 }

export function BoardPage() {
  const { data, currentUser, updateTask, notify } = useStore()
  const { openTask, openComposer } = useAppUI()
  const user = currentUser!
  const viewer = user.role === 'viewer'
  const [scope, setScope] = useState<'all' | 'mine'>(viewer ? 'all' : 'all')
  const [projectId, setProjectId] = useState('all')
  const [search, setSearch] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null)

  const projects = useMemo(() => visibleProjects(user, data), [user, data])
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])
  const projectsMap = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects])

  const tasks = useMemo(() => {
    const visible = visibleTasks(user, data)
    const needle = search.trim().toLowerCase()
    return visible.filter((task) => {
      if (scope === 'mine' && task.assigneeId !== user.id) return false
      if (projectId !== 'all' && task.projectId !== projectId) return false
      if (!needle) return true
      const project = projectsMap.get(task.projectId)
      const assignee = task.assigneeId ? userMap.get(task.assigneeId) : undefined
      return (
        task.title.toLowerCase().includes(needle) ||
        project?.name.toLowerCase().includes(needle) ||
        task.labels.some((label) => label.toLowerCase().includes(needle)) ||
        (assignee?.name ?? task.assigneeName ?? '').toLowerCase().includes(needle)
      )
    })
  }, [data, user, scope, projectId, search, projectsMap, userMap])

  const columns = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        tasks: tasks
          .filter((task) => task.status === status)
          .sort((a, b) => {
            const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
            if (priority !== 0) return priority
            if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
            if (a.dueDate) return -1
            if (b.dueDate) return 1
            return a.order - b.order
          }),
      })),
    [tasks],
  )

  const moveTask = (taskId: string, status: TaskStatus) => {
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task || task.status === status) return
    const project = projectsMap.get(task.projectId)
    if (!canEditTask(user, task, project)) {
      notify('You can’t move this task with your current access.', 'error')
      return
    }
    try {
      updateTask(taskId, { status })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move the task.', 'error')
    }
  }

  const onDrop = (status: TaskStatus, event: React.DragEvent) => {
    event.preventDefault()
    const id = dragId ?? event.dataTransfer.getData('text/plain')
    setDragOver(null)
    setDragId(null)
    if (!id) return
    moveTask(id, status)
  }

  return (
    <div className="page page-board">
      <PageHeader
        eyebrow="Flow"
        title="Board"
        description="See the shape of the work. Move a card when the moment is right."
        actions={
          canCreateTask(user) ? (
            <button className="button button-primary" onClick={() => openComposer()}>
              <Plus size={16} /> New task
            </button>
          ) : (
            <span className="read-only-pill">Read-only</span>
          )
        }
      />

      <div className="board-toolbar card">
        {!viewer && (
          <div className="segmented segmented-sm" role="group" aria-label="Board scope">
            <button className={cx(scope === 'all' && 'is-active')} onClick={() => setScope('all')}>All work</button>
            <button className={cx(scope === 'mine' && 'is-active')} onClick={() => setScope('mine')}>My cards</button>
          </div>
        )}
        <label className="search-field board-search">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter cards…" aria-label="Filter cards" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="search-clear"><X size={14} /></button>}
        </label>
        <label className="select-field">
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filter by project">
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <span className="board-count">{tasks.length} cards</span>
      </div>

      <div className="kanban" aria-label="Task board">
        {columns.map(({ status, tasks: columnTasks }) => (
          <section
            key={status}
            className={cx('kanban-column', dragOver === status && 'is-drag-over', `kanban-${status}`)}
            onDragOver={(event) => {
              if (!dragId) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDragOver(status)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOver(null)
            }}
            onDrop={(event) => onDrop(status, event)}
          >
            <header className="kanban-head">
              <div>
                <span className={cx('kanban-dot', `status-${status}`)} />
                <h2>{STATUS_LABELS[status]}</h2>
                <span className="kanban-count">{columnTasks.length}</span>
              </div>
              {canCreateTask(user) && (
                <button
                  className="icon-button icon-button-soft"
                  onClick={() => openComposer({ status, projectId: projectId === 'all' ? undefined : projectId })}
                  aria-label={`Add task to ${STATUS_LABELS[status]}`}
                  title={`Add to ${STATUS_LABELS[status]}`}
                >
                  <Plus size={15} />
                </button>
              )}
            </header>
            <p className="kanban-note">{COLUMN_NOTES[status]}</p>

            <div className="kanban-cards">
              {columnTasks.map((task) => {
                const project = projectsMap.get(task.projectId)
                const assignee = task.assigneeId ? userMap.get(task.assigneeId) : null
                const externalAssignee = !assignee ? task.assigneeName?.trim() ?? '' : ''
                const editable = canEditTask(user, task, project)
                const overdue = isOverdue(task.dueDate, status === 'done')
                const steps = stepProgress(task.subtasks)
                return (
                  <article
                    key={task.id}
                    className={cx('kanban-card', dragId === task.id && 'is-dragging', status === 'done' && 'is-done')}
                    draggable={editable}
                    onDragStart={(event) => {
                      if (!editable) return
                      setDragId(task.id)
                      event.dataTransfer.setData('text/plain', task.id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDragId(null)
                      setDragOver(null)
                    }}
                    onClick={() => openTask(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openTask(task.id)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${task.title}, ${STATUS_LABELS[task.status]}${externalAssignee ? `, assigned to ${externalAssignee}` : ''}${editable ? ', draggable' : ''}`}
                  >
                    <div className="kanban-card-top">
                      {project && (
                        <span className="kanban-project">
                          <span className="project-dot" style={{ background: project.color }} />
                          {project.name}
                        </span>
                      )}
                      {editable && <GripVertical size={14} className="kanban-grip" aria-hidden="true" />}
                    </div>
                    <h3>{task.title}</h3>
                    {task.labels.length > 0 && (
                      <div className="kanban-labels">
                        {task.labels.slice(0, 2).map((label) => (
                          <span className="chip chip-tiny" key={label}>{label}</span>
                        ))}
                      </div>
                    )}
                    {steps.total > 0 && (
                      <div className="kanban-progress">
                        <ProgressBar
                          value={steps.pct}
                          tone={project?.color}
                          className="kanban-progress-track"
                          label={`${steps.done} of ${steps.total} steps complete`}
                        />
                        <span className="kanban-progress-count" aria-hidden="true">
                          {steps.done}/{steps.total} steps
                        </span>
                      </div>
                    )}
                    <div className="kanban-card-foot">
                      <div className="kanban-meta">
                        {externalAssignee && (
                          <span className="kanban-external-assignee" title={`${externalAssignee} · external owner`}>
                            {externalAssignee}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={cx('due-chip due-chip-small', overdue && 'due-overdue')}>
                            <CalendarDays size={12} /> {formatDueDate(task.dueDate, status === 'done')}
                          </span>
                        )}
                      </div>
                      <div className="kanban-card-people">
                        <span className={cx('priority-inline', `priority-${task.priority}`)} title={`${task.priority} priority`}>
                          <span />
                        </span>
                        {assignee ? (
                          <Avatar name={assignee.name} tone={assignee.tone} size="xs" title={assignee.name} />
                        ) : externalAssignee ? (
                          <Avatar
                            name={externalAssignee}
                            tone={EXTERNAL_ASSIGNEE_TONE}
                            size="xs"
                            title={`${externalAssignee} · external owner`}
                          />
                        ) : (
                          <span className="avatar avatar-xs avatar-empty" title="Unassigned" aria-label="Unassigned">—</span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
              {columnTasks.length === 0 && (
                <div className="kanban-empty">
                  <span className="empty-icon"><CheckCircle2 size={18} /></span>
                  <p>{dragOver === status ? 'Drop it here.' : 'Quiet for now.'}</p>
                  <small>{dragOver === status ? 'Let it land.' : status === 'done' ? 'Finished work gathers here.' : 'Nothing in this stage.'}</small>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {!viewer && (
        <p className="board-hint">
          Tip: drag cards between columns. Every card is editable only by people with access.
        </p>
      )}
    </div>
  )
}
