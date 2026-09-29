import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import Navigation from './components/Navigation'
import RequireAuth from './components/RequireAuth'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PortalPage from './pages/PortalPage'
import AnalyzePage from './pages/AnalyzePage'
import HistoryPage from './pages/HistoryPage'
import DashboardPage from './pages/DashboardPage'

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal" element={<RequireAuth><PortalPage /></RequireAuth>} />
            <Route path="/analyze" element={<RequireAuth><AnalyzePage /></RequireAuth>} />
            <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
