import React, { useEffect, useRef, useState } from 'react';
import YouMatterLogo from '../assets/YouMatter_logo_bg_removed.png'; 
import GoogleLogo from '../assets/google_logo.png';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

function GoogleSignInButton({ onCredential, onError, isLoading, variant = 'page' }) {
  const buttonHostRef = useRef(null);
  const nativeButtonRef = useRef(null);
  const [localError, setLocalError] = useState(null);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled) {
        return;
      }
      if (!clientId) {
        const message = 'Google Sign-In is not configured.';
        setLocalError(message);
        if (onError) onError(message);
        return;
      }
      const google = window.google?.accounts?.id;
      if (!google || !buttonHostRef.current) {
        return;
      }
      google.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response?.credential) {
            const message = 'Google Sign-In failed. Please try again.';
            setLocalError(message);
            if (onError) onError(message);
            return;
          }
          if (onCredential) {
            onCredential(response.credential);
          }
        },
      });
      buttonHostRef.current.innerHTML = '';
      google.renderButton(buttonHostRef.current, {
        theme: variant === 'modal' ? 'outline' : 'filled_blue',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'pill',
        width: '100%',
      });
      const nativeButton =
        buttonHostRef.current.querySelector('button, div[role="button"], span[role="button"]');
      if (nativeButton) {
        nativeButtonRef.current = nativeButton;
      }
      if (buttonHostRef.current) {
        buttonHostRef.current.style.position = 'absolute';
        buttonHostRef.current.style.opacity = '0';
        buttonHostRef.current.style.pointerEvents = 'none';
        buttonHostRef.current.style.width = '0';
        buttonHostRef.current.style.height = '0';
      }
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const handleScriptLoad = () => {
      const scriptEl = document.getElementById(GOOGLE_SCRIPT_ID);
      if (scriptEl) {
        scriptEl.setAttribute('data-loaded', 'true');
      }
      renderGoogleButton();
    };

    const handleScriptError = () => {
      const message = 'Unable to load Google Sign-In. Please refresh and try again.';
      setLocalError(message);
      if (onError) onError(message);
    };

    let script = document.getElementById(GOOGLE_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = handleScriptLoad;
      script.onerror = handleScriptError;
      document.head.appendChild(script);
    } else if (script.getAttribute('data-loaded') === 'true') {
      renderGoogleButton();
    } else {
      script.addEventListener('load', handleScriptLoad);
      script.addEventListener('error', handleScriptError, { once: true });
    }

    return () => {
      cancelled = true;
      if (script) {
        script.removeEventListener('load', handleScriptLoad);
      }
      nativeButtonRef.current = null;
    };
  }, [clientId, onCredential, onError, variant]);

  const handleFallbackClick = () => {
    if (isLoading) {
      return;
    }
    if (localError) {
      alert(localError);
      return;
    }
    if (!clientId) {
      alert('Google Sign-In is not configured for this application.');
      return;
    }
    alert('Google Sign-In is initializing. Please try again in a moment.');
  };

  const handleCustomClick = (event) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    if (nativeButtonRef.current) {
      nativeButtonRef.current.click();
      return;
    }
    handleFallbackClick();
  };

  const buttonClassName = variant === 'modal' ? 'google-signin-btn-modal' : 'google-signin-btn';

  return (
    <div className="google-signin-wrapper">
      <button
        className={buttonClassName}
        onClick={handleCustomClick}
        type="button"
        disabled={isLoading}
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
      <div ref={buttonHostRef} className="google-signin-native-host" aria-hidden="true" />
      {localError && (
        <p className="login-error" role="alert">
          {localError}
        </p>
      )}
    </div>
  );
}

//Login popup
function LoginModal({ onLogin, onClose, error, isLoading, onGoogleLogin, onAuthError }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(identifier, password)
  }

  const handleGoogleCredential = (credential) => {
    if (isLoading || !credential || typeof onGoogleLogin !== 'function') {
      return;
    }
    onGoogleLogin(credential);
  };

  const handleGoogleError = (message) => {
    if (typeof onAuthError === 'function') {
      onAuthError(message);
    }
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
        <GoogleSignInButton
          variant="modal"
          onCredential={handleGoogleCredential}
          onError={handleGoogleError}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

//login page
function LoginPage({ onLogin, error, isLoading, onGoogleLogin, onAuthError }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onLogin(identifier, password)
  }

  const handleGoogleCredential = (credential) => {
    if (isLoading || !credential || typeof onGoogleLogin !== 'function') {
      return;
    }
    onGoogleLogin(credential);
  };

  const handleGoogleError = (message) => {
    if (typeof onAuthError === 'function') {
      onAuthError(message);
    }
  };

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
      <GoogleSignInButton
        variant="page"
        onCredential={handleGoogleCredential}
        onError={handleGoogleError}
        isLoading={isLoading}
      />
    </div>
  )
}

export { LoginModal, LoginPage }
