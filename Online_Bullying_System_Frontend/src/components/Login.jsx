import React, { useState } from 'react';
import YouMatterLogo from '../assets/YouMatter_logo_bg_removed.png'; 
import GoogleLogo from '../assets/google_logo.png';

//Login popup
function LoginModal({ onLogin, onClose, error, isLoading }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(identifier, password)
  }

  const handleGoogleSignIn = () => {
    alert('Google Sign-In not implemented yet.');
  }

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-box">
        <button className="login-modal-close" onClick={onClose}>&times;</button>
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Email or Username:
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        {error && <p className="login-error">{error}</p>}
        <hr className="login-divider" />
        <button
          className="google-signin-btn-modal"
          onClick={handleGoogleSignIn}
          type="button"
        >
          <img
            src={GoogleLogo}
            alt="Google"
            className="google-icon"
          />
          <span className="google-signin-text">Sign in with Google</span>
          <img
            src={GoogleLogo}
            alt=""
            className="google-icon google-icon-placeholder"
            aria-hidden="true"
            style={{ visibility: 'hidden' }}
          />
        </button>
      </div>
    </div>
  )
}

//login page
function LoginPage({ onLogin, error, isLoading }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(identifier, password)
  }

  // Dummy Google sign-in handler
  const handleGoogleSignIn = () => {
    alert('Google Sign-In not implemented yet.');
  }

  return (
    <div className="login-page">
      <img
        src={YouMatterLogo}
        alt="YouMatter Logo"
      />
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Email or Username:
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>
        </div>
        <div>
          <label>
            Password:
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {error && <p className="login-error">{error}</p>}
      <hr className="login-divider" />
      <button
        className="google-signin-btn"
        onClick={handleGoogleSignIn}
        type="button"
      >
        <img
          src={GoogleLogo}
          alt="Google"
          className="google-icon"
        />
        <span className="google-signin-text">Sign in with Google</span>
        <img
          src={GoogleLogo}
          alt=""
          className="google-icon google-icon-placeholder"
          aria-hidden="true"
          style={{ visibility: 'hidden' }}
        />
      </button>
    </div>
  )
}

export { LoginModal, LoginPage }
