import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Activity,
  AuthResult,
  Project,
  ProjectInput,
  Role,
  Session,
  StoreResult,
  Task,
  TaskInput,
  TaskStatus,
  User,
  UserInput,
  UserSettings,
  WorkspaceData,
} from '../types'
import { STATUS_LABELS } from '../types'
import {
  clearSession,
  createPasswordRecord,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  readSession,
  verifyPassword,
  writeSession,
} from '../lib/auth'
import {
  clearStoredData,
  DATA_VERSION,
  isWorkspaceData,
  loadOrCreateData,
  saveStoredData,
} from '../lib/storage'
import { DEMO_ACCOUNTS, buildSeedData } from '../data/seed'
import {
  canAssignTask,
  canComment,
  canCreateProject,
  canCreateTask,
  canDeleteComment,
  canDeleteProject,
  canDeleteTask,
  canEditProject,
  canEditTask,
  canManageUsers,
  canViewProject,
  canViewTask,
  isAdmin,
  isWriter,
  projectForTask,
} from '../lib/permissions'
import { downloadJson, initials, uid } from '../lib/utils'
import { BootScreen } from '../components/BootScreen'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

export interface TaskPatch {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Task['priority']
  projectId?: string
  assigneeId?: string | null
  dueDate?: string | null
  labels?: string[]
}

export interface UserPatch {
  name?: string
  email?: string
  role?: Role
  department?: string
  title?: string
  tone?: string
  active?: boolean
}

export interface StoreValue {
  data: WorkspaceData
  currentUser: User | null
  settings: UserSettings
  route: string
  toasts: ToastItem[]
  storageHealthy: boolean
  navigate: (path: string) => void
  notify: (message: string, tone?: ToastTone) => void
  dismissToast: (id: string) => void
  login: (email: string, password: string, remember: boolean) => Promise<AuthResult>
  quickLogin: (userId: string) => Promise<AuthResult>
  logout: () => void
  createTask: (input: TaskInput) => Task
  updateTask: (id: string, patch: TaskPatch) => Task
  toggleTask: (id: string) => Task
  deleteTask: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  addComment: (taskId: string, body: string) => void
  deleteComment: (taskId: string, commentId: string) => void
  createProject: (input: ProjectInput) => Project
  updateProject: (id: string, patch: Partial<ProjectInput>) => Project
  deleteProject: (id: string) => void
  createUser: (input: UserInput) => Promise<User>
  updateUser: (id: string, patch: UserPatch) => User
  resetUserPassword: (id: string, password: string) => Promise<void>
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>
  updateProfile: (patch: Pick<User, 'name' | 'title' | 'tone'>) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  rememberTask: (taskId: string) => void
  rememberSearch: (term: string) => void
  clearRecentSearches: () => void
  exportWorkspace: () => void
  exportPersonal: () => void
  importWorkspace: (json: string) => Promise<StoreResult>
  resetWorkspace: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

function readRoute(): string {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw || !raw.startsWith('/')) return '/overview'
  return raw.split('?')[0]
}

const KNOWN_ROUTES = ['/overview', '/tasks', '/board', '/calendar', '/projects', '/team', '/memory', '/settings']

function knownRoute(path: string): boolean {
  return KNOWN_ROUTES.includes(path) || path.startsWith('/projects/')
}

function validResumeRoute(path: string | undefined, user: User, data: WorkspaceData): string {
  if (!path || !knownRoute(path)) return '/overview'
  if (path.startsWith('/projects/')) {
    const project = data.projects.find((item) => item.id === path.split('/')[2])
    return project && canViewProject(user, project) ? path : '/overview'
  }
  return path
}

function makeActivity(
  actorId: string,
  action: string,
  entityType: Activity['entityType'],
  entityId: string | null,
  message: string,
): Activity {
  return {
    id: uid('a'),
    actorId,
    action,
    entityType,
    entityId,
    message,
    createdAt: new Date().toISOString(),
  }
}

function withActivity(data: WorkspaceData, activity: Activity): Activity[] {
  return [activity, ...data.activities].slice(0, 800)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [route, setRoute] = useState<string>(() => readRoute())
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [booting, setBooting] = useState(true)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [storageHealthy, setStorageHealthy] = useState(true)
  const readyRef = useRef(false)
  const warnedStorageRef = useRef(false)

  const notify = (message: string, tone: ToastTone = 'success') => {
    const id = uid('toast')
    setToasts((current) => [...current.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4200)
  }

  const dismissToast = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  const navigate = (path: string) => {
    if (!knownRoute(path)) path = '/overview'
    if (window.location.hash !== `#${path}`) {
      window.location.hash = path
    }
    setRoute(path)
  }

  useEffect(() => {
    let cancelled = false
    loadOrCreateData()
      .then(({ data: loaded }) => {
        if (cancelled) return
        setData(loaded)
        const session = readSession()
        const sessionUser = session ? loaded.users.find((user) => user.id === session.userId) : null
        if (sessionUser?.active) {
          setUserId(sessionUser.id)
          const initialRoute = validResumeRoute(
            window.location.hash ? readRoute() : loaded.memory[sessionUser.id]?.lastRoute,
            sessionUser,
            loaded,
          )
          setRoute(initialRoute)
          if (window.location.hash !== `#${initialRoute}`) {
            window.history.replaceState(null, '', `#${initialRoute}`)
          }
        } else if (session) {
          clearSession()
        }
        readyRef.current = true
        setBooting(false)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setFatalError(error instanceof Error ? error.message : 'Cadence could not open its local workspace.')
        setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onHashChange = () => {
      setRoute(readRoute())
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!data || !readyRef.current) return
    const saved = saveStoredData(data)
    setStorageHealthy(saved)
    if (!saved && !warnedStorageRef.current) {
      warnedStorageRef.current = true
      notify('Changes could not be saved. Local storage may be full or blocked.', 'error')
    }
  }, [data])

  const currentUser = useMemo(
    () => (data && userId ? data.users.find((user) => user.id === userId && user.active) ?? null : null),
    [data, userId],
  )

  useEffect(() => {
    if (!readyRef.current) return
    if (!currentUser) {
      clearSession()
    }
  }, [currentUser])

  useEffect(() => {
    if (!data || !currentUser) return
    if (data.memory[currentUser.id]?.lastRoute === route) return
    setData((current) => {
      if (!current) return current
      const memory = current.memory[currentUser.id] ?? {
        lastRoute: '/overview',
        lastTaskId: null,
        recentSearches: [],
        lastSeenAt: new Date().toISOString(),
        logins: 0,
      }
      return {
        ...current,
        memory: {
          ...current.memory,
          [currentUser.id]: { ...memory, lastRoute: route },
        },
      }
    })
  }, [route, currentUser, data])

  useEffect(() => {
    if (!data) return
    if (userId && !data.users.some((user) => user.id === userId && user.active)) {
      clearSession()
      setUserId(null)
    }
  }, [data, userId])

  const requireUser = (): User => {
    if (!currentUser) throw new Error('Sign in to continue.')
    return currentUser
  }

  const requireData = (): WorkspaceData => {
    if (!data) throw new Error('The local workspace is not ready yet.')
    return data
  }

  const login = async (email: string, password: string, remember: boolean): Promise<AuthResult> => {
    const workspace = requireData()
    const candidate = workspace.users.find(
      (user) => user.active && normalizeEmail(user.email) === normalizeEmail(email),
    )
    if (!candidate) return { ok: false, error: 'That email and password combination is not recognized.' }
    const valid = await verifyPassword(password, candidate)
    if (!valid) return { ok: false, error: 'That email and password combination is not recognized.' }

    const session: Session = {
      userId: candidate.id,
      startedAt: new Date().toISOString(),
      remember,
    }
    writeSession(session)
    setUserId(candidate.id)

    const now = new Date().toISOString()
    const previousMemory = workspace.memory[candidate.id]
    const memory = {
      lastRoute: previousMemory?.lastRoute ?? '/overview',
      lastTaskId: previousMemory?.lastTaskId ?? null,
      recentSearches: previousMemory?.recentSearches ?? [],
      lastSeenAt: now,
      logins: (previousMemory?.logins ?? 0) + 1,
    }
    setData((current) => {
      if (!current) return current
      return {
        ...current,
        users: current.users.map((user) =>
          user.id === candidate.id ? { ...user, lastSeenAt: now } : user,
        ),
        memory: { ...current.memory, [candidate.id]: memory },
        activities: withActivity(
          current,
          makeActivity(candidate.id, 'auth.login', 'session', null, 'signed in on this device'),
        ),
      }
    })

    const destination = validResumeRoute(memory.lastRoute, candidate, workspace)
    navigate(destination)
    notify(`Welcome back, ${candidate.name.split(' ')[0]}.`)
    return { ok: true }
  }

  const quickLogin = async (id: string): Promise<AuthResult> => {
    const workspace = requireData()
    const user = workspace.users.find((item) => item.id === id && item.active)
    const demo = DEMO_ACCOUNTS.find((item) => item.userId === id)
    if (!user || !demo) return { ok: false, error: 'This demo account is unavailable.' }
    return login(user.email, demo.password, true)
  }

  const logout = () => {
    clearSession()
    setUserId(null)
    navigate('/overview')
  }

  const getProject = (projectId: string, workspace: WorkspaceData): Project => {
    const project = workspace.projects.find((item) => item.id === projectId)
    if (!project) throw new Error('That project no longer exists.')
    return project
  }

  const getTask = (taskId: string, workspace: WorkspaceData): Task => {
    const task = workspace.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('That task no longer exists.')
    return task
  }

  const validateAssignable = (
    assigneeId: string | null | undefined,
    project: Project,
    workspace: WorkspaceData,
  ): string | null => {
    if (assigneeId == null) return null
    const assignee = workspace.users.find((user) => user.id === assigneeId && user.active)
    if (!assignee) throw new Error('Choose an active teammate.')
    if (!canViewProject(assignee, project)) {
      throw new Error(`${assignee.name} does not have access to this project yet.`)
    }
    return assigneeId
  }

  const createTask = (input: TaskInput): Task => {
    const workspace = requireData()
    const actor = requireUser()
    if (!canCreateTask(actor)) throw new Error('Viewers have read-only access and cannot create tasks.')
    const title = input.title.trim()
    if (!title) throw new Error('Give the task a title.')
    const project = getProject(input.projectId, workspace)
    if (!canViewProject(actor, project)) throw new Error('You do not have access to that project.')
    const assigneeId = validateAssignable(
      input.assigneeId === undefined ? actor.id : input.assigneeId,
      project,
      workspace,
    )
    const dueDate = input.dueDate ?? null
    if (dueDate && !isIsoDate(dueDate)) throw new Error('Choose a valid due date.')
    const now = new Date().toISOString()
    const status = input.status ?? 'todo'
    const task: Task = {
      id: uid('t'),
      title,
      description: input.description?.trim() ?? '',
      status,
      priority: input.priority ?? 'medium',
      projectId: project.id,
      assigneeId,
      creatorId: actor.id,
      dueDate,
      labels: (input.labels ?? []).map((label) => label.trim()).filter(Boolean),
      subtasks: (input.subtasks ?? []).map((subtask) => ({
        id: uid('s'),
        title: subtask.title.trim(),
        done: Boolean(subtask.done),
      })),
      comments: [],
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : null,
      order: Math.max(0, ...workspace.tasks.map((item) => item.order)) + 1,
    }
    const activity = makeActivity(
      actor.id,
      'task.create',
      'task',
      task.id,
      `added “${task.title}” to ${project.name}`,
    )
    setData({
      ...workspace,
      tasks: [task, ...workspace.tasks],
      activities: withActivity(workspace, activity),
    })
    notify('Task created.')
    return task
  }

  const updateTask = (id: string, patch: TaskPatch): Task => {
    const workspace = requireData()
    const actor = requireUser()
    const task = getTask(id, workspace)
    const project = projectForTask(task, workspace)
    if (!canEditTask(actor, task, project)) throw new Error('You do not have permission to edit this task.')
    if (!canEditTask(actor, task, project) || !isWriter(actor)) throw new Error('You have read-only access.')
    if (patch.assigneeId !== undefined && project && !canAssignTask(actor, task, project)) {
      throw new Error('Only the creator, project lead, or a manager can reassign this task.')
    }
    if (patch.projectId !== undefined && project && !canAssignTask(actor, task, project)) {
      throw new Error('Only the creator, project lead, or a manager can move this task.')
    }
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('A task needs a title.')
    if (patch.dueDate && !isIsoDate(patch.dueDate)) throw new Error('Choose a valid due date.')

    const nextProject = patch.projectId ? getProject(patch.projectId, workspace) : project
    if (!nextProject) throw new Error('That project no longer exists.')
    if (!canViewProject(actor, nextProject)) throw new Error('You do not have access to that project.')
    if (patch.assigneeId !== undefined) {
      validateAssignable(patch.assigneeId, nextProject, workspace)
    }

    const wasDone = task.status === 'done'
    const nextStatus = patch.status ?? task.status
    const now = new Date().toISOString()
    const updated: Task = {
      ...task,
      ...patch,
      title: patch.title?.trim() ?? task.title,
      description: patch.description?.trim() ?? patch.description ?? task.description,
      labels: patch.labels ?? task.labels,
      updatedAt: now,
      completedAt: nextStatus === 'done' ? (wasDone ? task.completedAt ?? now : now) : null,
    }

    let message = `updated “${updated.title}”`
    if (patch.status && patch.status !== task.status) {
      message = `moved “${updated.title}” to ${STATUS_LABELS[patch.status]}`
    } else if (patch.assigneeId !== undefined && patch.assigneeId !== task.assigneeId) {
      const assignee = workspace.users.find((user) => user.id === patch.assigneeId)
      message = assignee
        ? `assigned “${updated.title}” to ${assignee.name}`
        : `unassigned “${updated.title}”`
    } else if (patch.projectId && patch.projectId !== task.projectId) {
      message = `moved “${updated.title}” to ${nextProject.name}`
    } else if (patch.dueDate !== undefined && patch.dueDate !== task.dueDate) {
      message = `changed the due date on “${updated.title}”`
    } else if (patch.priority && patch.priority !== task.priority) {
      message = `set “${updated.title}” to ${patch.priority} priority`
    }

    const activity = makeActivity(
      actor.id,
      patch.status ? 'task.status' : 'task.update',
      'task',
      updated.id,
      message,
    )
    setData({
      ...workspace,
      tasks: workspace.tasks.map((item) => (item.id === id ? updated : item)),
      activities: withActivity(workspace, activity),
    })
    notify(patch.status === 'done' ? 'Task completed.' : 'Changes saved.')
    return updated
  }

  const toggleTask = (id: string): Task => {
    const workspace = requireData()
    const task = getTask(id, workspace)
    return updateTask(id, { status: task.status === 'done' ? 'todo' : 'done' })
  }

  const deleteTask = (id: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const task = getTask(id, workspace)
    const project = projectForTask(task, workspace)
    if (!canDeleteTask(actor, task, project)) throw new Error('You do not have permission to delete this task.')
    const activity = makeActivity(actor.id, 'task.delete', 'task', task.id, `deleted “${task.title}”`)
    setData({
      ...workspace,
      tasks: workspace.tasks.filter((item) => item.id !== id),
      activities: withActivity(workspace, activity),
    })
    notify('Task deleted.')
  }

  const mutateTask = (taskId: string, mutator: (task: Task, workspace: WorkspaceData) => Task): void => {
    const workspace = requireData()
    const actor = requireUser()
    const task = getTask(taskId, workspace)
    const project = projectForTask(task, workspace)
    if (!canEditTask(actor, task, project)) throw new Error('You do not have permission to update this task.')
    const updated = mutator(task, workspace)
    setData({
      ...workspace,
      tasks: workspace.tasks.map((item) => (item.id === taskId ? { ...updated, updatedAt: new Date().toISOString() } : item)),
    })
  }

  const addSubtask = (taskId: string, title: string): void => {
    if (!title.trim()) throw new Error('Add a title for the step.')
    mutateTask(taskId, (task) => ({
      ...task,
      subtasks: [...task.subtasks, { id: uid('s'), title: title.trim(), done: false }],
    }))
  }

  const toggleSubtask = (taskId: string, subtaskId: string): void => {
    mutateTask(taskId, (task) => ({
      ...task,
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
      ),
    }))
  }

  const deleteSubtask = (taskId: string, subtaskId: string): void => {
    mutateTask(taskId, (task) => ({
      ...task,
      subtasks: task.subtasks.filter((subtask) => subtask.id !== subtaskId),
    }))
  }

  const addComment = (taskId: string, body: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const task = getTask(taskId, workspace)
    const project = projectForTask(task, workspace)
    if (!canComment(actor, task, project)) throw new Error('You do not have permission to comment.')
    if (!body.trim()) throw new Error('Write a comment first.')
    const comment = {
      id: uid('c'),
      authorId: actor.id,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    }
    const updated: Task = {
      ...task,
      comments: [...task.comments, comment],
      updatedAt: comment.createdAt,
    }
    const activity = makeActivity(
      actor.id,
      'task.comment',
      'task',
      task.id,
      `commented on “${task.title}”`,
    )
    setData({
      ...workspace,
      tasks: workspace.tasks.map((item) => (item.id === taskId ? updated : item)),
      activities: withActivity(workspace, activity),
    })
  }

  const deleteComment = (taskId: string, commentId: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const task = getTask(taskId, workspace)
    const project = projectForTask(task, workspace)
    const comment = task.comments.find((item) => item.id === commentId)
    if (!comment) throw new Error('That comment no longer exists.')
    if (!canDeleteComment(actor, comment.authorId, project)) {
      throw new Error('You do not have permission to delete this comment.')
    }
    setData({
      ...workspace,
      tasks: workspace.tasks.map((item) =>
        item.id === taskId
          ? { ...item, comments: item.comments.filter((entry) => entry.id !== commentId) }
          : item,
      ),
    })
  }

  const createProject = (input: ProjectInput): Project => {
    const workspace = requireData()
    const actor = requireUser()
    if (!canCreateProject(actor)) throw new Error('Only admins and managers can create projects.')
    if (!input.name.trim()) throw new Error('Give the project a name.')
    if (!isAdmin(actor) && input.department !== actor.department) {
      throw new Error(`Managers can only create projects for ${actor.department}.`)
    }
    const lead = workspace.users.find((user) => user.id === input.leadId && user.active)
    if (!lead) throw new Error('Choose an active project lead.')
    const members = Array.from(new Set([...input.memberIds, lead.id]))
    if (input.dueDate && !isIsoDate(input.dueDate)) throw new Error('Choose a valid target date.')
    const project: Project = {
      id: uid('p'),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      color: input.color,
      status: input.status ?? 'active',
      visibility: input.visibility,
      department: input.department,
      leadId: lead.id,
      memberIds: members,
      dueDate: input.dueDate ?? null,
      createdAt: new Date().toISOString(),
    }
    const activity = makeActivity(
      actor.id,
      'project.create',
      'project',
      project.id,
      `created the project “${project.name}”`,
    )
    setData({
      ...workspace,
      projects: [project, ...workspace.projects],
      activities: withActivity(workspace, activity),
    })
    notify('Project created.')
    return project
  }

  const updateProject = (id: string, patch: Partial<ProjectInput>): Project => {
    const workspace = requireData()
    const actor = requireUser()
    const project = getProject(id, workspace)
    if (!canEditProject(actor, project)) throw new Error('You do not have permission to edit this project.')
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('A project needs a name.')
    if (patch.dueDate && !isIsoDate(patch.dueDate)) throw new Error('Choose a valid target date.')
    if (
      !isAdmin(actor) &&
      !['admin', 'manager'].includes(actor.role) &&
      (patch.department !== undefined || patch.leadId !== undefined)
    ) {
      throw new Error('Only an admin or manager can change the department or lead.')
    }
    if (!isAdmin(actor) && actor.role === 'manager' && patch.department && patch.department !== actor.department) {
      throw new Error(`Managers can only manage ${actor.department} projects.`)
    }
    if (patch.leadId) {
      const lead = workspace.users.find((user) => user.id === patch.leadId && user.active)
      if (!lead) throw new Error('Choose an active project lead.')
    }
    const members = patch.memberIds
      ? Array.from(new Set([...patch.memberIds, patch.leadId ?? project.leadId]))
      : project.memberIds
    const updated: Project = {
      ...project,
      ...patch,
      name: patch.name?.trim() ?? project.name,
      description: patch.description?.trim() ?? patch.description ?? project.description,
      memberIds: members,
      dueDate: patch.dueDate === undefined ? project.dueDate : patch.dueDate,
    }
    const activity = makeActivity(
      actor.id,
      'project.update',
      'project',
      project.id,
      `updated the project “${updated.name}”`,
    )
    setData({
      ...workspace,
      projects: workspace.projects.map((item) => (item.id === id ? updated : item)),
      activities: withActivity(workspace, activity),
    })
    notify('Project updated.')
    return updated
  }

  const deleteProject = (id: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const project = getProject(id, workspace)
    if (!canDeleteProject(actor)) throw new Error('Only an admin can delete a project.')
    const count = workspace.tasks.filter((task) => task.projectId === id).length
    const activity = makeActivity(
      actor.id,
      'project.delete',
      'project',
      project.id,
      `deleted the project “${project.name}” and ${count} ${count === 1 ? 'task' : 'tasks'}`,
    )
    setData({
      ...workspace,
      projects: workspace.projects.filter((item) => item.id !== id),
      tasks: workspace.tasks.filter((task) => task.projectId !== id),
      activities: withActivity(workspace, activity),
    })
    notify('Project and its tasks were deleted.')
    navigate('/projects')
  }

  const createUser = async (input: UserInput): Promise<User> => {
    const workspace = requireData()
    const actor = requireUser()
    if (!canManageUsers(actor)) throw new Error('Only admins can add people.')
    const name = input.name.trim()
    const email = normalizeEmail(input.email)
    if (!name) throw new Error('Add a name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Add a valid email address.')
    if (workspace.users.some((user) => normalizeEmail(user.email) === email)) {
      throw new Error('Someone with that email is already in the workspace.')
    }
    if (!input.title.trim()) throw new Error('Add a job title.')
    const problem = passwordProblem(input.password)
    if (problem) throw new Error(problem)
    const record = await createPasswordRecord(input.password)
    const now = new Date().toISOString()
    const user: User = {
      id: uid('u'),
      name,
      email,
      role: input.role,
      department: input.department,
      title: input.title.trim(),
      tone: input.tone,
      active: true,
      passwordHash: record.hash,
      salt: record.salt,
      createdAt: now,
      lastSeenAt: null,
    }
    const activity = makeActivity(actor.id, 'user.create', 'user', user.id, `added ${user.name} to the workspace`)
    setData({
      ...workspace,
      users: [...workspace.users, user],
      settings: {
        ...workspace.settings,
        [user.id]: { theme: 'system', weekStartsOn: 0, reduceMotion: false },
      },
      memory: {
        ...workspace.memory,
        [user.id]: {
          lastRoute: '/overview',
          lastTaskId: null,
          recentSearches: [],
          lastSeenAt: now,
          logins: 0,
        },
      },
      activities: withActivity(workspace, activity),
    })
    notify(`${user.name} was added.`)
    return user
  }

  const updateUser = (id: string, patch: UserPatch): User => {
    const workspace = requireData()
    const actor = requireUser()
    if (!canManageUsers(actor)) throw new Error('Only admins can manage people.')
    const target = workspace.users.find((user) => user.id === id)
    if (!target) throw new Error('That person no longer exists.')
    if (id === actor.id && patch.active === false) throw new Error('You cannot deactivate your own account.')
    const nextRole = patch.role ?? target.role
    const nextActive = patch.active ?? target.active
    if (target.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
      const otherAdmins = workspace.users.filter(
        (user) => user.role === 'admin' && user.active && user.id !== target.id,
      )
      if (otherAdmins.length === 0) throw new Error('Keep at least one active admin in the workspace.')
    }
    if (patch.email) {
      const email = normalizeEmail(patch.email)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Add a valid email address.')
      if (workspace.users.some((user) => user.id !== id && normalizeEmail(user.email) === email)) {
        throw new Error('Someone with that email is already in the workspace.')
      }
      patch = { ...patch, email }
    }
    if (patch.name !== undefined && !patch.name.trim()) throw new Error('A person needs a name.')
    const updated: User = {
      ...target,
      ...patch,
      name: patch.name?.trim() ?? target.name,
      title: patch.title?.trim() ?? target.title,
    }
    const activity = makeActivity(
      actor.id,
      'user.update',
      'user',
      target.id,
      nextActive === false && target.active
        ? `deactivated ${target.name}`
        : target.active === false && nextActive
          ? `reactivated ${target.name}`
          : `updated ${target.name}’s account`,
    )
    setData({
      ...workspace,
      users: workspace.users.map((user) => (user.id === id ? updated : user)),
      activities: withActivity(workspace, activity),
    })
    notify('Team member updated.')
    return updated
  }

  const resetUserPassword = async (id: string, password: string): Promise<void> => {
    const workspace = requireData()
    const actor = requireUser()
    if (!canManageUsers(actor)) throw new Error('Only admins can reset passwords.')
    const target = workspace.users.find((user) => user.id === id)
    if (!target) throw new Error('That person no longer exists.')
    const problem = passwordProblem(password)
    if (problem) throw new Error(problem)
    const record = await createPasswordRecord(password)
    const activity = makeActivity(actor.id, 'user.password', 'user', target.id, `reset the password for ${target.name}`)
    setData({
      ...workspace,
      users: workspace.users.map((user) =>
        user.id === id ? { ...user, passwordHash: record.hash, salt: record.salt } : user,
      ),
      activities: withActivity(workspace, activity),
    })
    notify('Password reset.')
  }

  const changePassword = async (currentPassword: string, nextPassword: string): Promise<void> => {
    const workspace = requireData()
    const actor = requireUser()
    const valid = await verifyPassword(currentPassword, actor)
    if (!valid) throw new Error('Your current password is incorrect.')
    const problem = passwordProblem(nextPassword)
    if (problem) throw new Error(problem)
    const record = await createPasswordRecord(nextPassword)
    const activity = makeActivity(actor.id, 'user.password', 'user', actor.id, 'changed their password')
    setData({
      ...workspace,
      users: workspace.users.map((user) =>
        user.id === actor.id ? { ...user, passwordHash: record.hash, salt: record.salt } : user,
      ),
      activities: withActivity(workspace, activity),
    })
    notify('Password changed.')
  }

  const updateProfile = (patch: Pick<User, 'name' | 'title' | 'tone'>): void => {
    const workspace = requireData()
    const actor = requireUser()
    if (!patch.name.trim()) throw new Error('Add your name.')
    setData({
      ...workspace,
      users: workspace.users.map((user) =>
        user.id === actor.id
          ? { ...user, name: patch.name.trim(), title: patch.title.trim(), tone: patch.tone }
          : user,
      ),
    })
    notify('Profile updated.')
  }

  const updateSettings = (patch: Partial<UserSettings>): void => {
    const workspace = requireData()
    const actor = requireUser()
    const current = workspace.settings[actor.id] ?? { theme: 'system', weekStartsOn: 0, reduceMotion: false }
    setData({
      ...workspace,
      settings: { ...workspace.settings, [actor.id]: { ...current, ...patch } },
    })
    notify('Preferences saved.')
  }

  const rememberTask = (taskId: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const current = workspace.memory[actor.id]
    if (!current || current.lastTaskId === taskId) return
    setData({
      ...workspace,
      memory: { ...workspace.memory, [actor.id]: { ...current, lastTaskId: taskId } },
    })
  }

  const rememberSearch = (term: string): void => {
    const workspace = requireData()
    const actor = requireUser()
    const value = term.trim()
    if (!value) return
    const current = workspace.memory[actor.id]
    if (!current) return
    const searches = [value, ...current.recentSearches.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 5)
    setData({
      ...workspace,
      memory: { ...workspace.memory, [actor.id]: { ...current, recentSearches: searches } },
    })
  }

  const clearRecentSearches = (): void => {
    const workspace = requireData()
    const actor = requireUser()
    const current = workspace.memory[actor.id]
    if (!current) return
    setData({
      ...workspace,
      memory: { ...workspace.memory, [actor.id]: { ...current, recentSearches: [] } },
    })
    notify('Search memory cleared.')
  }

  const exportWorkspace = (): void => {
    const workspace = requireData()
    const actor = requireUser()
    if (!isAdmin(actor)) throw new Error('Only admins can export a full workspace backup.')
    downloadJson(`cadence-workspace-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'cadence',
      exportedAt: new Date().toISOString(),
      data: workspace,
    })
    notify('Workspace backup downloaded.')
  }

  const exportPersonal = (): void => {
    const workspace = requireData()
    const actor = requireUser()
    const projects = workspace.projects.filter((project) => canViewProject(actor, project))
    const tasks = workspace.tasks.filter((task) =>
      canViewTask(actor, task, projectForTask(task, workspace)),
    )
    const personIds = new Set<string>([
      actor.id,
      ...tasks.map((task) => task.assigneeId).filter(Boolean) as string[],
      ...tasks.map((task) => task.creatorId),
      ...tasks.flatMap((task) => task.comments.map((comment) => comment.authorId)),
    ])
    downloadJson(`cadence-my-data-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'cadence',
      exportedAt: new Date().toISOString(),
      profile: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        department: actor.department,
        title: actor.title,
      },
      settings: workspace.settings[actor.id],
      memory: workspace.memory[actor.id],
      people: workspace.users
        .filter((user) => personIds.has(user.id))
        .map((user) => ({ id: user.id, name: user.name, title: user.title, department: user.department })),
      projects,
      tasks,
    })
    notify('Your data was downloaded.')
  }

  const importWorkspace = async (json: string): Promise<StoreResult> => {
    const actor = requireUser()
    if (!isAdmin(actor)) return { ok: false, error: 'Only admins can import a workspace.' }
    if (json.length > 8_000_000) return { ok: false, error: 'That backup is too large.' }
    try {
      const parsed = JSON.parse(json) as { app?: string; data?: unknown } | WorkspaceData
      const candidate = 'data' in parsed && parsed.app === 'cadence' ? parsed.data : parsed
      if (!isWorkspaceData(candidate)) return { ok: false, error: 'This is not a valid Cadence workspace backup.' }
      if (candidate.version !== DATA_VERSION) {
        return { ok: false, error: 'This backup was created by a different version of Cadence.' }
      }
      const imported = candidate as WorkspaceData
      const nextUser = imported.users.find((user) => user.id === actor.id && user.active)
      const withNote: WorkspaceData = {
        ...imported,
        activities: withActivity(
          imported,
          makeActivity(actor.id, 'workspace.import', 'workspace', null, 'restored the workspace from a backup'),
        ),
      }
      setData(withNote)
      if (!nextUser) {
        clearSession()
        setUserId(null)
        notify('Workspace restored. Sign in with an account from the backup.', 'info')
        return { ok: true }
      }
      notify('Workspace restored from backup.')
      return { ok: true }
    } catch {
      return { ok: false, error: 'The backup could not be read.' }
    }
  }

  const resetWorkspace = async (): Promise<void> => {
    const actor = requireUser()
    if (!isAdmin(actor)) throw new Error('Only admins can reset the workspace.')
    const seed = await buildSeedData()
    clearStoredData()
    saveStoredData(seed)
    clearSession()
    setData(seed)
    setUserId(null)
    navigate('/overview')
    notify('The demo workspace was restored.', 'info')
  }

  if (booting) return <BootScreen />
  if (fatalError) return <BootScreen error={fatalError} />
  if (!data) return <BootScreen error="The local workspace could not be loaded." />

  const settings: UserSettings = currentUser
    ? data.settings[currentUser.id] ?? { theme: 'system', weekStartsOn: 0, reduceMotion: false }
    : { theme: 'system', weekStartsOn: 0, reduceMotion: false }

  const value: StoreValue = {
    data,
    currentUser,
    settings,
    route,
    toasts,
    storageHealthy,
    navigate,
    notify,
    dismissToast,
    login,
    quickLogin,
    logout,
    createTask,
    updateTask,
    toggleTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    deleteComment,
    createProject,
    updateProject,
    deleteProject,
    createUser,
    updateUser,
    resetUserPassword,
    changePassword,
    updateProfile,
    updateSettings,
    rememberTask,
    rememberSearch,
    clearRecentSearches,
    exportWorkspace,
    exportPersonal,
    importWorkspace,
    resetWorkspace,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useStore must be used inside StoreProvider.')
  return context
}

export function useCurrentUser(): User {
  const { currentUser } = useStore()
  if (!currentUser) throw new Error('A signed-in user is required for this view.')
  return currentUser
}
