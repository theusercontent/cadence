import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Coffee,
  Feather,
  Hourglass,
  ListTodo,
  PenLine,
  Search,
  Sunrise,
  Target,
  UserRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader } from '../components/TaskRow'
import { EmptyState, PriorityFlag, ProjectGlyph } from '../components/ui'
import { assigneeDisplayName } from '../lib/assignees'
import {
  formatDateTime,
  formatDueDate,
  formatShortDate,
  toISODate,
} from '../lib/dates'
import {
  buildWeeklyReviewSnapshot,
  daysSince,
  reviewForWeek,
  reviewHistory,
  WEEKLY_INTENTION_LIMIT,
  WEEKLY_PRIORITY_LIMIT,
  weekRange,
  weekRangeForReview,
} from '../lib/review'
import { cx, pluralize } from '../lib/utils'
import type { Task } from '../types'

function MovementHead({
  number,
  eyebrow,
  title,
  aside,
}: {
  number: string
  eyebrow: string
  title: string
  aside?: ReactNode
}) {
  return (
    <header className="weekly-movement-head">
      <span className="weekly-movement-number" aria-hidden="true">{number}</span>
      <div className="weekly-movement-title">
        <span className="card-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {aside && <div className="weekly-movement-aside">{aside}</div>}
    </header>
  )
}

export function WeeklyPage() {
  const { data, currentUser, settings, navigate, saveWeeklyReview, notify } = useStore()
  const { openTask } = useAppUI()
  const user = currentUser!
  const range = useMemo(() => weekRange(new Date(), settings.weekStartsOn), [settings.weekStartsOn])
  const snapshot = useMemo(() => buildWeeklyReviewSnapshot(user, data, range), [user, data, range])
  const existingReview = useMemo(
    () => reviewForWeek(data.reviews, user.id, range.start),
    [data.reviews, user.id, range.start],
  )
  const history = useMemo(
    () => reviewHistory(data.reviews, user.id).filter((review) => review.weekStart !== range.start),
    [data.reviews, user.id, range.start],
  )
  const openMap = useMemo(() => new Map(snapshot.open.map((task) => [task.id, task])), [snapshot.open])
  const [intention, setIntention] = useState(existingReview?.intention ?? '')
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    (existingReview?.priorityIds ?? [])
      .filter((id) => snapshot.open.some((task) => task.id === id))
      .slice(0, WEEKLY_PRIORITY_LIMIT),
  )
  const [taskSearch, setTaskSearch] = useState('')

  useEffect(() => {
    setIntention(existingReview?.intention ?? '')
    setSelectedIds(
      (existingReview?.priorityIds ?? [])
        .filter((id) => snapshot.open.some((task) => task.id === id))
        .slice(0, WEEKLY_PRIORITY_LIMIT),
    )
    setTaskSearch('')
    // The review is the source of truth only when it is first loaded or saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReview?.id, existingReview?.reviewedAt, range.start])

  useEffect(() => {
    const openIds = new Set(snapshot.open.map((task) => task.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => openIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [snapshot.open])

  const selectedTasks = selectedIds
    .map((id) => openMap.get(id))
    .filter((task): task is Task => Boolean(task))
  const limitReached = selectedIds.length >= WEEKLY_PRIORITY_LIMIT
  const needle = taskSearch.trim().toLowerCase()
  const candidates = snapshot.open.filter((task) => {
    if (!needle) return true
    const project = data.projects.find((item) => item.id === task.projectId)
    return (
      task.title.toLowerCase().includes(needle) ||
      project?.name.toLowerCase().includes(needle) ||
      assigneeDisplayName(task, data.users).toLowerCase().includes(needle)
    )
  })
  const projectLookup = useMemo(
    () => new Map(data.projects.map((project) => [project.id, project])),
    [data.projects],
  )
  const maxDay = Math.max(1, ...snapshot.days.map((day) => day.count))
  const signalCount = snapshot.overdue.length + snapshot.stalled.length + snapshot.unassigned.length
  const heroTitle = existingReview
    ? 'The week is closed.'
    : snapshot.completed.length > 0
      ? 'The week has shape.'
      : 'Make a little room.'
  const heroCopy = existingReview
    ? `You closed this Cadence on ${formatDateTime(existingReview.reviewedAt)}. ${
        existingReview.intention
          ? 'Your intention is waiting in Memory.'
          : 'The review is held even without a written intention.'
      }`
    : 'Look back at what moved, notice what is asking for attention, and choose the rhythm for the week ahead.'

  const taskMeta = (task: Task) => {
    const project = projectLookup.get(task.projectId)
    const owner = assigneeDisplayName(task, data.users)
    return [
      project?.name,
      task.dueDate ? formatDueDate(task.dueDate) : 'No date',
      owner || 'Unassigned',
    ].filter(Boolean).join(' · ')
  }

  const togglePriority = (taskId: string) => {
    setSelectedIds((current) => {
      if (current.includes(taskId)) return current.filter((id) => id !== taskId)
      if (current.length >= WEEKLY_PRIORITY_LIMIT) return current
      return [...current, taskId]
    })
  }

  const handleSave = () => {
    try {
      saveWeeklyReview({
        weekStart: range.start,
        weekEnd: range.end,
        intention,
        priorityIds: selectedIds,
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The Cadence could not be saved.', 'error')
    }
  }

  const scrollToChoose = () => {
    document.getElementById('weekly-choose')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="page page-weekly">
      <PageHeader
        eyebrow="The weekly ritual"
        title="Weekly Cadence"
        description="A quiet five-minute review: notice what moved, make space for what stalled, and choose the rhythm for next week."
        actions={
          <span className={cx('weekly-status-pill', existingReview && 'is-closed')}>
            {existingReview ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
            <span>{existingReview ? 'Week closed' : 'Week open'}</span>
            <strong>{range.label}</strong>
          </span>
        }
      />

      <section className={cx('card weekly-hero', existingReview && 'is-closed')}>
        <div className="weekly-hero-copy">
          <span className="card-eyebrow"><Sunrise size={13} /> Week {range.weekNumber} · {range.label}</span>
          <h2>{heroTitle}</h2>
          <p>{heroCopy}</p>
          <div className="weekly-hero-meta">
            <span><CheckCircle2 size={13} /> {snapshot.completed.length} finished</span>
            <span><ListTodo size={13} /> {snapshot.open.length} open</span>
          </div>
          <div className="weekly-hero-actions">
            <a className="button button-primary" href="#weekly-lookback">
              {existingReview ? 'Walk it again' : 'Begin the review'} <ArrowDown size={15} />
            </a>
            {existingReview && (
              <button className="button button-secondary" onClick={scrollToChoose}>
                Choose next week <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="weekly-rhythm" aria-label={`${snapshot.completed.length} tasks finished this week`}>
          <div className="weekly-rhythm-head">
            <span>This week’s rhythm</span>
            <span className="weekly-rhythm-total">
              <strong>{snapshot.completed.length}</strong>
              <small>finished</small>
            </span>
          </div>
          <div className="weekly-rhythm-days">
            {snapshot.days.map((day) => (
              <div className={cx('weekly-day', day.isToday && 'is-today')} key={day.iso}>
                <span className="weekly-day-count">{day.count || '·'}</span>
                <span className="weekly-day-track">
                  <span
                    className="weekly-day-fill"
                    style={{ height: `${Math.max(day.count > 0 ? 14 : 3, (day.count / maxDay) * 100)}%` }}
                  />
                </span>
                <span className="weekly-day-label">{day.label}</span>
              </div>
            ))}
          </div>
          <p className="weekly-rhythm-foot">
            {snapshot.projectsMoved.length} {pluralize(snapshot.projectsMoved.length, 'project')} moved
            <span aria-hidden="true">·</span>
            {snapshot.open.length} still open
          </p>
        </div>
      </section>

      <div className="weekly-layout">
        <div className="weekly-main">
          <section className="card weekly-movement" id="weekly-lookback">
            <MovementHead
              number="01"
              eyebrow="Look back"
              title="What moved this week?"
              aside={<span className="weekly-movement-chip">{snapshot.completed.length} finished</span>}
            />
            <div className="weekly-lookback">
              <div className="weekly-wins">
                {snapshot.completed.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Coffee size={21} />}
                    title="A quiet week."
                    description="Nothing was finished this week. That is information, not a failure."
                  />
                ) : (
                  <>
                    {snapshot.completed.slice(0, 5).map((task) => {
                      const project = projectLookup.get(task.projectId)
                      return (
                        <button className="weekly-win" key={task.id} onClick={() => openTask(task.id)}>
                          <span className="weekly-win-icon"><Check size={13} /></span>
                          <span className="weekly-win-copy">
                            <strong>{task.title}</strong>
                            <small>
                              {project?.name ?? 'Project'}
                              {task.completedAt ? ` · finished ${formatShortDate(toISODate(new Date(task.completedAt)))}` : ''}
                            </small>
                          </span>
                          <ArrowUpRight size={14} />
                        </button>
                      )
                    })}
                    {snapshot.completed.length > 5 && (
                      <span className="weekly-more">+{snapshot.completed.length - 5} more finished this week</span>
                    )}
                  </>
                )}
              </div>

              <div className="weekly-project-panel">
                <span className="card-eyebrow">Projects in motion</span>
                {snapshot.projectsMoved.length === 0 ? (
                  <p className="weekly-empty-note">No project movement yet.</p>
                ) : (
                  <>
                    {snapshot.projectsMoved.slice(0, 4).map(({ project, completed, touched }) => (
                      <button
                        className="weekly-project-row"
                        key={project.id}
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <ProjectGlyph project={project} size="sm" />
                        <span className="weekly-project-copy">
                          <strong>{project.name}</strong>
                          <small>{completed} finished · {touched} touched</small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                    {snapshot.projectsMoved.length > 4 && (
                      <span className="weekly-more">
                        +{snapshot.projectsMoved.length - 4} more in motion
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="card weekly-movement" id="weekly-notice">
            <MovementHead
              number="02"
              eyebrow="Notice"
              title="What needs a gentler look?"
              aside={
                <span className={cx('weekly-movement-chip', signalCount === 0 && 'is-clear')}>
                  {signalCount === 0 ? 'Nothing stuck' : `${signalCount} to notice`}
                </span>
              }
            />
            <div className="weekly-signals">
              {[
                {
                  key: 'overdue',
                  tone: 'red',
                  icon: <Clock3 size={15} />,
                  label: 'Overdue',
                  description: 'Past due and still open',
                  tasks: snapshot.overdue,
                  meta: (task: Task) => (task.dueDate ? formatDueDate(task.dueDate) : 'No date'),
                },
                {
                  key: 'stalled',
                  tone: 'orange',
                  icon: <Hourglass size={15} />,
                  label: 'Gone quiet',
                  description: `No change for ${14}+ days`,
                  tasks: snapshot.stalled,
                  meta: (task: Task) => `${daysSince(task.updatedAt)}d quiet`,
                },
                {
                  key: 'unassigned',
                  tone: 'blue',
                  icon: <UserRound size={15} />,
                  label: 'Needs an owner',
                  description: 'Open work with no name',
                  tasks: snapshot.unassigned,
                  meta: () => 'Unassigned',
                },
              ].map((signal) => (
                <article className={cx('weekly-signal', `weekly-signal-${signal.tone}`)} key={signal.key}>
                  <header>
                    <span className="weekly-signal-icon">{signal.icon}</span>
                    <div>
                      <strong>{signal.label}</strong>
                      <small>{signal.description}</small>
                    </div>
                    <span className="weekly-signal-count">{signal.tasks.length}</span>
                  </header>
                  <div className="weekly-signal-items">
                    {signal.tasks.length === 0 ? (
                      <p className="weekly-signal-clear">Nothing here. Lovely.</p>
                    ) : (
                      signal.tasks.slice(0, 3).map((task) => (
                        <button key={task.id} onClick={() => openTask(task.id)}>
                          <span>{task.title}</span>
                          <small>{signal.meta(task)}</small>
                        </button>
                      ))
                    )}
                    {signal.tasks.length > 3 && (
                      <span className="weekly-more">+{signal.tasks.length - 3} more</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {snapshot.external.length > 0 && (
              <p className="weekly-external-note">
                <UserRound size={14} />
                {snapshot.external.length} {pluralize(snapshot.external.length, 'external owner')} tracked by name only. They have no workspace access, but their work still counts here.
              </p>
            )}
          </section>

          <section className="card weekly-movement weekly-choose" id="weekly-choose">
            <MovementHead
              number="03"
              eyebrow="Choose"
              title="Choose next week’s rhythm."
              aside={
                <span className={cx('weekly-movement-chip', limitReached && 'is-full')}>
                  {selectedIds.length}/{WEEKLY_PRIORITY_LIMIT} chosen
                </span>
              }
            />
            <div className="weekly-choose-layout">
              <div className="weekly-choice-panel">
                <div className="weekly-choice-head">
                  <div>
                    <span className="card-eyebrow">Priorities</span>
                    <h3>Carry only what matters.</h3>
                  </div>
                  <label className="search-field weekly-choice-search">
                    <Search size={14} />
                    <input
                      value={taskSearch}
                      onChange={(event) => setTaskSearch(event.target.value)}
                      placeholder="Find a task…"
                      aria-label="Find a task to prioritize"
                    />
                    {taskSearch && (
                      <button className="search-clear" onClick={() => setTaskSearch('')} aria-label="Clear task search">
                        <X size={13} />
                      </button>
                    )}
                  </label>
                </div>

                {selectedTasks.length > 0 && (
                  <div className="weekly-picked" aria-label="Selected priorities">
                    {selectedTasks.map((task, index) => (
                      <span className="weekly-picked-chip" key={task.id}>
                        <span className="weekly-picked-number">{index + 1}</span>
                        <span>{task.title}</span>
                        <button
                          onClick={() => togglePriority(task.id)}
                          aria-label={`Remove ${task.title} from priorities`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="weekly-choice-list" role="group" aria-label="Choose up to three priorities">
                  {candidates.length === 0 ? (
                    <p className="weekly-empty-note">
                      {snapshot.open.length === 0
                        ? 'Nothing is open. A clear horizon.'
                        : 'No open tasks match that search.'}
                    </p>
                  ) : (
                    candidates.map((task) => {
                      const selected = selectedIds.includes(task.id)
                      const disabled = !selected && limitReached
                      return (
                        <button
                          className={cx('weekly-choice', selected && 'is-selected')}
                          key={task.id}
                          onClick={() => togglePriority(task.id)}
                          disabled={disabled}
                          aria-pressed={selected}
                          title={disabled ? 'Three priorities is enough for one week.' : undefined}
                        >
                          <span className="weekly-choice-check">{selected && <Check size={12} />}</span>
                          <span className="weekly-choice-copy">
                            <strong>{task.title}</strong>
                            <small>{taskMeta(task)}</small>
                          </span>
                          <PriorityFlag priority={task.priority} />
                        </button>
                      )
                    })
                  )}
                </div>
                <p className="weekly-choice-hint">
                  {limitReached
                    ? 'Three is the limit. A week needs room to breathe.'
                    : 'Choose up to three. You can revisit this before closing the week.'}
                </p>
              </div>

              <div className="weekly-intention-panel">
                <span className="card-eyebrow"><PenLine size={13} /> The intention</span>
                <label className="weekly-intention-label" htmlFor="weekly-intention">
                  What should next week feel like?
                </label>
                <textarea
                  id="weekly-intention"
                  value={intention}
                  onChange={(event) => setIntention(event.target.value)}
                  maxLength={WEEKLY_INTENTION_LIMIT}
                  rows={5}
                  placeholder="A quieter launch. Fewer open loops. Make room for the work that matters."
                />
                <div className="weekly-intention-count">
                  <span>Saved with this week’s Cadence</span>
                  <strong>{intention.length}/{WEEKLY_INTENTION_LIMIT}</strong>
                </div>
                {snapshot.dueNextWeek.length > 0 && (
                  <div className="weekly-next-week">
                    <CalendarDays size={15} />
                    <span>
                      <strong>{snapshot.dueNextWeek.length} {pluralize(snapshot.dueNextWeek.length, 'task')} due next week</strong>
                      already on the calendar.
                    </span>
                  </div>
                )}
                <p className="weekly-intention-privacy">
                  <Feather size={13} /> Private to you, and only on this device.
                </p>
              </div>
            </div>
          </section>

          <section className={cx('card weekly-close', existingReview && 'is-closed')} id="weekly-close">
            <div className="weekly-close-mark" aria-hidden="true"><Feather size={22} /></div>
            <div className="weekly-close-copy">
              <span className="card-eyebrow">04 · Close the week</span>
              <h2>{existingReview ? 'The Cadence is held.' : 'Let the week rest.'}</h2>
              <p>
                {existingReview
                  ? `Saved ${formatDateTime(existingReview.reviewedAt)}. Come back if the shape of next week changes.`
                  : 'Save a quiet record of the week and carry only what matters into the next one.'}
              </p>
              <div className="weekly-close-meta">
                <span><Target size={13} /> {selectedTasks.length} {pluralize(selectedTasks.length, 'priority', 'priorities')}</span>
                <span><PenLine size={13} /> {intention.trim() ? 'Intention set' : 'No intention yet'}</span>
                <span><CheckCircle2 size={13} /> {snapshot.completed.length} finished</span>
              </div>
            </div>
            <button className="button button-primary weekly-close-button" onClick={handleSave}>
              <CheckCircle2 size={16} />
              {existingReview ? 'Update the Cadence' : 'Close the week'}
            </button>
          </section>
        </div>

        <aside className="weekly-aside">
          <section className="card weekly-intention-card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow">Held in Memory</span>
                <h2>{existingReview ? 'Your intention' : 'A gentle prompt'}</h2>
              </div>
              <Feather size={17} />
            </div>
            {existingReview ? (
              <>
                <blockquote>
                  {existingReview.intention
                    ? `“${existingReview.intention}”`
                    : '“No intention written. The week is still closed.”'}
                </blockquote>
                <p className="weekly-intention-meta">
                  {range.label} · closed {formatShortDate(toISODate(new Date(existingReview.reviewedAt)))}
                </p>
                <button className="text-button" onClick={scrollToChoose}>
                  Revisit next week <ArrowRight size={13} />
                </button>
              </>
            ) : (
              <>
                <p className="weekly-aside-soft">
                  You do not need the perfect words. One clear sentence is enough to give the week a direction.
                </p>
                <button className="text-button" onClick={scrollToChoose}>
                  Set the tone <ArrowRight size={13} />
                </button>
              </>
            )}
          </section>

          <section className="card weekly-history-card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow">The trail</span>
                <h2>Previous Cadences</h2>
              </div>
              {history.length > 0 && <span className="card-tag">{history.length}</span>}
            </div>
            {history.length === 0 ? (
              <p className="weekly-history-empty">
                Closed weeks gather here, with their intention and finished work.
              </p>
            ) : (
              <div className="weekly-history">
                {history.slice(0, 5).map((review) => {
                  const reviewRange = weekRangeForReview(review)
                  return (
                    <article className="weekly-history-row" key={review.id}>
                      <span className="weekly-history-week">
                        <strong>Week {reviewRange.weekNumber}</strong>
                        <small>{reviewRange.label}</small>
                      </span>
                      <span className="weekly-history-copy">
                        {review.intention || 'No intention written'}
                      </span>
                      <span className="weekly-history-count" title={`${review.completedCount} tasks finished`}>
                        <Check size={11} /> {review.completedCount}
                      </span>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="card weekly-note-card">
            <Feather size={17} />
            <p>“A week is a small unit of change. Close it gently.”</p>
            <span>Cadence principle</span>
          </section>
        </aside>
      </div>
    </div>
  )
}
