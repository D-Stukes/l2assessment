import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }
  
  const isActive = (path) => {
    return location.pathname === path
  }

  return (
    <nav className="bg-blue-600 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80">
            <div className="bg-white rounded-full w-10 h-10 flex items-center justify-center text-2xl">
              📧
            </div>
            <div>
              <div className="font-bold text-lg">Relay AI</div>
              <div className="text-xs text-blue-200">Customer Triage</div>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            <Link
              to="/"
              className={`px-4 py-2 rounded ${
                isActive('/') 
                  ? 'bg-blue-700 font-semibold' 
                  : 'hover:bg-blue-500'
              }`}
            >
              Home
            </Link>
            <Link
              to="/analyze"
              className={`px-4 py-2 rounded ${
                isActive('/analyze') 
                  ? 'bg-blue-700 font-semibold' 
                  : 'hover:bg-blue-500'
              }`}
            >
              Analyze
            </Link>
            <Link
              to="/history"
              className={`px-4 py-2 rounded ${
                isActive('/history') 
                  ? 'bg-blue-700 font-semibold' 
                  : 'hover:bg-blue-500'
              }`}
            >
              History
            </Link>
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded ${
                isActive('/dashboard') 
                  ? 'bg-blue-700 font-semibold' 
                  : 'hover:bg-blue-500'
              }`}
            >
              Dashboard
            </Link>
            {user && (
              <Link
                to="/portal"
                className={`px-4 py-2 rounded ${
                  isActive('/portal')
                    ? 'bg-blue-700 font-semibold'
                    : 'hover:bg-blue-500'
                }`}
              >
                Portal
              </Link>
            )}
            {user ? (
              <div className="flex items-center pl-3 ml-2 border-l border-blue-400">
                <div className="text-right mr-3 leading-tight">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-xs text-blue-200">{user.companyName}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded border border-blue-300 hover:bg-blue-500 text-sm"
                >
                  Log Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="ml-2 px-4 py-2 rounded bg-white text-blue-700 font-semibold hover:bg-blue-50"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
