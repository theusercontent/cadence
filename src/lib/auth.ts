import type { Session, User } from '../types'

const ITERATIONS = 120_000
const SESSION_KEY = 'cadence.session.v1'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  )
  return bytesToBase64(new Uint8Array(bits))
}

export async function createPasswordRecord(password: string): Promise<{ salt: string; hash: string }> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser does not support secure password storage. Open Cadence on localhost or a secure connection.')
  }
  const salt = generateSalt()
  const hash = await hashPassword(password, salt)
  return { salt, hash }
}

export async function verifyPassword(password: string, user: Pick<User, 'salt' | 'passwordHash'>): Promise<boolean> {
  try {
    const hash = await hashPassword(password, user.salt)
    if (hash.length !== user.passwordHash.length) return false
    let mismatch = 0
    for (let index = 0; index < hash.length; index += 1) {
      mismatch |= hash.charCodeAt(index) ^ user.passwordHash.charCodeAt(index)
    }
    return mismatch === 0
  } catch {
    return false
  }
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one letter and one number.'
  }
  return null
}

export function readSession(): Session | null {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem(SESSION_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Session
        if (parsed?.userId) return parsed
      }
    } catch {
      // Ignore malformed or unavailable session storage.
    }
  }
  return null
}

export function writeSession(session: Session): void {
  try {
    clearSession()
    const storage = session.remember ? localStorage : sessionStorage
    storage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // A blocked storage API should not prevent the current session from working.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // No-op.
  }
}
