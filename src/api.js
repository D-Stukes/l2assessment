/**
 * API client - talks to the Express server (proxied at /api by Vite in dev).
 * The session is an httpOnly cookie, so no token is handled in the browser.
 */

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`)
    error.status = res.status
    throw error
  }
  return data
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  responders: () => request('/responders'),
  tickets: (status) => request(status ? `/tickets?status=${encodeURIComponent(status)}` : '/tickets'),
  createTicket: (message) => request('/tickets', { method: 'POST', body: { message } }),
  updateTicket: (id, changes) => request(`/tickets/${id}`, { method: 'PATCH', body: changes }),
}

/**
 * The company's tickets in the shape the History, Dashboard, and Home pages use
 * (oldest first, with `timestamp` = when the ticket was created).
 */
export async function loadHistory() {
  const { tickets } = await api.tickets()
  return tickets
    .map(ticket => ({ ...ticket, timestamp: ticket.createdAt }))
    .reverse()
}
