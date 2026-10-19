import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskRow } from '../components/TaskRow'
import { stepProgress } from '../lib/utils'
import { employeeUser, projects, tasks } from './fixtures'

const task = tasks[0]
const project = projects.find((item) => item.id === task.projectId)!

function makeSteps(done: boolean[]) {
  return done.map((completed, index) => ({
    id: `step-${index + 1}`,
    title: `Step ${index + 1}`,
    done: completed,
  }))
}

describe('task step progress', () => {
  it('reports empty, partial, and complete progress', () => {
    expect(stepProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
    expect(stepProgress(makeSteps([true, false, false]))).toEqual({ done: 1, total: 3, pct: 33 })
    expect(stepProgress(makeSteps([true, true, true]))).toEqual({ done: 3, total: 3, pct: 100 })
  })

  it('renders a progress bar and step count on a task row', () => {
    render(
      <TaskRow
        task={{ ...task, subtasks: makeSteps([true, false]) }}
        project={project}
        assignee={employeeUser}
        onOpen={vi.fn()}
        onToggle={vi.fn()}
        canEdit
      />,
    )

    const progress = screen.getByRole('progressbar', { name: '1 of 2 steps complete' })
    expect(progress).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText('1/2 steps')).toBeInTheDocument()
  })

  it('keeps task rows without steps uncluttered', () => {
    render(
      <TaskRow
        task={{ ...task, subtasks: [] }}
        project={project}
        assignee={employeeUser}
        onOpen={vi.fn()}
        onToggle={vi.fn()}
        canEdit
      />,
    )

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/steps$/)).not.toBeInTheDocument()
  })
})
