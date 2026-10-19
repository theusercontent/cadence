import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader, TaskRow } from '../components/TaskRow'
import { EmptyState, UserAvatar } from '../components/ui'
import {
  canCreateTask,
  canEditTask,
  isAdmin,
  isManager,
  isViewer,
  visibleProjects,
  visibleTasks,
} from '../lib/permissions'
import { addDays, todayISO } from '../lib/dates'
import { cx, pluralize } from '../lib/utils'
import type { Task, TaskPriority } from '../types'
import { PRIORITY_LABELS } from '../types'

type TaskFilter = 'all' | 'today' | 'upcoming' | 'overdue' | 'done'
type SortMode = 'smart' | 'priority' | 'recent'

const FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Completed' },
]

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return [...tasks].sort((a, b) => {
    if (mode === 'priority') {
      const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
      if (priority !== 0) return priority
    }
    if (mode === 'recent') {
      return b.updatedAt.localeCompare(a.updatedAt)
    }
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    const priority = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    if (priority !== 0) return priority
    return a.order - b.order
  })
}

export function TasksPage() {
  const { data, currentUser, toggleTask, notify } = useStore()
  const { openTask, openComposer } = useAppUI()
  const user = currentUser!
  const viewer = isViewer(user)
  const defaultScope: 'mine' | 'all' = isAdmin(user) || isManager(user) || viewer ? 'all' : 'mine'
  const [scope, setScope] = useState<'mine' | 'all'>(defaultScope)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [search, setSearch] = useState('')
  const [projectId, setProjectId] = useState('all')
  const [priority, setPriority] = useState<'all' | TaskPriority>('all')
  const [sort, setSort] = useState<SortMode>('smart')
  const [showDone, setShowDone] = useState(false)

  const projects = useMemo(() => visibleProjects(user, data), [user, data])
  const projectMap = useMemo(() => new Map(data.projects.map((project) => [project.id, project])), [data.projects])
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])
  const today = todayISO()
  const weekEnd = addDays(today, 7)

  const scopedTasks = useMemo(() => {
    const tasks = visibleTasks(user, data)
    if (viewer) return tasks
    return scope === 'mine' ? tasks.filter((task) => task.assigneeId === user.id) : tasks
  }, [data, user, scope, viewer])

  const baseTasks = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return scopedTasks.filter((task) => {
      if (projectId !== 'all' && task.projectId !== projectId) return false
      if (priority !== 'all' && task.priority !== priority) return false
      if (!needle) return true
      const project = projectMap.get(task.projectId)
      return (
        task.title.toLowerCase().includes(needle) ||
        task.description.toLowerCase().includes(needle) ||
        task.labels.some((label) => label.toLowerCase().includes(needle)) ||
        project?.name.toLowerCase().includes(needle)
      )
    })
  }, [scopedTasks, projectId, priority, search, projectMap])

  const counts = useMemo(() => {
    const open = baseTasks.filter((task) => task.status !== 'done')
    return {
      all: baseTasks.length,
      today: baseTasks.filter((task) => task.dueDate === today).length,
      upcoming: open.filter((task) => Boolean(task.dueDate && task.dueDate > today)).length,
      overdue: open.filter((task) => Boolean(task.dueDate && task.dueDate < today)).length,
      done: baseTasks.filter((task) => task.status === 'done').length,
    }
  }, [baseTasks, today])

  const filtered = useMemo(() => {
    return baseTasks.filter((task) => {
      if (filter === 'today') return task.dueDate === today
      if (filter === 'upcoming') return task.status !== 'done' && Boolean(task.dueDate && task.dueDate > today)
      if (filter === 'overdue') return task.status !== 'done' && Boolean(task.dueDate && task.dueDate < today)
      if (filter === 'done') return task.status === 'done'
      return true
    })
  }, [baseTasks, filter, today])

  const openFiltered = filtered.filter((task) => task.status !== 'done')
  const doneFiltered = filtered.filter((task) => task.status === 'done')

  const groups = useMemo(() => {
    const build = (tasks: Task[]): Array<{ key: string; label: string; tasks: Task[] }> => {
      const buckets: Record<string, Task[]> = {
        overdue: [],
        today: [],
        tomorrow: [],
        week: [],
        later: [],
        none: [],
      }
      for (const task of tasks) {
        if (!task.dueDate) buckets.none.push(task)
        else if (task.dueDate < today) buckets.overdue.push(task)
        else if (task.dueDate === today) buckets.today.push(task)
        else if (task.dueDate === addDays(today, 1)) buckets.tomorrow.push(task)
        else if (task.dueDate <= weekEnd) buckets.week.push(task)
        else buckets.later.push(task)
      }
      const labels: Record<string, string> = {
        overdue: 'Overdue',
        today: 'Today',
        tomorrow: 'Tomorrow',
        week: 'This week',
        later: 'Later',
        none: 'No date',
        done: 'Completed',
      }
      return Object.entries(buckets)
        .filter(([, tasksInBucket]) => tasksInBucket.length > 0)
        .map(([key, tasksInBucket]) => ({
          key,
          label: labels[key],
          tasks: sortTasks(tasksInBucket, sort),
        }))
    }
    if (filter === 'all') {
      return build(openFiltered)
    }
    return []
  }, [filter, openFiltered, sort, today, weekEnd])

  const activeFilters = search || projectId !== 'all' || priority !== 'all' || filter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setProjectId('all')
    setPriority('all')
    setFilter('all')
  }

  const toggle = (task: Task) => {
    try {
      toggleTask(task.id)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const renderRows = (tasks: Task[]) =>
    tasks.map((task) => (
      <TaskRow
        key={task.id}
        task={task}
        project={projectMap.get(task.projectId)}
        assignee={task.assigneeId ? userMap.get(task.assigneeId) : undefined}
        canEdit={canEditTask(user, task, projectMap.get(task.projectId))}
        onOpen={() => openTask(task.id)}
        onToggle={() => toggle(task)}
      />
    ))

  return (
    <div className="page page-tasks">
      <PageHeader
        eyebrow="Your work"
        title="Tasks"
        description={
          viewer
            ? 'A calm read-only view of the work shared with you.'
            : 'One list for everything open, due, and done. Nothing buried.'
        }
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

      <section className="task-workspace card">
        <div className="task-toolbar">
          <div className="task-toolbar-top">
            {!viewer && (
              <div className="segmented segmented-sm" role="group" aria-label="Task scope">
                <button className={cx(scope === 'mine' && 'is-active')} onClick={() => setScope('mine')}>
                  My tasks
                </button>
                <button className={cx(scope === 'all' && 'is-active')} onClick={() => setScope('all')}>
                  {isAdmin(user) || isManager(user) ? 'All work' : 'Shared'}
                </button>
              </div>
            )}
            <div className="filter-tabs" role="tablist" aria-label="Task filters">
              {FILTERS.map((item) => (
                <button
                  key={item.value}
                  className={cx('filter-tab', filter === item.value && 'is-active')}
                  onClick={() => setFilter(item.value)}
                  role="tab"
                  aria-selected={filter === item.value}
                >
                  {item.label}
                  <span>{counts[item.value]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="task-toolbar-bottom">
            <label className="search-field">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search" className="search-clear">
                  <X size={14} />
                </button>
              )}
            </label>
            <label className="select-field">
              <ListFilter size={14} />
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filter by project">
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>
            <label className="select-field">
              <SlidersHorizontal size={14} />
              <select value={priority} onChange={(event) => setPriority(event.target.value as 'all' | TaskPriority)} aria-label="Filter by priority">
                <option value="all">Any priority</option>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                  <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <label className="select-field select-sort">
              <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} aria-label="Sort tasks">
                <option value="smart">Due date</option>
                <option value="priority">Priority</option>
                <option value="recent">Recently updated</option>
              </select>
            </label>
            {activeFilters && (
              <button className="text-button clear-filters" onClick={clearFilters}>
                <X size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {filter === 'all' ? (
          <div className="task-groups">
            {groups.length === 0 && doneFiltered.length === 0 && (
              <EmptyState
                icon={<CheckCircle2 size={26} />}
                title={activeFilters ? 'Nothing matches.' : 'A beautifully empty list.'}
                description={activeFilters ? 'Try a different filter or search.' : 'When work arrives, it will land right here.'}
                action={activeFilters ? (
                  <button className="button button-quiet" onClick={clearFilters}>Clear filters</button>
                ) : canCreateTask(user) ? (
                  <button className="button button-primary button-compact" onClick={() => openComposer()}>
                    <Plus size={15} /> Add the first task
                  </button>
                ) : undefined}
              />
            )}
            {groups.map((group) => (
              <section className="task-group" key={group.key}>
                <header className="task-group-head">
                  <div>
                    <span className={cx('task-group-dot', `dot-${group.key}`)} />
                    <h2>{group.label}</h2>
                    <span className="task-group-count">{group.tasks.length}</span>
                  </div>
                  {group.key === 'overdue' && <span className="group-note">Needs attention</span>}
                  {group.key === 'today' && <span className="group-note subtle"><CalendarDays size={12} /> Today</span>}
                </header>
                <div className="task-list">{renderRows(group.tasks)}</div>
              </section>
            ))}
            {doneFiltered.length > 0 && (
              <section className="task-group task-group-done">
                <button className="task-group-head task-group-toggle" onClick={() => setShowDone((current) => !current)}>
                  <div>
                    {showDone ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <h2>Completed</h2>
                    <span className="task-group-count">{doneFiltered.length}</span>
                  </div>
                  <span className="group-note subtle">A quiet record</span>
                </button>
                {showDone && <div className="task-list">{renderRows(sortTasks(doneFiltered, sort))}</div>}
              </section>
            )}
          </div>
        ) : (
          <div className="task-groups">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={26} />}
                title={
                  filter === 'done' ? 'Nothing completed yet.' :
                  filter === 'overdue' ? 'Nothing is overdue.' :
                  filter === 'today' ? 'Today is clear.' :
                  'The road ahead is quiet.'
                }
                description={
                  filter === 'done' ? 'Finished work will gather here over time.' :
                  filter === 'overdue' ? 'Everything is moving at its own pace.' :
                  filter === 'today' ? 'No tasks are due today. Enjoy the space.' :
                  'No upcoming dated work in this view.'
                }
                action={filter === 'today' && canCreateTask(user) ? (
                  <button className="button button-secondary button-compact" onClick={() => openComposer({ dueDate: today })}>
                    <Plus size={15} /> Plan something for today
                  </button>
                ) : undefined}
              />
            ) : (
              <div className="task-list">
                {renderRows(sortTasks(filtered, sort))}
              </div>
            )}
          </div>
        )}

        <footer className="task-workspace-foot">
          <span>{pluralize(filtered.length, 'task')} in this view</span>
          <span>Scoped by your role · {projects.length} accessible {pluralize(projects.length, 'project')}</span>
        </footer>
      </section>

      {scope === 'all' && !viewer && (
        <p className="tasks-scope-note">
          As {user.role === 'admin' ? 'an admin' : 'a manager'}, you can edit work across your scope. Tasks outside your access never leave this device.
        </p>
      )}
    </div>
  )
}
