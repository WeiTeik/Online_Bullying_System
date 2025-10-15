import React, { useEffect, useRef, useState } from 'react';
import YouMatterLogo from '../assets/YouMatter_logo_bg_removed.png'; 
import GoogleLogo from '../assets/google_logo.png';
import { requestPasswordReset } from '../services/api';

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


function useForgotPasswordRequest() {
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setStatusMessage('');
    setErrorMessage('');
    setIsSubmitting(false);
  };

  const submit = async (email) => {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      setStatusMessage('');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setStatusMessage('');

    try {
      const response = await requestPasswordReset(trimmedEmail);
      setStatusMessage(response?.message || 'Temporary password has been emailed to you.');
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to reset password. Please try again later.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submit,
    statusMessage,
    errorMessage,
    isSubmitting,
    reset,
  };
}

function ForgotPasswordForm({
  onSubmit,
  onCancel,
  isLoading,
  message,
  error,
  initialEmail = '',
  variant = 'page',
}) {
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(email);
  };

  const formClassName = `forgot-password-form forgot-password-form--${variant}`;

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className="forgot-password-copy">
        <p>Please enter the email address you'd like your password reset instructions sent to.</p>
      </div>
      <label className="forgot-password-label">
        <span>Enter email address</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
      </label>
      <div className="forgot-password-actions">
        <button className="forgot-password-submit" type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send to email'}
        </button>
        <button
          type="button"
          className="forgot-password-back"
          onClick={onCancel}
          disabled={isLoading}
        >
          Back to Login
        </button>
      </div>
      {message && (
        <p className="login-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function TwoFactorForm({
  email,
  onSubmit,
  onCancel,
  isLoading,
  error,
  variant = 'page',
}) {
  const [code, setCode] = useState('');

  const handleCodeChange = (event) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(nextValue);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(code);
  };

  const formClassName = `two-factor-form two-factor-form--${variant}`;

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className="two-factor-copy">
        <p>Enter the six-digit code we just sent to your email to finish signing in.</p>
        {email && (
          <p className="two-factor-email">
            Code sent to <strong>{email}</strong>.
          </p>
        )}
      </div>
      <label className="two-factor-label">
        <span>Enter 6-digit code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={handleCodeChange}
          disabled={isLoading}
          required
        />
      </label>
      <div className="two-factor-actions">
        <button className="two-factor-submit" type="submit" disabled={isLoading || code.length !== 6}>
          {isLoading ? 'Verifying...' : 'Verify code'}
        </button>
        <button
          type="button"
          className="two-factor-back"
          onClick={onCancel}
          disabled={isLoading}
        >
          Back to Login
        </button>
      </div>
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

//Login popup
function LoginModal({
  onLogin,
  onClose,
  error,
  isLoading,
  onGoogleLogin,
  onAuthError,
  pendingTwoFactor,
  onVerifyTwoFactor,
  twoFactorError,
  isTwoFactorLoading,
  onCancelTwoFactor,
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const {
    submit: submitForgotPassword,
    statusMessage: forgotStatusMessage,
    errorMessage: forgotErrorMessage,
    isSubmitting: isForgotSubmitting,
    reset: resetForgotState,
  } = useForgotPasswordRequest()
  const isTwoFactorActive = Boolean(pendingTwoFactor?.challengeId)
  const isForgotPasswordActive = isForgotPassword && !isTwoFactorActive

  useEffect(() => {
    if (isTwoFactorActive) {
      resetForgotState()
      setIsForgotPassword(false)
    }
  }, [isTwoFactorActive, resetForgotState])

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

  const handleShowForgotPassword = () => {
    if (isTwoFactorActive) {
      return
    }
    resetForgotState()
    setIsForgotPassword(true)
    if (typeof onAuthError === 'function') {
      onAuthError(null)
    }
  }

  const handleReturnToLogin = () => {
    resetForgotState()
    setIsForgotPassword(false)
    if (typeof onCancelTwoFactor === 'function') {
      onCancelTwoFactor()
    }
  }

  const handleCloseModal = () => {
    handleReturnToLogin()
    if (typeof onClose === 'function') {
      onClose()
    }
  }

  const initialForgotEmail = identifier.includes('@') ? identifier : ''
  const maskedEmail = pendingTwoFactor?.email || ''

  return (
    <div className="login-modal-overlay">
      <div className="login-modal-box">
        <button className="login-modal-close" onClick={handleCloseModal}>&times;</button>
        <div className="login-modal-content">
          <h2>
            {isTwoFactorActive
              ? 'Verify your identity'
              : isForgotPasswordActive
                ? 'Forgot your password'
                : 'Login'}
          </h2>
          {isTwoFactorActive ? (
            <TwoFactorForm
              variant="modal"
              email={maskedEmail}
              onSubmit={(code) => onVerifyTwoFactor?.(pendingTwoFactor.challengeId, code)}
              onCancel={handleReturnToLogin}
              isLoading={isTwoFactorLoading}
              error={twoFactorError}
            />
          ) : isForgotPasswordActive ? (
            <ForgotPasswordForm
              variant="modal"
              onSubmit={submitForgotPassword}
              onCancel={handleReturnToLogin}
              isLoading={isForgotSubmitting}
              message={forgotStatusMessage}
              error={forgotErrorMessage}
              initialEmail={initialForgotEmail}
            />
          ) : (
            <>
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
              <button
                type="button"
                className="forgot-password-link"
                onClick={handleShowForgotPassword}
                disabled={isLoading}
              >
                Forgot password?
              </button>
              <hr className="login-divider" />
              <GoogleSignInButton
                variant="modal"
                onCredential={handleGoogleCredential}
                onError={handleGoogleError}
                isLoading={isLoading}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

//login page
function LoginPage({
  onLogin,
  error,
  isLoading,
  onGoogleLogin,
  onAuthError,
  pendingTwoFactor,
  onVerifyTwoFactor,
  twoFactorError,
  isTwoFactorLoading,
  onCancelTwoFactor,
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const {
    submit: submitForgotPassword,
    statusMessage: forgotStatusMessage,
    errorMessage: forgotErrorMessage,
    isSubmitting: isForgotSubmitting,
    reset: resetForgotState,
  } = useForgotPasswordRequest()
  const isTwoFactorActive = Boolean(pendingTwoFactor?.challengeId)
  const isForgotPasswordActive = isForgotPassword && !isTwoFactorActive

  useEffect(() => {
    if (isTwoFactorActive) {
      resetForgotState()
      setIsForgotPassword(false)
    }
  }, [isTwoFactorActive, resetForgotState])

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

  const handleShowForgotPassword = () => {
    if (isTwoFactorActive) {
      return
    }
    resetForgotState()
    setIsForgotPassword(true)
    if (typeof onAuthError === 'function') {
      onAuthError(null)
    }
  }

  const handleReturnToLogin = () => {
    resetForgotState()
    setIsForgotPassword(false)
    if (typeof onCancelTwoFactor === 'function') {
      onCancelTwoFactor()
    }
  }

  const initialForgotEmail = identifier.includes('@') ? identifier : ''
  const maskedEmail = pendingTwoFactor?.email || ''

  return (
    <div className="login-page">
      <img
        src={YouMatterLogo}
        alt="YouMatter Logo"
      />
      <div className="login-page-content">
        <h2>
          {isTwoFactorActive
            ? 'Verify your identity'
            : isForgotPasswordActive
              ? 'Forgot your password'
              : 'Login'}
        </h2>
        {isTwoFactorActive ? (
          <TwoFactorForm
            variant="page"
            email={maskedEmail}
            onSubmit={(code) => onVerifyTwoFactor?.(pendingTwoFactor.challengeId, code)}
            onCancel={handleReturnToLogin}
            isLoading={isTwoFactorLoading}
            error={twoFactorError}
          />
        ) : isForgotPasswordActive ? (
          <ForgotPasswordForm
            onSubmit={submitForgotPassword}
            onCancel={handleReturnToLogin}
            isLoading={isForgotSubmitting}
            message={forgotStatusMessage}
            error={forgotErrorMessage}
            initialEmail={initialForgotEmail}
            variant="page"
          />
        ) : (
          <>
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
            <button
              type="button"
              className="forgot-password-link"
              onClick={handleShowForgotPassword}
              disabled={isLoading}
            >
              Forgot password?
            </button>
            <hr className="login-divider" />
            <GoogleSignInButton
              variant="page"
              onCredential={handleGoogleCredential}
              onError={handleGoogleError}
              isLoading={isLoading}
            />
          </>
        )}
      </div>
    </div>
  )
}

export { LoginModal, LoginPage }
