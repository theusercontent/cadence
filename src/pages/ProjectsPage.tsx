import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  CalendarDays,
  FolderKanban,
  Plus,
  Search,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { PageHeader } from '../components/TaskRow'
import { AvatarStack, EmptyState, ProgressBar, ProjectGlyph } from '../components/ui'
import { canCreateProject, canEditProject, visibleProjects, visibleTasks } from '../lib/permissions'
import { formatDueDate, isOverdue } from '../lib/dates'
import { cx, pluralize } from '../lib/utils'
import type { ProjectStatus } from '../types'
import { VISIBILITY_LABELS } from '../types'
import { ProjectModal } from './ProjectModal'

type ProjectFilter = 'active' | 'paused' | 'completed' | 'all'

export function ProjectsPage() {
  const { data, currentUser, navigate } = useStore()
  const user = currentUser!
  const [filter, setFilter] = useState<ProjectFilter>('active')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const projects = useMemo(() => visibleProjects(user, data), [user, data])
  const tasks = useMemo(() => visibleTasks(user, data), [user, data])
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])

  const enriched = useMemo(
    () =>
      projects.map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id)
        const doneTasks = projectTasks.filter((task) => task.status === 'done')
        const members = project.memberIds
          .map((id) => userMap.get(id))
          .filter((person): person is NonNullable<typeof person> => Boolean(person && person.active))
        const lead = userMap.get(project.leadId)
        return {
          project,
          members,
          lead,
          total: projectTasks.length,
          open: projectTasks.length - doneTasks.length,
          done: doneTasks.length,
          progress: projectTasks.length ? Math.round((doneTasks.length / projectTasks.length) * 100) : 0,
        }
      }),
    [projects, tasks, userMap],
  )

  const counts = useMemo(
    () => ({
      active: enriched.filter((item) => item.project.status === 'active').length,
      paused: enriched.filter((item) => item.project.status === 'paused').length,
      completed: enriched.filter((item) => item.project.status === 'completed').length,
      all: enriched.length,
    }),
    [enriched],
  )

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return enriched
      .filter((item) => filter === 'all' || item.project.status === filter)
      .filter((item) => !needle || item.project.name.toLowerCase().includes(needle) || item.project.description.toLowerCase().includes(needle))
      .sort((a, b) => (a.project.dueDate ?? '9999').localeCompare(b.project.dueDate ?? '9999'))
  }, [enriched, filter, search])

  const statusTabs: Array<{ value: ProjectFilter; label: string }> = [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'completed', label: 'Completed' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div className="page page-projects">
      <PageHeader
        eyebrow="Bodies of work"
        title="Projects"
        description={
          canCreateProject(user)
            ? 'Clear containers for the work that takes more than a day.'
            : 'The shared bodies of work you have access to.'
        }
        actions={
          canCreateProject(user) ? (
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> New project
            </button>
          ) : undefined
        }
      />

      <section className="projects-toolbar card">
        <div className="filter-tabs" role="tablist" aria-label="Project status">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              className={cx('filter-tab', filter === tab.value && 'is-active')}
              onClick={() => setFilter(tab.value)}
              role="tab"
              aria-selected={filter === tab.value}
            >
              {tab.label}<span>{counts[tab.value]}</span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects…" aria-label="Search projects" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="search-clear"><X size={14} /></button>}
        </label>
      </section>

      {filtered.length === 0 ? (
        <section className="card">
          <EmptyState
            icon={<FolderKanban size={26} />}
            title={search ? 'No projects match.' : filter === 'active' ? 'No active projects.' : 'Nothing here yet.'}
            description={search ? 'Try a different search.' : 'A project gives related work a shared memory and a clear edge.'}
            action={canCreateProject(user) && !search ? (
              <button className="button button-primary button-compact" onClick={() => setModalOpen(true)}>
                <Plus size={15} /> Create a project
              </button>
            ) : undefined}
          />
        </section>
      ) : (
        <div className="project-grid">
          {filtered.map(({ project, members, lead, total, open, done, progress }) => {
            const projectOverdue = project.dueDate ? isOverdue(project.dueDate, project.status === 'completed') : false
            const editable = canEditProject(user, project)
            return (
              <article
                key={project.id}
                className="project-card card"
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/projects/${project.id}`)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${project.name}`}
              >
                <div className="project-card-top">
                  <ProjectGlyph project={project} />
                  <div className="project-card-badges">
                    <span className={cx('badge', `badge-project-${project.status}`)}>{project.status}</span>
                    {editable && <span className="badge badge-subtle">Can edit</span>}
                  </div>
                </div>
                <h2>{project.name}</h2>
                <p className="project-card-description">{project.description || 'No description yet.'}</p>
                <div className="project-card-meta">
                  <span><Building2 size={13} /> {project.department}</span>
                  <span><ShieldCheck size={13} /> {VISIBILITY_LABELS[project.visibility]}</span>
                  {project.dueDate && (
                    <span className={cx(projectOverdue && 'text-danger')}>
                      <CalendarDays size={13} /> {formatDueDate(project.dueDate, project.status === 'completed')}
                    </span>
                  )}
                </div>
                <div className="project-progress">
                  <div className="project-progress-head">
                    <span>{done} of {total} tasks done</span>
                    <strong>{progress}%</strong>
                  </div>
                  <ProgressBar value={progress} tone={project.color} />
                </div>
                <div className="project-card-foot">
                  <div className="project-people">
                    <AvatarStack users={members} max={4} size="sm" />
                    <span>{members.length} {pluralize(members.length, 'person', 'people')}</span>
                  </div>
                  <div className="project-open">
                    {open > 0 ? `${open} open` : 'All clear'}
                    <ArrowRight size={15} />
                  </div>
                </div>
                {lead && (
                  <div className="project-lead-line">
                    <span>Led by {lead.name}</span>
                    <span>{done} completed · {total} total</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {user.role === 'viewer' && (
        <div className="inline-note">
          <UsersRound size={15} />
          <span>Viewer access is read-only. You can explore any project shared with you, but the work stays untouched.</span>
        </div>
      )}

      <ProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={(project) => navigate(`/projects/${project.id}`)}
      />
    </div>
  )
}
