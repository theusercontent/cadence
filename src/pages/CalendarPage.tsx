import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Plus,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader } from '../components/TaskRow'
import { CheckToggle, EmptyState, ProgressBar, ProjectGlyph } from '../components/ui'
import { canCreateTask, canEditTask, visibleProjects, visibleTasks } from '../lib/permissions'
import {
  formatLongDate,
  formatMonthYear,
  isSameMonth,
  monthGrid,
  toISODate,
  todayISO,
} from '../lib/dates'
import { cx, pluralize, stepProgress } from '../lib/utils'
import type { Project, Task } from '../types'

export function CalendarPage() {
  const { data, currentUser, settings, toggleTask, notify } = useStore()
  const { openTask, openComposer } = useAppUI()
  const user = currentUser!
  const today = todayISO()
  const [cursor, setCursor] = useState(() => {
    const date = new Date()
    return new Date(date.getFullYear(), date.getMonth(), 1, 12)
  })
  const [selected, setSelected] = useState(today)
  const [scope, setScope] = useState<'mine' | 'all'>(user.role === 'viewer' ? 'all' : 'mine')
  const [projectId, setProjectId] = useState('all')

  const weekDays = useMemo(() => {
    const base = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    if (settings.weekStartsOn === 1) return [...base.slice(1), base[0]]
    return base
  }, [settings.weekStartsOn])

  const projects = useMemo(() => visibleProjects(user, data), [user, data])
  const projectMap = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects])
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])

  const datedTasks = useMemo(() => {
    return visibleTasks(user, data).filter((task) => {
      if (!task.dueDate) return false
      if (scope === 'mine' && task.assigneeId !== user.id) return false
      if (projectId !== 'all' && task.projectId !== projectId) return false
      return true
    })
  }, [data, user, scope, projectId])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of datedTasks) {
      if (!task.dueDate) continue
      const list = map.get(task.dueDate) ?? []
      list.push(task)
      map.set(task.dueDate, list)
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1
        if (b.status === 'done' && a.status !== 'done') return -1
        return a.order - b.order
      })
    }
    return map
  }, [datedTasks])

  const grid = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth(), settings.weekStartsOn),
    [cursor, settings.weekStartsOn],
  )
  const selectedTasks = tasksByDate.get(selected) ?? []
  const selectedDate = new Date(`${selected}T12:00:00`)
  const weekStart = settings.weekStartsOn

  useEffect(() => {
    if (!selected.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)) {
      setSelected(toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)))
    }
  }, [cursor, selected])

  const shiftMonth = (delta: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1, 12))
  }

  const goToday = () => {
    const now = new Date()
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1, 12))
    setSelected(today)
  }

  const toggle = (task: Task) => {
    try {
      toggleTask(task.id)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const dayCount = tasksByDate.get(selected)?.length ?? 0
  const monthTaskCount = grid
    .filter((date) => isSameMonth(date, cursor.getMonth()))
    .reduce((sum, date) => sum + (tasksByDate.get(toISODate(date))?.length ?? 0), 0)

  return (
    <div className="page page-calendar">
      <PageHeader
        eyebrow="Rhythm"
        title="Calendar"
        description="A gentle map of what’s coming. Keep the week honest."
        actions={
          canCreateTask(user) ? (
            <button className="button button-primary" onClick={() => openComposer({ dueDate: selected })}>
              <Plus size={16} /> New task
            </button>
          ) : undefined
        }
      />

      <div className="calendar-toolbar card">
        <div className="calendar-month-nav">
          <button className="icon-button icon-button-soft" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={17} />
          </button>
          <button className="icon-button icon-button-soft" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight size={17} />
          </button>
          <h2>{formatMonthYear(cursor)}</h2>
          <button className="button button-quiet button-compact" onClick={goToday}>Today</button>
        </div>
        <div className="calendar-toolbar-right">
          {user.role !== 'viewer' && (
            <div className="segmented segmented-sm" role="group" aria-label="Calendar scope">
              <button className={cx(scope === 'mine' && 'is-active')} onClick={() => setScope('mine')}>My tasks</button>
              <button className={cx(scope === 'all' && 'is-active')} onClick={() => setScope('all')}>All work</button>
            </div>
          )}
          <label className="select-field">
            <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filter by project">
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="calendar-layout">
        <section className="calendar-card card" aria-label="Month calendar">
          <div className="calendar-weekdays">
            {weekDays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid" role="grid">
            {grid.map((date) => {
              const iso = toISODate(date)
              const inMonth = isSameMonth(date, cursor.getMonth())
              const isToday = iso === today
              const isSelected = iso === selected
              const dayTasks = tasksByDate.get(iso) ?? []
              const weekIndex = Math.floor((date.getDay() - weekStart + 7) % 7)
              return (
                <div
                  key={iso}
                  className={cx(
                    'calendar-day',
                    !inMonth && 'is-outside',
                    isToday && 'is-today',
                    isSelected && 'is-selected',
                    (weekIndex === 0 || weekIndex === 6) && 'is-weekend',
                  )}
                  onClick={() => setSelected(iso)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      if (event.target !== event.currentTarget) return
                      event.preventDefault()
                      setSelected(iso)
                    }
                  }}
                  role="gridcell"
                  tabIndex={0}
                  aria-label={`${formatLongDate(iso)}, ${dayTasks.length} ${pluralize(dayTasks.length, 'task')}`}
                  aria-selected={isSelected}
                >
                  <div className="calendar-day-head">
                    <span className="calendar-day-number">{date.getDate()}</span>
                    {isToday && <span className="calendar-today-label">Today</span>}
                    {dayTasks.length > 0 && <span className="calendar-day-count">{dayTasks.length}</span>}
                  </div>
                  <div className="calendar-day-tasks">
                    {dayTasks.slice(0, 2).map((task) => {
                      const project = projectMap.get(task.projectId)
                      return (
                        <button
                          key={task.id}
                          className={cx('calendar-task', task.status === 'done' && 'is-done')}
                          style={{ '--task-color': project?.color ?? '#7A7F87' } as React.CSSProperties}
                          onClick={(event) => {
                            event.stopPropagation()
                            openTask(task.id)
                          }}
                          title={task.title}
                        >
                          <span className="calendar-task-dot" />
                          <span>{task.title}</span>
                        </button>
                      )
                    })}
                    {dayTasks.length > 2 && (
                      <button
                        className="calendar-more"
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelected(iso)
                        }}
                      >
                        +{dayTasks.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <footer className="calendar-foot">
            <span>{monthTaskCount} {pluralize(monthTaskCount, 'task')} this month</span>
            <span>Dates are stored on this device</span>
          </footer>
        </section>

        <aside className="day-panel card">
          <div className="day-panel-head">
            <div>
              <span className="eyebrow">{formatLongDate(selected)}</span>
              <h2>{selected === today ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</h2>
            </div>
            {canCreateTask(user) && (
              <button
                className="icon-button icon-button-soft"
                onClick={() => openComposer({ dueDate: selected })}
                aria-label="Add task to this day"
                title="Add task"
              >
                <Plus size={16} />
              </button>
            )}
          </div>
          <p className="day-panel-count">{dayCount ? `${dayCount} ${pluralize(dayCount, 'task')} scheduled` : 'Nothing scheduled'}</p>

          <div className="day-task-list">
            {selectedTasks.length === 0 ? (
              <EmptyState
                compact
                icon={<Coffee size={20} />}
                title="A little breathing room."
                description={selected === today ? 'Nothing is due today. That’s a good thing.' : 'This day is open. Leave it be, or add something intentional.'}
                action={canCreateTask(user) ? (
                  <button className="button button-secondary button-compact" onClick={() => openComposer({ dueDate: selected })}>
                    <Plus size={14} /> Add a task
                  </button>
                ) : undefined}
              />
            ) : (
              selectedTasks.map((task) => {
                const project = projectMap.get(task.projectId)
                const assignee = task.assigneeId ? userMap.get(task.assigneeId) : null
                const owner = assignee?.name ?? task.assigneeName
                const steps = stepProgress(task.subtasks)
                return (
                  <article
                    key={task.id}
                    className={cx('day-task', task.status === 'done' && 'is-done')}
                    onClick={() => openTask(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openTask(task.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <CheckToggle
                      size="sm"
                      done={task.status === 'done'}
                      onToggle={() => toggle(task)}
                      disabled={!canEditTask(user, task, project)}
                      label={task.title}
                    />
                    <div className="day-task-copy">
                      <span>{task.title}</span>
                      <small>
                        {project?.name}
                        {owner ? ` · ${owner.split(' ')[0]}` : ''}
                      </small>
                      {steps.total > 0 && (
                        <div className="day-task-progress">
                          <ProgressBar
                            value={steps.pct}
                            tone={project?.color}
                            label={`${steps.done} of ${steps.total} steps complete`}
                          />
                          <span aria-hidden="true">{steps.done}/{steps.total}</span>
                        </div>
                      )}
                    </div>
                    <ProjectGlyph project={project ?? ({ color: '#888', name: '' } as Project)} size="sm" />
                  </article>
                )
              })
            )}
          </div>

          <footer className="day-panel-foot">
            <CalendarDays size={14} />
            <span>Plan lightly. Leave room for the real day.</span>
          </footer>
        </aside>
      </div>
    </div>
  )
}
