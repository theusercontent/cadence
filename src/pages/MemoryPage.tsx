import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Brain,
  CheckSquare2,
  Clock3,
  Download,
  FolderKanban,
  HardDrive,
  KeyRound,
  LogIn,
  Search,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader } from '../components/TaskRow'
import { Avatar, EmptyState, UserAvatar } from '../components/ui'
import { visibleActivities } from '../lib/permissions'
import { formatDateTime, formatLongDate, formatRelativeTime, toISODate, todayISO, dateOffsetISO } from '../lib/dates'
import { storageFootprint } from '../lib/storage'
import { cx, pluralize } from '../lib/utils'
import type { Activity } from '../types'

type MemoryFilter = 'all' | 'tasks' | 'projects' | 'people' | 'sessions'

const ROUTE_LABELS: Record<string, string> = {
  '/overview': 'Overview',
  '/tasks': 'Tasks',
  '/board': 'Board',
  '/calendar': 'Calendar',
  '/projects': 'Projects',
  '/team': 'Team',
  '/memory': 'Memory',
  '/settings': 'Settings',
}

function routeLabel(route: string): string {
  if (route.startsWith('/projects/')) return 'A project'
  return ROUTE_LABELS[route] ?? 'Overview'
}

function categoryFor(activity: Activity): Exclude<MemoryFilter, 'all'> {
  if (activity.entityType === 'task') return 'tasks'
  if (activity.entityType === 'project') return 'projects'
  if (activity.entityType === 'user') return 'people'
  return 'sessions'
}

function dateBucket(activity: Activity): string {
  const iso = toISODate(new Date(activity.createdAt))
  if (iso === todayISO()) return 'Today'
  if (iso === dateOffsetISO(-1)) return 'Yesterday'
  const date = new Date(activity.createdAt)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  }).format(date)
}

export function MemoryPage() {
  const { data, currentUser, navigate, clearRecentSearches, exportPersonal, notify } = useStore()
  const { openTask, openPalette } = useAppUI()
  const user = currentUser!
  const [filter, setFilter] = useState<MemoryFilter>('all')
  const [search, setSearch] = useState('')

  const memory = data.memory[user.id]
  const lastTask = memory?.lastTaskId ? data.tasks.find((task) => task.id === memory.lastTaskId) : null
  const footprint = storageFootprint(data)
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])
  const visible = useMemo(() => visibleActivities(user, data), [user, data])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return visible.filter((activity) => {
      if (filter !== 'all' && categoryFor(activity) !== filter) return false
      if (!needle) return true
      const actor = userMap.get(activity.actorId)
      return activity.message.toLowerCase().includes(needle) || actor?.name.toLowerCase().includes(needle)
    })
  }, [visible, filter, search, userMap])

  const groups = useMemo(() => {
    const grouped = new Map<string, Activity[]>()
    for (const activity of filtered) {
      const bucket = dateBucket(activity)
      const list = grouped.get(bucket) ?? []
      list.push(activity)
      grouped.set(bucket, list)
    }
    return Array.from(grouped.entries()).map(([label, activities]) => ({ label, activities }))
  }, [filtered])

  const counts = useMemo(
    () => ({
      all: visible.length,
      tasks: visible.filter((activity) => categoryFor(activity) === 'tasks').length,
      projects: visible.filter((activity) => categoryFor(activity) === 'projects').length,
      people: visible.filter((activity) => categoryFor(activity) === 'people').length,
      sessions: visible.filter((activity) => categoryFor(activity) === 'sessions').length,
    }),
    [visible],
  )

  const activityIcon = (activity: Activity) => {
    switch (activity.entityType) {
      case 'task':
        return <CheckSquare2 size={14} />
      case 'project':
        return <FolderKanban size={14} />
      case 'user':
        return <UsersRound size={14} />
      case 'session':
        return <LogIn size={14} />
      default:
        return <Sparkles size={14} />
    }
  }

  const openActivity = (activity: Activity) => {
    if (activity.entityType === 'task' && activity.entityId) {
      if (data.tasks.some((task) => task.id === activity.entityId)) openTask(activity.entityId)
      else notify('That task is no longer in the workspace.', 'info')
    } else if (activity.entityType === 'project' && activity.entityId) {
      if (data.projects.some((project) => project.id === activity.entityId)) navigate(`/projects/${activity.entityId}`)
      else navigate('/projects')
    } else if (activity.entityType === 'user') {
      navigate('/team')
    }
  }

  const joinDate = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(user.createdAt))
  const openTaskCount = data.tasks.filter((task) => task.assigneeId === user.id && task.status !== 'done').length

  return (
    <div className="page page-memory">
      <PageHeader
        eyebrow="Local recall"
        title="Memory"
        description="A quiet record of what moved, what you searched for, and where you left off. Yours alone, on this device."
        actions={
          <button className="button button-secondary" onClick={exportPersonal}>
            <Download size={15} /> Export my data
          </button>
        }
      />

      <section className="memory-hero card">
        <div className="memory-orb" aria-hidden="true"><Brain size={32} /></div>
        <div className="memory-hero-copy">
          <span className="card-eyebrow">Remembered automatically</span>
          <h2>Your work leaves a gentle trail.</h2>
          <p>
            Cadence saves every change to this browser as you work. It also remembers your last page,
            the last task you opened, and the words you searched for.
          </p>
        </div>
        <div className="memory-hero-stats">
          <div><strong>{counts.all}</strong><span>recorded moments</span></div>
          <div><strong>{openTaskCount}</strong><span>open tasks</span></div>
          <div><strong>{memory?.logins ?? 1}</strong><span>sign-ins</span></div>
        </div>
      </section>

      <div className="memory-layout">
        <section className="card memory-timeline-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Activity</span>
              <h2>The local trail</h2>
            </div>
            <span className="card-tag"><HardDrive size={13} /> {footprint.label}</span>
          </div>

          <div className="memory-toolbar">
            <div className="filter-tabs" role="tablist" aria-label="Memory filters">
              {([
                ['all', 'Everything'],
                ['tasks', 'Tasks'],
                ['projects', 'Projects'],
                ['people', 'People'],
                ['sessions', 'Sign-ins'],
              ] as Array<[MemoryFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  className={cx('filter-tab', filter === value && 'is-active')}
                  onClick={() => setFilter(value)}
                  role="tab"
                  aria-selected={filter === value}
                >
                  {label}<span>{counts[value]}</span>
                </button>
              ))}
            </div>
            <label className="search-field memory-search">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Recall something…" aria-label="Search memory" />
              {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="search-clear"><X size={14} /></button>}
            </label>
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={<Brain size={24} />}
              title="Nothing to recall yet."
              description="As you work, the small moments gather here — automatically and only on this device."
            />
          ) : (
            <div className="timeline">
              {groups.map((group) => (
                <section className="timeline-group" key={group.label}>
                  <header className="timeline-date">
                    <span>{group.label}</span>
                    <span className="timeline-rule" />
                    <span>{group.activities.length}</span>
                  </header>
                  <div className="timeline-entries">
                    {group.activities.map((activity) => {
                      const actor = userMap.get(activity.actorId)
                      if (!actor) return null
                      const clickable = Boolean(activity.entityId)
                      return (
                        <button
                          key={activity.id}
                          className={cx('timeline-entry', clickable && 'is-clickable')}
                          onClick={() => clickable && openActivity(activity)}
                        >
                          <span className="timeline-avatar-wrap">
                            <UserAvatar user={actor} size="sm" />
                            <span className={cx('timeline-type', `type-${categoryFor(activity)}`)}>
                              {activityIcon(activity)}
                            </span>
                          </span>
                          <span className="timeline-copy">
                            <span><strong>{actor.name}</strong> {activity.message}</span>
                            <small>{formatDateTime(activity.createdAt)}</small>
                          </span>
                          <span className="timeline-time">{formatRelativeTime(activity.createdAt)}</span>
                          {clickable && <ArrowRight size={14} className="timeline-arrow" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          <footer className="memory-foot">
            <span>Activity is scoped by your role. Private work stays out of view.</span>
            <span>Stored in this browser</span>
          </footer>
        </section>

        <aside className="memory-aside">
          <section className="card memory-personal-card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow">Personal recall</span>
                <h2>Pick up where you left off</h2>
              </div>
            </div>
            <div className="recall-list">
              <button className="recall-row" onClick={() => navigate(memory?.lastRoute ?? '/overview')}>
                <span className="recall-icon"><Clock3 size={16} /></span>
                <span className="recall-copy">
                  <small>Last place</small>
                  <strong>{routeLabel(memory?.lastRoute ?? '/overview')}</strong>
                </span>
                <ArrowRight size={14} />
              </button>
              {lastTask ? (
                <button className="recall-row" onClick={() => openTask(lastTask.id)}>
                  <span className="recall-icon"><CheckSquare2 size={16} /></span>
                  <span className="recall-copy">
                    <small>Last task opened</small>
                    <strong>{lastTask.title}</strong>
                  </span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <div className="recall-row is-static">
                  <span className="recall-icon"><CheckSquare2 size={16} /></span>
                  <span className="recall-copy">
                    <small>Last task opened</small>
                    <strong>No task yet</strong>
                  </span>
                </div>
              )}
              <div className="recall-row is-static">
                <span className="recall-icon"><KeyRound size={16} /></span>
                <span className="recall-copy">
                  <small>Member since</small>
                  <strong>{joinDate}</strong>
                </span>
              </div>
            </div>

            <div className="search-memory">
              <div className="search-memory-head">
                <span><Search size={13} /> Recent searches</span>
                {memory?.recentSearches.length ? (
                  <button className="text-button" onClick={clearRecentSearches}><Trash2 size={12} /> Forget</button>
                ) : null}
              </div>
              {memory?.recentSearches.length ? (
                <div className="search-memory-chips">
                  {memory.recentSearches.map((term) => (
                    <button key={term} className="chip chip-button" onClick={() => openPalette(term)}>
                      {term}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Searches you choose from the command palette appear here.</p>
              )}
            </div>
          </section>

          <section className="card memory-storage-card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow">On this device</span>
                <h2>What’s remembered</h2>
              </div>
              <span className="local-dot" />
            </div>
            <dl className="memory-stats">
              <div><dt>Tasks</dt><dd>{data.tasks.length}</dd></div>
              <div><dt>Projects</dt><dd>{data.projects.length}</dd></div>
              <div><dt>People</dt><dd>{data.users.length}</dd></div>
              <div><dt>Comments</dt><dd>{data.tasks.reduce((sum, task) => sum + task.comments.length, 0)}</dd></div>
              <div><dt>Local size</dt><dd>{footprint.label}</dd></div>
            </dl>
            <p className="storage-note">
              Your workspace is saved in browser storage. Download a personal copy any time. Admins can create full workspace backups in Settings.
            </p>
            <button className="button button-secondary button-compact full-width" onClick={exportPersonal}>
              <Download size={14} /> Download my memory
            </button>
          </section>

          <section className="card memory-quote-card">
            <Sparkles size={18} />
            <p>“Memory is a quiet act of respect — for the work, and for the person doing it.”</p>
            <span>Cadence principle</span>
          </section>
        </aside>
      </div>
    </div>
  )
}
