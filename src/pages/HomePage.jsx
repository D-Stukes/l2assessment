import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { loadHistory } from '../api'
import { useAuth } from '../auth/AuthContext'

const howItWorksSteps = [
  { title: 'Paste', description: 'Copy a customer message into the Analyze page.' },
  { title: 'Analyze', description: 'AI sorts it into a category and the app scores its urgency.' },
  { title: 'Review', description: 'Check the category, urgency, suggested next step, and AI reasoning.' },
  { title: 'Track', description: 'Every result is saved to History and summarized on the Dashboard.' },
]

const categoryDescriptions = [
  { name: 'Billing Issue', description: 'Payments, charges, invoices, refunds, or subscriptions.' },
  { name: 'Technical Problem', description: 'Errors, outages, slow pages, or features not working.' },
  { name: 'Feature Request', description: 'Ideas and suggestions for improving the product.' },
  { name: 'General Inquiry', description: 'Questions, feedback, and anything else.' },
]

const urgencyDescriptions = [
  {
    name: 'High',
    className: 'bg-red-100 text-red-800',
    description: 'Customer is blocked or losing money, such as an outage, a login failure, or a double charge. Respond first.',
  },
  {
    name: 'Medium',
    className: 'bg-yellow-100 text-yellow-800',
    description: 'Something is broken or slow, but the customer can still work. Respond the same day.',
  },
  {
    name: 'Low',
    className: 'bg-green-100 text-green-800',
    description: 'Questions, suggestions, and thank-you notes. Respond when time allows.',
  },
]

function HomePage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ total: 0, today: 0 })
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    // Stats come from the logged-in company's tickets
    if (!user) return

    loadHistory()
      .then(history => {
        const today = new Date().toDateString()
        const todayCount = history.filter(item =>
          new Date(item.timestamp).toDateString() === today
        ).length

        setStats({
          total: history.length,
          today: todayCount
        })

        // Get recent 3 items
        setRecentActivity(history.slice(-3).reverse())
      })
      .catch(error => console.error('Error loading stats:', error))
  }, [user])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Hero Section */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to Relay AI Customer Triage
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            AI-powered message categorization and routing for customer support teams
          </p>
          <p className="text-gray-700">
            Relay AI is a subscription-based customer operations platform that uses AI to categorize, 
            prioritize, and route incoming customer messages for small businesses. Our SaaS model is 
            built around boosting team efficiency and enabling companies to handle more customer 
            volume without hiring additional support staff.
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">What This Tool Does</h2>
          <p className="text-gray-700 mb-6">
            Paste in a message from a customer and Relay AI gives your support team a first pass
            at triage: what kind of message it is, how quickly it needs attention, and a suggested
            next step. This helps your team answer the most important messages first.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mb-3">How it works</h3>
          <ol className="grid grid-cols-4 gap-4 mb-6">
            {howItWorksSteps.map((step, index) => (
              <li key={step.title} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-sm font-bold text-blue-600 mb-1">Step {index + 1}</div>
                <div className="font-semibold text-gray-900 mb-1">{step.title}</div>
                <div className="text-sm text-gray-600">{step.description}</div>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Message categories</h3>
              <ul className="space-y-2">
                {categoryDescriptions.map((cat) => (
                  <li key={cat.name} className="text-sm text-gray-700">
                    <span className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold mr-2">
                      {cat.name}
                    </span>
                    {cat.description}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Urgency levels</h3>
              <ul className="space-y-2">
                {urgencyDescriptions.map((level) => (
                  <li key={level.name} className="text-sm text-gray-700">
                    <span className={`inline-block px-2 py-0.5 rounded font-semibold mr-2 ${level.className}`}>
                      {level.name}
                    </span>
                    {level.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
            <span className="font-semibold">Please note:</span> Results are an automated first pass.
            A team member should review each message before responding to the customer.
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Messages Analyzed</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="text-3xl font-bold text-green-600">{stats.today}</div>
            <div className="text-sm text-gray-600">Analyzed Today</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Link
            to="/analyze"
            className="bg-blue-600 text-white rounded-lg p-6 hover:bg-blue-700 transition"
          >
            <div className="text-2xl mb-2">📝</div>
            <div className="font-semibold mb-1">Analyze Message</div>
            <div className="text-sm text-blue-100">Triage a new customer message</div>
          </Link>

          <Link
            to="/history"
            className="bg-purple-600 text-white rounded-lg p-6 hover:bg-purple-700 transition"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold mb-1">View History</div>
            <div className="text-sm text-purple-100">See past analyses</div>
          </Link>

          <button
            onClick={() => {
              const examples = [
                "Our payment failed and we can't access our account",
                "The dashboard is loading very slowly",
                "Can you add a dark mode feature?"
              ]
              const random = examples[Math.floor(Math.random() * examples.length)]
              localStorage.setItem('exampleMessage', random)
              window.location.href = '/analyze'
            }}
            className="bg-orange-600 text-white rounded-lg p-6 hover:bg-orange-700 transition"
          >
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-semibold mb-1">Try Example</div>
            <div className="text-sm text-orange-100">Use a sample message</div>
          </button>
        </div>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.map((item, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm text-gray-500">
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <div className="text-gray-700 truncate">
                        "{item.message.substring(0, 60)}..."
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {item.category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.urgency === 'High' ? 'bg-red-100 text-red-800' :
                          item.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {item.urgency}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentActivity.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-gray-600 mb-4">No messages analyzed yet</div>
            <Link
              to="/analyze"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Analyze Your First Message
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default HomePage
