/**
 * Auth - password hashing, cookie sessions, and the requireAuth middleware.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { db } from './db.js'

const SESSION_COOKIE = 'relay_session'
const SESSION_DAYS = 7

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':')
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return timingSafeEqual(expected, actual)
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

function readSessionToken(req) {
  const cookies = req.headers.cookie || ''
  for (const part of cookies.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function startSession(res, userId) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, expires.toISOString())

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
  })
}

export function endSession(req, res) {
  const token = readSessionToken(req)
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
  res.clearCookie(SESSION_COOKIE)
}

/**
 * Looks up the session cookie and attaches req.user = { id, name, email, companyId, companyName }.
 * Responds 401 when there is no valid session.
 */
export function requireAuth(req, res, next) {
  const token = readSessionToken(req)
  if (!token) return res.status(401).json({ error: 'Not logged in' })

  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.company_id AS companyId, c.name AS companyName
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN companies c ON c.id = u.company_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(token), new Date().toISOString())

  if (!user) return res.status(401).json({ error: 'Session expired, please log in again' })

  req.user = { ...user }
  next()
}
