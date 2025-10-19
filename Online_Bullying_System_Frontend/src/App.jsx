import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import HomePage from './components/StudentHome';
import { LoginModal, LoginPage } from './components/Login';
import { SubmitComplaint } from './components/SubmitComplaint';
import { ComplaintStatus } from './components/CheckStatus';
import { Resources } from './components/Resources';
import StudentProfilePage from './components/StudentProfilePage';
import AdminDashboard from './components/admin/AdminDashboard';
import {
  login as loginRequest,
  toAbsoluteUrl,
  getComplaints,
  addComplaintComment,
  loginWithGoogle,
  verifyTwoFactor,
} from './services/api';
import './App.css';

const LOCAL_STORAGE_USER_KEY = 'obs.currentUser';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER ADMIN']);

const normalizeRole = (role) => {
  if (!role) return '';
  return String(role).replace(/[_-]/g, ' ').trim().toUpperCase();
};

const isAdminUser = (user) => ADMIN_ROLES.has(normalizeRole(user?.role));

const getRoleLandingPath = (user) => (isAdminUser(user) ? '/admin' : '/home');

const loadStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(LOCAL_STORAGE_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Detected invalid stored user data, clearing persisted session.', error);
    window.localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    return null;
  }
};

function App() {
  const [complaints, setComplaints] = useState([])
  const [isComplaintsLoading, setIsComplaintsLoading] = useState(false)
  const [complaintsError, setComplaintsError] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(() => loadStoredUser())
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [pendingRoute, setPendingRoute] = useState(null)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const [complaintsVersion, setComplaintsVersion] = useState(0)
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null)
  const [isTwoFactorLoading, setIsTwoFactorLoading] = useState(false)
  const [twoFactorError, setTwoFactorError] = useState(null)
  const [twoFactorMessage, setTwoFactorMessage] = useState(null)

  // Add this inside App to get the current route
  const location = useLocation();
  const navigate = useNavigate();
  const userMenuRef = useRef(null);

  const handleUserUpdate = (updatedUser) => {
    if (!updatedUser) return
    setCurrentUser(updatedUser)
  }

  const handleSubmitComplaint = (complaint) => {
    if (!complaint) return
    setComplaints(prev => [complaint, ...prev])
    navigate('/status')
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (currentUser) {
      window.localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(currentUser));
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }
  }, [currentUser]);

  const completeLogin = useCallback((user) => {
    if (!user) {
      return
    }
    setCurrentUser(user)
    setShowLogin(false)
    setShowUserMenu(false)
    setTwoFactorChallenge(null)
    setTwoFactorError(null)
    setTwoFactorMessage(null)
    setIsTwoFactorLoading(false)
    setIsAuthLoading(false)
    const landingPath = getRoleLandingPath(user)
    const nextRoute =
      isAdminUser(user)
        ? landingPath
        : pendingRoute && !pendingRoute.startsWith('/admin')
          ? pendingRoute
          : landingPath
    navigate(nextRoute)
    setPendingRoute(null)
  }, [navigate, pendingRoute])

  const handleLogin = async (identifier, password) => {
    const trimmedIdentifier = identifier.trim()
    if (!trimmedIdentifier || !password) {
      setAuthError('Please enter both email/username and password.')
      return
    }

    setIsAuthLoading(true)
    setAuthError(null)
    setTwoFactorError(null)

    try {
      const response = await loginRequest(trimmedIdentifier, password)
      if (response?.requires_two_factor) {
        setTwoFactorChallenge({
          challengeId: response.challenge_id,
          email: response.email,
          expiresIn: response.expires_in,
          identifier: trimmedIdentifier,
          requiresPasswordReset: Boolean(response.requires_password_reset),
          stage: 'code',
        })
        setTwoFactorMessage(response?.message || 'A verification code has been sent to your email.')
        return
      }
      completeLogin(response)
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

  const handleVerifyTwoFactorCode = async (challengeId, code) => {
    if (!challengeId) {
      setTwoFactorError('Missing verification challenge.')
      return
    }
    const trimmedCode = (code || '').trim()
    if (!trimmedCode) {
      setTwoFactorError('Please enter the verification code sent to your email.')
      return
    }
    setIsTwoFactorLoading(true)
    setTwoFactorError(null)
    try {
      const result = await verifyTwoFactor({ challengeId, code: trimmedCode })
      if (result?.requires_password_reset && result?.reset_token) {
        setTwoFactorChallenge(prev => ({
          ...(prev || {}),
          challengeId: prev?.challengeId || challengeId,
          email: result?.email || prev?.email,
          expiresIn: prev?.expiresIn,
          identifier: prev?.identifier,
          requiresPasswordReset: true,
          passwordResetToken: result.reset_token,
          resetExpiresIn: result.expires_in,
          stage: 'password',
        }))
        setTwoFactorMessage(
          result?.message || 'Verification successful. Please create a new password to continue.'
        )
        return
      }
      setTwoFactorMessage(null)
      completeLogin(result)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to verify the code. Please try again.'
      setTwoFactorError(message)
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const handleCompleteTwoFactorPassword = async (resetToken, newPassword, confirmPassword) => {
    if (!resetToken) {
      setTwoFactorError('Password reset session expired. Please sign in again.')
      return
    }
    setIsTwoFactorLoading(true)
    setTwoFactorError(null)
    try {
      const user = await verifyTwoFactor({
        resetToken,
        newPassword,
        confirmPassword,
      })
      setTwoFactorMessage(null)
      completeLogin(user)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to update the password. Please try again.'
      setTwoFactorError(message)
    } finally {
      setIsTwoFactorLoading(false)
    }
  }

  const handleCancelTwoFactor = useCallback(() => {
    setTwoFactorChallenge(null)
    setTwoFactorError(null)
    setTwoFactorMessage(null)
    setIsTwoFactorLoading(false)
  }, [])

  const handleGoogleLogin = async (idToken) => {
    if (!idToken) {
      setAuthError('Unable to authenticate with Google. Please try again.')
      return
    }
    setIsAuthLoading(true)
    setAuthError(null)
    handleCancelTwoFactor()
    try {
      const user = await loginWithGoogle(idToken)
      setCurrentUser(user)
      setShowLogin(false)
      setShowUserMenu(false)
      const landingPath = getRoleLandingPath(user)
      const nextRoute =
        isAdminUser(user)
          ? landingPath
          : pendingRoute && !pendingRoute.startsWith('/admin')
            ? pendingRoute
            : landingPath
      navigate(nextRoute)
      setPendingRoute(null)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to login with Google. Please try again.'
      setAuthError(message)
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleOpenLogin = () => {
    setAuthError(null)
    setPendingRoute(null)
    setIsMobileNavOpen(false)
    setShowUserMenu(false)
    handleCancelTwoFactor()
    setShowLogin(true)
  }

  const handleCloseLoginModal = () => {
    setShowLogin(false)
    setAuthError(null)
    setPendingRoute(null)
    handleCancelTwoFactor()
  }

  const handleLogout = () => {
    setCurrentUser(null)
    setShowUserMenu(false)
    setPendingRoute(null)
    setComplaints([])
    setComplaintsError(null)
    setIsComplaintsLoading(false)
    setIsMobileNavOpen(false)
    handleCancelTwoFactor()
    navigate('/home')
  }

  const handleViewProfile = () => {
    setShowUserMenu(false)
    setIsMobileNavOpen(false)
    navigate('/profile')
  }

  const handleAddComment = async (complaintId, message) => {
    if (!currentUser) {
      throw new Error('You must be logged in to comment.')
    }
    const comment = await addComplaintComment(complaintId, {
      author_id: currentUser.id,
      message,
    })
    setComplaints(prev =>
      prev.map(complaint =>
        complaint.id === complaintId
          ? {
              ...complaint,
              comments: [...(complaint.comments || []), comment],
            }
          : complaint
      )
    )
    return comment
  }
  const refreshComplaints = useCallback(() => {
    setComplaintsVersion(prev => prev + 1)
  }, [])
  useEffect(() => {
    if (!currentUser) {
      setComplaints([])
      setComplaintsError(null)
      setIsComplaintsLoading(false)
      return
    }
    let isActive = true
    const fetchComplaints = async () => {
      setIsComplaintsLoading(true)
      setComplaintsError(null)
      try {
        const params = { include_comments: true }
        if ((currentUser.role || '').toUpperCase() === 'STUDENT') {
          params.user_id = currentUser.id
        }
        const data = await getComplaints(params)
        if (isActive) {
          setComplaints(data)
        }
      } catch (err) {
        if (isActive) {
          const message =
            err?.response?.data?.error ||
            err?.message ||
            'Unable to load complaints.'
          setComplaintsError(message)
        }
      } finally {
        if (isActive) {
          setIsComplaintsLoading(false)
        }
      }
    }
    fetchComplaints()
    return () => {
      isActive = false
    }
  }, [currentUser, complaintsVersion])

  const handleProtectedNav = (event, path) => {
    if (!currentUser) {
      event.preventDefault()
      setPendingRoute(path)
      setAuthError(null)
      setShowLogin(true)
      setShowUserMenu(false)
    } else {
      setIsMobileNavOpen(false)
      setShowUserMenu(false)
    }
  }

  const handleUserButtonClick = () => {
    if (isMobileView) {
      setIsMobileNavOpen(false)
      setShowUserMenu(false)
      navigate('/profile')
      return
    }
    setShowUserMenu((prev) => !prev)
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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }
    const mql = window.matchMedia('(max-width: 768px)')
    const handleChange = (event) => {
      setIsMobileView(event.matches)
    }
    setIsMobileView(mql.matches)
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange)
      return () => mql.removeListener(handleChange)
    }
    return undefined
  }, [])

  useEffect(() => {
    if (isMobileView) {
      setShowUserMenu(false)
      userMenuRef.current = null
    }
  }, [isMobileView])

  useEffect(() => {
    setIsMobileNavOpen(false)
    setShowUserMenu(false)
  }, [location.pathname])

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLoginRoute = location.pathname === '/login';

  const avatarInitial = (currentUser?.username || currentUser?.email || 'U')
    .charAt(0)
    .toUpperCase()
  const avatarLabel = currentUser?.username || currentUser?.email || 'User'
  const avatarUrl = currentUser?.avatar_url ? toAbsoluteUrl(currentUser.avatar_url) : null

  return (
    <div className="App">
      {!isAdminRoute && !isLoginRoute && (
        <header className={`header${isMobileNavOpen ? ' header--mobile-open' : ''}`}>
          <div className="header-container">
            <h1 className="logo">YouMatter</h1>
            <button
              type="button"
              className={`mobile-nav-toggle${isMobileNavOpen ? ' is-open' : ''}`}
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
              aria-expanded={isMobileNavOpen}
            >
              <span className="mobile-nav-toggle__bar" />
              <span className="mobile-nav-toggle__bar" />
              <span className="mobile-nav-toggle__bar" />
            </button>
            <nav className={`nav${isMobileNavOpen ? ' nav--open' : ''}`}>
              <Link
                className="nav-link"
                to="/home"
                onClick={() => {
                  setIsMobileNavOpen(false)
                  setShowUserMenu(false)
                }}
              >
                Home
              </Link>
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
              <Link
                className="nav-link"
                to="/resources"
                onClick={() => {
                  setIsMobileNavOpen(false)
                  setShowUserMenu(false)
                }}
              >
                Resources
              </Link>
              {currentUser ? (
                <div className="user-menu" ref={isMobileView ? undefined : userMenuRef}>
                  <button
                    type="button"
                    className="user-avatar-btn"
                    onClick={handleUserButtonClick}
                    aria-haspopup={isMobileView ? undefined : true}
                    aria-expanded={isMobileView ? undefined : showUserMenu}
                    aria-label={
                      isMobileView
                        ? `View profile for ${avatarLabel}`
                        : `Account menu for ${avatarLabel}`
                    }
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
                  {!isMobileView && showUserMenu && (
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
                  type="button"
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
          <Route
            path="/submit"
            element={
              <SubmitComplaint
                onSubmit={handleSubmitComplaint}
                currentUser={currentUser}
              />
            }
          />
          <Route
            path="/status"
            element={
              <ComplaintStatus
                complaints={complaints}
                loading={isComplaintsLoading}
                error={complaintsError}
                onAddComment={handleAddComment}
                currentUser={currentUser}
              />
            }
          />
          <Route path="/resources" element={<Resources />} />
          <Route
            path="/profile"
            element={
              <StudentProfilePage
                complaints={complaints}
                currentUser={currentUser}
                onUserUpdate={handleUserUpdate}
                onLogout={handleLogout}
              />
            }
          />
          <Route
            path="/login"
            element={
              currentUser ? (
                <Navigate to={getRoleLandingPath(currentUser)} replace />
              ) : (
                <LoginPage
                  onLogin={handleLogin}
                  error={authError}
                  isLoading={isAuthLoading}
                  onGoogleLogin={handleGoogleLogin}
                  onAuthError={setAuthError}
                  pendingTwoFactor={twoFactorChallenge}
                  onVerifyTwoFactorCode={handleVerifyTwoFactorCode}
                  onCompleteTwoFactorPassword={handleCompleteTwoFactorPassword}
                  twoFactorError={twoFactorError}
                  twoFactorMessage={twoFactorMessage}
                  isTwoFactorLoading={isTwoFactorLoading}
                  onCancelTwoFactor={handleCancelTwoFactor}
                />
              )
            }
          />
          <Route
            path="/admin/*"
            element={
              !currentUser ? (
                <Navigate to="/login" replace />
              ) : !isAdminUser(currentUser) ? (
                <Navigate to="/home" replace />
              ) : (
                <AdminDashboard
                  currentUser={currentUser}
                  complaints={complaints}
                  complaintsLoading={isComplaintsLoading}
                  complaintsError={complaintsError}
                  onRefreshComplaints={refreshComplaints}
                  onUserUpdate={handleUserUpdate}
                  onLogout={handleLogout}
                />
              )
            }
          />
          <Route path="*" element={<HomePage />} />
        </Routes>
        {showLogin && !currentUser && (
          <LoginModal
            onLogin={handleLogin}
            onClose={handleCloseLoginModal}
            error={authError}
            isLoading={isAuthLoading}
            onGoogleLogin={handleGoogleLogin}
            onAuthError={setAuthError}
            pendingTwoFactor={twoFactorChallenge}
            onVerifyTwoFactorCode={handleVerifyTwoFactorCode}
            onCompleteTwoFactorPassword={handleCompleteTwoFactorPassword}
            twoFactorError={twoFactorError}
            twoFactorMessage={twoFactorMessage}
            isTwoFactorLoading={isTwoFactorLoading}
            onCancelTwoFactor={handleCancelTwoFactor}
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
