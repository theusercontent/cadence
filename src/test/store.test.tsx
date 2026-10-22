import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Task, User, WorkspaceData } from '../types'
import type { StoreValue } from '../store/store'
import { StoreProvider, useStore } from '../store/store'
import { createPasswordRecord, verifyPassword } from '../lib/auth'
import { DATA_KEY, readStoredData } from '../lib/storage'
import { weekRange } from '../lib/review'
import {
  adminUser,
  makeSession,
  makeWorkspace,
  managerUser,
} from './fixtures'

const SESSION_KEY = 'cadence.session.v1'

function wrapper({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>
}

function seedStorage(data: WorkspaceData, userId?: string) {
  localStorage.clear()
  sessionStorage.clear()
  window.location.hash = '#/overview'
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
  if (userId) localStorage.setItem(SESSION_KEY, JSON.stringify(makeSession(userId)))
}

async function renderStore(
  userId: string | null = 'u-employee',
  data: WorkspaceData = makeWorkspace(),
) {
  seedStorage(data, userId ?? undefined)
  const view = renderHook(() => useStore(), { wrapper })
  await waitFor(() => {
    expect(view.result.current?.data.version).toBe(2)
  })
  if (userId) {
    await waitFor(() => {
      expect(view.result.current?.currentUser?.id).toBe(userId)
    })
  } else {
    expect(view.result.current?.currentUser).toBeNull()
  }
  return view
}

async function useEmployeeStore() {
  return renderStore('u-employee')
}

describe('store task mutations', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('creates, completes, and persists a task for an employee', async () => {
    const { result } = await useEmployeeStore()
    let created!: Task

    act(() => {
      created = result.current.createTask({
        title: '  Prepare the design review  ',
        description: 'Summarize the open questions.',
        projectId: 'p-design',
        priority: 'high',
        dueDate: '2026-10-20',
        labels: ['Design', '  Review '],
      })
    })

    expect(created.title).toBe('Prepare the design review')
    expect(created.creatorId).toBe('u-employee')
    expect(created.assigneeId).toBe('u-employee')
    expect(created.assigneeName).toBeNull()
    expect(created.status).toBe('todo')
    expect(created.labels).toEqual(['Design', 'Review'])
    expect(created.order).toBe(5)
    expect(result.current.data.tasks[0].id).toBe(created.id)
    expect(result.current.data.activities[0].action).toBe('task.create')

    act(() => {
      result.current.toggleTask(created.id)
    })
    const completed = result.current.data.tasks.find((task) => task.id === created.id)!
    expect(completed.status).toBe('done')
    expect(completed.completedAt).not.toBeNull()

    await waitFor(() => {
      const stored = readStoredData()
      expect(stored?.tasks.find((task) => task.id === created.id)?.status).toBe('done')
      expect(stored?.activities[0].action).toBe('task.status')
    })
  })

  it('tracks an external assignee name without granting workspace access', async () => {
    const { result } = await useEmployeeStore()
    let created!: Task

    act(() => {
      created = result.current.createTask({
        title: '  Send vendor brief  ',
        projectId: 'p-design',
        assigneeId: null,
        assigneeName: '  Rowan Vale  ',
      })
    })

    expect(created.assigneeId).toBeNull()
    expect(created.assigneeName).toBe('Rowan Vale')

    act(() => {
      result.current.updateTask(created.id, { assigneeName: 'Rowan V.' })
    })
    const external = result.current.data.tasks.find((task) => task.id === created.id)!
    expect(external.assigneeId).toBeNull()
    expect(external.assigneeName).toBe('Rowan V.')
    expect(result.current.data.activities[0].message).toContain('Rowan V.')

    act(() => {
      result.current.updateTask(created.id, { assigneeId: 'u-employee' })
    })
    const linked = result.current.data.tasks.find((task) => task.id === created.id)!
    expect(linked.assigneeId).toBe('u-employee')
    expect(linked.assigneeName).toBeNull()
  })

  it('updates subtasks and comments with activity history', async () => {
    const { result } = await useEmployeeStore()

    act(() => {
      result.current.addSubtask('t-mine', 'Draft the outline')
    })
    act(() => {
      result.current.addComment('t-mine', '  Ready for a first look.  ')
    })

    const task = result.current.data.tasks.find((item) => item.id === 't-mine')!
    expect(task.subtasks.at(-1)?.title).toBe('Draft the outline')
    expect(task.comments.at(-1)?.body).toBe('Ready for a first look.')
    expect(result.current.data.activities[0].action).toBe('task.comment')

    act(() => {
      result.current.toggleSubtask('t-mine', task.subtasks.at(-1)!.id)
    })
    expect(
      result.current.data.tasks
        .find((item) => item.id === 't-mine')!
        .subtasks.at(-1)?.done,
    ).toBe(true)
  })

  it('keeps viewers read-only across every mutation', async () => {
    const { result } = await renderStore('u-viewer')

    expect(() =>
      result.current.createTask({ title: 'Nope', projectId: 'p-shared' }),
    ).toThrow(/read-only/i)
    expect(() => result.current.updateTask('t-mine', { title: 'Nope' })).toThrow(
      /permission/i,
    )
    expect(() => result.current.updateTask('t-mine', { assigneeName: 'Nope' })).toThrow(
      /permission/i,
    )
    expect(() => result.current.toggleTask('t-mine')).toThrow(/permission/i)
    expect(() => result.current.deleteTask('t-mine')).toThrow(/permission/i)
    expect(() => result.current.addComment('t-mine', 'Nope')).toThrow(/permission/i)
    expect(() =>
      result.current.createProject({
        name: 'Nope',
        color: '#000000',
        visibility: 'workspace',
        department: 'Finance',
        leadId: 'u-viewer',
        memberIds: [],
      }),
    ).toThrow(/admins and managers/i)
    expect(() => result.current.updateUser('u-employee', { title: 'Nope' })).toThrow(
      /Only admins/i,
    )
    expect(result.current.data.tasks).toHaveLength(4)
  })

  it('stops employees editing work they do not own', async () => {
    const { result } = await useEmployeeStore()

    expect(() => result.current.updateTask('t-other', { title: 'Changed' })).toThrow(
      /permission/i,
    )
    expect(() => result.current.deleteTask('t-other')).toThrow(/permission/i)

    act(() => {
      result.current.updateTask('t-mine', { priority: 'urgent' })
    })
    expect(
      result.current.data.tasks.find((task) => task.id === 't-mine')?.priority,
    ).toBe('urgent')
  })

  it('lets a manager manage their department but not other departments', async () => {
    const { result } = await renderStore('u-manager')

    let createdProjectId = ''
    act(() => {
      const project = result.current.createProject({
        name: 'Product Q4',
        description: 'Planning for the next quarter.',
        color: '#2F6FED',
        visibility: 'team',
        department: 'Product',
        leadId: 'u-manager',
        memberIds: ['u-employee'],
      })
      createdProjectId = project.id
    })
    expect(result.current.data.projects[0].id).toBe(createdProjectId)
    expect(result.current.data.activities[0].action).toBe('project.create')

    expect(() =>
      result.current.createProject({
        name: 'Design Q4',
        color: '#E06C94',
        visibility: 'team',
        department: 'Design',
        leadId: 'u-manager',
        memberIds: [],
      }),
    ).toThrow(/Product/)
    expect(() => result.current.deleteProject('p-shared')).toThrow(/Only an admin/i)
    expect(() => result.current.updateUser('u-employee', { title: 'Nope' })).toThrow(
      /Only admins/i,
    )
  })
})

describe('admin and account mutations', () => {
  it('creates a user with a verifiable password and initializes their workspace', async () => {
    const { result } = await renderStore('u-admin')
    let created!: User

    await act(async () => {
      created = await result.current.createUser({
        name: '  Jules Martin ',
        email: '  Jules@Cadence.Test ',
        role: 'employee',
        department: 'Engineering',
        title: '  Platform Engineer ',
        tone: '#3FA77A',
        password: 'jules1234',
      })
    })

    expect(created.name).toBe('Jules Martin')
    expect(created.email).toBe('jules@cadence.test')
    await expect(verifyPassword('jules1234', created)).resolves.toBe(true)
    await expect(verifyPassword('wrong1234', created)).resolves.toBe(false)
    expect(result.current.data.settings[created.id]).toEqual({
      theme: 'system',
      weekStartsOn: 0,
      reduceMotion: false,
    })
    expect(result.current.data.memory[created.id].lastRoute).toBe('/overview')
    expect(result.current.data.activities[0].action).toBe('user.create')

    await expect(
      result.current.createUser({
        name: 'Duplicate',
        email: 'jules@cadence.test',
        role: 'viewer',
        department: 'Finance',
        title: 'Analyst',
        tone: '#2F6FED',
        password: 'duplicate1',
      }),
    ).rejects.toThrow(/already in the workspace/i)
  })

  it('protects the last admin and prevents self-deactivation', async () => {
    const { result } = await renderStore('u-admin')

    expect(() => result.current.updateUser(adminUser.id, { active: false })).toThrow(
      /your own account/i,
    )
    expect(() =>
      result.current.updateUser(adminUser.id, { role: 'manager' }),
    ).toThrow(/at least one active admin/i)

    act(() => {
      result.current.updateUser('u-employee', { active: false })
    })
    expect(
      result.current.data.users.find((user) => user.id === 'u-employee')?.active,
    ).toBe(false)
    expect(result.current.data.activities[0].message).toMatch(/deactivated/i)
  })

  it('signs an admin in, records the session, and signs out', async () => {
    const record = await createPasswordRecord('adminpass1')
    const data = makeWorkspace({
      users: [
        { ...adminUser, salt: record.salt, passwordHash: record.hash },
        managerUser,
        ...makeWorkspace().users.slice(2),
      ],
    })
    const { result } = await renderStore(null, data)

    let outcome!: Awaited<ReturnType<StoreValue['login']>>
    await act(async () => {
      outcome = await result.current.login('  ADMIN@cadence.test ', 'adminpass1', true)
    })
    expect(outcome.ok).toBe(true)
    expect(result.current.currentUser?.id).toBe('u-admin')
    expect(result.current.data.memory['u-admin'].logins).toBe(2)
    expect(result.current.data.activities[0].action).toBe('auth.login')
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()

    const failed = await result.current.login('admin@cadence.test', 'wrongpass1', true)
    expect(failed.ok).toBe(false)

    act(() => {
      result.current.logout()
    })
    expect(result.current.currentUser).toBeNull()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(sessionStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('memory and preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('deduplicates recent searches, caps them, and persists preferences', async () => {
    const { result } = await useEmployeeStore()

    for (const term of ['Atlas', 'atlas', 'sync', 'board', 'focus', 'review', 'plan']) {
      act(() => {
        result.current.rememberSearch(term)
      })
    }

    expect(result.current.data.memory['u-employee'].recentSearches).toEqual([
      'plan',
      'review',
      'focus',
      'board',
      'sync',
    ])

    act(() => {
      result.current.rememberTask('t-mine')
    })
    act(() => {
      result.current.updateSettings({ theme: 'dark', weekStartsOn: 1 })
    })
    expect(result.current.data.memory['u-employee'].lastTaskId).toBe('t-mine')
    expect(result.current.settings.theme).toBe('dark')
    expect(result.current.settings.weekStartsOn).toBe(1)

    await waitFor(() => {
      const stored = readStoredData()
      expect(stored?.memory['u-employee'].recentSearches[0]).toBe('plan')
      expect(stored?.settings['u-employee'].theme).toBe('dark')
    })

    act(() => {
      result.current.clearRecentSearches()
    })
    expect(result.current.data.memory['u-employee'].recentSearches).toEqual([])
  })

  it('does not persist blank searches or duplicate task memory', async () => {
    const { result } = await useEmployeeStore()

    act(() => {
      result.current.rememberSearch('   ')
    })
    act(() => {
      result.current.rememberTask('t-mine')
    })
    expect(result.current.data.memory['u-employee'].recentSearches).toEqual([])
    expect(result.current.data.memory['u-employee'].lastTaskId).toBe('t-mine')

    const before = result.current.data
    act(() => {
      result.current.rememberTask('t-mine')
    })
    expect(result.current.data).toBe(before)
  })
})

describe('weekly cadence', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('closes one review per week and updates it in place', async () => {
    const { result } = await useEmployeeStore()
    const range = weekRange(new Date(), 1)
    let reviewId = ''

    act(() => {
      const review = result.current.saveWeeklyReview({
        weekStart: range.start,
        weekEnd: range.end,
        intention: '  Make room for the launch review.  ',
        priorityIds: ['t-mine', 't-design'],
      })
      reviewId = review.id
      expect(review.intention).toBe('Make room for the launch review.')
      expect(review.priorityIds).toEqual(['t-mine', 't-design'])
    })

    expect(result.current.data.reviews).toHaveLength(1)
    expect(result.current.data.reviews[0].userId).toBe('u-employee')

    act(() => {
      result.current.saveWeeklyReview({
        weekStart: range.start,
        weekEnd: range.end,
        intention: 'Fewer open loops.',
        priorityIds: ['t-mine'],
      })
    })

    expect(result.current.data.reviews).toHaveLength(1)
    expect(result.current.data.reviews[0].id).toBe(reviewId)
    expect(result.current.data.reviews[0].intention).toBe('Fewer open loops.')

    await waitFor(() => {
      const stored = readStoredData()
      expect(stored?.reviews).toHaveLength(1)
      expect(stored?.reviews[0].intention).toBe('Fewer open loops.')
    })
  })

  it('keeps priorities inside the reviewer’s scope and lets viewers close a personal review', async () => {
    const employee = await useEmployeeStore()
    const range = weekRange(new Date(), 1)

    expect(() =>
      employee.result.current.saveWeeklyReview({
        weekStart: range.start,
        weekEnd: range.end,
        priorityIds: ['t-other'],
      }),
    ).toThrow(/no longer in view/i)

    const viewer = await renderStore('u-viewer')
    act(() => {
      viewer.result.current.saveWeeklyReview({
        weekStart: range.start,
        weekEnd: range.end,
        intention: 'A quiet week of observing.',
        priorityIds: [],
      })
    })

    expect(viewer.result.current.data.reviews[0].userId).toBe('u-viewer')
    expect(viewer.result.current.data.tasks).toHaveLength(4)
  })
})
