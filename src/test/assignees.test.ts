import { describe, expect, it } from 'vitest'
import {
  assigneeDisplayName,
  matchTeammate,
  normalizeAssigneeName,
  resolveAssignee,
} from '../lib/assignees'
import {
  employeeUser,
  inactiveUser,
  managerUser,
  tasks,
  users,
} from './fixtures'

describe('free-text assignees', () => {
  it('links a typed name to a single active teammate', () => {
    expect(matchTeammate('  maya employee ', [employeeUser, managerUser])?.id).toBe(
      employeeUser.id,
    )
    expect(resolveAssignee('Maya Employee', [employeeUser, managerUser])).toEqual({
      assigneeId: employeeUser.id,
      assigneeName: null,
    })
  })

  it('keeps an unknown name as a trimmed external owner', () => {
    expect(resolveAssignee('  Rowan Vale  ', [employeeUser, managerUser])).toEqual({
      assigneeId: null,
      assigneeName: 'Rowan Vale',
    })
    expect(resolveAssignee('   ', [employeeUser])).toEqual({
      assigneeId: null,
      assigneeName: null,
    })
  })

  it('does not link duplicated or inactive names', () => {
    const duplicate = {
      ...employeeUser,
      id: 'u-employee-copy',
      email: 'copy@cadence.test',
    }

    expect(matchTeammate('Maya Employee', [employeeUser, duplicate])).toBeUndefined()
    expect(resolveAssignee('Inactive Person', [inactiveUser])).toEqual({
      assigneeId: null,
      assigneeName: 'Inactive Person',
    })
  })

  it('shows the linked teammate first and falls back to the external name', () => {
    expect(assigneeDisplayName(tasks[0], users)).toBe('Maya Employee')
    expect(
      assigneeDisplayName(
        { ...tasks[0], assigneeId: null, assigneeName: '  Rowan Vale  ' },
        users,
      ),
    ).toBe('Rowan Vale')
  })

  it('rejects names beyond the stored limit', () => {
    expect(() => normalizeAssigneeName('x'.repeat(81))).toThrow(/80 characters/i)
  })
})
