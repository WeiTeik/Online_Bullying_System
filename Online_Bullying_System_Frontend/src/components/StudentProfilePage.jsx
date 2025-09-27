import React, { useState } from 'react';

const mockUser = {
  name: "Ramon Ridwan",
  studentId: "P20012847",
  email: "Ramonridwan@protonmail.com",
  avatar: "" // leave empty to use placeholder
};

function StudentProfilePage({ complaints = [], showHistory = true }) {
  const [activeTab, setActiveTab] = useState('account');
  const [showReset, setShowReset] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [user, setUser] = useState(mockUser);

  const handleReset = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setResetMsg('New passwords do not match.');
      return;
    }
    setResetMsg('Password reset successful.');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowReset(false);
  };

  const avatarSrc = user.avatar || 'https://via.placeholder.com/160?text=Avatar';

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Sidebar */}
        <div className="profile-sidebar">
          <div
            onClick={() => { setActiveTab('account'); setShowReset(false); }}
            className={`sidebar-item ${activeTab === 'account' && !showReset ? 'active' : ''}`}
          >
            My Account
          </div>

          <div
            onClick={() => { setActiveTab('account'); setShowReset(true); }}
            className={`sidebar-subitem ${showReset ? 'active' : ''}`}
          >
            Reset Password
          </div>

          {showHistory && (
            <div
              onClick={() => { setActiveTab('history'); setShowReset(false); }}
              className={`sidebar-item history ${activeTab === 'history' ? 'active' : ''}`}
            >
              History Complaint
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="profile-main">
          {activeTab === 'account' && !showReset && (
            <>
              <h1 className="profile-title">Profile</h1>

              <div className="profile-top">
                {/* Avatar */}
                <div className="avatar-wrapper">
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="avatar-img"
                  />
                  <label htmlFor="avatar-upload" className="avatar-upload-button">
                    <svg width="16" height="16" fill="#fff" viewBox="0 0 24 24">
                      <path d="M12 5.9c-3.37 0-6.1 2.73-6.1 6.1s2.73 6.1 6.1 6.1 6.1-2.73 6.1-6.1-2.73-6.1-6.1-6.1zm0 10.2c-2.26 0-4.1-1.84-4.1-4.1s1.84-4.1 4.1-4.1 4.1 1.84 4.1 4.1-1.84 4.1-4.1 4.1z"/>
                    </svg>
                    <input id="avatar-upload" type="file" accept="image/*" style={{ display: "none" }} />
                  </label>
                </div>

                {/* Info block */}
                <div className="info-block">
                  <div className="info-row">
                    <span className="info-label">Name</span>
                    <input
                      type="text"
                      value={user.name}
                      disabled
                      className="info-input"
                    />
                  </div>

                  <div className="info-row">
                    <span className="info-label">Student ID</span>
                    <input
                      type="text"
                      value={user.studentId || ''}
                      disabled
                      className="info-input"
                    />
                  </div>

                  <div className="info-row">
                    <span className="info-label">Email</span>
                    <input
                      type="text"
                      value={user.email}
                      disabled
                      className="info-input"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'account' && showReset && (
            <div className="reset-container">
              <h2 className="reset-title">Reset Password</h2>
              <form onSubmit={handleReset}>
                <div className="form-group">
                  <label className="form-label">Old Password</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="reset-row">
                  <div className="reset-col">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                  <div className="reset-col">
                    <label className="form-label">Confirm</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                <button type="submit" className="reset-submit">Submit</button>

                {resetMsg && <div className="reset-msg">{resetMsg}</div>}
              </form>
            </div>
          )}

          {showHistory && activeTab === 'history' && (
            <div className="history-container">
              <h2 className="history-title">History Complaint</h2>
              {complaints.length === 0 ? (
                <div className="no-complaints">No complaints submitted yet.</div>
              ) : (
                <ul className="history-list">
                  {complaints.map((c) => (
                    <li key={c.id} className="history-item">
                      <div className="history-field"><strong>Title:</strong> {c.title || 'No Title'}</div>
                      <div className="history-field"><strong>Status:</strong> {c.status}</div>
                      <div className="history-field"><strong>Date:</strong> {c.submittedAt}</div>
                      <div className="history-field" style={{ whiteSpace: "pre-wrap" }}><strong>Description:</strong> {c.description}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StudentProfilePage;