import type { Task, User } from '../types'

export const ASSIGNEE_NAME_LIMIT = 80
export const EXTERNAL_ASSIGNEE_TONE = '#7A808C'

export interface AssigneeValue {
  assigneeId: string | null
  assigneeName: string | null
}

export function normalizeAssigneeName(value: string | null | undefined): string | null {
  const name = value?.trim() ?? ''
  if (!name) return null
  if (name.length > ASSIGNEE_NAME_LIMIT) {
    throw new Error(`Assignee names must be ${ASSIGNEE_NAME_LIMIT} characters or fewer.`)
  }
  return name
}

/** Finds a single active teammate whose name exactly matches the typed name. */
export function matchTeammate(name: string, candidates: User[]): User | undefined {
  const needle = name.trim().toLocaleLowerCase()
  if (!needle) return undefined
  const matches = candidates.filter(
    (person) => person.active && person.name.trim().toLocaleLowerCase() === needle,
  )
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Resolves a free-text owner into either a linked workspace member or an
 * external name. Linked members keep the normal permission boundaries.
 */
export function resolveAssignee(name: string, candidates: User[]): AssigneeValue {
  const value = normalizeAssigneeName(name)
  if (!value) return { assigneeId: null, assigneeName: null }
  const teammate = matchTeammate(value, candidates)
  return teammate
    ? { assigneeId: teammate.id, assigneeName: null }
    : { assigneeId: null, assigneeName: value }
}

export function assigneeDisplayName(task: Task, users: User[]): string {
  const linked = task.assigneeId
    ? users.find((person) => person.id === task.assigneeId)
    : undefined
  return linked?.name ?? task.assigneeName?.trim() ?? ''
}
