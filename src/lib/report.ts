import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Project,
  type Task,
  type User,
} from '../types'
import { stepProgress } from './utils'

export const TASK_REPORT_HEADERS = [
  'Task',
  'Project',
  'Status',
  'Priority',
  'Assignee',
  'Creator',
  'Due date',
  'Labels',
  'Steps done',
  'Steps total',
  'Progress %',
  'Created',
  'Updated',
  'Completed',
] as const

const STATUS_ORDER: Record<Task['status'], number> = {
  backlog: 0,
  todo: 1,
  in_progress: 2,
  review: 3,
  done: 4,
}

export function escapeCsvCell(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * Builds a spreadsheet-ready task summary. Callers are responsible for
 * filtering the task list to the current user's visible workspace.
 */
export function buildTaskReportCsv(
  tasks: Task[],
  projects: Project[],
  users: User[],
): string {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const userById = new Map(users.map((user) => [user.id, user]))

  const sorted = [...tasks].sort((left, right) => {
    const leftProject = projectById.get(left.projectId)?.name ?? ''
    const rightProject = projectById.get(right.projectId)?.name ?? ''
    const projectOrder = leftProject.localeCompare(rightProject, 'en', { sensitivity: 'base' })
    if (projectOrder) return projectOrder

    const statusOrder = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
    if (statusOrder) return statusOrder

    const dueOrder = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
    if (dueOrder) return dueOrder

    return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
  })

  const rows = sorted.map((task) => {
    const project = projectById.get(task.projectId)
    const assignee = task.assigneeId ? userById.get(task.assigneeId) : undefined
    const assigneeName = assignee?.name ?? task.assigneeName?.trim()
    const creator = userById.get(task.creatorId)
    const progress = stepProgress(task.subtasks)

    return [
      task.title,
      project?.name ?? 'Unknown project',
      STATUS_LABELS[task.status],
      PRIORITY_LABELS[task.priority],
      assigneeName || 'Unassigned',
      creator?.name ?? 'Unknown',
      task.dueDate ?? '',
      task.labels.join('; '),
      progress.done,
      progress.total,
      progress.pct,
      task.createdAt,
      task.updatedAt,
      task.completedAt ?? '',
    ]
  })

  const headers: Array<string | number> = [...TASK_REPORT_HEADERS]
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')
}
