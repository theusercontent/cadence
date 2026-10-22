import type {
  Activity,
  Project,
  Session,
  Task,
  User,
  UserMemory,
  UserSettings,
  WorkspaceData,
} from '../types'

const NOW = '2026-10-01T09:00:00.000Z'

function makeUser(overrides: Partial<User> & Pick<User, 'id' | 'name' | 'email' | 'role'>): User {
  return {
    passwordHash: 'test-hash',
    salt: 'test-salt',
    department: 'Product',
    title: 'Teammate',
    tone: '#2F6FED',
    active: true,
    createdAt: NOW,
    lastSeenAt: NOW,
    ...overrides,
  }
}

export const adminUser = makeUser({
  id: 'u-admin',
  name: 'Ava Admin',
  email: 'admin@cadence.test',
  role: 'admin',
  department: 'Leadership',
  title: 'Chief of Staff',
})

export const managerUser = makeUser({
  id: 'u-manager',
  name: 'Marcus Manager',
  email: 'manager@cadence.test',
  role: 'manager',
  department: 'Product',
  title: 'Head of Product',
})

export const employeeUser = makeUser({
  id: 'u-employee',
  name: 'Maya Employee',
  email: 'employee@cadence.test',
  role: 'employee',
  department: 'Design',
  title: 'Product Designer',
})

export const viewerUser = makeUser({
  id: 'u-viewer',
  name: 'Noah Viewer',
  email: 'viewer@cadence.test',
  role: 'viewer',
  department: 'Finance',
  title: 'Finance Analyst',
})

export const inactiveUser = makeUser({
  id: 'u-inactive',
  name: 'Inactive Person',
  email: 'inactive@cadence.test',
  role: 'employee',
  department: 'Engineering',
  active: false,
})

export const users = [adminUser, managerUser, employeeUser, viewerUser, inactiveUser]

const sharedProject: Project = {
  id: 'p-shared',
  name: 'Shared Launch',
  description: 'A workspace-wide project.',
  color: '#2F6FED',
  status: 'active',
  visibility: 'workspace',
  department: 'Product',
  leadId: managerUser.id,
  memberIds: [managerUser.id, employeeUser.id],
  dueDate: null,
  createdAt: NOW,
}

const designProject: Project = {
  id: 'p-design',
  name: 'Design Systems',
  description: 'A department project.',
  color: '#E06C94',
  status: 'active',
  visibility: 'team',
  department: 'Design',
  leadId: employeeUser.id,
  memberIds: [employeeUser.id],
  dueDate: null,
  createdAt: NOW,
}

const secretProject: Project = {
  id: 'p-secret',
  name: 'Board Planning',
  description: 'A private project.',
  color: '#8B6CF0',
  status: 'active',
  visibility: 'private',
  department: 'Leadership',
  leadId: adminUser.id,
  memberIds: [adminUser.id],
  dueDate: null,
  createdAt: NOW,
}

export const projects = [sharedProject, designProject, secretProject]

function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'title' | 'projectId'>): Task {
  return {
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    assigneeName: null,
    creatorId: managerUser.id,
    dueDate: null,
    labels: [],
    subtasks: [],
    comments: [],
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    order: 1,
    ...overrides,
  }
}

export const tasks = [
  makeTask({
    id: 't-mine',
    title: 'My shared task',
    projectId: sharedProject.id,
    assigneeId: employeeUser.id,
    creatorId: employeeUser.id,
    order: 1,
  }),
  makeTask({
    id: 't-other',
    title: 'Someone else’s task',
    projectId: sharedProject.id,
    assigneeId: managerUser.id,
    creatorId: managerUser.id,
    order: 2,
  }),
  makeTask({
    id: 't-design',
    title: 'Department design task',
    projectId: designProject.id,
    assigneeId: employeeUser.id,
    creatorId: employeeUser.id,
    status: 'in_progress',
    order: 3,
  }),
  makeTask({
    id: 't-secret',
    title: 'Private board task',
    projectId: secretProject.id,
    assigneeId: adminUser.id,
    creatorId: adminUser.id,
    priority: 'urgent',
    order: 4,
  }),
]

const activities: Activity[] = [
  {
    id: 'a-1',
    actorId: managerUser.id,
    action: 'task.create',
    entityType: 'task',
    entityId: 't-other',
    message: 'added “Someone else’s task”',
    createdAt: NOW,
  },
]

export function makeWorkspace(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  const settings: Record<string, UserSettings> = Object.fromEntries(
    users.map((user) => [
      user.id,
      { theme: 'system', weekStartsOn: 0, reduceMotion: false } satisfies UserSettings,
    ]),
  )
  const memory: Record<string, UserMemory> = Object.fromEntries(
    users.map((user) => [
      user.id,
      {
        lastRoute: '/overview',
        lastTaskId: null,
        recentSearches: [],
        lastSeenAt: NOW,
        logins: 1,
      } satisfies UserMemory,
    ]),
  )
  return {
    version: 2,
    createdAt: NOW,
    users,
    projects,
    tasks,
    activities,
    settings,
    memory,
    reviews: [],
    ...overrides,
  }
}

export function makeSession(userId: string): Session {
  return { userId, startedAt: NOW, remember: true }
}
