import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import HomePage from './components/StudentHome';
import { LoginModal, LoginPage } from './components/Login';
import { SubmitComplaint } from './components/SubmitComplaint';
import { ComplaintStatus } from './components/CheckStatus';
import { Resources } from './components/Resources';
import StudentProfilePage from './components/StudentProfilePage';
import AdminDashboard from './components/admin/AdminDashboard';
import { login as loginRequest, toAbsoluteUrl } from './services/api';
import './App.css';

function App() {
  const [complaints, setComplaints] = useState([])
  const [showLogin, setShowLogin] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [pendingRoute, setPendingRoute] = useState(null)

  // Add this inside App to get the current route
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const handleUserUpdate = (updatedUser) => {
    if (!updatedUser) return
    setCurrentUser(updatedUser)
  }

  const handleSubmitComplaint = (complaint) => {
    const newComplaint = {
      id: Date.now(),
      ...complaint,
      status: 'pending',
      submittedAt: new Date().toLocaleDateString()
    }
    setComplaints([...complaints, newComplaint])
    navigate('/status')
  }

  const handleLogin = async (identifier, password) => {
    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier || !password) {
      setAuthError('Please enter both email/username and password.')
      return
    }

    setIsAuthLoading(true)
    setAuthError(null)

    try {
      const user = await loginRequest(trimmedIdentifier, password)
      setCurrentUser(user)
      setShowLogin(false)
      setShowUserMenu(false)
      navigate(pendingRoute || '/home')
      setPendingRoute(null)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to login. Please try again.'
      setAuthError(message)
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleOpenLogin = () => {
    setAuthError(null)
    setPendingRoute(null)
    setShowLogin(true)
  }

  const handleCloseLoginModal = () => {
    setShowLogin(false)
    setAuthError(null)
    setPendingRoute(null)
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setShowUserMenu(false)
    setPendingRoute(null)
    navigate('/home')
  }

  const handleViewProfile = () => {
    setShowUserMenu(false)
    navigate('/profile')
  }

  const handleProtectedNav = (event, path) => {
    if (!currentUser) {
      event.preventDefault()
      setPendingRoute(path)
      setAuthError(null)
      setShowLogin(true)
      setShowUserMenu(false)
    }
  }

  useEffect(() => {
    if (!showUserMenu) return
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUserMenu])

  const avatarInitial = (currentUser?.username || currentUser?.email || 'U')
    .charAt(0)
    .toUpperCase()
  const avatarLabel = currentUser?.username || currentUser?.email || 'User'
  const avatarUrl = currentUser?.avatar_url ? toAbsoluteUrl(currentUser.avatar_url) : null
  
  return (
    <div className="App">
      {/* Hide header if on /login or /admin route */}
      {location.pathname !== '/login' && !location.pathname.startsWith('/admin') && (
        <header className="header">
          <div className="header-container">
            <h1 className="logo">YouMatter</h1>
            <nav className="nav">
              <Link className="nav-link" to="/home">Home</Link>
              <Link
                className="nav-link"
                to="/submit"
                onClick={(e) => handleProtectedNav(e, '/submit')}
                aria-disabled={!currentUser}
              >
                Submit Complaint
              </Link>
              <Link
                className="nav-link"
                to="/status"
                onClick={(e) => handleProtectedNav(e, '/status')}
                aria-disabled={!currentUser}
              >
                Check Status
              </Link>
              <Link className="nav-link" to="/resources">Resources</Link>
              {currentUser ? (
                <div className="user-menu" ref={userMenuRef}>
                  <button
                    type="button"
                    className="user-avatar-btn"
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    aria-haspopup="true"
                    aria-expanded={showUserMenu}
                    aria-label={`Account menu for ${avatarLabel}`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={`${avatarLabel} avatar`}
                        className="user-avatar-img"
                      />
                    ) : (
                      <span className="user-avatar-initial">{avatarInitial}</span>
                    )}
                  </button>
                  {showUserMenu && (
                    <div className="user-dropdown" role="menu">
                      <div className="user-dropdown__header">
                        <span className="user-name">{currentUser.username}</span>
                        <span className="user-email">{currentUser.email}</span>
                      </div>
                      <button type="button" onClick={handleViewProfile} role="menuitem">
                        View Profile
                      </button>
                      <button type="button" onClick={handleLogout} role="menuitem">
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="nav-link login-btn"
                  onClick={handleOpenLogin}
                >
                  Login
                </button>
              )}
            </nav>
          </div>
        </header>
      )}
      
      <main className="main-content">
        <Routes>
          <Route path="/home" element={<HomePage />} />
          <Route path="/submit" element={<SubmitComplaint onSubmit={handleSubmitComplaint} />} />
          <Route path="/status" element={<ComplaintStatus complaints={complaints} />} />
          <Route path="/resources" element={<Resources />} />
          <Route
            path="/profile"
            element={
              <StudentProfilePage
                complaints={complaints}
                currentUser={currentUser}
                onUserUpdate={handleUserUpdate}
              />
            }
          />
          <Route
            path="/login"
            element={
              <LoginPage
                onLogin={handleLogin}
                error={authError}
                isLoading={isAuthLoading}
              />
            }
          />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        {showLogin && !currentUser && (
          <LoginModal
            onLogin={handleLogin}
            onClose={handleCloseLoginModal}
            error={authError}
            isLoading={isAuthLoading}
          />
        )}
      </main>
      
      <footer className="footer">
        <div className="container">
          <p>&copy; 2025 YouMatter. Your safety is our priority.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
