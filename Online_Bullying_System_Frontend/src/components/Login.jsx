import React, { useEffect, useRef, useState } from 'react';
import YouMatterLogo from '../assets/YouMatter_logo_bg_removed.png'; 
import GoogleLogo from '../assets/google_logo.png';
import { requestPasswordReset } from '../services/api';
import { evaluatePasswordRules, validateNewPassword } from '../utils/passwords';

const GOOGLE_SCRIPT_ID = 'google-identity-services';

const EyeIcon = ({ visible }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M1 12s4.5-7 11-7 11 7 11 7-4.5 7-11 7S1 12 1 12Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="12"
      cy="12"
      r="3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    {!visible && (
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);

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
  onSubmitCode,
  onSubmitPassword,
  onCancel,
  isLoading,
  error,
  message,
  variant = 'page',
  stage = 'code',
  requiresPasswordReset = false,
  passwordContext = {},
}) {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setLocalError('');
    if (stage === 'code') {
      setCode('');
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [stage]);

  const handleCodeChange = (event) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(nextValue);
    if (localError) {
      setLocalError('');
    }
  };

  const handleNewPasswordChange = (event) => {
    setNewPassword(event.target.value);
    if (localError) {
      setLocalError('');
    }
  };

  const handleConfirmPasswordChange = (event) => {
    setConfirmPassword(event.target.value);
    if (localError) {
      setLocalError('');
    }
  };

  const isPasswordStage = stage === 'password';
  const passwordRuleStatus = isPasswordStage
    ? evaluatePasswordRules(newPassword, passwordContext)
    : {};
  const passwordRules = isPasswordStage
    ? [
        { id: 'length', label: 'At least 8 characters.', met: passwordRuleStatus.length },
        {
          id: 'uppercase',
          label: 'At least one uppercase letter (A–Z).',
          met: passwordRuleStatus.uppercase,
        },
        {
          id: 'lowercase',
          label: 'At least one lowercase letter (a–z).',
          met: passwordRuleStatus.lowercase,
        },
        { id: 'digit', label: 'At least one number (0–9).', met: passwordRuleStatus.digit },
        {
          id: 'special',
          label: 'At least one special character',
          met: passwordRuleStatus.special,
        },
      ]
    : [];

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) {
      return;
    }
    if (isPasswordStage) {
      let validationMessage = validateNewPassword(newPassword, passwordContext);
      if (!validationMessage && newPassword !== confirmPassword) {
        validationMessage = 'Password confirmation does not match.';
      }
      if (validationMessage) {
        setLocalError(validationMessage);
        return;
      }
      setLocalError('');
      if (typeof onSubmitPassword === 'function') {
        await onSubmitPassword(newPassword, confirmPassword);
      }
      return;
    }

    if (!code || code.length !== 6) {
      setLocalError('Please enter the 6-digit verification code.');
      return;
    }
    setLocalError('');
    if (typeof onSubmitCode === 'function') {
      await onSubmitCode(code);
    }
  };

  const submitDisabled =
    isLoading ||
    (isPasswordStage
      ? !newPassword || !confirmPassword
      : code.length !== 6);

  const formClassName = `two-factor-form two-factor-form--${variant}`;

  return (
    <form onSubmit={handleSubmit} className={formClassName}>
      <div className="two-factor-copy">
        {isPasswordStage ? (
          <p>Create a new password to finish signing in.</p>
        ) : (
          <>
            <p>Enter the six-digit code we just sent to your email to finish signing in.</p>
            {email && (
              <p className="two-factor-email">
                Code sent to <strong>{email}</strong>.
              </p>
            )}
            {requiresPasswordReset && (
              <p className="two-factor-email">
                After verifying the code, you’ll be prompted to set a new password.
              </p>
            )}
          </>
        )}
      </div>

      {message && (
        <p className="login-success" role="status">
          {message}
        </p>
      )}

      {isPasswordStage ? (
        <div className="reset-row">
          <div className="reset-col">
            <label className="form-label">New Password</label>
            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={handleNewPasswordChange}
                required
                className="form-input"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-pressed={showNewPassword}
                aria-label={`${showNewPassword ? 'Hide' : 'Show'} new password`}
                disabled={isLoading}
              >
                <EyeIcon visible={showNewPassword} />
              </button>
            </div>
            <ul className="password-rules">
              {passwordRules.map((rule) => (
                <li
                  key={rule.id}
                  className={`password-rule${rule.met ? ' password-rule--met' : ''}`}
                >
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="reset-col">
            <label className="form-label">Confirm Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                required
                className="form-input"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-pressed={showConfirmPassword}
                aria-label={`${showConfirmPassword ? 'Hide' : 'Show'} password confirmation`}
                disabled={isLoading}
              >
                <EyeIcon visible={showConfirmPassword} />
              </button>
            </div>
          </div>
        </div>
      ) : (
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
      )}

      <div className="two-factor-actions">
        <button className="two-factor-submit" type="submit" disabled={submitDisabled}>
          {isLoading
            ? isPasswordStage
              ? 'Saving...'
              : 'Verifying...'
            : isPasswordStage
              ? 'Set password'
              : 'Verify code'}
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
      {(localError || error) && (
        <p className="login-error" role="alert">
          {localError || error}
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
  onVerifyTwoFactorCode,
  onCompleteTwoFactorPassword,
  twoFactorError,
  twoFactorMessage,
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
  const isAwaitingPasswordReset = Boolean(pendingTwoFactor?.passwordResetToken)
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
              stage={isAwaitingPasswordReset ? 'password' : 'code'}
              message={twoFactorMessage}
              requiresPasswordReset={Boolean(pendingTwoFactor?.requiresPasswordReset)}
              passwordContext={{
                email:
                  pendingTwoFactor?.identifier && pendingTwoFactor.identifier.includes('@')
                    ? pendingTwoFactor.identifier
                    : '',
                username: pendingTwoFactor?.identifier || identifier,
              }}
              onSubmitCode={(code) =>
                onVerifyTwoFactorCode?.(pendingTwoFactor?.challengeId, code)
              }
              onSubmitPassword={(newPassword, confirmPassword) =>
                onCompleteTwoFactorPassword?.(
                  pendingTwoFactor?.passwordResetToken,
                  newPassword,
                  confirmPassword
                )
              }
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
                  Email:
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
  onVerifyTwoFactorCode,
  onCompleteTwoFactorPassword,
  twoFactorError,
  twoFactorMessage,
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
  const isAwaitingPasswordReset = Boolean(pendingTwoFactor?.passwordResetToken)
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
            stage={isAwaitingPasswordReset ? 'password' : 'code'}
            message={twoFactorMessage}
            requiresPasswordReset={Boolean(pendingTwoFactor?.requiresPasswordReset)}
            passwordContext={{
              email:
                pendingTwoFactor?.identifier && pendingTwoFactor.identifier.includes('@')
                  ? pendingTwoFactor.identifier
                  : '',
              username: pendingTwoFactor?.identifier || identifier,
            }}
            onSubmitCode={(code) =>
              onVerifyTwoFactorCode?.(pendingTwoFactor?.challengeId, code)
            }
            onSubmitPassword={(newPassword, confirmPassword) =>
              onCompleteTwoFactorPassword?.(
                pendingTwoFactor?.passwordResetToken,
                newPassword,
                confirmPassword
              )
            }
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
                  Email:
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
