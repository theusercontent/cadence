import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSession,
  createPasswordRecord,
  hashPassword,
  normalizeEmail,
  passwordProblem,
  readSession,
  verifyPassword,
  writeSession,
} from '../lib/auth'

describe('password hashing', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores salted PBKDF2 hashes and verifies only the right password', async () => {
    const record = await createPasswordRecord('correct-horse-9')
    expect(record.salt).not.toBe('')
    expect(record.hash).not.toContain('correct-horse-9')
    expect(record.hash.length).toBeGreaterThan(20)

    const stored = { salt: record.salt, passwordHash: record.hash }
    await expect(verifyPassword('correct-horse-9', stored)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password-9', stored)).resolves.toBe(false)
  })

  it('salts every record separately', async () => {
    const [first, second] = await Promise.all([
      createPasswordRecord('same-password-1'),
      createPasswordRecord('same-password-1'),
    ])
    expect(first.salt).not.toBe(second.salt)
    expect(first.hash).not.toBe(second.hash)
  })

  it('is deterministic for a given password and salt', async () => {
    const first = await hashPassword('stable-password-7', 'c2FsdHktc2FsdA==')
    const second = await hashPassword('stable-password-7', 'c2FsdHktc2FsdA==')
    expect(first).toBe(second)
  })
})

describe('password policy', () => {
  it('rejects short or single-character-class passwords', () => {
    expect(passwordProblem('short1')).toBe('Use at least 8 characters.')
    expect(passwordProblem('onlyletters')).toBe('Include at least one letter and one number.')
    expect(passwordProblem('12345678')).toBe('Include at least one letter and one number.')
    expect(passwordProblem('letters123')).toBeNull()
  })
})

describe('email normalization', () => {
  it('trims and lowercases addresses', () => {
    expect(normalizeEmail('  Ava@Cadence.App ')).toBe('ava@cadence.app')
  })
})

describe('sessions', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps remembered sessions locally and session-only logins in session storage', () => {
    writeSession({ userId: 'u-admin', startedAt: '2026-01-01T00:00:00.000Z', remember: true })
    expect(readSession()?.userId).toBe('u-admin')
    expect(localStorage.getItem('cadence.session.v1')).not.toBeNull()
    expect(sessionStorage.getItem('cadence.session.v1')).toBeNull()

    writeSession({ userId: 'u-viewer', startedAt: '2026-01-02T00:00:00.000Z', remember: false })
    expect(readSession()?.userId).toBe('u-viewer')
    expect(localStorage.getItem('cadence.session.v1')).toBeNull()
    expect(sessionStorage.getItem('cadence.session.v1')).not.toBeNull()
  })

  it('clears both session stores and ignores malformed data', () => {
    localStorage.setItem('cadence.session.v1', '{broken')
    expect(readSession()).toBeNull()

    writeSession({ userId: 'u-admin', startedAt: '2026-01-01T00:00:00.000Z', remember: true })
    clearSession()
    expect(readSession()).toBeNull()
    expect(localStorage.getItem('cadence.session.v1')).toBeNull()
    expect(sessionStorage.getItem('cadence.session.v1')).toBeNull()
  })
})
