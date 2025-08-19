import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './components/StudentHome';
import { LoginModal, LoginPage } from './components/Login';
import { SubmitComplaint } from './components/SubmitComplaint';
import { ComplaintStatus } from './components/CheckStatus';
import { Resources } from './components/Resources';
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
              <Link 
                className="nav-link" 
                to="/home"
                style={{ textDecoration: 'none', color: 'white', textTransform: 'uppercase' }}
              >
                Home
              </Link>
              <Link 
                className="nav-link" 
                to="/submit"
                style={{ textDecoration: 'none', color: 'white', textTransform: 'uppercase' }}
              >
                Submit Complaint
              </Link>
              <Link 
                className="nav-link" 
                to="/status"
                style={{ textDecoration: 'none', color: 'white', textTransform: 'uppercase' }}
              >
                Check Status
              </Link>
              <Link 
                className="nav-link" 
                to="/resources"
                style={{ textDecoration: 'none', color: 'white', textTransform: 'uppercase' }}
              >
                Resources
              </Link>
              <button
                className="nav-link"
                onClick={() => setShowLogin(true)}
                style={{ 
                  marginLeft: '0.5rem', 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  textDecoration: 'none',
                  color: 'white',
                  textTransform: 'uppercase'
                }}
              >
                Login
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

// // Home Page Component
// function HomePage() {
//   return (
//     <div className="home-page">
//       <section className="hero">
//         <h2>Online Bullying Complaint System</h2>
//         <p className="hero-subtitle">
//           A safe and confidential platform for hostel students to report bullying incidents
//         </p>
//         <div className="hero-stats">
//           <div className="stat">
//             <h3>24/7</h3>
//             <p>Available Support</p>
//           </div>
//           <div className="stat">
//             <h3>100%</h3>
//             <p>Confidential</p>
//           </div>
//           <div className="stat">
//             <h3>Fast</h3>
//             <p>Response Time</p>
//           </div>
//         </div>
//       </section>

//       <section className="features">
//         <h3>How It Works</h3>
//         <div className="feature-grid">
//           <div className="feature-card">
//             <div className="feature-icon">📝</div>
//             <h4>Submit Report</h4>
//             <p>Fill out a secure form with details about the incident</p>
//           </div>
//           <div className="feature-card">
//             <div className="feature-icon">🔍</div>
//             <h4>Investigation</h4>
//             <p>Our team reviews and investigates your complaint promptly</p>
//           </div>
//           <div className="feature-card">
//             <div className="feature-icon">✅</div>
//             <h4>Resolution</h4>
//             <p>We work to resolve the issue and ensure your safety</p>
//           </div>
//         </div>
//       </section>
//     </div>
//   )
// }

//Login popup
// function LoginModal({ onLogin, onClose }) {
//   const [username, setUsername] = useState('')
//   const [password, setPassword] = useState('')

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     onLogin(username, password)
//   }

//   return (
//   <div className="login-modal-overlay">
//     <div className="login-modal-box">
//       <button className="login-modal-close" onClick={onClose}>&times;</button>
//       <h2>Login</h2>
//       <form onSubmit={handleSubmit}>
//         <label>
//           Email:
//           <input
//             type="text"
//             value={username}
//             onChange={e => setUsername(e.target.value)}
//             required
//           />
//         </label>
//         <label>
//           Password:
//           <input
//             type="password"
//             value={password}
//             onChange={e => setPassword(e.target.value)}
//             required
//           />
//         </label>
//         <button type="submit">Login</button>
//       </form>
//     </div>
//   </div>
// )
// }

// //login page
// function LoginPage({ onLogin }) {
//   const [username, setUsername] = useState('')
//   const [password, setPassword] = useState('')

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     onLogin(username, password)
//   }

//   return (
//     <div className="login-page" style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
//       <h2>Login</h2>
//       <form onSubmit={handleSubmit}>
//         <div style={{ marginBottom: 12 }}>
//           <label>
//             Email:
//             <input
//               type="text"
//               value={username}
//               onChange={e => setUsername(e.target.value)}
//               required
//               style={{ width: '100%', padding: 8, marginTop: 4 }}
//             />
//           </label>
//         </div>
//         <div style={{ marginBottom: 12 }}>
//           <label>
//             Password:
//             <input
//               type="password"
//               value={password}
//               onChange={e => setPassword(e.target.value)}
//               required
//               style={{ width: '100%', padding: 8, marginTop: 4 }}
//             />
//           </label>
//         </div>
//         <button type="submit" style={{ width: '100%', padding: 10 }}>Login</button>
//       </form>
//     </div>
//   )
// }

// function SubmitComplaint({ onSubmit }) {
//   const [formData, setFormData] = useState({
//     studentName: '',
//     studentId: '',
//     roomNumber: '',
//     incidentType: '',
//     description: '',
//     incidentDate: '',
//     witnesses: '',
//     anonymous: false
//   })

//   const handleChange = (e) => {
//     const { name, value, type, checked } = e.target
//     setFormData(prev => ({
//       ...prev,
//       [name]: type === 'checkbox' ? checked : value
//     }))
//   }

//   const handleSubmit = (e) => {
//     e.preventDefault()
//     onSubmit(formData)
//     setFormData({
//       studentName: '',
//       studentId: '',
//       roomNumber: '',
//       incidentType: '',
//       description: '',
//       incidentDate: '',
//       witnesses: '',
//       anonymous: false
//     })
//     alert('Complaint submitted successfully!')
//   }

//   return (
//     <div className="submit-complaint">
//       <h2>Submit a Complaint</h2>
//       <p className="form-intro">
//         Please provide as much detail as possible. All information is kept confidential.
//       </p>

//       <form onSubmit={handleSubmit} className="complaint-form">
//         <div className="form-group switch-group">
//           <label className="switch-label">
//             <span>Submit anonymously</span>
//             <div className="switch">
//               <input
//                 type="checkbox"
//                 name="anonymous"
//                 checked={formData.anonymous}
//                 onChange={handleChange}
//               />
//               <span className="slider"></span>
//             </div>
//           </label>
//           <p className="switch-description">Your identity will not be revealed</p>
//         </div>

//         <div className="form-group">
//           <label htmlFor="studentName">Student Name:</label>
//           <input
//             type="text"
//             id="studentName"
//             name="studentName"
//             value={formData.studentName}
//             onChange={handleChange}
//             required={!formData.anonymous}
//             disabled={formData.anonymous}
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="studentId">Student ID:</label>
//           <input
//             type="text"
//             id="studentId"
//             name="studentId"
//             value={formData.studentId}
//             onChange={handleChange}
//             required={!formData.anonymous}
//             disabled={formData.anonymous}
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="roomNumber">Room Number:</label>
//           <input
//             type="text"
//             id="roomNumber"
//             name="roomNumber"
//             value={formData.roomNumber}
//             onChange={handleChange}
//             required
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="incidentType">Type of Incident:</label>
//           <select
//             id="incidentType"
//             name="incidentType"
//             value={formData.incidentType}
//             onChange={handleChange}
//             required
//           >
//             <option value="">Select incident type</option>
//             <option value="verbal-bullying">Verbal Bullying</option>
//             <option value="physical-bullying">Physical Bullying</option>
//             <option value="cyber-bullying">Cyber Bullying</option>
//             <option value="social-exclusion">Social Exclusion</option>
//             <option value="harassment">Harassment</option>
//             <option value="other">Other</option>
//           </select>
//         </div>

//         <div className="form-group">
//           <label htmlFor="incidentDate">Date of Incident:</label>
//           <input
//             type="date"
//             id="incidentDate"
//             name="incidentDate"
//             value={formData.incidentDate}
//             onChange={handleChange}
//             required
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="description">Description of Incident:</label>
//           <textarea
//             id="description"
//             name="description"
//             value={formData.description}
//             onChange={handleChange}
//             rows="6"
//             placeholder="Please provide detailed information about what happened..."
//             required
//           />
//         </div>

//         <div className="form-group">
//           <label htmlFor="witnesses">Witnesses (if any):</label>
//           <textarea
//             id="witnesses"
//             name="witnesses"
//             value={formData.witnesses}
//             onChange={handleChange}
//             rows="3"
//             placeholder="Names or descriptions of any witnesses..."
//           />
//         </div>

//         <button type="submit" className="submit-btn">
//           Submit Complaint
//         </button>
//       </form>
//     </div>
//   )
// }

// // Check Status Component
// function ComplaintStatus({ complaints }) {
//   return (
//     <div className="complaint-status">
//       <h2>Complaint Status</h2>

//       {complaints.length === 0 ? (
//         <div className="no-complaints">
//           <p>No complaints submitted yet.</p>
//         </div>
//       ) : (
//         <div className="complaints-list">
//           {complaints.map(complaint => (
//             <div key={complaint.id} className="complaint-card">
//               <div className="complaint-header">
//                 <h3>Complaint #{complaint.id}</h3>
//                 <span className={`status ${complaint.status}`}>
//                   {complaint.status.toUpperCase()}
//                 </span>
//               </div>
//               <div className="complaint-details">
//                 <p><strong>Type:</strong> {complaint.incidentType}</p>
//                 <p><strong>Submitted:</strong> {complaint.submittedAt}</p>
//                 <p><strong>Room:</strong> {complaint.roomNumber}</p>
//                 {!complaint.anonymous && (
//                   <p><strong>Student:</strong> {complaint.studentName}</p>
//                 )}
//               </div>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }

// // Resources Component
// function Resources() {
//   return (
//     <div className="resources">
//       <h2>Support Resources</h2>

//       <div className="resource-section">
//         <h3>Emergency Contacts</h3>
//         <div className="contact-grid">
//           <div className="contact-card">
//             <h4>Student Counselor</h4>
//             <p>📞 +604-1234567</p>
//             <p>📧 counselor@inti.edu.my</p>
//           </div>
//           <div className="contact-card">
//             <h4>Talian Kasih (Counselors)</h4>
//             <p>📞 15999</p>
//             <p>
//               <a 
//                 href="https://www.kpwkm.gov.my/" 
//                 target="_blank" 
//                 rel="noopener noreferrer"
//                 style={{ color: '#007bff', textDecoration: 'underline' }}
//               > https://www.kpwkm.gov.my/
//               </a>
//             </p>
//           </div>
//           <div className="contact-card">
//             <h4>Emergency Services</h4>
//             <p>📞 999</p>
//             <p>Available 24/7</p>
//           </div>
//         </div>
//       </div>

//       <div className="resource-section">
//         <h3>What Constitutes Bullying?</h3>
//         <ul className="bullying-types">
//           <li><strong>Physical Bullying:</strong> Hitting, kicking, pushing, damaging property</li>
//           <li><strong>Verbal Bullying:</strong> Name-calling, insults, threats, inappropriate comments</li>
//           <li><strong>Social Bullying:</strong> Exclusion, spreading rumors, public embarrassment</li>
//           <li><strong>Cyber Bullying:</strong> Online harassment, threatening messages, sharing private information</li>
//         </ul>
//       </div>

//       <div className="resource-section">
//         <h3>Your Rights</h3>
//         <ul className="rights-list">
//           <li>Right to feel safe in your living environment</li>
//           <li>Right to report incidents without fear of retaliation</li>
//           <li>Right to confidential support and counseling</li>
//           <li>Right to have complaints investigated promptly</li>
//           <li>Right to be treated with dignity and respect</li>
//         </ul>
//       </div>
//     </div>
//   )
// }

export default App;
