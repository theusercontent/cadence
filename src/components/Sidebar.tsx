import {
  Brain,
  CalendarDays,
  Columns3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Plus,
  Settings2,
  UsersRound,
  WifiOff,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { BrandMark } from '../components/BrandMark'
import { Avatar } from '../components/ui'
import { canCreateTask, isWriter } from '../lib/permissions'
import { cx } from '../lib/utils'
import { storageFootprint } from '../lib/storage'
import { isOverdue } from '../lib/dates'

interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  badge?: number
  matches?: (path: string) => boolean
}

export function Sidebar() {
  const { data, currentUser, route, navigate, settings } = useStore()
  const { navOpen, setNavOpen, openComposer } = useAppUI()
  const user = currentUser!
  const footprint = storageFootprint(data)
  const myOpenTasks = data.tasks.filter(
    (task) => task.assigneeId === user.id && task.status !== 'done',
  )
  const dueCount = myOpenTasks.filter(
    (task) => task.dueDate && (task.dueDate <= new Date().toISOString().slice(0, 10) || isOverdue(task.dueDate, false)),
  ).length
  const showNew = canCreateTask(user)

  const projectMatch = (path: string) => path.startsWith('/projects')
  const items: Array<{ label?: string; nav: NavItem[] }> = [
    {
      nav: [
        { path: '/overview', label: 'Overview', icon: LayoutDashboard },
        { path: '/tasks', label: 'Tasks', icon: ListTodo, badge: dueCount },
        { path: '/board', label: 'Board', icon: Columns3 },
        { path: '/calendar', label: 'Calendar', icon: CalendarDays },
      ],
    },
    {
      label: 'Workspace',
      nav: [
        { path: '/projects', label: 'Projects', icon: FolderKanban, matches: projectMatch },
        { path: '/team', label: 'Team', icon: UsersRound },
      ],
    },
    {
      label: 'You',
      nav: [
        { path: '/memory', label: 'Memory', icon: Brain },
        { path: '/settings', label: 'Settings', icon: Settings2 },
      ],
    },
  ]

  const go = (path: string) => {
    navigate(path)
    setNavOpen(false)
  }

  return (
    <>
      {navOpen && <button className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}
      <aside className={cx('sidebar', navOpen && 'sidebar-open')}>
        <div className="sidebar-inner">
          <div className="sidebar-top">
            <button className="sidebar-brand" onClick={() => go('/overview')} aria-label="Cadence overview">
              <BrandMark />
              <span className="sidebar-brand-copy">
                <strong>Cadence</strong>
                <small>Local workspace</small>
              </span>
            </button>
            <button className="icon-button sidebar-close" onClick={() => setNavOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
          </div>

          {showNew && (
            <button className="sidebar-new button button-primary" onClick={() => openComposer()}>
              <Plus size={16} />
              New task
            </button>
          )}

          <nav className="sidebar-nav" aria-label="Main navigation">
            {items.map((group, groupIndex) => (
              <div className="nav-group" key={group.label ?? groupIndex}>
                {group.label && <p className="nav-label">{group.label}</p>}
                {group.nav.map((item) => {
                  const active = item.matches ? item.matches(route) : route === item.path
                  const Icon = item.icon
                  return (
                    <button
                      key={item.path}
                      className={cx('nav-item', active && 'nav-item-active')}
                      onClick={() => go(item.path)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <Icon size={17} strokeWidth={1.9} />
                      <span>{item.label}</span>
                      {Boolean(item.badge) && <span className="nav-badge">{item.badge}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-spacer" />

          <button className="sidebar-storage" onClick={() => go('/settings')}>
            <span className="sidebar-storage-icon"><WifiOff size={15} /></span>
            <span>
              <strong>Offline workspace</strong>
              <small>{footprint.label} saved on this device</small>
            </span>
            <span className="local-dot" aria-hidden="true" />
          </button>

          <div className="sidebar-user">
            <Avatar name={user.name} tone={user.tone} size="sm" />
            <span className="sidebar-user-copy">
              <strong>{user.name}</strong>
              <small>{user.role === 'admin' ? 'Workspace admin' : user.title}</small>
            </span>
            <span className={cx('sidebar-role-dot', `role-dot-${user.role}`)} title={user.role} />
          </div>
          <p className="sidebar-version">
            Cadence 1.3 · {settings.theme === 'system' ? 'Auto theme' : `${settings.theme} theme`}
          </p>
        </div>
      </aside>
    </>
  )
}
