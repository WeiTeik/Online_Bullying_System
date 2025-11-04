import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUser,
  uploadUserAvatar,
  deleteUserAvatar,
  changeUserPassword,
  toAbsoluteUrl,
  updateUser,
} from '../services/api';
import {
  validateNewPassword,
  getPasswordRuleChecklist,
} from '../utils/passwords';
import EyeIcon from './EyeIcon';

const MAX_AVATAR_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatStatusLabel = (status = '') => {
  const raw = (status || '').toString().trim();
  if (!raw) return 'Pending';
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'new' || normalized === 'pending') return 'Pending';
  if (normalized === 'in_progress' || normalized === 'investigating') return 'Investigating';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

function StudentProfilePage({
  complaints = [],
  showHistory = true,
  currentUser,
  onUserUpdate,
  onLogout,
  allowNameEdit = false,
}) {
  const [activeTab, setActiveTab] = useState('account');
  const [showReset, setShowReset] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [avatarMessage, setAvatarMessage] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [avatarBusyMessage, setAvatarBusyMessage] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState(null);
  const [nameError, setNameError] = useState(null);
  const fileInputRef = useRef(null);
  const avatarMenuRef = useRef(null);
  const navigate = useNavigate();

  const passwordContext = {
    fullName: user?.full_name || currentUser?.full_name,
    email: user?.email || currentUser?.email,
    username: user?.username || currentUser?.username,
  };

  const passwordRules = getPasswordRuleChecklist(newPassword, passwordContext);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    let isMounted = true;

    const loadProfile = async () => {
      try {
        setIsLoadingProfile(true);
        setProfileError(null);

        if (!currentUser.id) {
          if (isMounted) {
            setUser(currentUser);
            setIsLoadingProfile(false);
          }
          return;
        }

        const data = await getUser(currentUser.id);
        if (isMounted) {
          setUser(data);
          if (onUserUpdate) {
            onUserUpdate({ ...currentUser, ...data });
          }
        }
      } catch (err) {
        if (isMounted) {
          setProfileError('Unable to load full profile. Showing basic account info.');
          setUser(currentUser);
        }
      } finally {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, navigate, onUserUpdate]);

  useEffect(() => {
    if (!allowNameEdit) {
      return;
    }
    if (!user) {
      setNameValue('');
      return;
    }
    setNameValue(user.full_name || '');
    setNameMessage(null);
    setNameError(null);
  }, [allowNameEdit, user]);

  useEffect(() => {
    if (!showAvatarMenu) return;
    const handleClickOutside = (event) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarMenu]);

  useEffect(() => {
    if (!showReset) {
      setResetMsg('');
      setResetError(null);
      setIsResetting(false);
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [showReset]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mql = window.matchMedia('(max-width: 768px)');
    const handleChange = (event) => {
      setIsMobile(event.matches);
    };
    // set initial state
    setIsMobile(mql.matches);
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handleChange);
      return () => mql.removeEventListener('change', handleChange);
    }
    if (typeof mql.addListener === 'function') {
      mql.addListener(handleChange);
      return () => mql.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const handleNavigation = (target) => {
    if (target === 'account') {
      setActiveTab('account');
      setShowReset(false);
      return;
    }
    if (target === 'reset') {
      setActiveTab('account');
      setShowReset(true);
      return;
    }
    if (target === 'history') {
      setActiveTab('history');
      setShowReset(false);
    }
  };

  const isAccountView = activeTab === 'account' && !showReset;
  const isResetView = activeTab === 'account' && showReset;
  const isHistoryView = activeTab === 'history';
  const handleMobileLogout = () => {
    if (typeof onLogout === 'function') {
      onLogout();
    }
  };

  const handleNameChange = (event) => {
    if (!allowNameEdit) {
      return;
    }
    setNameValue(event.target.value);
    if (nameError) {
      setNameError(null);
    }
    if (nameMessage) {
      setNameMessage(null);
    }
  };

  const handleNameSubmit = async (event) => {
    event.preventDefault();
    if (!allowNameEdit) {
      return;
    }
    if (!currentUser?.id) {
      setNameError('Unable to verify your account. Please log in again.');
      return;
    }

    const trimmedName = nameValue.trim();
    if (!trimmedName) {
      setNameError('Name cannot be empty.');
      return;
    }

    const currentFullName = (user?.full_name || '').trim();
    if (trimmedName === currentFullName) {
      setNameMessage('No changes to save.');
      return;
    }

    try {
      setIsSavingName(true);
      setNameError(null);
      setNameMessage(null);
      const updatedUser = await updateUser(currentUser.id, { full_name: trimmedName });
      setUser(updatedUser);
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      setNameValue(trimmedName);
      setNameMessage('Name updated successfully.');
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to update name. Please try again.';
      setNameError(message);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setResetMsg('');
    setResetError(null);

    if (newPassword !== confirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    if (newPassword === oldPassword) {
      setResetError('New password must be different from the old password.');
      return;
    }

    const validationError = validateNewPassword(newPassword, passwordContext);
    if (validationError) {
      setResetError(validationError);
      return;
    }

    if (!currentUser?.id) {
      setResetError('Unable to verify your account. Please log in again.');
      return;
    }

    try {
      setIsResetting(true);
      const response = await changeUserPassword(currentUser.id, {
        old_password: oldPassword,
        new_password: newPassword,
      });
      const message = response?.message || 'Password reset successful.';
      setResetMsg(message);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to reset password. Please try again.';
      setResetError(message);
    } finally {
      setIsResetting(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  const handleAvatarChange = (event) => {
    const fileInput = event.target;
    const file = fileInput.files && fileInput.files[0];
    if (!file || !currentUser?.id) return;

    setShowAvatarMenu(false);
    setAvatarError(null);
    setAvatarMessage(null);

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (PNG, JPG, GIF, WEBP).');
      fileInput.value = '';
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('Please choose an image smaller than 4 MB.');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      try {
        setIsUploadingAvatar(true);
        setAvatarBusyMessage('Uploading photo...');
        setAvatarError(null);
        setAvatarMessage(null);
        const updatedUser = await uploadUserAvatar(currentUser.id, base64Data);
        setUser(updatedUser);
        if (onUserUpdate) {
          onUserUpdate(updatedUser);
        }
        setAvatarMessage('Profile photo updated successfully.');
      } catch (err) {
        setAvatarError(
          err?.response?.data?.error || 'Failed to update profile photo. Please try again.'
        );
      } finally {
        setIsUploadingAvatar(false);
        setAvatarBusyMessage(null);
        fileInput.value = '';
      }
    };
    reader.onerror = () => {
      setAvatarError('Could not read selected file.');
      setAvatarMessage(null);
      fileInput.value = '';
    };
    reader.readAsDataURL(file);
  };

  const triggerAvatarUpload = () => {
    if (isUploadingAvatar) return;
    setShowAvatarMenu(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleAvatarButtonClick = () => {
    if (isUploadingAvatar) return;
    if (user?.avatar_url) {
      setShowAvatarMenu((prev) => !prev);
    } else {
      triggerAvatarUpload();
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUser?.id) return;
    try {
      setIsUploadingAvatar(true);
      setAvatarBusyMessage('Removing photo...');
      setAvatarError(null);
      setAvatarMessage(null);
      const updatedUser = await deleteUserAvatar(currentUser.id);
      setUser(updatedUser);
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      setAvatarMessage('Profile photo removed.');
    } catch (err) {
      setAvatarError(
        err?.response?.data?.error || 'Failed to remove profile photo. Please try again.'
      );
    } finally {
      setIsUploadingAvatar(false);
      setAvatarBusyMessage(null);
      setShowAvatarMenu(false);
    }
  };

  const avatarSrc = user?.avatar_url ? toAbsoluteUrl(user.avatar_url) : null;
  const displayName = user?.full_name || user?.username || 'Student';
  const savedFullName = (user?.full_name || '').trim();
  const normalizedNameValue = nameValue.trim();
  const isNameUnchanged = normalizedNameValue === savedFullName;
  const displayEmail = user?.email || 'Not available';
  const avatarLabelSource = (displayName || displayEmail || '').trim() || 'User';
  const avatarInitial = avatarLabelSource.charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      {isMobile && (
        <div className="profile-tabs-mobile" role="tablist" aria-label="Profile sections">
          <button
            type="button"
            className={`profile-tabs-mobile__button${isAccountView ? ' is-active' : ''}`}
            onClick={() => handleNavigation('account')}
            aria-pressed={isAccountView}
          >
            Account
          </button>
          <button
            type="button"
            className={`profile-tabs-mobile__button${isResetView ? ' is-active' : ''}`}
            onClick={() => handleNavigation('reset')}
            aria-pressed={isResetView}
          >
            Reset Password
          </button>
          {showHistory && (
            <button
              type="button"
              className={`profile-tabs-mobile__button${isHistoryView ? ' is-active' : ''}`}
              onClick={() => handleNavigation('history')}
              aria-pressed={isHistoryView}
            >
              History
            </button>
          )}
        </div>
      )}
      <div className="profile-card">
        {/* Sidebar */}
        <div className={`profile-sidebar${isMobile ? ' is-hidden-mobile' : ''}`}>
          <div
            onClick={() => handleNavigation('account')}
            className={`sidebar-item ${isAccountView ? 'active' : ''}`}
          >
            My Account
          </div>

          <div
            onClick={() => handleNavigation('reset')}
            className={`sidebar-subitem ${isResetView ? 'active' : ''}`}
          >
            Reset Password
          </div>

          {showHistory && (
            <div
              onClick={() => handleNavigation('history')}
              className={`sidebar-item history ${isHistoryView ? 'active' : ''}`}
            >
              History Complaint
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="profile-main">
          {isLoadingProfile && (
            <div className="profile-status">Loading profile...</div>
          )}
          {profileError && !isLoadingProfile && (
            <div className="profile-error">{profileError}</div>
          )}

          {isAccountView && (
            <>
              <h1 className="profile-title">Profile</h1>

              <div className="profile-section-card">
                <div className="profile-top">
                  {/* Avatar */}
                  <div className="avatar-wrapper">
                    {avatarSrc ? (
                      <img
                        src={avatarSrc}
                        alt="avatar"
                        className="avatar-img"
                      />
                    ) : (
                      <div className="avatar-fallback" aria-hidden="true">
                        {avatarInitial}
                      </div>
                    )}
                    <div className="avatar-control" ref={avatarMenuRef}>
                      <button
                        type="button"
                        className="avatar-upload-button"
                        onClick={handleAvatarButtonClick}
                        disabled={isUploadingAvatar}
                        aria-haspopup="true"
                        aria-expanded={showAvatarMenu}
                        aria-label={user?.avatar_url ? 'Change profile photo' : 'Upload profile photo'}
                      >
                        <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24">
                          <path d="M12 5.9c-3.37 0-6.1 2.73-6.1 6.1s2.73 6.1 6.1 6.1 6.1-2.73 6.1-6.1-2.73-6.1-6.1-6.1zm0 10.2c-2.26 0-4.1-1.84-4.1-4.1s1.84-4.1 4.1-4.1 4.1 1.84 4.1 4.1-1.84 4.1-4.1 4.1z"/>
                        </svg>
                      </button>
                      <input
                        ref={fileInputRef}
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        style={{ display: "none" }}
                      />
                      {showAvatarMenu && user?.avatar_url && (
                        <div className="avatar-options-menu">
                          <button
                            type="button"
                            onClick={triggerAvatarUpload}
                            disabled={isUploadingAvatar}
                          >
                            Upload Photo
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            disabled={isUploadingAvatar}
                          >
                            Remove Photo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="avatar-status-container">
                    {isUploadingAvatar && (
                      <p className="avatar-status">{avatarBusyMessage || 'Updating photo...'}</p>
                    )}
                    {!isUploadingAvatar && avatarMessage && (
                      <p className="avatar-status success">{avatarMessage}</p>
                    )}
                    {!isUploadingAvatar && avatarError && (
                      <p className="avatar-status error">{avatarError}</p>
                    )}
                  </div>

                  {/* Info block */}
                  <div className="info-block">
                    <div className="info-row">
                      <span className="info-label">Name</span>
                      {allowNameEdit ? (
                        <form className="info-editable" onSubmit={handleNameSubmit}>
                          <input
                            type="text"
                            value={nameValue}
                            onChange={handleNameChange}
                            className="info-input"
                            disabled={isSavingName}
                            placeholder="Enter your name"
                          />
                          <button
                            type="submit"
                            className="info-save-button"
                            disabled={
                              isSavingName || !normalizedNameValue || isNameUnchanged
                            }
                          >
                            {isSavingName ? 'Saving...' : 'Save'}
                          </button>
                        </form>
                      ) : (
                        <input
                          type="text"
                          value={displayName}
                          disabled
                          className="info-input"
                        />
                      )}
                    </div>

                    <div className="info-row">
                      <span className="info-label">Email</span>
                      <input
                        type="text"
                        value={displayEmail}
                        disabled
                        className="info-input"
                      />
                    </div>

                    {allowNameEdit && (nameError || nameMessage) && (
                      <div
                        className={`info-feedback${
                          nameError ? ' info-feedback--error' : ' info-feedback--success'
                        }`}
                        role="status"
                      >
                        {nameError || nameMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {isResetView && (
            <div className="reset-container profile-section-card">
              <h2 className="reset-title">Reset Password</h2>
              <form onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Old Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      required
                      className="form-input"
                      disabled={isResetting}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowOldPassword(prev => !prev)}
                      aria-label={`${showOldPassword ? 'Hide' : 'Show'} old password`}
                      aria-pressed={showOldPassword}
                      disabled={isResetting}
                    >
                      <EyeIcon visible={showOldPassword} />
                    </button>
                  </div>
                </div>

                <div className="reset-row">
                  <div className="reset-col">
                    <label className="form-label">New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        className="form-input"
                        disabled={isResetting}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowNewPassword(prev => !prev)}
                        aria-label={`${showNewPassword ? 'Hide' : 'Show'} new password`}
                        aria-pressed={showNewPassword}
                        disabled={isResetting}
                      >
                        <EyeIcon visible={showNewPassword} />
                      </button>
                    </div>
                    <ul className="password-rules">
                      {passwordRules.map(rule => (
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
                    <label className="form-label">Confirm</label>
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        className="form-input"
                        disabled={isResetting}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        aria-label={`${showConfirmPassword ? 'Hide' : 'Show'} password confirmation`}
                        aria-pressed={showConfirmPassword}
                        disabled={isResetting}
                      >
                        <EyeIcon visible={showConfirmPassword} />
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className="reset-submit" disabled={isResetting}>
                  {isResetting ? 'Updating...' : 'Submit'}
                </button>

                {resetError && <div className="reset-error">{resetError}</div>}
                {resetMsg && <div className="reset-msg">{resetMsg}</div>}
              </form>
            </div>
          )}

          {showHistory && isHistoryView && (
            <div className="history-container profile-section-card">
              <h2 className="history-title">History Complaint</h2>
              {complaints.length === 0 ? (
                <div className="no-complaints">No complaints submitted yet.</div>
              ) : (
                <ul className="history-list">
                  {complaints.map((c) => {
                    const submittedAt = c.submitted_at || c.submittedAt;
                    const statusValue = c.status || c.status_label || c.statusLabel;
                    const statusLabel = formatStatusLabel(statusValue);
                    return (
                      <li key={c.id} className="history-item">
                        <div className="history-content">
                          <div className="history-field"><strong>Status:</strong> {statusLabel}</div>
                          <div className="history-field"><strong>Date:</strong> {formatDateTime(submittedAt)}</div>
                          <div className="history-field history-description"><strong>Description:</strong> {c.description}</div>
                        </div>
                        <div className="history-actions">
                          <button
                            type="button"
                            className="history-view-button"
                            onClick={() => navigate('/status', { state: { complaintId: c.id } })}
                          >
                            View
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {isMobile && typeof onLogout === 'function' && (
            <button
              type="button"
              className="profile-mobile-logout"
              onClick={handleMobileLogout}
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentProfilePage;
