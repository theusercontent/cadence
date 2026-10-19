import { useMemo, useState } from 'react'
import {
  Check,
  Crown,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { PageHeader } from '../components/TaskRow'
import { Avatar, EmptyState, RoleBadge } from '../components/ui'
import {
  canManageUsers,
  canViewUser,
  permissionSummary,
  roleBadgeTone,
  visibleTasks,
} from '../lib/permissions'
import { formatRelativeTime } from '../lib/dates'
import { cx, pluralize } from '../lib/utils'
import type { Role } from '../types'
import { ROLE_LABELS } from '../types'
import { UserModal } from './UserModal'

const CAPABILITIES: Array<{ label: string; roles: Record<Role, boolean> }> = [
  { label: 'View shared work', roles: { admin: true, manager: true, employee: true, viewer: true } },
  { label: 'Create tasks', roles: { admin: true, manager: true, employee: true, viewer: false } },
  { label: 'Edit assigned tasks', roles: { admin: true, manager: true, employee: true, viewer: false } },
  { label: 'Create department projects', roles: { admin: true, manager: true, employee: false, viewer: false } },
  { label: 'Manage all projects', roles: { admin: true, manager: false, employee: false, viewer: false } },
  { label: 'Manage people & roles', roles: { admin: true, manager: false, employee: false, viewer: false } },
  { label: 'Backup & restore workspace', roles: { admin: true, manager: false, employee: false, viewer: false } },
]

export function TeamPage() {
  const { data, currentUser } = useStore()
  const user = currentUser!
  const [department, setDepartment] = useState('All')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [managePersonId, setManagePersonId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const managePerson = managePersonId ? data.users.find((person) => person.id === managePersonId) ?? null : null

  const people = useMemo(
    () => data.users.filter((person) => canViewUser(user, person)),
    [data.users, user],
  )
  const tasks = useMemo(() => visibleTasks(user, data), [user, data])
  const departments = useMemo(
    () => ['All', ...Array.from(new Set(people.map((person) => person.department))).sort()],
    [people],
  )
  const taskCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      if (task.assigneeId && task.status !== 'done') {
        counts.set(task.assigneeId, (counts.get(task.assigneeId) ?? 0) + 1)
      }
    }
    return counts
  }, [tasks])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return people
      .filter((person) => department === 'All' || person.department === department)
      .filter((person) => roleFilter === 'all' || person.role === roleFilter)
      .filter((person) => !needle || person.name.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle) || person.title.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (a.id === user.id) return -1
        if (b.id === user.id) return 1
        if (a.active !== b.active) return a.active ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [people, department, roleFilter, search, user.id])

  const activeCount = people.filter((person) => person.active).length
  const leadCount = people.filter((person) => person.role === 'admin' || person.role === 'manager').length
  const departmentCount = new Set(people.map((person) => person.department)).size
  const manager = canManageUsers(user)

  return (
    <div className="page page-team">
      <PageHeader
        eyebrow="The people"
        title="Team"
        description="A small, legible directory. Roles are applied locally to everything you can see and change."
        actions={
          manager ? (
            <button className="button button-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Add teammate
            </button>
          ) : undefined
        }
      />

      <section className="team-summary-grid">
        <article className="card team-access-card">
          <div className="team-access-icon"><ShieldCheck size={20} /></div>
          <div>
            <span className="card-eyebrow">Your access</span>
            <h2>{ROLE_LABELS[user.role]}</h2>
            <p>{permissionSummary(user)}</p>
          </div>
          <RoleBadge role={user.role} />
        </article>
        <article className="card team-stat">
          <span className="stat-icon stat-blue"><UsersRound size={18} /></span>
          <strong>{activeCount}</strong>
          <span>active {pluralize(activeCount, 'person', 'people')}</span>
        </article>
        <article className="card team-stat">
          <span className="stat-icon stat-purple"><Crown size={18} /></span>
          <strong>{leadCount}</strong>
          <span>admins & managers</span>
        </article>
        <article className="card team-stat">
          <span className="stat-icon stat-green"><UserRound size={18} /></span>
          <strong>{departmentCount}</strong>
          <span>departments</span>
        </article>
      </section>

      <section className="team-toolbar card">
        <div className="department-chips">
          {departments.map((item) => (
            <button
              key={item}
              className={cx('chip chip-button', department === item && 'is-active')}
              onClick={() => setDepartment(item)}
            >
              {item}
              {item === 'All' && <span className="chip-count">{people.length}</span>}
            </button>
          ))}
        </div>
        <div className="team-toolbar-right">
          <label className="search-field">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people…" aria-label="Search people" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="search-clear"><X size={14} /></button>}
          </label>
          <label className="select-field">
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | Role)} aria-label="Filter by role">
              <option value="all">All roles</option>
              {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={<UsersRound size={26} />}
            title="No one matches."
            description="Try another department, role, or search term."
            action={<button className="button button-quiet" onClick={() => { setSearch(''); setDepartment('All'); setRoleFilter('all') }}>Clear filters</button>}
          />
        </section>
      ) : (
        <div className="people-grid">
          {filtered.map((person) => (
            <article className={cx('person-card card', !person.active && 'is-inactive')} key={person.id}>
              <div className="person-card-top">
                <Avatar name={person.name} tone={person.tone} size="lg" />
                <div className="person-card-badges">
                  {person.id === user.id && <span className="badge badge-you">You</span>}
                  <RoleBadge role={person.role} />
                </div>
              </div>
              <h2>{person.name}</h2>
              <p className="person-title">{person.title}</p>
              <div className="person-meta">
                <span className="person-department">{person.department}</span>
                <span className="person-email">{person.email}</span>
              </div>
              <div className="person-work">
                <div>
                  <span>Visible open work</span>
                  <strong>{taskCounts.get(person.id) ?? 0}</strong>
                </div>
                <div>
                  <span>Last seen</span>
                  <strong>{person.lastSeenAt ? formatRelativeTime(person.lastSeenAt) : 'Never'}</strong>
                </div>
              </div>
              <div className="person-foot">
                <span className={cx('status-pill', person.active ? 'is-active' : 'is-inactive')}>
                  <span /> {person.active ? 'Active' : 'Paused'}
                </span>
                {manager && (
                  <button className="button button-quiet button-compact" onClick={() => setManagePersonId(person.id)}>
                    Manage
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="card access-matrix-card">
        <div className="card-head">
          <div>
            <span className="card-eyebrow">Role-based access</span>
            <h2>What each role can do</h2>
          </div>
          <span className="card-tag"><ShieldCheck size={13} /> Local rules</span>
        </div>
        <div className="access-matrix-wrap">
          <table className="access-matrix">
            <thead>
              <tr>
                <th>Capability</th>
                {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                  <th key={role}>
                    <span className={cx('role-matrix-label', `role-${roleBadgeTone(role)}`)}>{ROLE_LABELS[role]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((capability) => (
                <tr key={capability.label}>
                  <td>{capability.label}</td>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                    <td key={role}>
                      {capability.roles[role] ? (
                        <span className="access-yes"><Check size={15} /></span>
                      ) : (
                        <span className="access-no"><Minus size={15} /></span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="access-matrix-foot">
          These rules are enforced in the data layer, not just hidden in the interface. A viewer can never mutate work, and managers only manage projects in their department.
        </p>
      </section>

      <UserModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UserModal open={Boolean(managePerson)} person={managePerson} onClose={() => setManagePersonId(null)} />
    </div>
  )
}
