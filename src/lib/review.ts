import type {
  Project,
  Task,
  User,
  WeeklyReview,
  WeeklyReviewInput,
  WorkspaceData,
} from '../types'
import {
  addDays,
  addDaysToDate,
  fromISODate,
  startOfWeek,
  todayISO,
  toISODate,
} from './dates'
import { isAdmin, isManager, isViewer, visibleTasks } from './permissions'

export const WEEKLY_INTENTION_LIMIT = 180
export const WEEKLY_PRIORITY_LIMIT = 3
export const WEEKLY_STALE_DAYS = 14

const DAY_MS = 86_400_000
const PRIORITY_RANK: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export interface WeekRange {
  start: string
  end: string
  startDate: Date
  endDate: Date
  label: string
  weekNumber: number
}

export interface ReviewDay {
  iso: string
  label: string
  count: number
  isToday: boolean
}

export interface ReviewProjectMovement {
  project: Project
  completed: number
  touched: number
}

export interface WeeklyReviewSnapshot {
  range: WeekRange
  tasks: Task[]
  open: Task[]
  completed: Task[]
  overdue: Task[]
  stalled: Task[]
  unassigned: Task[]
  external: Task[]
  dueNextWeek: Task[]
  projectsMoved: ReviewProjectMovement[]
  days: ReviewDay[]
}

function isoWeekNumber(date: Date): number {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1))
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
}

export function formatWeekRange(start: string, end: string): string {
  const first = fromISODate(start)
  const last = fromISODate(end)
  const firstLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(first)
  const lastLabel = new Intl.DateTimeFormat('en-US', {
    ...(first.getMonth() === last.getMonth() ? { day: 'numeric' } : { month: 'short', day: 'numeric' }),
    ...(first.getFullYear() !== last.getFullYear() ? { year: 'numeric' } : {}),
  }).format(last)
  return `${firstLabel} – ${lastLabel}`
}

export function weekRangeFrom(start: string, end: string): WeekRange {
  const startDate = fromISODate(start)
  return {
    start,
    end,
    startDate,
    endDate: fromISODate(end),
    label: formatWeekRange(start, end),
    // The middle of the seven-day span keeps the ISO week label stable for both
    // Sunday-start and Monday-start preferences.
    weekNumber: isoWeekNumber(addDaysToDate(startDate, 3)),
  }
}

export function weekRange(value: string | Date = new Date(), weekStartsOn: 0 | 1 = 1): WeekRange {
  const startDate = startOfWeek(value, weekStartsOn)
  const endDate = addDaysToDate(startDate, 6)
  return weekRangeFrom(toISODate(startDate), toISODate(endDate))
}

export function weekRangeForReview(review: WeeklyReview): WeekRange {
  return weekRangeFrom(review.weekStart, review.weekEnd)
}

export function isDateInRange(value: string | null, start: string, end: string): boolean {
  if (!value) return false
  const iso = toISODate(new Date(value))
  return iso >= start && iso <= end
}

export function daysSince(value: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY_MS))
}

export function reviewScopeTasks(user: User, data: WorkspaceData): Task[] {
  const tasks = visibleTasks(user, data)
  if (isAdmin(user) || isManager(user) || isViewer(user)) return tasks
  return tasks.filter((task) => task.assigneeId === user.id || task.creatorId === user.id)
}

export function sortOpenTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aOverdue = Boolean(a.dueDate && a.dueDate < todayISO())
    const bOverdue = Boolean(b.dueDate && b.dueDate < todayISO())
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate && !b.dueDate) return -1
    if (!a.dueDate && b.dueDate) return 1
    const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (priority !== 0) return priority
    return a.order - b.order
  })
}

export function buildWeeklyReviewSnapshot(
  user: User,
  data: WorkspaceData,
  range: WeekRange,
): WeeklyReviewSnapshot {
  const tasks = reviewScopeTasks(user, data)
  const open = sortOpenTasks(tasks.filter((task) => task.status !== 'done'))
  const completed = tasks
    .filter((task) => task.completedAt && isDateInRange(task.completedAt, range.start, range.end))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const days: ReviewDay[] = Array.from({ length: 7 }, (_, index) => {
    const iso = addDays(range.start, index)
    return {
      iso,
      label: new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(fromISODate(iso)),
      count: completed.filter((task) => task.completedAt && toISODate(new Date(task.completedAt)) === iso).length,
      isToday: iso === todayISO(),
    }
  })

  const movements = new Map<string, ReviewProjectMovement>()
  for (const task of tasks) {
    const touched = isDateInRange(task.updatedAt, range.start, range.end)
    const finished = Boolean(task.completedAt && isDateInRange(task.completedAt, range.start, range.end))
    if (!touched && !finished) continue
    const project = data.projects.find((item) => item.id === task.projectId)
    if (!project) continue
    const movement = movements.get(project.id) ?? { project, completed: 0, touched: 0 }
    movement.touched += 1
    if (finished) movement.completed += 1
    movements.set(project.id, movement)
  }

  const projectsMoved = Array.from(movements.values()).sort(
    (a, b) => b.completed - a.completed || b.touched - a.touched || a.project.name.localeCompare(b.project.name),
  )
  const overdue = open
    .filter((task) => task.dueDate && task.dueDate < todayISO())
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const stalled = open
    .filter((task) => daysSince(task.updatedAt) >= WEEKLY_STALE_DAYS)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  const unassigned = open.filter((task) => !task.assigneeId && !task.assigneeName)
  const external = open.filter((task) => !task.assigneeId && Boolean(task.assigneeName))
  const dueNextWeek = open.filter(
    (task) => Boolean(task.dueDate && task.dueDate > range.end && task.dueDate <= addDays(range.end, 7)),
  )

  return {
    range,
    tasks,
    open,
    completed,
    overdue,
    stalled,
    unassigned,
    external,
    dueNextWeek,
    projectsMoved,
    days,
  }
}

export function normalizeWeeklyReviewInput(
  input: WeeklyReviewInput,
): { weekStart: string; weekEnd: string; intention: string; priorityIds: string[] } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(input.weekEnd)) {
    throw new Error('Choose a valid review week.')
  }
  if (input.weekEnd !== addDays(input.weekStart, 6)) {
    throw new Error('A Weekly Cadence covers seven days.')
  }
  const intention = input.intention?.trim() ?? ''
  if (intention.length > WEEKLY_INTENTION_LIMIT) {
    throw new Error(`Keep the intention to ${WEEKLY_INTENTION_LIMIT} characters or fewer.`)
  }
  const priorityIds = Array.from(new Set(input.priorityIds)).filter(Boolean)
  if (priorityIds.length > WEEKLY_PRIORITY_LIMIT) {
    throw new Error(`Choose no more than ${WEEKLY_PRIORITY_LIMIT} priorities.`)
  }
  return { weekStart: input.weekStart, weekEnd: input.weekEnd, intention, priorityIds }
}

export function reviewForWeek(
  reviews: WeeklyReview[],
  userId: string,
  weekStart: string,
): WeeklyReview | undefined {
  return reviews.find((review) => review.userId === userId && review.weekStart === weekStart)
}

export function reviewHistory(reviews: WeeklyReview[], userId: string): WeeklyReview[] {
  return reviews
    .filter((review) => review.userId === userId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.reviewedAt.localeCompare(a.reviewedAt))
}
