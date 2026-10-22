import type { WorkspaceData } from '../types'
import { buildSeedData } from '../data/seed'

export const DATA_KEY = 'cadence.workspace.v1'
export const DATA_VERSION = 2

export function normalizeWorkspaceData(value: unknown): WorkspaceData | null {
  if (!isWorkspaceData(value)) return null
  if (value.version !== DATA_VERSION) return null
  return { ...value, reviews: value.reviews ?? [] }
}

export function readStoredData(): WorkspaceData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return null
    return normalizeWorkspaceData(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveStoredData(data: WorkspaceData): boolean {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

export function clearStoredData(): void {
  try {
    localStorage.removeItem(DATA_KEY)
  } catch {
    // No-op.
  }
}

export async function loadOrCreateData(): Promise<{ data: WorkspaceData; seeded: boolean }> {
  const stored = readStoredData()
  if (stored) return { data: stored, seeded: false }
  const data = await buildSeedData()
  saveStoredData(data)
  return { data, seeded: true }
}

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WorkspaceData>
  return (
    typeof candidate.version === 'number' &&
    Array.isArray(candidate.users) &&
    Array.isArray(candidate.projects) &&
    Array.isArray(candidate.tasks) &&
    Array.isArray(candidate.activities) &&
    Boolean(candidate.settings) &&
    Boolean(candidate.memory) &&
    (candidate.reviews === undefined ||
      (Array.isArray(candidate.reviews) &&
        candidate.reviews.every(
          (review) =>
            Boolean(review?.id && review?.userId && review?.weekStart && review?.weekEnd) &&
            typeof review.intention === 'string' &&
            Array.isArray(review.priorityIds),
        ))) &&
    candidate.users.every((user) => Boolean(user?.id && user?.email && user?.role)) &&
    candidate.tasks.every((task) =>
      Boolean(task?.id && task?.title && task?.projectId) &&
      (task.assigneeName == null || typeof task.assigneeName === 'string'),
    )
  )
}

export function storageFootprint(data: WorkspaceData): { bytes: number; label: string } {
  let bytes = 0
  try {
    bytes = new Blob([JSON.stringify(data)]).size
  } catch {
    bytes = JSON.stringify(data).length
  }
  if (bytes < 1024) return { bytes, label: `${bytes} B` }
  if (bytes < 1024 * 1024) return { bytes, label: `${(bytes / 1024).toFixed(1)} KB` }
  return { bytes, label: `${(bytes / (1024 * 1024)).toFixed(1)} MB` }
}
