import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/AuthContext'

const urgencyClass = (urgency) =>
  urgency === 'High' ? 'bg-red-100 text-red-800' :
  urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
  'bg-green-100 text-green-800'

const statusClass = (status) =>
  status === 'Open' ? 'bg-blue-100 text-blue-800' :
  status === 'Pending' ? 'bg-orange-100 text-orange-800' :
  'bg-gray-200 text-gray-800'

const formatDateTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—')

function OpenTicketRow({ ticket, responders, onSaved }) {
  const [status, setStatus] = useState(ticket.status)
  const [responderId, setResponderId] = useState(ticket.responderId ?? '')
  const [resolution, setResolution] = useState(ticket.resolution ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const isChanged =
    status !== ticket.status ||
    String(responderId) !== String(ticket.responderId ?? '') ||
    resolution !== (ticket.resolution ?? '')

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      const { ticket: updated } = await api.updateTicket(ticket.id, {
        status,
        responderId: responderId === '' ? null : Number(responderId),
        resolution,
      })
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <li className="border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        <span className="text-gray-500">#{ticket.id} · Created {formatDateTime(ticket.createdAt)}</span>
        <span className={`px-2 py-0.5 rounded font-semibold ${statusClass(ticket.status)}`}>{ticket.status}</span>
        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{ticket.category}</span>
        <span className={`px-2 py-0.5 rounded ${urgencyClass(ticket.urgency)}`}>{ticket.urgency}</span>
      </div>
      <p className="text-gray-800 mb-3">"{ticket.message}"</p>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <label className="block">
          <span className="block font-semibold text-gray-700 mb-1">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          >
            <option>Open</option>
            <option>Pending</option>
            <option>Resolved</option>
          </select>
        </label>
        <label className="block">
          <span className="block font-semibold text-gray-700 mb-1">Responder</span>
          <select
            value={responderId}
            onChange={(e) => setResponderId(e.target.value)}
            className="w-full border border-gray-300 rounded p-2"
          >
            <option value="">Unassigned</option>
            {responders.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="text-gray-500 self-end pb-2">
          Last updated {formatDateTime(ticket.updatedAt)}
        </div>
      </div>

      {status === 'Resolved' && (
        <label className="block text-sm mt-3">
          <span className="block font-semibold text-gray-700 mb-1">Resolution</span>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="How was this resolved?"
            className="w-full border border-gray-300 rounded p-2 h-20"
          />
        </label>
      )}

      {error && <div className="text-sm text-red-700 mt-2">{error}</div>}

      <div className="mt-3">
        <button
          onClick={handleSave}
          disabled={!isChanged || isSaving}
          className={`px-4 py-2 rounded-lg font-semibold text-sm ${
            !isChanged || isSaving
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </li>
  )
}

function PortalPage() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState([])
  const [responders, setResponders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.tickets(), api.responders()])
      .then(([ticketData, responderData]) => {
        setTickets(ticketData.tickets)
        setResponders(responderData.responders)
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setTickets(current => current.map(t => (t.id === updated.id ? updated : t)))
  }

  const openTickets = tickets.filter(t => t.status === 'Open')
  const pendingTickets = tickets.filter(t => t.status === 'Pending')
  const resolvedTickets = tickets.filter(t => t.status === 'Resolved')
  const activeTickets = [...openTickets, ...pendingTickets]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-sm text-gray-500">Company portal</div>
          <h1 className="text-3xl font-bold text-gray-900">{user.companyName}</h1>
          <p className="text-gray-600">Signed in as {user.name} ({user.email})</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 mb-6">{error}</div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-600">{openTickets.length}</div>
            <div className="text-sm text-gray-600">Open</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-orange-600">{pendingTickets.length}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-gray-100 border border-gray-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-gray-700">{resolvedTickets.length}</div>
            <div className="text-sm text-gray-600">Resolved</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Open and pending tickets</h2>
            <Link to="/analyze" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold text-sm">
              + New Ticket
            </Link>
          </div>
          {isLoading ? (
            <div className="text-gray-500">Loading...</div>
          ) : activeTickets.length === 0 ? (
            <div className="text-gray-500">No open or pending tickets. Nice work!</div>
          ) : (
            <ul className="space-y-4">
              {activeTickets.map(ticket => (
                <OpenTicketRow
                  key={`${ticket.id}-${ticket.updatedAt}`}
                  ticket={ticket}
                  responders={responders}
                  onSaved={handleSaved}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Message history and resolutions</h2>
          {!isLoading && resolvedTickets.length === 0 ? (
            <div className="text-gray-500">No resolved tickets yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b border-gray-200">
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Message</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4">Responder</th>
                    <th className="py-2 pr-4">Resolution</th>
                    <th className="py-2">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedTickets.map(ticket => (
                    <tr key={ticket.id} className="border-b border-gray-100 align-top">
                      <td className="py-2 pr-4 whitespace-nowrap text-gray-500">{formatDateTime(ticket.createdAt)}</td>
                      <td className="py-2 pr-4 text-gray-800">{ticket.message}</td>
                      <td className="py-2 pr-4">{ticket.category}</td>
                      <td className="py-2 pr-4">{ticket.responderName || 'Unassigned'}</td>
                      <td className="py-2 pr-4 text-gray-700">{ticket.resolution}</td>
                      <td className="py-2 whitespace-nowrap text-gray-500">{formatDateTime(ticket.resolvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PortalPage
