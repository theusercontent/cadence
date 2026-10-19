import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Brain,
  CalendarDays,
  CheckSquare2,
  Clock3,
  Columns3,
  FolderKanban,
  Plus,
  Search,
  Settings2,
  UserRound,
  X,
} from 'lucide-react'
import { useStore } from '../store/store'
import { useAppUI } from '../ui/AppUI'
import { Avatar, ProjectGlyph, StatusDot } from './ui'
import {
  canCreateTask,
  canViewTask,
  projectForTask,
  visibleProjects,
  visibleTasks,
} from '../lib/permissions'
import { formatDueDate } from '../lib/dates'
import { isTypingTarget } from '../lib/utils'

type ItemType = 'task' | 'project' | 'person' | 'action'

interface PaletteItem {
  id: string
  type: ItemType
  title: string
  subtitle?: string
  icon?: React.ReactNode
  run: () => void
}

export function CommandPalette() {
  const { data, currentUser, navigate, rememberSearch } = useStore()
  const { paletteOpen, paletteSeed, closePalette, openTask, openComposer } = useAppUI()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const user = currentUser!

  useEffect(() => {
    if (!paletteOpen) return
    setQuery(paletteSeed)
    setSelected(0)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40)
    const prior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prior
    }
  }, [paletteOpen, paletteSeed])

  const recent = data.memory[user.id]?.recentSearches ?? []

  const groups = useMemo(() => {
    if (!paletteOpen) return [] as Array<{ label: string; items: PaletteItem[] }>
    const needle = query.trim().toLowerCase()
    const tasks = visibleTasks(user, data)
    const projects = visibleProjects(user, data)
    const today = new Date().toISOString().slice(0, 10)

    const taskResults = tasks
      .filter((task) => {
        if (!needle) return task.status !== 'done' && task.dueDate === today
        const project = projectForTask(task, data)
        return (
          task.title.toLowerCase().includes(needle) ||
          task.labels.some((label) => label.toLowerCase().includes(needle)) ||
          project?.name.toLowerCase().includes(needle)
        )
      })
      .slice(0, 6)
      .map<PaletteItem>((task) => ({
        id: task.id,
        type: 'task',
        title: task.title,
        subtitle: task.projectId
          ? `${projectForTask(task, data)?.name ?? 'Project'} · ${task.dueDate ? formatDueDate(task.dueDate, task.status === 'done') : 'No date'}`
          : 'Task',
        icon: <StatusDot status={task.status} />,
        run: () => {
          if (query.trim()) rememberSearch(query)
          openTask(task.id)
        },
      }))

    const projectResults = projects
      .filter((project) => !needle || project.name.toLowerCase().includes(needle) || project.description.toLowerCase().includes(needle))
      .slice(0, 4)
      .map<PaletteItem>((project) => ({
        id: project.id,
        type: 'project',
        title: project.name,
        subtitle: `${project.department} · ${data.tasks.filter((task) => task.projectId === project.id && task.status !== 'done').length} open tasks`,
        icon: <ProjectGlyph project={project} size="sm" />,
        run: () => {
          if (query.trim()) rememberSearch(query)
          closePalette()
          navigate(`/projects/${project.id}`)
        },
      }))

    const peopleResults = data.users
      .filter((person) => person.active)
      .filter((person) => !needle || person.name.toLowerCase().includes(needle) || person.title.toLowerCase().includes(needle) || person.email.toLowerCase().includes(needle))
      .slice(0, 4)
      .map<PaletteItem>((person) => ({
        id: person.id,
        type: 'person',
        title: person.name,
        subtitle: `${person.title} · ${person.department}`,
        icon: <Avatar name={person.name} tone={person.tone} size="xs" />,
        run: () => {
          if (query.trim()) rememberSearch(query)
          closePalette()
          navigate('/team')
        },
      }))

    const actionItems: PaletteItem[] = []
    if (needle) {
      if (canCreateTask(user)) {
        actionItems.push({
          id: 'action-new-task',
          type: 'action',
          title: `Create a task “${query.trim()}”`,
          subtitle: 'Quick capture',
          icon: <Plus size={16} />,
          run: () => {
            rememberSearch(query)
            closePalette()
            openComposer()
          },
        })
      }
    } else {
      if (canCreateTask(user)) {
        actionItems.push({
          id: 'go-new-task',
          type: 'action',
          title: 'New task',
          subtitle: 'Quick capture',
          icon: <Plus size={16} />,
          run: () => openComposer(),
        })
      }
      actionItems.push(
        {
          id: 'go-board',
          type: 'action',
          title: 'Open the board',
          subtitle: 'Move work forward',
          icon: <Columns3 size={16} />,
          run: () => {
            closePalette()
            navigate('/board')
          },
        },
        {
          id: 'go-calendar',
          type: 'action',
          title: 'Open the calendar',
          subtitle: 'See the shape of your week',
          icon: <CalendarDays size={16} />,
          run: () => {
            closePalette()
            navigate('/calendar')
          },
        },
        {
          id: 'go-memory',
          type: 'action',
          title: 'Open memory',
          subtitle: 'Everything you’ve touched recently',
          icon: <Brain size={16} />,
          run: () => {
            closePalette()
            navigate('/memory')
          },
        },
        {
          id: 'go-settings',
          type: 'action',
          title: 'Open settings',
          subtitle: 'Appearance, profile, and local data',
          icon: <Settings2 size={16} />,
          run: () => {
            closePalette()
            navigate('/settings')
          },
        },
      )
    }

    const result: Array<{ label: string; items: PaletteItem[] }> = []
    if (taskResults.length) result.push({ label: needle ? 'Tasks' : 'Due today', items: taskResults })
    if (projectResults.length) result.push({ label: 'Projects', items: projectResults })
    if (peopleResults.length) result.push({ label: 'People', items: peopleResults })
    if (actionItems.length) result.push({ label: needle ? 'Quick action' : 'Jump to', items: actionItems })
    return result
  }, [paletteOpen, query, data, user, closePalette, navigate, openComposer, openTask, rememberSearch])

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    if (!paletteOpen) return
    setSelected((current) => Math.min(current, Math.max(0, flat.length - 1)))
  }, [flat.length, paletteOpen])

  useEffect(() => {
    if (!paletteOpen) return
    const node = document.getElementById(`palette-item-${selected}`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [selected, paletteOpen])

  useEffect(() => {
    if (!paletteOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, closePalette])

  if (!paletteOpen) return null

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (isTypingTarget(event.target) && event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((current) => (flat.length ? (current + 1) % flat.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((current) => (flat.length ? (current - 1 + flat.length) % flat.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const item = flat[selected]
      if (item) item.run()
    }
  }

  let flatIndex = -1

  return (
    <div className="palette-layer">
      <button className="overlay-backdrop palette-backdrop" onClick={closePalette} tabIndex={-1} aria-label="Close search" />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search Cadence" onKeyDown={onKeyDown}>
        <div className="palette-search">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tasks, projects, people…"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button className="palette-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={15} />
            </button>
          ) : (
            <span className="palette-esc"><kbd>esc</kbd></span>
          )}
        </div>

        <div className="palette-results">
          {!query && recent.length > 0 && (
            <div className="palette-recent">
              <span className="palette-recent-label"><Clock3 size={13} /> Recent memory</span>
              <div className="palette-recent-chips">
                {recent.map((term) => (
                  <button key={term} className="chip chip-button" onClick={() => setQuery(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {flat.length === 0 ? (
            <div className="palette-empty">
              <span className="empty-icon"><Search size={20} /></span>
              <p>No matches for “{query}”</p>
              <small>Try a project, a person, or one of your labels.</small>
            </div>
          ) : (
            groups.map((group) => (
              <section className="palette-group" key={group.label} aria-label={group.label}>
                <p className="palette-group-label">{group.label}</p>
                {group.items.map((item) => {
                  flatIndex += 1
                  const itemIndex = flatIndex
                  return (
                    <button
                      key={item.id}
                      id={`palette-item-${itemIndex}`}
                      className={`palette-item ${selected === itemIndex ? 'is-selected' : ''}`}
                      onMouseMove={() => setSelected(itemIndex)}
                      onClick={item.run}
                    >
                      <span className="palette-item-icon">{item.icon}</span>
                      <span className="palette-item-copy">
                        <strong>{item.title}</strong>
                        {item.subtitle && <small>{item.subtitle}</small>}
                      </span>
                      <ArrowRight size={14} className="palette-item-arrow" />
                    </button>
                  )
                })}
              </section>
            ))
          )}
        </div>

        <footer className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> to navigate</span>
          <span><kbd>↵</kbd> to open</span>
          <span className="palette-footer-spacer" />
          <span className="palette-footer-brand"><CheckSquare2 size={13} /> Cadence memory</span>
        </footer>
      </div>
    </div>
  )
}
