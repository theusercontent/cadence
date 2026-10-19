import type {
  Activity,
  Project,
  Role,
  Task,
  User,
  WorkspaceData,
} from '../types'

export const isAdmin = (user: User): boolean => user.role === 'admin'
export const isManager = (user: User): boolean => user.role === 'manager'
export const isViewer = (user: User): boolean => user.role === 'viewer'
export const isWriter = (user: User): boolean => user.active && user.role !== 'viewer'

export const roleBadgeTone = (role: Role): string => {
  switch (role) {
    case 'admin':
      return 'purple'
    case 'manager':
      return 'blue'
    case 'employee':
      return 'green'
    case 'viewer':
      return 'gray'
  }
}

export function canViewProject(user: User, project: Project): boolean {
  if (!user.active) return false
  if (isAdmin(user)) return true
  if (project.leadId === user.id || project.memberIds.includes(user.id)) return true
  if (project.visibility === 'workspace') return true
  if (project.visibility === 'team') {
    return project.department === user.department
  }
  return false
}

export function canViewTask(user: User, task: Task, project?: Project | null): boolean {
  if (!user.active) return false
  if (isAdmin(user)) return true
  if (task.creatorId === user.id || task.assigneeId === user.id) return true
  return Boolean(project && canViewProject(user, project))
}

export function canEditTask(user: User, task: Task, project?: Project | null): boolean {
  if (!isWriter(user)) return false
  if (isAdmin(user)) return true
  if (task.creatorId === user.id || task.assigneeId === user.id) return true
  if (project?.leadId === user.id) return true
  if (isManager(user) && project?.department === user.department) return true
  return false
}

export function canAssignTask(user: User, task: Task, project?: Project | null): boolean {
  if (!isWriter(user)) return false
  if (isAdmin(user)) return true
  if (task.creatorId === user.id) return true
  if (project?.leadId === user.id) return true
  if (isManager(user) && project?.department === user.department) return true
  return false
}

export function canDeleteTask(user: User, task: Task, project?: Project | null): boolean {
  if (!isWriter(user)) return false
  if (isAdmin(user)) return true
  if (task.creatorId === user.id) return true
  if (project?.leadId === user.id) return true
  if (isManager(user) && project?.department === user.department) return true
  return false
}

export function canCreateTask(user: User): boolean {
  return user.active && isWriter(user)
}

export function canCreateProject(user: User): boolean {
  return user.active && (isAdmin(user) || isManager(user))
}

export function canEditProject(user: User, project: Project): boolean {
  if (!user.active) return false
  if (isAdmin(user)) return true
  if (project.leadId === user.id) return true
  if (isManager(user) && project.department === user.department) return true
  return false
}

export function canDeleteProject(user: User): boolean {
  return user.active && isAdmin(user)
}

export function canManageUsers(user: User): boolean {
  return user.active && isAdmin(user)
}

export function canComment(user: User, task: Task, project?: Project | null): boolean {
  return isWriter(user) && canViewTask(user, task, project)
}

export function canDeleteComment(
  user: User,
  authorId: string,
  project?: Project | null,
): boolean {
  if (!isWriter(user)) return false
  if (isAdmin(user)) return true
  if (authorId === user.id) return true
  if (project?.leadId === user.id) return true
  if (isManager(user) && project?.department === user.department) return true
  return false
}

export function canViewUser(viewer: User, target: User): boolean {
  if (isAdmin(viewer)) return true
  if (target.id === viewer.id) return true
  return target.active
}

export function visibleProjects(user: User, data: WorkspaceData): Project[] {
  return data.projects.filter((project) => canViewProject(user, project))
}

export function visibleTasks(user: User, data: WorkspaceData): Task[] {
  return data.tasks.filter((task) => {
    const project = data.projects.find((item) => item.id === task.projectId)
    return canViewTask(user, task, project)
  })
}

export function projectForTask(task: Task, data: WorkspaceData): Project | undefined {
  return data.projects.find((project) => project.id === task.projectId)
}

export function visibleActivities(user: User, data: WorkspaceData): Activity[] {
  if (isAdmin(user)) return data.activities
  return data.activities.filter((activity) => {
    if (activity.actorId === user.id) return true
    if (activity.entityType === 'task') {
      const task = data.tasks.find((item) => item.id === activity.entityId)
      if (!task) return false
      const project = projectForTask(task, data)
      return canViewTask(user, task, project)
    }
    if (activity.entityType === 'project') {
      const project = data.projects.find((item) => item.id === activity.entityId)
      return project ? canViewProject(user, project) : false
    }
    if (activity.entityType === 'user') return activity.entityId === user.id
    return false
  })
}

export function accessibleUsers(user: User, data: WorkspaceData): User[] {
  return data.users.filter((target) => canViewUser(user, target))
}

export function canSetDepartment(user: User): boolean {
  return isAdmin(user) || isManager(user)
}

export function canManageWorkspace(user: User): boolean {
  return isAdmin(user)
}

export function permissionSummary(user: User): string {
  switch (user.role) {
    case 'admin':
      return 'You can see and manage everything in this workspace, including people and local data.'
    case 'manager':
      return `You can manage ${user.department} projects and any task shared with you. People management is reserved for admins.`
    case 'employee':
      return 'You can create work, complete tasks assigned to you, and collaborate on projects you can access.'
    case 'viewer':
      return 'You have read-only access to shared work. Creating and editing are disabled.'
  }
}
