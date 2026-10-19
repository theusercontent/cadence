import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Check, FolderPlus, UsersRound } from 'lucide-react'
import { useStore } from '../store/store'
import { Avatar, Overlay } from '../components/ui'
import { canSetDepartment } from '../lib/permissions'
import { AVATAR_TONES, DEPARTMENTS, PROJECT_COLORS } from '../data/seed'
import { addDays, todayISO } from '../lib/dates'
import { cx } from '../lib/utils'
import type { Project, ProjectInput, ProjectStatus, ProjectVisibility, User } from '../types'
import { ROLE_LABELS, VISIBILITY_LABELS } from '../types'

export function ProjectModal({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean
  project?: Project | null
  onClose: () => void
  onSaved?: (project: Project) => void
}) {
  const { data, currentUser, createProject, updateProject } = useStore()
  const user = currentUser!
  const managerLocked = !canSetDepartment(user) || (user.role === 'manager' && !project)
  const activeUsers = useMemo(() => data.users.filter((person) => person.active), [data.users])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [department, setDepartment] = useState(user.department)
  const [visibility, setVisibility] = useState<ProjectVisibility>('team')
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [leadId, setLeadId] = useState(user.id)
  const [memberIds, setMemberIds] = useState<string[]>([user.id])
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (project) {
      setName(project.name)
      setDescription(project.description)
      setColor(project.color)
      setDepartment(project.department)
      setVisibility(project.visibility)
      setStatus(project.status)
      setLeadId(project.leadId)
      setMemberIds(project.memberIds)
      setDueDate(project.dueDate ?? '')
    } else {
      setName('')
      setDescription('')
      setColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)])
      setDepartment(user.role === 'manager' ? user.department : user.department)
      setVisibility('team')
      setStatus('active')
      setLeadId(user.id)
      setMemberIds([user.id])
      setDueDate(addDays(todayISO(), 30))
    }
    setError('')
  }, [open, project, user.department, user.id, user.role])

  if (!open) return null

  const lead = activeUsers.find((person) => person.id === leadId)
  const canChooseLead = user.role === 'admin' || user.role === 'manager'

  const toggleMember = (id: string) => {
    setMemberIds((current) => {
      if (id === leadId) return current
      return current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    })
  }

  const chooseLead = (id: string) => {
    setLeadId(id)
    setMemberIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    const payload: ProjectInput = {
      name,
      description,
      color,
      status,
      visibility,
      department,
      leadId,
      memberIds,
      dueDate: dueDate || null,
    }
    try {
      const saved = project ? updateProject(project.id, payload) : createProject(payload)
      onClose()
      onSaved?.(saved)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the project.')
    }
  }

  return (
    <Overlay
      open={open}
      onClose={onClose}
      title={project ? 'Edit project' : 'New project'}
      description={project ? 'Adjust the shape of this work.' : 'Give a body of work a clear home.'}
      width="lg"
      footer={
        <>
          <span className="footer-hint">Visible to the people you choose.</span>
          <button className="button button-quiet" onClick={onClose}>Cancel</button>
          <button className="button button-primary" onClick={submit} disabled={!name.trim()}>
            <FolderPlus size={16} /> {project ? 'Save changes' : 'Create project'}
          </button>
        </>
      }
    >
      <form className="project-form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Project name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Atlas Experience Refresh"
            autoFocus
            maxLength={90}
          />
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this body of work here to accomplish?"
          />
        </label>

        <div className="form-grid two">
          <div className="field">
            <span className="field-label">Color</span>
            <div className="color-swatches">
              {PROJECT_COLORS.map((swatch) => (
                <button
                  type="button"
                  key={swatch}
                  className={cx('color-swatch', color === swatch && 'is-selected')}
                  style={{ background: swatch }}
                  onClick={() => setColor(swatch)}
                  aria-label={`Use color ${swatch}`}
                  aria-pressed={color === swatch}
                >
                  {color === swatch && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span className="field-label">Target date</span>
            <span className="input-with-icon">
              <CalendarDays size={15} />
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </span>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Department</span>
            <select
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              disabled={!canSetDepartment(user) || (user.role === 'manager' && !project)}
            >
              {DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {managerLocked && <span className="field-hint">Managers create for their own department.</span>}
          </label>
          <label className="field">
            <span className="field-label">Visibility</span>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as ProjectVisibility)}>
              {(Object.keys(VISIBILITY_LABELS) as ProjectVisibility[]).map((value) => (
                <option key={value} value={value}>{VISIBILITY_LABELS[value]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span className="field-label">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Project lead</span>
            <select value={leadId} onChange={(event) => chooseLead(event.target.value)} disabled={!canChooseLead}>
              {activeUsers.map((person) => (
                <option key={person.id} value={person.id}>{person.name} · {ROLE_LABELS[person.role]}</option>
              ))}
            </select>
            {!canChooseLead && <span className="field-hint">Only managers and admins can change the lead.</span>}
          </label>
        </div>

        <div className="field">
          <span className="field-label"><UsersRound size={14} /> Members</span>
          <div className="member-picker">
            {activeUsers.map((person: User) => {
              const selected = memberIds.includes(person.id) || person.id === leadId
              return (
                <button
                  type="button"
                  key={person.id}
                  className={cx('member-option', selected && 'is-selected')}
                  onClick={() => toggleMember(person.id)}
                  disabled={person.id === leadId}
                  aria-pressed={selected}
                >
                  <Avatar name={person.name} tone={person.tone} size="xs" />
                  <span>
                    <strong>{person.name}</strong>
                    <small>{person.department}{person.id === leadId ? ' · Lead' : ''}</small>
                  </span>
                  <span className="member-check">{selected && <Check size={12} />}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="project-preview">
          <span className="project-preview-label">Preview</span>
          <div className="project-preview-card">
            <span className="project-preview-glyph" style={{ background: color }} />
            <div>
              <strong>{name || 'Untitled project'}</strong>
              <small>{lead ? `${lead.name} · ${department}` : department}</small>
            </div>
            <span className="chip chip-tiny">{VISIBILITY_LABELS[visibility]}</span>
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="submit" className="sr-only">Save project</button>
      </form>
    </Overlay>
  )
}
