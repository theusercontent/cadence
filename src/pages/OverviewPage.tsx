import { useMemo } from 'react'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Feather,
  ListTodo,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader, TaskRow } from '../components/TaskRow'
import {
  Avatar,
  AvatarStack,
  EmptyState,
  ProgressBar,
  ProgressRing,
  ProjectGlyph,
} from '../components/ui'
import {
  canCreateTask,
  isAdmin,
  isManager,
  visibleActivities,
  visibleProjects,
  visibleTasks,
} from '../lib/permissions'
import {
  formatDueDate,
  formatRelativeTime,
  formatTodayLong,
  greeting,
  isThisWeek,
  todayISO,
  toISODate,
  dateOffsetISO,
  fromISODate,
} from '../lib/dates'
import { reviewForWeek, weekRange } from '../lib/review'
import { cx, pct } from '../lib/utils'
import type { Activity, Project } from '../types'

export function OverviewPage() {
  const { data, currentUser, settings, navigate, toggleTask, notify } = useStore()
  const { openTask, openComposer } = useAppUI()
  const user = currentUser!
  const currentWeek = useMemo(
    () => weekRange(new Date(), settings.weekStartsOn),
    [settings.weekStartsOn],
  )
  const weeklyReviewed = Boolean(reviewForWeek(data.reviews, user.id, currentWeek.start))

  const analysis = useMemo(() => {
    const tasks = visibleTasks(user, data)
    const projects = visibleProjects(user, data)
    const leadership = isAdmin(user) || isManager(user)
    const scope = leadership ? tasks : tasks.filter((task) => task.assigneeId === user.id || task.creatorId === user.id)
    const myOpen = tasks
      .filter((task) => task.assigneeId === user.id && task.status !== 'done')
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return a.order - b.order
      })
    const focus = myOpen.slice(0, 4)
    const open = scope.filter((task) => task.status !== 'done')
    const dueToday = open.filter((task) => task.dueDate === todayISO())
    const overdue = open.filter((task) => task.dueDate && task.dueDate < todayISO())
    const inProgress = open.filter((task) => task.status === 'in_progress')
    const completedThisWeek = scope.filter(
      (task) => task.status === 'done' && task.completedAt && isThisWeek(task.completedAt),
    )
    const done = scope.filter((task) => task.status === 'done')
    const completionPct = pct(done.length, scope.length)
    const days = Array.from({ length: 7 }, (_, index) => {
      const iso = dateOffsetISO(index - 6)
      const dayTasks = scope.filter(
        (task) => task.completedAt && toISODate(new Date(task.completedAt)) === iso,
      )
      return {
        iso,
        label: new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(fromISODate(iso)),
        count: dayTasks.length,
      }
    })
    const activities = visibleActivities(user, data).slice(0, 5)
    const projectCards = projects
      .filter((project) => project.status !== 'completed')
      .map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id)
        const doneCount = projectTasks.filter((task) => task.status === 'done').length
        return { project, total: projectTasks.length, doneCount, progress: pct(doneCount, projectTasks.length) }
      })
      .sort((a, b) => (a.project.dueDate ?? '9999').localeCompare(b.project.dueDate ?? '9999'))
      .slice(0, 3)
    return {
      scope,
      projects,
      focus,
      myOpen,
      open,
      dueToday,
      overdue,
      inProgress,
      completedThisWeek,
      completionPct,
      days,
      activities,
      projectCards,
      leadership,
    }
  }, [data, user])

  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])
  const projectMap = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects])
  const scopeLabel = isAdmin(user) ? 'Across the workspace' : isManager(user) ? 'Across your teams' : 'In your lane'
  const maxBar = Math.max(1, ...analysis.days.map((day) => day.count))
  const showWriter = canCreateTask(user)

  const openTaskById = (id: string) => {
    if (data.tasks.some((task) => task.id === id)) openTask(id)
  }

  const openActivity = (activity: Activity) => {
    if (activity.entityType === 'task' && activity.entityId) openTaskById(activity.entityId)
    else if (activity.entityType === 'project' && activity.entityId) navigate(`/projects/${activity.entityId}`)
    else navigate('/memory')
  }

  return (
    <div className="page page-overview">
      <PageHeader
        eyebrow={formatTodayLong()}
        title={<>{greeting()}, {user.name.split(' ')[0]}.</>}
        description={
          analysis.overdue.length > 0
            ? `${analysis.overdue.length} ${analysis.overdue.length === 1 ? 'task needs' : 'tasks need'} a little attention. Everything else is moving.`
            : 'Here’s the work that deserves your attention today.'
        }
        actions={
          <>
            <span className="role-context-pill">
              <Sparkles size={14} /> {scopeLabel}
            </span>
            {showWriter && (
              <button className="button button-primary" onClick={() => openComposer()}>
                <Plus size={16} /> Add task
              </button>
            )}
          </>
        }
      />

      <section className="stat-grid" aria-label="Workspace summary">
        <article className="stat-card">
          <span className="stat-icon stat-blue"><ListTodo size={18} /></span>
          <div>
            <span className="stat-label">Open work</span>
            <strong className="stat-value">{analysis.open.length}</strong>
            <span className="stat-foot">{analysis.leadership ? 'Team tasks in view' : 'Assigned or created by you'}</span>
          </div>
        </article>
        <article className={cx('stat-card', analysis.dueToday.length > 0 && 'stat-card-accent')}>
          <span className="stat-icon stat-orange"><CalendarDays size={18} /></span>
          <div>
            <span className="stat-label">Due today</span>
            <strong className="stat-value">{analysis.dueToday.length}</strong>
            <span className="stat-foot">{analysis.overdue.length > 0 ? `${analysis.overdue.length} already overdue` : 'All clear on the calendar'}</span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-purple"><Clock3 size={18} /></span>
          <div>
            <span className="stat-label">In progress</span>
            <strong className="stat-value">{analysis.inProgress.length}</strong>
            <span className="stat-foot">Actively moving</span>
          </div>
        </article>
        <article className="stat-card">
          <span className="stat-icon stat-green"><CheckCircle2 size={18} /></span>
          <div>
            <span className="stat-label">Done this week</span>
            <strong className="stat-value">{analysis.completedThisWeek.length}</strong>
            <span className="stat-foot">Quietly compounding</span>
          </div>
        </article>
      </section>

      {!weeklyReviewed && (
        <button className="weekly-invite" onClick={() => navigate('/review')}>
          <span className="weekly-invite-mark" aria-hidden="true"><Feather size={19} /></span>
          <span className="weekly-invite-copy">
            <span className="card-eyebrow">The weekly ritual</span>
            <strong>Close the week. Set the rhythm.</strong>
            <small>Look back, notice what’s stuck, and choose what comes next.</small>
          </span>
          <span className="weekly-invite-cta">Open Weekly Cadence <ArrowRight size={14} /></span>
        </button>
      )}

      <div className="dashboard-grid">
        <section className="card focus-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Your focus</span>
              <h2>Today’s short list</h2>
            </div>
            <button className="text-button" onClick={() => navigate('/tasks')}>
              All tasks <ArrowRight size={14} />
            </button>
          </div>
          <div className="focus-list">
            {analysis.focus.length === 0 ? (
              <EmptyState
                compact
                icon={<Coffee size={22} />}
                title="A clear page."
                description="Nothing assigned to you is open right now. Keep it that way, or pull something forward."
                action={showWriter ? (
                  <button className="button button-secondary button-compact" onClick={() => openComposer()}>
                    <Plus size={15} /> Add a task
                  </button>
                ) : undefined}
              />
            ) : (
              analysis.focus.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={projectMap.get(task.projectId)}
                  assignee={task.assigneeId ? userMap.get(task.assigneeId) : undefined}
                  canEdit={showWriter && (task.assigneeId === user.id || task.creatorId === user.id || analysis.leadership)}
                  onOpen={() => openTask(task.id)}
                  onToggle={() => {
                    try {
                      toggleTask(task.id)
                    } catch (error) {
                      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
                    }
                  }}
                  compact
                />
              ))
            )}
          </div>
          {analysis.myOpen.length > analysis.focus.length && (
            <button className="focus-more" onClick={() => navigate('/tasks')}>
              {analysis.myOpen.length - analysis.focus.length} more in your queue
              <ArrowRight size={14} />
            </button>
          )}
        </section>

        <section className="card momentum-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Momentum</span>
              <h2>This week</h2>
            </div>
            <span className="card-tag"><TrendingUp size={13} /> Local only</span>
          </div>
          <div className="momentum-body">
            <ProgressRing value={analysis.completionPct} size={124} sublabel="complete" />
            <div className="momentum-copy">
              <p>
                <strong>{analysis.completedThisWeek.length}</strong> {analysis.completedThisWeek.length === 1 ? 'task' : 'tasks'} finished this week.
              </p>
              <span>{analysis.open.length} still open {analysis.leadership ? 'across your teams' : 'in your lane'}.</span>
            </div>
          </div>
          <div className="week-bars" aria-label="Completions over the last seven days">
            {analysis.days.map((day) => (
              <div className="week-bar-column" key={day.iso} title={`${day.count} completed on ${day.iso}`}>
                <span className="week-bar-value">{day.count > 0 ? day.count : ''}</span>
                <span className="week-bar-track">
                  <span
                    className="week-bar-fill"
                    style={{ height: `${Math.max(day.count > 0 ? 12 : 3, (day.count / maxBar) * 100)}%` }}
                  />
                </span>
                <span className="week-bar-label">{day.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card projects-overview-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Project pulse</span>
              <h2>Where the work lives</h2>
            </div>
            <button className="text-button" onClick={() => navigate('/projects')}>
              View projects <ArrowRight size={14} />
            </button>
          </div>
          <div className="project-mini-grid">
            {analysis.projectCards.map(({ project, progress, doneCount, total }) => {
              const members = project.memberIds
                .map((id) => userMap.get(id))
                .filter((person): person is NonNullable<typeof person> => Boolean(person))
              return (
                <button
                  key={project.id}
                  className="project-mini"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <div className="project-mini-head">
                    <ProjectGlyph project={project} size="sm" />
                    <span className="project-mini-name">{project.name}</span>
                    <ArrowRight size={14} />
                  </div>
                  <p>{project.description}</p>
                  <div className="project-mini-progress">
                    <ProgressBar value={progress} tone={project.color} />
                    <span>{progress}%</span>
                  </div>
                  <div className="project-mini-foot">
                    <AvatarStack users={members} max={3} size="xs" />
                    <span>{doneCount}/{total} tasks</span>
                    {project.dueDate && <span className="project-mini-due"><CalendarDays size={12} /> {formatDueDate(project.dueDate)}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card memory-preview-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Memory</span>
              <h2>Recently in motion</h2>
            </div>
            <button className="text-button" onClick={() => navigate('/memory')}>
              All activity <ArrowRight size={14} />
            </button>
          </div>
          <div className="activity-preview">
            {analysis.activities.map((activity) => {
              const actor = userMap.get(activity.actorId)
              if (!actor) return null
              return (
                <button className="activity-line" key={activity.id} onClick={() => openActivity(activity)}>
                  <Avatar name={actor.name} tone={actor.tone} size="xs" />
                  <span>
                    <strong>{actor.name.split(' ')[0]}</strong> {activity.message}
                  </span>
                  <time>{formatRelativeTime(activity.createdAt)}</time>
                </button>
              )
            })}
          </div>
          <button className="memory-teaser" onClick={() => navigate('/memory')}>
            <Brain size={16} />
            <span>
              <strong>Cadence remembers what you touched.</strong>
              <small>Local activity, searches, and your last place.</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </section>
      </div>
    </div>
  )
}
