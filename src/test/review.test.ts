import { describe, expect, it } from 'vitest'
import type { Task, WeeklyReview, WorkspaceData } from '../types'
import { addDays, fromISODate, todayISO } from '../lib/dates'
import {
  buildWeeklyReviewSnapshot,
  normalizeWeeklyReviewInput,
  reviewForWeek,
  reviewHistory,
  reviewScopeTasks,
  weekRange,
} from '../lib/review'
import { normalizeWorkspaceData } from '../lib/storage'
import { adminUser, employeeUser, makeWorkspace, tasks } from './fixtures'

const DAY_MS = 86_400_000

function taskVariant(overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    ...tasks[0],
    ...overrides,
  }
}

function makeReview(overrides: Partial<WeeklyReview> & Pick<WeeklyReview, 'id' | 'weekStart'>): WeeklyReview {
  return {
    userId: employeeUser.id,
    weekEnd: addDays(overrides.weekStart, 6),
    reviewedAt: `${overrides.weekStart}T17:00:00.000Z`,
    intention: '',
    priorityIds: [],
    completedCount: 0,
    projectCount: 0,
    openCount: 0,
    ...overrides,
  }
}

describe('week ranges', () => {
  it('builds Monday and Sunday weeks from the same date', () => {
    const wednesday = new Date(2026, 9, 21, 12, 0, 0, 0)
    const mondayWeek = weekRange(wednesday, 1)
    const sundayWeek = weekRange(wednesday, 0)

    expect(mondayWeek.start).toBe('2026-10-19')
    expect(mondayWeek.end).toBe('2026-10-25')
    expect(mondayWeek.label).toBe('Oct 19 – 25')
    expect(sundayWeek.start).toBe('2026-10-18')
    expect(sundayWeek.end).toBe('2026-10-24')
  })
})

describe('weekly review scope', () => {
  it('gives leaders the visible workspace and employees only their own lane', () => {
    const workspace = makeWorkspace()
    const employeeTasks = reviewScopeTasks(employeeUser, workspace)
    const adminTasks = reviewScopeTasks(adminUser, workspace)

    expect(employeeTasks.map((task) => task.id)).toEqual(['t-mine', 't-design'])
    expect(adminTasks.map((task) => task.id)).toEqual([
      't-mine',
      't-other',
      't-design',
      't-secret',
    ])
  })
})

describe('weekly review snapshot', () => {
  it('separates finished work from overdue, quiet, unassigned, external, and next-week work', () => {
    const range = weekRange(new Date(), 1)
    const now = new Date().toISOString()
    const completedAt = fromISODate(range.start)
    completedAt.setHours(12, 0, 0, 0)

    const workspace = makeWorkspace({
      tasks: [
        taskVariant({
          id: 't-finished',
          title: 'Finished this week',
          status: 'done',
          completedAt: completedAt.toISOString(),
          updatedAt: completedAt.toISOString(),
        }),
        taskVariant({
          id: 't-overdue',
          title: 'Overdue follow-up',
          dueDate: todayISO() < range.start ? addDays(range.start, -1) : addDays(todayISO(), -1),
          updatedAt: now,
        }),
        taskVariant({
          id: 't-stale',
          title: 'Quiet work',
          dueDate: null,
          updatedAt: new Date(Date.now() - 20 * DAY_MS).toISOString(),
        }),
        taskVariant({
          id: 't-unowned',
          title: 'Unowned work',
          dueDate: null,
          assigneeId: null,
          assigneeName: null,
          updatedAt: now,
        }),
        taskVariant({
          id: 't-external',
          title: 'External vendor work',
          dueDate: null,
          assigneeId: null,
          assigneeName: 'Rowan Vale',
          updatedAt: now,
        }),
        taskVariant({
          id: 't-next',
          title: 'Next week work',
          dueDate: addDays(range.end, 3),
          updatedAt: now,
        }),
      ],
    })

    const snapshot = buildWeeklyReviewSnapshot(adminUser, workspace, range)

    expect(snapshot.completed.map((task) => task.id)).toEqual(['t-finished'])
    expect(snapshot.open).toHaveLength(5)
    expect(snapshot.overdue.map((task) => task.id)).toEqual(['t-overdue'])
    expect(snapshot.stalled.map((task) => task.id)).toEqual(['t-stale'])
    expect(snapshot.unassigned.map((task) => task.id)).toEqual(['t-unowned'])
    expect(snapshot.external.map((task) => task.id)).toEqual(['t-external'])
    expect(snapshot.dueNextWeek.map((task) => task.id)).toEqual(['t-next'])
    expect(snapshot.days.find((day) => day.iso === range.start)?.count).toBe(1)
    expect(snapshot.projectsMoved[0]).toMatchObject({ project: { id: 'p-shared' }, completed: 1 })
  })
})

describe('weekly review input', () => {
  it('normalizes values and refuses more than three priorities', () => {
    const normalized = normalizeWeeklyReviewInput({
      weekStart: '2026-10-19',
      weekEnd: '2026-10-25',
      intention: '  Make room for the launch.  ',
      priorityIds: ['t-mine', 't-mine', 't-design', ''],
    })

    expect(normalized).toEqual({
      weekStart: '2026-10-19',
      weekEnd: '2026-10-25',
      intention: 'Make room for the launch.',
      priorityIds: ['t-mine', 't-design'],
    })

    expect(() =>
      normalizeWeeklyReviewInput({
        weekStart: '2026-10-19',
        weekEnd: '2026-10-25',
        priorityIds: ['a', 'b', 'c', 'd'],
      }),
    ).toThrow(/no more than 3/i)

    expect(() =>
      normalizeWeeklyReviewInput({
        weekStart: '2026-10-19',
        weekEnd: '2026-10-24',
        priorityIds: [],
      }),
    ).toThrow(/seven days/i)
  })

  it('finds and sorts a person’s review history', () => {
    const reviews = [
      makeReview({ id: 'r-old', weekStart: '2026-10-05' }),
      makeReview({ id: 'r-new', weekStart: '2026-10-12' }),
      makeReview({ id: 'r-other', weekStart: '2026-10-19', userId: adminUser.id }),
    ]

    expect(reviewForWeek(reviews, employeeUser.id, '2026-10-12')?.id).toBe('r-new')
    expect(reviewHistory(reviews, employeeUser.id).map((review) => review.id)).toEqual([
      'r-new',
      'r-old',
    ])
  })
})

describe('workspace review normalization', () => {
  it('adds an empty review trail to older workspaces and rejects other versions', () => {
    const { reviews: _reviews, ...legacy } = makeWorkspace()
    const normalized = normalizeWorkspaceData(legacy as unknown)

    expect(normalized?.reviews).toEqual([])
    expect(
      normalizeWorkspaceData({ ...legacy, version: 3 } as unknown as WorkspaceData),
    ).toBeNull()
  })
})
