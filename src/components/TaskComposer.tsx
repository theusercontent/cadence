import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Plus } from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { Avatar, Overlay } from './ui'
import { canCreateTask, canViewProject, visibleProjects } from '../lib/permissions'
import {
  ASSIGNEE_NAME_LIMIT,
  EXTERNAL_ASSIGNEE_TONE,
  matchTeammate,
  resolveAssignee,
} from '../lib/assignees'
import { todayISO } from '../lib/dates'
import type { TaskPriority, TaskStatus } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../types'

export function TaskComposer() {
  const { data, currentUser, createTask } = useStore()
  const { composerDefaults, closeComposer, openTask } = useAppUI()
  const user = currentUser!
  const projects = useMemo(() => visibleProjects(user, data), [user, data])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [labels, setLabels] = useState('')
  const [error, setError] = useState('')

  const open = composerDefaults !== null

  useEffect(() => {
    if (!open) return
    const preferred = projects.find((project) => project.id === composerDefaults?.projectId)
    const defaultProject = preferred ?? projects[0]
    const candidates = data.users.filter(
      (person) => person.active && defaultProject && canViewProject(person, defaultProject),
    )
    const defaultAssignee =
      candidates.find((person) => person.id === composerDefaults?.assigneeId) ??
      candidates.find((person) => person.id === user.id) ??
      candidates[0]
    setTitle('')
    setDescription('')
    setProjectId(defaultProject?.id ?? '')
    setAssignee(defaultAssignee?.name ?? '')
    setDueDate(composerDefaults?.dueDate ?? '')
    setPriority('medium')
    setStatus(composerDefaults?.status ?? 'todo')
    setLabels('')
    setError('')
  }, [open, composerDefaults, projects, data.users, user.id])

  if (!open || !canCreateTask(user)) return null

  const selectedProject = projects.find((project) => project.id === projectId)
  const assignees = data.users.filter(
    (person) => person.active && selectedProject && canViewProject(person, selectedProject),
  )
  const matchedAssignee = matchTeammate(assignee, assignees)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const assignment = resolveAssignee(assignee, assignees)
      const task = createTask({
        title,
        description,
        projectId,
        ...assignment,
        dueDate: dueDate || null,
        priority,
        status,
        labels: labels.split(',').map((label) => label.trim()).filter(Boolean),
      })
      closeComposer()
      openTask(task.id)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create the task.')
    }
  }

  return (
    <Overlay
      open={open}
      onClose={closeComposer}
      title="New task"
      description="Capture the next clear step."
      width="md"
      footer={
        <>
          <span className="footer-hint">Stored locally, instantly.</span>
          <button className="button button-quiet" onClick={closeComposer}>Cancel</button>
          <button className="button button-primary" onClick={submit} disabled={!title.trim() || !projectId}>
            <Plus size={16} /> Create task
          </button>
        </>
      }
    >
      <form className="task-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Task</span>
          <input
            className="task-title-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to happen?"
            autoFocus
            maxLength={140}
          />
        </label>

        <label className="field">
          <span className="field-label">Notes</span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Add the context someone needs to do great work…"
          />
        </label>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Project</span>
            <select value={projectId} onChange={(event) => {
              const nextProject = projects.find((project) => project.id === event.target.value)
              setProjectId(event.target.value)
              const nextCandidates = data.users.filter((person) => person.active && nextProject && canViewProject(person, nextProject))
              setAssignee(nextCandidates.find((person) => person.id === user.id)?.name ?? nextCandidates[0]?.name ?? '')
            }}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Assignee</span>
            <input
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="Type a teammate or any name"
              list="composer-assignee-names"
              maxLength={ASSIGNEE_NAME_LIMIT}
              aria-describedby="composer-assignee-hint"
            />
            <datalist id="composer-assignee-names">
              {assignees.map((person) => (
                <option key={person.id} value={person.name} />
              ))}
            </datalist>
            <span className="field-hint" id="composer-assignee-hint">
              Teammates stay linked. Any other name is saved as an external owner.
            </span>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => (
                <option key={value} value={value}>{STATUS_LABELS[value]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((value) => (
                <option key={value} value={value}>{PRIORITY_LABELS[value]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Due date</span>
            <span className="input-with-icon">
              <CalendarDays size={16} />
              <input
                type="date"
                value={dueDate}
                min={undefined}
                onChange={(event) => setDueDate(event.target.value)}
                onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
              />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Labels</span>
            <input
              value={labels}
              onChange={(event) => setLabels(event.target.value)}
              placeholder="Design, Research"
            />
          </label>
        </div>

        <div className="quick-date-row">
          <span className="quick-date-label">Quick date</span>
          <button type="button" className="chip chip-button" onClick={() => setDueDate(todayISO())}>Today</button>
          <button type="button" className="chip chip-button" onClick={() => {
            const date = new Date()
            date.setDate(date.getDate() + 1)
            setDueDate(date.toISOString().slice(0, 10))
          }}>Tomorrow</button>
          <button type="button" className="chip chip-button" onClick={() => setDueDate('')}>No date</button>
          {assignee.trim() && (
            <span
              className="composer-assignee"
              title={matchedAssignee ? `${matchedAssignee.name} · linked teammate` : `${assignee.trim()} · external owner`}
            >
              <Avatar
                name={assignee.trim()}
                tone={matchedAssignee?.tone ?? EXTERNAL_ASSIGNEE_TONE}
                size="xs"
              />
              <span>{assignee.trim()}</span>
              {!matchedAssignee && <span className="composer-assignee-tag">External</span>}
            </span>
          )}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="sr-only">Create task</button>
      </form>
    </Overlay>
  )
}
