import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [complaints, setComplaints] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

    const handleSubmitComplaint = (complaint) => {
    const newComplaint = {
      id: Date.now(),
      ...complaint,
      status: 'pending',
      submittedAt: new Date().toLocaleDateString()
    }
    setComplaints([...complaints, newComplaint])
    setActiveSection('status')
  }

  const handleLogin = (username, password) => {
    if (username && password){
      setIsLoggedIn(true)
      setShowLogin(false)
      setActiveSection('home')
    }
  }

const renderContent = () => {
    switch (activeSection) {
      case 'login':
        return <LoginPage onLogin={handleLogin} />
      case 'home':
        return <HomePage />
      case 'submit':
        return <SubmitComplaint onSubmit={handleSubmitComplaint} />
      case 'status':
        return <ComplaintStatus complaints={complaints} />
      case 'resources':
        return <Resources />
      default:
        return <HomePage />
    }
  }
  
  return (
    <Router>
      <div className="App">
        <header className="header">
          <div className="header-container">
            <h1 className="logo">YouMatter</h1>
            <nav className="nav">
              <Link className="nav-link" to="/home">Home</Link>
              <Link className="nav-link" to="/submit">Submit Complaint</Link>
              <Link className="nav-link" to="/status">Check Status</Link>
              <Link className="nav-link" to="/resources">Resources</Link>
              <Link className="nav-link" to="/login" style={{ marginLeft: '1rem' }}>Login Page</Link>
              <button
                className="nav-link"
                onClick={() => setShowLogin(true)}
                style={{ marginLeft: '0.5rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Login Popup
              </button>
            </nav>
          </div>
        </header>
        
        <main className="main-content">
          <Routes>
            <Route path="/home" element={<HomePage />} />
            <Route path="/submit" element={<SubmitComplaint onSubmit={handleSubmitComplaint} />} />
            <Route path="/status" element={<ComplaintStatus complaints={complaints} />} />
            <Route path="/resources" element={<Resources />} />
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="*" element={<HomePage />} />
          </Routes>
          {showLogin && (
            <LoginModal
              onLogin={handleLogin}
              onClose={() => setShowLogin(false)}
            />
          )}
        </main>
        
        <footer className="footer">
          <div className="container">
            <p>&copy; 2025 YouMatter. Your safety is our priority.</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

// Home Page Component
function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h2>Online Bullying Complaint System</h2>
        <p className="hero-subtitle">
          A safe and confidential platform for hostel students to report bullying incidents
        </p>
        <div className="hero-stats">
          <div className="stat">
            <h3>24/7</h3>
            <p>Available Support</p>
          </div>
          <div className="stat">
            <h3>100%</h3>
            <p>Confidential</p>
          </div>
          <div className="stat">
            <h3>Fast</h3>
            <p>Response Time</p>
          </div>
        </div>
      </section>

      <section className="features">
        <h3>How It Works</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h4>Submit Report</h4>
            <p>Fill out a secure form with details about the incident</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h4>Investigation</h4>
            <p>Our team reviews and investigates your complaint promptly</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✅</div>
            <h4>Resolution</h4>
            <p>We work to resolve the issue and ensure your safety</p>
          </div>
        </div>
      </section>
    </div>
  )
}

//Login popup
function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(username, password)
  }

  return (
  <div className="login-modal-overlay">
    <div className="login-modal-box">
      <button className="login-modal-close" onClick={onClose}>&times;</button>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Username:
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          Password:
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Login</button>
      </form>
    </div>
  </div>
)
}

//login page
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(username, password)
  }

  return (
    <div className="login-page" style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Username:
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </label>
        </div>
        <button type="submit" style={{ width: '100%', padding: 10 }}>Login</button>
      </form>
    </div>
  )
}

function SubmitComplaint({ onSubmit }) {
  return <div>Submit Complaint Page</div>
}

function ComplaintStatus({ complaints }) {
  return <div>Complaint Status Page</div>
}

function Resources() {
  return <div>Resources Page</div>
}
export default App;
