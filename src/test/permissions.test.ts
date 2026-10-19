import { describe, expect, it } from 'vitest'
import type { Activity, Task } from '../types'
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
  canViewUser,
  visibleActivities,
  visibleProjects,
  visibleTasks,
} from '../lib/permissions'
import {
  adminUser,
  employeeUser,
  inactiveUser,
  makeWorkspace,
  managerUser,
  projects,
  tasks,
  viewerUser,
} from './fixtures'

const shared = projects.find((project) => project.id === 'p-shared')!
const design = projects.find((project) => project.id === 'p-design')!
const secret = projects.find((project) => project.id === 'p-secret')!
const mine = tasks.find((task) => task.id === 't-mine')!
const other = tasks.find((task) => task.id === 't-other')!
const designTask = tasks.find((task) => task.id === 't-design')!
const secretTask = tasks.find((task) => task.id === 't-secret')!

describe('project visibility', () => {
  it('lets admins see everything and scopes everyone else', () => {
    expect(canViewProject(adminUser, secret)).toBe(true)
    expect(canViewProject(managerUser, shared)).toBe(true)
    expect(canViewProject(managerUser, design)).toBe(false)
    expect(canViewProject(employeeUser, design)).toBe(true)
    expect(canViewProject(employeeUser, secret)).toBe(false)
    expect(canViewProject(viewerUser, shared)).toBe(true)
    expect(canViewProject(viewerUser, design)).toBe(false)
    expect(canViewProject(inactiveUser, shared)).toBe(false)
  })

  it('filters project lists to what each role can see', () => {
    const data = makeWorkspace()
    expect(visibleProjects(adminUser, data)).toHaveLength(3)
    expect(visibleProjects(employeeUser, data).map((project) => project.id)).toEqual([
      'p-shared',
      'p-design',
    ])
    expect(visibleProjects(viewerUser, data).map((project) => project.id)).toEqual(['p-shared'])
    expect(visibleProjects(inactiveUser, data)).toHaveLength(0)
  })
})

describe('task visibility and editing', () => {
  it('shows tasks through projects, assignment, or ownership', () => {
    expect(canViewTask(adminUser, secretTask, secret)).toBe(true)
    expect(canViewTask(employeeUser, mine, shared)).toBe(true)
    expect(canViewTask(employeeUser, other, shared)).toBe(true)
    expect(canViewTask(employeeUser, secretTask, secret)).toBe(false)
    expect(canViewTask(viewerUser, other, shared)).toBe(true)
    expect(canViewTask(viewerUser, secretTask, secret)).toBe(false)
    expect(canViewTask(inactiveUser, mine, shared)).toBe(false)
  })

  it('limits edits by ownership, project lead, department, and role', () => {
    expect(canEditTask(adminUser, other, shared)).toBe(true)
    expect(canEditTask(employeeUser, mine, shared)).toBe(true)
    expect(canEditTask(employeeUser, other, shared)).toBe(false)
    expect(canEditTask(employeeUser, designTask, design)).toBe(true)
    expect(canEditTask(managerUser, other, shared)).toBe(true)
    expect(canEditTask(managerUser, designTask, design)).toBe(false)
    expect(canEditTask(viewerUser, mine, shared)).toBe(false)
    expect(canEditTask(inactiveUser, mine, shared)).toBe(false)
  })

  it('separates assignment and deletion from general editing', () => {
    expect(canAssignTask(employeeUser, mine, shared)).toBe(true)
    expect(canAssignTask(employeeUser, other, shared)).toBe(false)
    expect(canAssignTask(managerUser, other, shared)).toBe(true)
    expect(canAssignTask(viewerUser, mine, shared)).toBe(false)
    expect(canAssignTask(inactiveUser, mine, shared)).toBe(false)

    expect(canDeleteTask(employeeUser, mine, shared)).toBe(true)
    expect(canDeleteTask(employeeUser, other, shared)).toBe(false)
    expect(canDeleteTask(adminUser, other, shared)).toBe(true)
    expect(canDeleteTask(viewerUser, mine, shared)).toBe(false)
  })

  it('filters tasks and activities using the same visibility rules', () => {
    const data = makeWorkspace()
    expect(visibleTasks(adminUser, data)).toHaveLength(4)
    expect(visibleTasks(employeeUser, data).map((task) => task.id)).toEqual([
      't-mine',
      't-other',
      't-design',
    ])
    expect(visibleTasks(viewerUser, data).map((task) => task.id)).toEqual(['t-mine', 't-other'])

    const boardActivity: Activity = {
      id: 'a-secret',
      actorId: adminUser.id,
      action: 'task.update',
      entityType: 'task',
      entityId: secretTask.id,
      message: 'updated a private task',
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    expect(visibleActivities(adminUser, { ...data, activities: [boardActivity] })).toHaveLength(1)
    expect(visibleActivities(employeeUser, { ...data, activities: [boardActivity] })).toHaveLength(0)
  })
})

describe('project, people, and comment permissions', () => {
  it('allows only writers to create tasks and only leads or managers to create projects', () => {
    expect(canCreateTask(employeeUser)).toBe(true)
    expect(canCreateTask(viewerUser)).toBe(false)
    expect(canCreateTask(inactiveUser)).toBe(false)
    expect(canCreateProject(managerUser)).toBe(true)
    expect(canCreateProject(adminUser)).toBe(true)
    expect(canCreateProject(employeeUser)).toBe(false)
    expect(canCreateProject(viewerUser)).toBe(false)
    expect(canCreateProject(inactiveUser)).toBe(false)
  })

  it('scopes project edits and reserves deletion for admins', () => {
    expect(canEditProject(adminUser, secret)).toBe(true)
    expect(canEditProject(managerUser, shared)).toBe(true)
    expect(canEditProject(managerUser, design)).toBe(false)
    expect(canEditProject(employeeUser, design)).toBe(true)
    expect(canEditProject(employeeUser, shared)).toBe(false)
    expect(canEditProject(viewerUser, shared)).toBe(false)
    expect(canDeleteProject(adminUser)).toBe(true)
    expect(canDeleteProject(managerUser)).toBe(false)
    expect(canDeleteProject(viewerUser)).toBe(false)
  })

  it('reserves people management for active admins', () => {
    expect(canManageUsers(adminUser)).toBe(true)
    expect(canManageUsers(managerUser)).toBe(false)
    expect(canManageUsers(viewerUser)).toBe(false)
    expect(canManageUsers(inactiveUser)).toBe(false)
    expect(canViewUser(adminUser, inactiveUser)).toBe(true)
    expect(canViewUser(employeeUser, inactiveUser)).toBe(false)
    expect(canViewUser(employeeUser, employeeUser)).toBe(true)
  })

  it('allows comments only on visible tasks and manages their deletion', () => {
    expect(canComment(employeeUser, other, shared)).toBe(true)
    expect(canComment(employeeUser, secretTask, secret)).toBe(false)
    expect(canComment(viewerUser, mine, shared)).toBe(false)
    expect(canComment(inactiveUser, mine, shared)).toBe(false)

    expect(canDeleteComment(employeeUser, employeeUser.id, shared)).toBe(true)
    expect(canDeleteComment(employeeUser, managerUser.id, shared)).toBe(false)
    expect(canDeleteComment(managerUser, employeeUser.id, shared)).toBe(true)
    expect(canDeleteComment(adminUser, employeeUser.id, shared)).toBe(true)
    expect(canDeleteComment(viewerUser, employeeUser.id, shared)).toBe(false)
  })
})

describe('role helpers', () => {
  it('keeps inactive people out of every write path', () => {
    const allChecks: Array<(user: typeof inactiveUser, task: Task) => boolean> = [
      (user, task) => canEditTask(user, task, shared),
      (user, task) => canAssignTask(user, task, shared),
      (user, task) => canDeleteTask(user, task, shared),
      (user, task) => canComment(user, task, shared),
    ]
    for (const check of allChecks) {
      expect(check(inactiveUser, mine)).toBe(false)
    }
  })
})
