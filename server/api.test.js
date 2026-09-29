// Run with: npm test  (uses a throwaway in-memory database)
process.env.DB_PATH = ':memory:'
delete process.env.GROQ_API_KEY
delete process.env.VITE_GROQ_API_KEY

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { createApp } = await import('./app.js')
const { seedIfEmpty, DEMO_PASSWORD } = await import('./seed.js')

let server, baseUrl

before(async () => {
  seedIfEmpty()
  server = createApp().listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  baseUrl = `http://localhost:${server.address().port}`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

async function login(email) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  })
  assert.equal(res.status, 200)
  const cookie = res.headers.get('set-cookie').split(';')[0]
  return (path, options = {}) => fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Cookie: cookie, ...options.headers },
  })
}

test('rejects requests without a session and wrong passwords', async () => {
  assert.equal((await fetch(`${baseUrl}/api/tickets`)).status, 401)
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'maria@acme.test', password: 'wrong' }),
  })
  assert.equal(res.status, 401)
})

test('users from two companies each see only their own data', async () => {
  const acme = await login('maria@acme.test')
  const bright = await login('priya@brightside.test')

  const me = await (await acme('/api/auth/me')).json()
  assert.equal(me.user.companyName, 'Acme Outfitters')

  const acmeTickets = (await (await acme('/api/tickets')).json()).tickets
  const brightTickets = (await (await bright('/api/tickets')).json()).tickets
  assert.equal(acmeTickets.length, 5)
  assert.equal(brightTickets.length, 3)

  const acmeIds = new Set(acmeTickets.map(t => t.id))
  assert.ok(brightTickets.every(t => !acmeIds.has(t.id)))

  // Brightside can't read or edit an Acme ticket, even by guessing its id
  const res = await bright(`/api/tickets/${acmeTickets[0].id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Pending' }),
  })
  assert.equal(res.status, 404)

  // ...or assign one of Acme's users as a responder
  const acmeResponders = (await (await acme('/api/responders')).json()).responders
  const res2 = await bright(`/api/tickets/${brightTickets[0].id}`, {
    method: 'PATCH',
    body: JSON.stringify({ responderId: acmeResponders[0].id }),
  })
  assert.equal(res2.status, 400)
})

test('new tickets are analyzed and saved to the company', async () => {
  const acme = await login('sam@acme.test')
  const res = await acme('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ message: 'Our site is down and customers cannot check out!' }),
  })
  assert.equal(res.status, 201)
  const { ticket } = await res.json()
  assert.equal(ticket.status, 'Open')
  assert.ok(['High', 'Medium', 'Low'].includes(ticket.urgency))
  assert.ok(ticket.category)
  assert.ok(ticket.createdAt)

  const bright = await login('leo@brightside.test')
  const brightTickets = (await (await bright('/api/tickets')).json()).tickets
  assert.ok(brightTickets.every(t => t.id !== ticket.id))
})

test('ticket status and responder updates persist', async () => {
  const acme = await login('maria@acme.test')
  const [ticket] = (await (await acme('/api/tickets?status=Open')).json()).tickets
  const [, sam] = (await (await acme('/api/responders')).json()).responders

  let res = await acme(`/api/tickets/${ticket.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Pending', responderId: sam.id }),
  })
  assert.equal(res.status, 200)

  // Resolving requires a resolution
  res = await acme(`/api/tickets/${ticket.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Resolved' }),
  })
  assert.equal(res.status, 400)

  res = await acme(`/api/tickets/${ticket.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Resolved', resolution: 'Restarted the payment service.' }),
  })
  assert.equal(res.status, 200)

  // Read it back through a fresh session
  const again = await login('sam@acme.test')
  const saved = (await (await again('/api/tickets')).json()).tickets.find(t => t.id === ticket.id)
  assert.equal(saved.status, 'Resolved')
  assert.equal(saved.responderName, sam.name)
  assert.equal(saved.resolution, 'Restarted the payment service.')
  assert.ok(saved.resolvedAt)
})

test('logout ends the session', async () => {
  const acme = await login('maria@acme.test')
  assert.equal((await acme('/api/auth/logout', { method: 'POST' })).status, 200)
  assert.equal((await acme('/api/tickets')).status, 401)
})
