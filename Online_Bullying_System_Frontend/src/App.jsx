import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomePage from './components/StudentHome';
import { LoginModal, LoginPage } from './components/Login';
import { SubmitComplaint } from './components/SubmitComplaint';
import { ComplaintStatus } from './components/CheckStatus';
import { Resources } from './components/Resources';
import StudentProfilePage from './components/StudentProfilePage';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState('home')
  const [complaints, setComplaints] = useState([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // Add this inside App to get the current route
  const location = useLocation();

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
    <div className="App">
      {/* Hide header if on /login route */}
      {location.pathname !== '/login' && (
        <header className="header">
          <div className="header-container">
            <h1 className="logo">YouMatter</h1>
            <nav className="nav">
              <Link 
                className="nav-link" 
                to="/home"
              >
                Home
              </Link>
              <Link 
                className="nav-link" 
                to="/submit"
              >
                Submit Complaint
              </Link>
              <Link 
                className="nav-link" 
                to="/status"
              >
                Check Status
              </Link>
              <Link 
                className="nav-link" 
                to="/resources"
              >
                Resources
              </Link>
              <button
                className="nav-link login-btn"
                onClick={() => setShowLogin(true)}
              >
                Login
              </button>
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
          <Route path="/profile" element={<StudentProfilePage complaints={complaints} />} />
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
  );
}

export default App;
