export type Role = 'admin' | 'manager' | 'employee' | 'viewer'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectVisibility = 'workspace' | 'team' | 'private'
export type ProjectStatus = 'active' | 'paused' | 'completed'
export type ThemePreference = 'system' | 'light' | 'dark'

export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
  salt: string
  role: Role
  department: string
  title: string
  tone: string
  active: boolean
  createdAt: string
  lastSeenAt: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  color: string
  status: ProjectStatus
  visibility: ProjectVisibility
  department: string
  leadId: string
  memberIds: string[]
  dueDate: string | null
  createdAt: string
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Comment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  projectId: string
  assigneeId: string | null
  assigneeName: string | null
  creatorId: string
  dueDate: string | null
  labels: string[]
  subtasks: Subtask[]
  comments: Comment[]
  createdAt: string
  updatedAt: string
  completedAt: string | null
  order: number
}

export type ActivityEntity = 'task' | 'project' | 'user' | 'session' | 'workspace'

export interface Activity {
  id: string
  actorId: string
  action: string
  entityType: ActivityEntity
  entityId: string | null
  message: string
  createdAt: string
}

export interface UserMemory {
  lastRoute: string
  lastTaskId: string | null
  recentSearches: string[]
  lastSeenAt: string
  logins: number
}

export interface UserSettings {
  theme: ThemePreference
  weekStartsOn: 0 | 1
  reduceMotion: boolean
}

export interface WeeklyReview {
  id: string
  userId: string
  weekStart: string
  weekEnd: string
  reviewedAt: string
  intention: string
  priorityIds: string[]
  completedCount: number
  projectCount: number
  openCount: number
}

export interface WeeklyReviewInput {
  weekStart: string
  weekEnd: string
  intention?: string
  priorityIds: string[]
}

export interface WorkspaceData {
  version: number
  createdAt: string
  users: User[]
  projects: Project[]
  tasks: Task[]
  activities: Activity[]
  settings: Record<string, UserSettings>
  memory: Record<string, UserMemory>
  reviews: WeeklyReview[]
}

export interface Session {
  userId: string
  startedAt: string
  remember: boolean
}

export interface TaskInput {
  title: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  projectId: string
  assigneeId?: string | null
  assigneeName?: string | null
  dueDate?: string | null
  labels?: string[]
  subtasks?: Array<Pick<Subtask, 'title' | 'done'>>
}

export interface ProjectInput {
  name: string
  description?: string
  color: string
  status?: ProjectStatus
  visibility: ProjectVisibility
  department: string
  leadId: string
  memberIds: string[]
  dueDate?: string | null
}

export interface UserInput {
  name: string
  email: string
  role: Role
  department: string
  title: string
  tone: string
  password: string
}

export interface AuthResult {
  ok: boolean
  error?: string
}

export interface StoreResult {
  ok: boolean
  error?: string
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To do',
  in_progress: 'In progress',
  review: 'In review',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
  viewer: 'Viewer',
}

export const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  workspace: 'Everyone',
  team: 'Department',
  private: 'Invited only',
}

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done']
export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low']
