import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CalendarDays,
  Check,
  Clock3,
  FolderKanban,
  ListChecks,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { Avatar, CheckToggle, ConfirmDialog, Overlay, ProgressBar, UserAvatar } from './ui'
import {
  canAssignTask,
  canComment,
  canDeleteComment,
  canDeleteTask,
  canEditTask,
  canViewProject,
} from '../lib/permissions'
import { formatDateTime, formatDueDate, isOverdue, todayISO } from '../lib/dates'
import { cx } from '../lib/utils'
import type { TaskPriority, TaskStatus } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../types'

export function TaskDetail() {
  const {
    data,
    currentUser,
    updateTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    deleteComment,
    rememberTask,
    notify,
  } = useStore()
  const { taskId, closeTask } = useAppUI()
  const user = currentUser!
  const task = taskId ? data.tasks.find((item) => item.id === taskId) : undefined
  const project = task ? data.projects.find((item) => item.id === task.projectId) : undefined
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description)
    setSubtaskDraft('')
    setLabelDraft('')
    setCommentDraft('')
    setConfirmDelete(false)
    rememberTask(task.id)
    // Only reset the editable fields when a different task is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id])

  const authorMap = useMemo(() => new Map(data.users.map((person) => [person.id, person])), [data.users])
  const canEdit = Boolean(task && project && canEditTask(user, task, project))
  const canAssign = Boolean(task && project && canAssignTask(user, task, project))
  const canDelete = Boolean(task && project && canDeleteTask(user, task, project))
  const canWriteComment = Boolean(task && project && canComment(user, task, project))
  const assignees = useMemo(() => {
    if (!project) return []
    return data.users.filter(
      (person) => person.active && (canViewProject(person, project) || person.id === task?.assigneeId),
    )
  }, [data.users, project, task?.assigneeId])
  const visibleProjects = useMemo(
    () => data.projects.filter((item) => canViewProject(user, item)),
    [data.projects, user],
  )

  if (!task || !project) return null

  const saveTitle = () => {
    if (!title.trim()) {
      setTitle(task.title)
      notify('A task needs a title.', 'error')
      return
    }
    if (title.trim() === task.title) return
    try {
      updateTask(task.id, { title })
    } catch (error) {
      setTitle(task.title)
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const saveDescription = () => {
    if (description.trim() === task.description) return
    try {
      updateTask(task.id, { description })
    } catch (error) {
      setDescription(task.description)
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const changeStatus = (status: TaskStatus) => {
    try {
      updateTask(task.id, { status })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const changePriority = (priority: TaskPriority) => {
    try {
      updateTask(task.id, { priority })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the task.', 'error')
    }
  }

  const changeProject = (nextId: string) => {
    const nextProject = data.projects.find((item) => item.id === nextId)
    if (!nextProject) return
    const assigneeKeepsAccess = task.assigneeId
      ? data.users.some((person) => person.id === task.assigneeId && canViewProject(person, nextProject))
      : true
    try {
      updateTask(task.id, {
        projectId: nextId,
        ...(assigneeKeepsAccess ? {} : { assigneeId: null }),
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not move the task.', 'error')
    }
  }

  const submitSubtask = (event: FormEvent) => {
    event.preventDefault()
    try {
      addSubtask(task.id, subtaskDraft)
      setSubtaskDraft('')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add the step.', 'error')
    }
  }

  const addLabel = () => {
    const value = labelDraft.trim()
    if (!value || task.labels.includes(value)) {
      setLabelDraft('')
      return
    }
    try {
      updateTask(task.id, { labels: [...task.labels, value] })
      setLabelDraft('')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add the label.', 'error')
    }
  }

  const removeLabel = (label: string) => {
    try {
      updateTask(task.id, { labels: task.labels.filter((item) => item !== label) })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not update the label.', 'error')
    }
  }

  const submitComment = (event: FormEvent) => {
    event.preventDefault()
    try {
      addComment(task.id, commentDraft)
      setCommentDraft('')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not add the comment.', 'error')
    }
  }

  const commentUsers = [...task.comments].reverse()
  const doneSubtasks = task.subtasks.filter((subtask) => subtask.done).length
  const subtaskPct = task.subtasks.length ? Math.round((doneSubtasks / task.subtasks.length) * 100) : 0
  const overdue = isOverdue(task.dueDate, task.status === 'done')
  const creator = authorMap.get(task.creatorId)
  const assignee = task.assigneeId ? authorMap.get(task.assigneeId) : null

  return (
    <>
      <Overlay
        open
        onClose={closeTask}
        title={project.name}
        description={`${project.department} · ${STATUS_LABELS[task.status]}`}
        variant="sheet"
        width="lg"
        footer={
          <>
            {canDelete ? (
              <button className="button button-quiet button-danger-quiet" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete
              </button>
            ) : (
              <span className="footer-hint">{canEdit ? 'Changes save locally.' : <><Lock size={13} /> Read-only access</>}</span>
            )}
            <span className="footer-spacer" />
            <button className="button button-primary" onClick={closeTask}>Done</button>
          </>
        }
      >
        <div className="task-detail">
          <div className="task-detail-title-row">
            <CheckToggle
              done={task.status === 'done'}
              onToggle={() => changeStatus(task.status === 'done' ? 'todo' : 'done')}
              disabled={!canEdit}
              label={task.title}
              size="lg"
            />
            <input
              className={cx('task-detail-title', task.status === 'done' && 'is-completed')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={saveTitle}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}
              disabled={!canEdit}
              aria-label="Task title"
            />
          </div>

          <div className="task-detail-meta">
            <div className="detail-field">
              <span className="detail-label"><UserRound size={14} /> Assignee</span>
              <select
                value={task.assigneeId ?? ''}
                onChange={(event) => {
                  const value = event.target.value || null
                  try {
                    updateTask(task.id, { assigneeId: value })
                  } catch (error) {
                    notify(error instanceof Error ? error.message : 'Could not reassign the task.', 'error')
                  }
                }}
                disabled={!canAssign}
              >
                <option value="">Unassigned</option>
                {assignees.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div className="detail-field">
              <span className="detail-label"><CalendarDays size={14} /> Due date</span>
              <div className="detail-date-row">
                <input
                  type="date"
                  value={task.dueDate ?? ''}
                  onChange={(event) => {
                    try {
                      updateTask(task.id, { dueDate: event.target.value || null })
                    } catch (error) {
                      notify(error instanceof Error ? error.message : 'Could not set the date.', 'error')
                    }
                  }}
                  disabled={!canEdit}
                  className={cx(overdue && 'is-overdue')}
                />
                {task.dueDate && (
                  <span className={cx('due-inline-label', overdue && 'is-overdue')}>
                    {formatDueDate(task.dueDate, task.status === 'done')}
                  </span>
                )}
              </div>
            </div>
            <div className="detail-field">
              <span className="detail-label"><FolderKanban size={14} /> Project</span>
              <select
                value={task.projectId}
                onChange={(event) => changeProject(event.target.value)}
                disabled={!canAssign}
              >
                {visibleProjects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div className="detail-field">
              <span className="detail-label"><ListChecks size={14} /> Status</span>
              <select
                value={task.status}
                onChange={(event) => changeStatus(event.target.value as TaskStatus)}
                disabled={!canEdit}
              >
                {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => (
                  <option key={value} value={value}>{STATUS_LABELS[value]}</option>
                ))}
              </select>
            </div>
            <div className="detail-field">
              <span className="detail-label"><Tag size={14} /> Priority</span>
              <select
                value={task.priority}
                onChange={(event) => changePriority(event.target.value as TaskPriority)}
                disabled={!canEdit}
              >
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                  <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>
                ))}
              </select>
            </div>
            <div className="detail-field">
              <span className="detail-label"><Clock3 size={14} /> Updated</span>
              <span className="detail-static">{formatDateTime(task.updatedAt)}</span>
            </div>
          </div>

          <section className="detail-section">
            <h3 className="detail-section-title">Notes</h3>
            <textarea
              className="detail-notes"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={saveDescription}
              placeholder="Add context, links, or acceptance notes…"
              disabled={!canEdit}
            />
          </section>

          <section className="detail-section">
            <div className="detail-section-head">
              <h3 className="detail-section-title">Steps</h3>
              {task.subtasks.length > 0 && (
                <span className="detail-section-meta">{doneSubtasks}/{task.subtasks.length}</span>
              )}
            </div>
            {task.subtasks.length > 0 && (
              <ProgressBar
                value={subtaskPct}
                tone={project.color}
                className="subtask-progress"
                label={`${doneSubtasks} of ${task.subtasks.length} steps complete`}
              />
            )}
            <div className="subtask-list">
              {task.subtasks.map((subtask) => (
                <div className={cx('subtask', subtask.done && 'is-done')} key={subtask.id}>
                  <CheckToggle
                    size="sm"
                    done={subtask.done}
                    onToggle={() => {
                      try {
                        toggleSubtask(task.id, subtask.id)
                      } catch (error) {
                        notify(error instanceof Error ? error.message : 'Could not update the step.', 'error')
                      }
                    }}
                    disabled={!canEdit}
                    label={subtask.title}
                  />
                  <span>{subtask.title}</span>
                  {canEdit && (
                    <button
                      className="subtask-remove"
                      onClick={() => {
                        try {
                          deleteSubtask(task.id, subtask.id)
                        } catch (error) {
                          notify(error instanceof Error ? error.message : 'Could not remove the step.', 'error')
                        }
                      }}
                      aria-label={`Remove ${subtask.title}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canEdit && (
              <form className="inline-add" onSubmit={submitSubtask}>
                <Plus size={15} />
                <input
                  value={subtaskDraft}
                  onChange={(event) => setSubtaskDraft(event.target.value)}
                  placeholder="Add a step…"
                  aria-label="Add a step"
                />
                {subtaskDraft.trim() && <button type="submit" className="inline-add-submit">Add</button>}
              </form>
            )}
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">Labels</h3>
            <div className="label-row">
              {task.labels.map((label) => (
                <span className="chip" key={label}>
                  {label}
                  {canEdit && (
                    <button onClick={() => removeLabel(label)} aria-label={`Remove ${label} label`}>
                      <X size={11} />
                    </button>
                  )}
                </span>
              ))}
              {canEdit && (
                <span className="label-add">
                  <Plus size={13} />
                  <input
                    value={labelDraft}
                    onChange={(event) => setLabelDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addLabel()
                      }
                    }}
                    onBlur={addLabel}
                    placeholder={task.labels.length ? 'Add label' : 'Add the first label'}
                    aria-label="Add a label"
                  />
                </span>
              )}
              {!canEdit && task.labels.length === 0 && <span className="muted">No labels</span>}
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-head">
              <h3 className="detail-section-title"><MessageSquare size={15} /> Conversation</h3>
              <span className="detail-section-meta">{task.comments.length}</span>
            </div>
            <div className="comment-list">
              {commentUsers.map((comment) => {
                const author = authorMap.get(comment.authorId)
                if (!author) return null
                return (
                  <article className="comment" key={comment.id}>
                    <UserAvatar user={author} size="sm" />
                    <div className="comment-body">
                      <div className="comment-head">
                        <strong>{author.name}</strong>
                        <span>{formatDateTime(comment.createdAt)}</span>
                        {canDeleteComment(user, comment.authorId, project) && (
                          <button
                            className="comment-delete"
                            aria-label="Delete comment"
                            onClick={() => {
                              try {
                                deleteComment(task.id, comment.id)
                              } catch (error) {
                                notify(error instanceof Error ? error.message : 'Could not delete the comment.', 'error')
                              }
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </article>
                )
              })}
              {task.comments.length === 0 && (
                <p className="comment-empty">No conversation yet. A little context goes a long way.</p>
              )}
            </div>
            {canWriteComment ? (
              <form className="comment-composer" onSubmit={submitComment}>
                <Avatar name={user.name} tone={user.tone} size="sm" />
                <div>
                  <textarea
                    rows={2}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Write a comment…"
                    aria-label="Write a comment"
                  />
                  <div className="comment-composer-foot">
                    <span>Visible to everyone in this project</span>
                    <button className="button button-primary button-compact" disabled={!commentDraft.trim()}>
                      <Send size={14} /> Comment
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <p className="comment-readonly"><Lock size={13} /> Your role has read-only access to the conversation.</p>
            )}
          </section>

          <footer className="task-detail-footer">
            <span>
              Created by <strong>{creator?.name ?? 'Unknown'}</strong> · {formatDateTime(task.createdAt)}
            </span>
            <span className="task-detail-id">#{task.id.slice(-6)}</span>
          </footer>
        </div>
      </Overlay>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        description={`“${task.title}” will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete task"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          try {
            deleteTask(task.id)
            setConfirmDelete(false)
            closeTask()
          } catch (error) {
            notify(error instanceof Error ? error.message : 'Could not delete the task.', 'error')
          }
        }}
      />
    </>
  )
}
