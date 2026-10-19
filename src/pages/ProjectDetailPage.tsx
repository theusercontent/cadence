import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Building2,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  PencilLine,
  Plus,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { TaskRow } from '../components/TaskRow'
import {
  Avatar,
  ConfirmDialog,
  EmptyState,
  ProgressBar,
  ProgressRing,
  ProjectGlyph,
} from '../components/ui'
import {
  canCreateTask,
  canDeleteProject,
  canEditProject,
  canEditTask,
  canViewProject,
  visibleActivities,
} from '../lib/permissions'
import {
  formatDateTime,
  formatDueDate,
  formatRelativeTime,
  isOverdue,
} from '../lib/dates'
import { cx, pct, pluralize } from '../lib/utils'
import { STATUS_LABELS, STATUS_ORDER, VISIBILITY_LABELS } from '../types'
import { ProjectModal } from './ProjectModal'

export function ProjectDetailPage() {
  const { data, currentUser, route, navigate, toggleTask, deleteProject, notify } = useStore()
  const { openTask, openComposer } = useAppUI()
  const user = currentUser!
  const projectId = route.split('/')[2]
  const project = data.projects.find((item) => item.id === projectId)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const projectTasks = useMemo(
    () => (project ? data.tasks.filter((task) => task.projectId === project.id) : []),
    [data.tasks, project],
  )
  const userMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])

  const activities = useMemo(() => {
    if (!project) return []
    const ids = new Set(projectTasks.map((task) => task.id))
    return visibleActivities(user, data)
      .filter(
        (activity) =>
          (activity.entityType === 'project' && activity.entityId === project.id) ||
          (activity.entityType === 'task' && activity.entityId && ids.has(activity.entityId)),
      )
      .slice(0, 6)
  }, [project, projectTasks, user, data])

  if (!project || !canViewProject(user, project)) {
    return (
      <div className="page">
        <button className="back-link" onClick={() => navigate('/projects')}>
          <ArrowLeft size={16} /> Projects
        </button>
        <section className="card">
          <EmptyState
            icon={<ShieldCheck size={26} />}
            title="This project isn’t available."
            description="It may not exist, or your role may not have access to it. Access rules are applied locally, every time."
            action={<button className="button button-secondary" onClick={() => navigate('/projects')}>See accessible projects</button>}
          />
        </section>
      </div>
    )
  }

  const done = projectTasks.filter((task) => task.status === 'done')
  const open = projectTasks.filter((task) => task.status !== 'done')
  const progress = pct(done.length, projectTasks.length)
  const members = project.memberIds
    .map((id) => userMap.get(id))
    .filter((person): person is NonNullable<typeof person> => Boolean(person && person.active))
  const lead = userMap.get(project.leadId)
  const editable = canEditProject(user, project)
  const writer = canCreateTask(user)
  const canDelete = canDeleteProject(user)
  const projectOverdue = project.dueDate ? isOverdue(project.dueDate, project.status === 'completed') : false

  const accessCopy =
    project.visibility === 'workspace'
      ? 'Everyone in the workspace can see this project.'
      : project.visibility === 'team'
        ? `Visible to ${project.department} and project members.`
        : 'Visible only to invited members and the lead.'

  const toggle = (taskId: string) => {
    try {
      toggleTask(taskId)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  return (
    <div className="page page-project-detail">
      <button className="back-link" onClick={() => navigate('/projects')}>
        <ArrowLeft size={16} /> All projects
      </button>

      <header className="project-hero card">
        <div className="project-hero-main">
          <ProjectGlyph project={project} size="lg" />
          <div className="project-hero-copy">
            <div className="project-hero-badges">
              <span className={cx('badge', `badge-project-${project.status}`)}>{project.status}</span>
              <span className="badge badge-subtle"><Building2 size={12} /> {project.department}</span>
              <span className="badge badge-subtle"><ShieldCheck size={12} /> {VISIBILITY_LABELS[project.visibility]}</span>
            </div>
            <h1>{project.name}</h1>
            <p>{project.description || 'No description yet.'}</p>
            <div className="project-hero-meta">
              <span><UsersRound size={14} /> {members.length} {pluralize(members.length, 'member')}</span>
              <span><ListTodo size={14} /> {open.length} open {pluralize(open.length, 'task')}</span>
              {project.dueDate && (
                <span className={cx(projectOverdue && 'text-danger')}>
                  <CalendarDays size={14} /> Target {formatDueDate(project.dueDate, project.status === 'completed')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="project-hero-actions">
          {editable && (
            <button className="button button-secondary" onClick={() => setEditOpen(true)}>
              <PencilLine size={15} /> Edit project
            </button>
          )}
          {writer && (
            <button className="button button-primary" onClick={() => openComposer({ projectId: project.id })}>
              <Plus size={16} /> Add task
            </button>
          )}
          {canDelete && (
            <button className="icon-button icon-button-soft button-danger-quiet" onClick={() => setConfirmDelete(true)} aria-label="Delete project" title="Delete project">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      <section className="project-summary-grid">
        <article className="card project-progress-card">
          <div>
            <span className="card-eyebrow">Progress</span>
            <h2>{done.length} of {projectTasks.length} tasks done</h2>
            <p>{open.length > 0 ? `${open.length} tasks are still in motion. Keep the edge of the project clear.` : 'Every task is complete. A good moment to write the note that closes it.'}</p>
          </div>
          <ProgressRing value={progress} size={112} sublabel="complete" />
        </article>
        <article className="card project-stat-card">
          <span className="stat-icon stat-blue"><ListTodo size={18} /></span>
          <span className="stat-label">Open</span>
          <strong>{open.length}</strong>
          <small>across {STATUS_ORDER.filter((status) => status !== 'done').length} stages</small>
        </article>
        <article className="card project-stat-card">
          <span className="stat-icon stat-green"><CheckCircle2 size={18} /></span>
          <span className="stat-label">Completed</span>
          <strong>{done.length}</strong>
          <small>since {formatDueDate(project.createdAt.slice(0, 10), true)}</small>
        </article>
        <article className="card project-stat-card">
          <span className="stat-icon stat-purple"><UsersRound size={18} /></span>
          <span className="stat-label">Members</span>
          <strong>{members.length}</strong>
          <small>led by {lead?.name ?? 'nobody'}</small>
        </article>
      </section>

      <div className="project-detail-layout">
        <section className="card project-tasks-card">
          <div className="card-head">
            <div>
              <span className="card-eyebrow">Work</span>
              <h2>Project tasks</h2>
            </div>
            {writer && (
              <button className="button button-secondary button-compact" onClick={() => openComposer({ projectId: project.id })}>
                <Plus size={15} /> Add task
              </button>
            )}
          </div>

          {projectTasks.length === 0 ? (
            <EmptyState
              icon={<ListTodo size={24} />}
              title="The project is an open page."
              description="Add the first task to give this work a starting point."
              action={writer ? (
                <button className="button button-primary button-compact" onClick={() => openComposer({ projectId: project.id })}>
                  <Plus size={15} /> Add the first task
                </button>
              ) : undefined}
            />
          ) : (
            <div className="project-task-groups">
              {STATUS_ORDER.map((status) => {
                const groupTasks = projectTasks
                  .filter((task) => task.status === status)
                  .sort((a, b) => a.order - b.order)
                if (!groupTasks.length) return null
                return (
                  <section className="project-task-group" key={status}>
                    <header className="project-task-group-head">
                      <span className={cx('kanban-dot', `status-${status}`)} />
                      <h3>{STATUS_LABELS[status]}</h3>
                      <span>{groupTasks.length}</span>
                    </header>
                    <div className="task-list">
                      {groupTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          project={project}
                          assignee={task.assigneeId ? userMap.get(task.assigneeId) : undefined}
                          canEdit={canEditTask(user, task, project)}
                          onOpen={() => openTask(task.id)}
                          onToggle={() => toggle(task.id)}
                          showProject={false}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </section>

        <aside className="project-aside">
          <section className="card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow">People</span>
                <h2>Team</h2>
              </div>
              <span className="card-tag">{members.length}</span>
            </div>
            <div className="member-list">
              {members.map((member) => (
                <div className="member-list-item" key={member.id}>
                  <Avatar name={member.name} tone={member.tone} size="sm" />
                  <span>
                    <strong>{member.name}</strong>
                    <small>{member.title}</small>
                  </span>
                  {member.id === project.leadId && <span className="badge badge-subtle">Lead</span>}
                </div>
              ))}
            </div>
            <div className="access-note">
              <ShieldCheck size={15} />
              <span>{accessCopy}</span>
            </div>
          </section>

          <section className="card project-info-card">
            <span className="card-eyebrow">Details</span>
            <dl>
              <div><dt>Lead</dt><dd>{lead?.name ?? 'Unassigned'}</dd></div>
              <div><dt>Department</dt><dd>{project.department}</dd></div>
              <div><dt>Visibility</dt><dd>{VISIBILITY_LABELS[project.visibility]}</dd></div>
              <div><dt>Target</dt><dd>{project.dueDate ? formatDueDate(project.dueDate) : 'No date'}</dd></div>
              <div><dt>Created</dt><dd>{formatDateTime(project.createdAt)}</dd></div>
            </dl>
          </section>

          <section className="card project-memory-card">
            <div className="card-head">
              <div>
                <span className="card-eyebrow"><Brain size={12} /> Project memory</span>
                <h2>Recent motion</h2>
              </div>
            </div>
            <div className="project-activity">
              {activities.length === 0 ? (
                <p className="muted">No project activity yet.</p>
              ) : (
                activities.map((activity) => {
                  const actor = userMap.get(activity.actorId)
                  if (!actor) return null
                  return (
                    <button
                      key={activity.id}
                      className="project-activity-line"
                      onClick={() => {
                        if (activity.entityType === 'task' && activity.entityId) openTask(activity.entityId)
                        else navigate('/memory')
                      }}
                    >
                      <Avatar name={actor.name} tone={actor.tone} size="xs" />
                      <span><strong>{actor.name.split(' ')[0]}</strong> {activity.message}</span>
                      <time>{formatRelativeTime(activity.createdAt)}</time>
                    </button>
                  )
                })
              )}
            </div>
            <button className="text-button project-memory-link" onClick={() => navigate('/memory')}>
              Open memory <ArrowRight size={13} />
            </button>
          </section>
        </aside>
      </div>

      <ProjectModal
        open={editOpen}
        project={project}
        onClose={() => setEditOpen(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete “${project.name}”?`}
        description={`This will delete the project and all ${projectTasks.length} ${pluralize(projectTasks.length, 'task')} inside it. This cannot be undone.`}
        confirmLabel="Delete project"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          try {
            deleteProject(project.id)
            setConfirmDelete(false)
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Could not delete the project.', 'error')
          }
        }}
      />
    </div>
  )
}
