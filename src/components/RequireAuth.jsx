import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function RequireAuth({ children }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="text-center text-gray-500 py-16">Loading...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}

export default RequireAuth
