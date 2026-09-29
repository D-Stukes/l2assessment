/**
 * API routes. Every ticket route is behind requireAuth and filtered by
 * req.user.companyId, so a user can never read or change another company's tickets.
 */

import express from 'express'
import { db } from './db.js'
import { requireAuth, startSession, endSession, verifyPassword } from './auth.js'
import { categorizeMessage } from './llm.js'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction } from '../src/utils/templates.js'

const STATUSES = ['Open', 'Pending', 'Resolved']

const ticketSelect = `
  SELECT t.id, t.message, t.category, t.urgency,
         t.recommended_action AS recommendedAction, t.reasoning,
         t.status, t.resolution,
         t.responder_id AS responderId, r.name AS responderName,
         t.created_at AS createdAt, t.updated_at AS updatedAt, t.resolved_at AS resolvedAt
  FROM tickets t
  LEFT JOIN users r ON r.id = t.responder_id
`

const getTicket = (id, companyId) =>
  db.prepare(`${ticketSelect} WHERE t.id = ? AND t.company_id = ?`).get(id, companyId)

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '100kb' }))

  // --- Auth ---

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

    const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(String(email).trim())
    if (!user || !verifyPassword(String(password), user.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    startSession(res, user.id)
    const profile = db.prepare(`
      SELECT u.id, u.name, u.email, u.company_id AS companyId, c.name AS companyName
      FROM users u JOIN companies c ON c.id = u.company_id WHERE u.id = ?
    `).get(user.id)
    res.json({ user: { ...profile } })
  })

  app.post('/api/auth/logout', (req, res) => {
    endSession(req, res)
    res.json({ ok: true })
  })

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.user })
  })

  // --- Company data ---

  app.get('/api/responders', requireAuth, (req, res) => {
    const responders = db.prepare('SELECT id, name FROM users WHERE company_id = ? ORDER BY name')
      .all(req.user.companyId)
    res.json({ responders: responders.map(r => ({ ...r })) })
  })

  app.get('/api/tickets', requireAuth, (req, res) => {
    const { status } = req.query
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' })

    const tickets = status
      ? db.prepare(`${ticketSelect} WHERE t.company_id = ? AND t.status = ? ORDER BY t.created_at DESC`)
          .all(req.user.companyId, status)
      : db.prepare(`${ticketSelect} WHERE t.company_id = ? ORDER BY t.created_at DESC`)
          .all(req.user.companyId)
    res.json({ tickets: tickets.map(t => ({ ...t })) })
  })

  // Analyze a message and save it as a new Open ticket for the user's company
  app.post('/api/tickets', requireAuth, async (req, res, next) => {
    try {
      const message = String(req.body?.message || '').trim()
      if (!message) return res.status(400).json({ error: 'Message is required' })

      const { category, reasoning } = await categorizeMessage(message)
      const urgency = calculateUrgency(message)
      const recommendedAction = getRecommendedAction(category)

      const { lastInsertRowid } = db.prepare(`
        INSERT INTO tickets (company_id, message, category, urgency, recommended_action, reasoning, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.companyId, message, category, urgency, recommendedAction, reasoning, req.user.id)

      res.status(201).json({ ticket: { ...getTicket(lastInsertRowid, req.user.companyId) } })
    } catch (error) {
      next(error)
    }
  })

  // Update status, assigned responder, and/or resolution
  app.patch('/api/tickets/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id)
    const existing = getTicket(id, req.user.companyId)
    // 404 (not 403) so users can't probe which ticket ids exist at other companies
    if (!existing) return res.status(404).json({ error: 'Ticket not found' })

    const body = req.body || {}
    const status = body.status ?? existing.status
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' })

    let responderId = existing.responderId
    if ('responderId' in body) {
      responderId = body.responderId === null || body.responderId === '' ? null : Number(body.responderId)
      if (responderId !== null) {
        const sameCompany = db.prepare('SELECT 1 FROM users WHERE id = ? AND company_id = ?')
          .get(responderId, req.user.companyId)
        if (!sameCompany) return res.status(400).json({ error: 'Responder must be on your team' })
      }
    }

    const resolution = 'resolution' in body ? (String(body.resolution || '').trim() || null) : existing.resolution
    if (status === 'Resolved' && !resolution) {
      return res.status(400).json({ error: 'Add a resolution before marking the ticket resolved' })
    }

    const now = new Date().toISOString()
    const resolvedAt = status === 'Resolved' ? (existing.resolvedAt || now) : null

    db.prepare(`
      UPDATE tickets SET status = ?, responder_id = ?, resolution = ?, updated_at = ?, resolved_at = ?
      WHERE id = ? AND company_id = ?
    `).run(status, responderId, resolution, now, resolvedAt, id, req.user.companyId)

    res.json({ ticket: { ...getTicket(id, req.user.companyId) } })
  })

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

  app.use((error, req, res, _next) => {
    console.error(error)
    res.status(500).json({ error: 'Something went wrong on the server' })
  })

  return app
}
