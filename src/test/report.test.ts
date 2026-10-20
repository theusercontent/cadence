import { describe, expect, it } from 'vitest'
import { visibleTasks } from '../lib/permissions'
import { buildTaskReportCsv, TASK_REPORT_HEADERS } from '../lib/report'
import { adminUser, makeWorkspace, projects, tasks, users, viewerUser } from './fixtures'

const sharedTask = tasks[0]

describe('task CSV report', () => {
  it('exports headers and task details in a spreadsheet-friendly shape', () => {
    const csv = buildTaskReportCsv([sharedTask], projects, users)
    const [header, row] = csv.split('\r\n')

    expect(header).toBe(TASK_REPORT_HEADERS.join(','))
    expect(row).toContain('My shared task')
    expect(row).toContain('Shared Launch')
    expect(row).toContain('Maya Employee')
    expect(row).toContain(',0,0,0,2026-10-01T09:00:00.000Z')
  })

  it('escapes quotes, commas, and newlines without breaking the row', () => {
    const task = {
      ...sharedTask,
      title: 'Ship "Atlas", phase 1\n(today)',
      dueDate: '2026-10-24',
      labels: ['Launch', 'Q4, planning'],
      subtasks: [
        { id: 'step-1', title: 'Outline', done: true },
        { id: 'step-2', title: 'Draft', done: false },
      ],
    }

    const csv = buildTaskReportCsv([task], projects, users)

    expect(csv).toContain('"Ship ""Atlas"", phase 1\n(today)"')
    expect(csv).toContain('2026-10-24,"Launch; Q4, planning",1,2,50,')
  })

  it('reports complete and empty step progress as plain numbers', () => {
    const complete = {
      ...sharedTask,
      id: 't-complete',
      title: 'Complete task',
      subtasks: [
        { id: 'step-1', title: 'One', done: true },
        { id: 'step-2', title: 'Two', done: true },
        { id: 'step-3', title: 'Three', done: true },
      ],
    }

    expect(buildTaskReportCsv([sharedTask], projects, users)).toContain(',0,0,0,')
    expect(buildTaskReportCsv([complete], projects, users)).toContain(',3,3,100,')
  })

  it('reports free-text assignee names when no workspace account is linked', () => {
    const task = {
      ...sharedTask,
      id: 't-external',
      title: 'Send vendor brief',
      assigneeId: null,
      assigneeName: 'Rowan "Row" Vale',
    }

    const csv = buildTaskReportCsv([task], projects, users)

    expect(csv).toContain('"Rowan ""Row"" Vale"')
    expect(csv).not.toContain('Unassigned')
  })

  it('only includes tasks visible to the signed-in role', () => {
    const workspace = makeWorkspace()
    const viewerCsv = buildTaskReportCsv(
      visibleTasks(viewerUser, workspace),
      workspace.projects,
      workspace.users,
    )
    const adminCsv = buildTaskReportCsv(
      visibleTasks(adminUser, workspace),
      workspace.projects,
      workspace.users,
    )

    expect(viewerCsv).toContain('My shared task')
    expect(viewerCsv).not.toContain('Department design task')
    expect(viewerCsv).not.toContain('Private board task')
    expect(adminCsv).toContain('Department design task')
    expect(adminCsv).toContain('Private board task')
  })
})
