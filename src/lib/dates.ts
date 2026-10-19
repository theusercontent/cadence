const DAY_MS = 86_400_000

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(value: string, days: number): string {
  const date = fromISODate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function dateOffsetISO(days: number): string {
  return addDays(todayISO(), days)
}

export function daysFromToday(value: string): number {
  const today = fromISODate(todayISO())
  const target = fromISODate(value)
  return Math.round((target.getTime() - today.getTime()) / DAY_MS)
}

export function isOverdue(value: string | null, completed: boolean): boolean {
  return Boolean(value && !completed && value < todayISO())
}

export function formatShortDate(value: string): string {
  const date = fromISODate(value)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export function formatLongDate(value: string): string {
  const date = fromISODate(value)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

export function formatMonthYear(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

export function formatWeekday(value: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(fromISODate(value))
}

export function formatDueDate(value: string | null, completed = false): string {
  if (!value) return 'No date'
  const offset = daysFromToday(value)
  if (completed) return formatShortDate(value)
  if (offset < 0) {
    const overdue = Math.abs(offset)
    return overdue === 1 ? 'Yesterday' : `${overdue}d overdue`
  }
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Tomorrow'
  if (offset > 1 && offset < 7) return formatWeekday(value)
  return formatShortDate(value)
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatRelativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime()
  if (diff < 45_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`
  if (diff < 172_800_000) return 'Yesterday'
  if (diff < 604_800_000) return `${Math.round(diff / 86_400_000)}d ago`
  return formatShortDate(toISODate(new Date(value)))
}

export function startOfWeek(value: string | Date, weekStartsOn: 0 | 1 = 0): Date {
  const date = typeof value === 'string' ? fromISODate(value) : new Date(value)
  date.setHours(12, 0, 0, 0)
  const offset = (date.getDay() - weekStartsOn + 7) % 7
  date.setDate(date.getDate() - offset)
  return date
}

export function monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 0): Date[] {
  const first = new Date(year, month, 1, 12, 0, 0, 0)
  const offset = (first.getDay() - weekStartsOn + 7) % 7
  const start = addDaysToDate(first, -offset)
  return Array.from({ length: 42 }, (_, index) => addDaysToDate(start, index))
}

export function isSameMonth(date: Date, month: number): boolean {
  return date.getMonth() === month
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatTodayLong(): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date())
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)
}

export function isThisWeek(value: string | null): boolean {
  if (!value) return false
  const date = new Date(value)
  const start = startOfWeek(new Date(), 1)
  const end = addDaysToDate(start, 7)
  return date >= start && date < end
}

export function startOfDay(date = new Date()): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function daysAgoISO(days: number): string {
  return addDays(todayISO(), -days)
}

export function timeAgoIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : plural ?? `${singular}s`
}
