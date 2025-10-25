import React, { useEffect, useMemo, useRef, useState } from 'react';
import './admin.css';
import {
  getUsers,
  inviteAdmin as inviteAdminApi,
  updateUser as updateUserApi,
  deleteUser as deleteUserApi,
  toAbsoluteUrl,
} from '../../services/api';

const ADMINS_PER_PAGE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

const roleKey = (role) => (role || '').toUpperCase();
const hasAdminRole = (role) => ADMIN_ROLES.has(roleKey(role));
const normaliseStatus = (status) => (status || '').toLowerCase();

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const getDisplayName = (admin) =>
  admin?.full_name || admin?.username || admin?.email || 'Admin';

const sortAdmins = (list) => {
  const roleWeight = (role) => (roleKey(role) === 'SUPER_ADMIN' ? 0 : 1);
  const statusWeight = (status) => (normaliseStatus(status) === 'pending' ? 0 : 1);
  return [...list].sort((a, b) => {
    const roleDelta = roleWeight(a.role) - roleWeight(b.role);
    if (roleDelta !== 0) {
      return roleDelta;
    }
    const statusDelta = statusWeight(a.status) - statusWeight(b.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return getDisplayName(a).localeCompare(getDisplayName(b));
  });
};

const AdminMembers = ({ currentUser }) => {
  const [admins, setAdmins] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('ADMIN');
  const [addError, setAddError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addResult, setAddResult] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('ADMIN');
  const [editError, setEditError] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [removeModal, setRemoveModal] = useState(null);
  const [removeInput, setRemoveInput] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState({});

  const currentRole = roleKey(currentUser?.role);
  const isSuperAdmin = currentRole === 'SUPER_ADMIN';

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) {
      return;
    }
    hasFetchedRef.current = true;
    let isActive = true;
    const fetchAdmins = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await getUsers();
        if (!isActive) return;
        const userList = Array.isArray(data) ? data : [];
        const adminList = sortAdmins(
          userList.filter((user) => hasAdminRole(user.role))
        );
        setAdmins(adminList);
      } catch (err) {
        if (!isActive) return;
        const message =
          err?.response?.data?.error ||
          err?.message ||
          'Unable to load administrators.';
        setLoadError(message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchAdmins();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredAdmins = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return admins;
    }
    return admins.filter((admin) => {
      const name = (admin.full_name || '').toLowerCase();
      const username = (admin.username || '').toLowerCase();
      const email = (admin.email || '').toLowerCase();
      const role = roleKey(admin.role).toLowerCase();
      return (
        name.includes(term) ||
        username.includes(term) ||
        email.includes(term) ||
        role.includes(term)
      );
    });
  }, [admins, search]);

  const totalPages = Math.ceil(filteredAdmins.length / ADMINS_PER_PAGE);
  const paginatedAdmins = filteredAdmins.slice(
    (currentPage - 1) * ADMINS_PER_PAGE,
    currentPage * ADMINS_PER_PAGE
  );

  const pendingCount = admins.filter(
    (admin) => normaliseStatus(admin.status) === 'pending'
  ).length;

const resetAddForm = () => {
  setAddName('');
  setAddEmail('');
  setAddRole('ADMIN');
  setAddError('');
};

const handleAddAdmin = async () => {
  const trimmedName = addName.trim();
  const trimmedEmail = addEmail.trim().toLowerCase();
  const roleValue = roleKey(addRole) === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

  if (!trimmedName) {
    setAddError('Administrator name is required.');
    return;
  }
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    setAddError('Please enter a valid email address.');
    return;
  }

  setAddError('');
  setIsAdding(true);

  try {
    const response = await inviteAdminApi({
      full_name: trimmedName,
      email: trimmedEmail,
      role: roleValue,
    });
    const newAdmin = response?.admin;
    const temporaryPassword = response?.temporary_password;

    if (!newAdmin) {
      setAddError('Invitation response was empty. Please try again.');
      return;
    }

    setAdmins((prev) =>
      sortAdmins([
        newAdmin,
        ...prev.filter((admin) => admin.id !== newAdmin.id),
      ])
    );

    setCurrentPage(1);
    setAddResult({
      name: getDisplayName(newAdmin),
      email: newAdmin.email,
      username: newAdmin.username,
      password: temporaryPassword,
      role: roleKey(newAdmin.role),
    });
    setShowAddModal(false);
    resetAddForm();
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      'Unable to create administrator. Please try again.';
    setAddError(message);
  } finally {
    setIsAdding(false);
  }
};

const openEditModal = (admin) => {
  if (!isSuperAdmin) return;
  setEditModal(admin);
  setEditName(admin.full_name || admin.username || '');
  setEditEmail(admin.email || '');
  setEditRole(roleKey(admin.role) === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN');
  setEditError('');
};

const closeEditModal = () => {
  setEditModal(null);
  setEditName('');
  setEditEmail('');
  setEditRole('ADMIN');
  setEditError('');
  setIsEditSaving(false);
};

const handleSaveEdit = async () => {
  if (!editModal) return;
  const trimmedName = editName.trim();
  const trimmedEmail = editEmail.trim().toLowerCase();
  const roleValue = roleKey(editRole) === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

  if (!trimmedName) {
    setEditError('Administrator name cannot be empty.');
    return;
  }
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    setEditError('Please enter a valid email address.');
    return;
  }

  setEditError('');
  setIsEditSaving(true);
  try {
    const updated = await updateUserApi(editModal.id, {
      full_name: trimmedName,
      email: trimmedEmail,
      role: roleValue,
    });
    setAdmins((prev) =>
      sortAdmins(
        prev.map((admin) =>
          admin.id === updated.id ? { ...admin, ...updated } : admin
        )
      )
    );
    closeEditModal();
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      'Unable to update administrator. Please try again.';
    setEditError(message);
    setIsEditSaving(false);
  }
};

const openRemoveModal = (admin) => {
  if (!isSuperAdmin || !admin) return;
  if (admin.id === currentUser?.id) {
    return;
  }
  const code = String(Math.floor(1000 + Math.random() * 9000));
  setRemoveModal({ admin, code });
  setRemoveInput('');
  setRemoveError('');
  setIsRemoving(false);
};

const closeRemoveModal = () => {
  setRemoveModal(null);
  setRemoveInput('');
  setRemoveError('');
  setIsRemoving(false);
};

const handleConfirmRemove = async () => {
  if (!removeModal) return;
  if (removeInput.trim() !== removeModal.code) {
    setRemoveError('Verification code does not match.');
    return;
  }
  setIsRemoving(true);
  try {
    await deleteUserApi(removeModal.admin.id);
    setAdmins((prev) =>
      sortAdmins(
        prev.filter((admin) => admin.id !== removeModal.admin.id)
      )
    );
    closeRemoveModal();
  } catch (err) {
    const message =
      err?.response?.data?.error ||
      err?.message ||
      'Unable to remove administrator. Please try again.';
    setRemoveError(message);
    setIsRemoving(false);
  }
};

const handlePageChange = (page) => {
  if (page >= 1 && page <= totalPages) {
    setCurrentPage(page);
  }
};

const getAvatarKey = (entity) => {
  const idPart = entity?.id != null ? String(entity.id) : '';
  const avatarPart = entity?.avatar_url || '';
  return `${idPart}|${avatarPart}`;
};

const handleAvatarError = (key) => {
  if (!key) return;
  setFailedAvatars((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
};

const renderAvatar = (admin) => {
  const displayName = getDisplayName(admin);
  const avatarUrl = toAbsoluteUrl(admin.avatar_url);
  const avatarKey = getAvatarKey(admin);
  const hasFailed = avatarKey && failedAvatars[avatarKey];
  const initial = (displayName || 'A').trim().charAt(0).toUpperCase();
  if (avatarUrl && !hasFailed) {
    return (
      <img
        src={avatarUrl}
        alt={displayName}
        className="student-avatar"
        onError={() => handleAvatarError(avatarKey)}
      />
    );
  }
  return (
    <div className="student-avatar student-avatar-fallback" aria-hidden="true">
      {initial || 'A'}
    </div>
  );
};

  const renderContent = () => {
    if (isLoading) {
      return <div className="student-placeholder">Loading administrators…</div>;
    }
    if (loadError) {
      return (
        <div className="student-placeholder student-placeholder-error">
          {loadError}
        </div>
      );
    }
    if (filteredAdmins.length === 0) {
      return <div className="student-placeholder">No administrators found.</div>;
    }
    return paginatedAdmins.map((admin) => {
      const displayName = getDisplayName(admin);
      const email = admin.email || '—';
      const roleLabel =
        roleKey(admin.role) === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin';
      const status = normaliseStatus(admin.status);
      const isPending = status === 'pending';
      const invitedAt = formatDate(admin.invited_at);
      const lastLogin = formatDate(admin.last_login_at);
      const isSelf = admin.id === currentUser?.id;

      return (
        <div
          key={admin.id || `${email}-${displayName}`}
          className={`student-row${isPending ? ' pending' : ''}`}
        >
          {renderAvatar(admin)}
          <div className="student-info">
            <div className="student-name-row">
              <div className="student-name">{displayName}</div>
              <span className="student-status-tag">{roleLabel}</span>
              {isPending && (
                <span className="student-status-tag pending">Pending</span>
              )}
            </div>
            <div className="student-email">{email}</div>
            <div className="student-meta">
              {admin.username && (
                <span className="student-meta-item">
                  Username: {admin.username}
                </span>
              )}
              {isPending && invitedAt && (
                <span className="student-meta-item">Invited {invitedAt}</span>
              )}
              {!isPending && lastLogin && (
                <span className="student-meta-item">Last login {lastLogin}</span>
              )}
              {status && !isPending && (
                <span className="student-meta-item">
                  Status: {status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
          {isSuperAdmin && (
            <div className="student-actions">
              <button
                type="button"
                className="student-action-button edit"
                onClick={() => openEditModal(admin)}
                title="Edit administrator"
              >
                <span className="student-action-icon" aria-hidden="true">
                  ✏️
                </span>
                <span className="visually-hidden">Edit</span>
              </button>
              <button
                type="button"
                className="student-action-button remove"
                onClick={() => openRemoveModal(admin)}
                title={
                  isSelf
                    ? 'You cannot remove your own administrator account'
                    : 'Remove administrator'
                }
                disabled={isSelf}
              >
                <span className="student-action-icon" aria-hidden="true">
                  🗑️
                </span>
                <span className="visually-hidden">Remove</span>
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="admin-students-bg">
      <div className="admin-students-container">
        <div className="admin-students-header">
          <div>
            <h2 className="admin-students-title">Administrators</h2>
            <div className="admin-students-subtitle">
              {pendingCount > 0
                ? `${pendingCount} admin${
                    pendingCount === 1 ? ' is' : 's are'
                  } pending activation.`
                : 'All administrators are active.'}
            </div>
            {!isSuperAdmin && (
              <div className="admin-students-subtitle">
                You have read-only access to administrator details.
              </div>
            )}
          </div>
          <div className="admin-students-actions">
            <div className="admin-students-search">
              <span className="admin-students-search-icon">&#128269;</span>
              <input
                type="text"
                placeholder="Search administrator"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-students-search-input"
              />
            </div>
            {isSuperAdmin && (
              <button
                className="admin-students-add-btn"
                onClick={() => {
                  resetAddForm();
                  setShowAddModal(true);
                }}
              >
                <span className="admin-students-add-icon">+</span>
                Add Admin
              </button>
            )}
          </div>
        </div>

        {addResult && (
          <div className="admin-feedback success" role="status">
            <strong>Administrator created.</strong>{' '}
            {addResult.name} has been added as a{' '}
            {addResult.role === 'SUPER_ADMIN'
              ? 'super administrator'
              : 'administrator'}
            .
            {addResult.username && (
              <div className="admin-feedback-password">
                Username: <code>{addResult.username}</code>
              </div>
            )}
            {addResult.password && (
              <div className="admin-feedback-password">
                Temporary password: <code>{addResult.password}</code>
              </div>
            )}
            <button
              type="button"
              className="admin-feedback-dismiss"
              onClick={() => setAddResult(null)}
            >
              &times;
            </button>
          </div>
        )}

        <div className="admin-students-table student-table-scroll">
          <div className="admin-students-table-header">
            <div className="admin-students-table-header-count">
              {filteredAdmins.length} Administrators
            </div>
          </div>
          <div>{renderContent()}</div>
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`pagination-btn${
                  currentPage === i + 1 ? ' pagination-btn-active' : ''
                }`}
                onClick={() => handlePageChange(i + 1)}
                aria-current={currentPage === i + 1 ? 'page' : undefined}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}

        {showAddModal && isSuperAdmin && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add Admin</h3>
              <p>Provide the administrator details to create their account.</p>
              <input
                type="text"
                className="admin-modal-input"
                placeholder="Full Name"
                value={addName}
                onChange={(e) => {
                  setAddName(e.target.value);
                  setAddError('');
                }}
                disabled={isAdding}
              />
              <input
                type="email"
                className="admin-modal-input"
                placeholder="admin@email.com"
                value={addEmail}
                onChange={(e) => {
                  setAddEmail(e.target.value);
                  setAddError('');
                }}
                disabled={isAdding}
              />
              <select
                className="admin-modal-input"
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                disabled={isAdding}
              >
                <option value="ADMIN">Administrator</option>
                <option value="SUPER_ADMIN">Super Administrator</option>
              </select>
              {addError && <div className="modal-error">{addError}</div>}
              <div className="modal-info">
                A username and temporary password will be generated
                automatically. Share the credentials securely with the
                administrator.
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setShowAddModal(false);
                    resetAddForm();
                  }}
                  disabled={isAdding}
                >
                  Cancel
                </button>
                <button
                  className="admin-students-add-btn modal-process-btn"
                  onClick={handleAddAdmin}
                  disabled={isAdding}
                >
                  {isAdding ? 'Processing…' : 'Process'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editModal && isSuperAdmin && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Edit Admin Info</h3>
              <input
                type="text"
                className="admin-modal-input"
                placeholder="Full Name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError('');
                }}
                disabled={isEditSaving}
              />
              <input
                type="email"
                className="admin-modal-input"
                placeholder="admin@email.com"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  setEditError('');
                }}
                disabled={isEditSaving}
              />
              <select
                className="admin-modal-input"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                disabled={isEditSaving}
              >
                <option value="ADMIN">Administrator</option>
                <option value="SUPER_ADMIN">Super Administrator</option>
              </select>
              {editError && <div className="modal-error">{editError}</div>}
              <div className="modal-info">
                Saving changes updates the administrator across the system.
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={closeEditModal}
                  disabled={isEditSaving}
                >
                  Cancel
                </button>
                <button
                  className="admin-students-add-btn modal-process-btn"
                  onClick={handleSaveEdit}
                  disabled={isEditSaving}
                >
                  {isEditSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {removeModal && isSuperAdmin && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Remove Admin</h3>
              <p>
                Enter the verification code to remove{' '}
                <strong>{getDisplayName(removeModal.admin)}</strong> from the
                system.
              </p>
              <div className="verification-code">{removeModal.code}</div>
              <input
                type="text"
                className="admin-modal-input"
                placeholder="Enter verification code"
                value={removeInput}
                onChange={(e) => {
                  setRemoveInput(e.target.value);
                  setRemoveError('');
                }}
                disabled={isRemoving}
              />
              {removeError && <div className="modal-error">{removeError}</div>}
              <div className="modal-warning">This action cannot be undone.</div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={closeRemoveModal}
                  disabled={isRemoving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleConfirmRemove}
                  disabled={
                    isRemoving || removeInput.trim() !== removeModal.code
                  }
                >
                  {isRemoving ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMembers;
