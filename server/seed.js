/**
 * Seed - two demo companies with users and tickets, so the portal has
 * something to show on first run. Only runs when the database is empty.
 */

import { db } from './db.js'
import { hashPassword } from './auth.js'
import { calculateUrgency } from '../src/utils/urgencyScorer.js'
import { getRecommendedAction } from '../src/utils/templates.js'

export const DEMO_PASSWORD = 'relay123'

const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

const demoCompanies = [
  {
    name: 'Acme Outfitters',
    users: [
      { name: 'Maria Lopez', email: 'maria@acme.test' },
      { name: 'Sam Carter', email: 'sam@acme.test' },
    ],
    tickets: [
      { message: 'Our checkout page is down and customers cannot pay. Please help ASAP!', category: 'Technical Problem', status: 'Open', responder: 0, age: 1 },
      { message: 'I was charged twice for my March subscription.', category: 'Billing Issue', status: 'Pending', responder: 1, age: 20 },
      { message: 'Could you add an export to CSV option on the orders report?', category: 'Feature Request', status: 'Open', responder: null, age: 30 },
      { message: 'The dashboard is loading very slowly this morning.', category: 'Technical Problem', status: 'Resolved', responder: 0, age: 72, resolution: 'Cleared a stuck cache job. Load times back under 2 seconds.' },
      { message: 'Thanks for the quick help last week, the team loves the new layout.', category: 'General Inquiry', status: 'Resolved', responder: 1, age: 120, resolution: 'Thanked the customer and shared the feedback with the product team.' },
    ],
  },
  {
    name: 'Brightside Dental',
    users: [
      { name: 'Priya Shah', email: 'priya@brightside.test' },
      { name: 'Leo Nguyen', email: 'leo@brightside.test' },
    ],
    tickets: [
      { message: "We can't log in to the scheduling system since this morning.", category: 'Technical Problem', status: 'Open', responder: 1, age: 2 },
      { message: 'How do I add a new hygienist to the booking calendar?', category: 'General Inquiry', status: 'Pending', responder: 0, age: 26 },
      { message: 'Please send a copy of our last three invoices.', category: 'Billing Issue', status: 'Resolved', responder: 0, age: 96, resolution: 'Emailed PDF invoices for January to March.' },
    ],
  },
]

export function seedIfEmpty() {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM companies').get()
  if (count > 0) return false

  const insertCompany = db.prepare('INSERT INTO companies (name) VALUES (?)')
  const insertUser = db.prepare('INSERT INTO users (company_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
  const insertTicket = db.prepare(`
    INSERT INTO tickets (company_id, message, category, urgency, recommended_action, reasoning,
                         status, responder_id, resolution, created_by, created_at, updated_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')
  try {
    for (const company of demoCompanies) {
      const companyId = Number(insertCompany.run(company.name).lastInsertRowid)
      const userIds = company.users.map(user =>
        Number(insertUser.run(companyId, user.name, user.email, hashPassword(DEMO_PASSWORD)).lastInsertRowid)
      )

      for (const t of company.tickets) {
        const createdAt = hoursAgo(t.age)
        const updatedAt = t.status === 'Open' ? createdAt : hoursAgo(t.age / 2)
        insertTicket.run(
          companyId, t.message, t.category, calculateUrgency(t.message),
          getRecommendedAction(t.category), 'Sample ticket added when the database was created.',
          t.status, t.responder === null ? null : userIds[t.responder], t.resolution ?? null,
          userIds[0], createdAt, updatedAt, t.status === 'Resolved' ? updatedAt : null
        )
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return true
}
