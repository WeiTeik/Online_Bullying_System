import React, { useEffect, useMemo, useState } from 'react';
import './admin.css';
import {
  getStudents,
  inviteStudent,
  updateStudent as updateStudentApi,
  resetStudentPassword as resetStudentPasswordApi,
  deleteStudent as deleteStudentApi,
} from '../../services/api';

const STUDENTS_PER_PAGE = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseStatus = (status) => (status || '').toLowerCase();
const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const AdminStudents = () => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [formError, setFormError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [removeModal, setRemoveModal] = useState(null);
  const [removeInput, setRemoveInput] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    let isActive = true;
    const fetchStudents = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const data = await getStudents();
        if (isActive) {
          setStudents(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isActive) {
          const message =
            err?.response?.data?.error ||
            err?.message ||
            'Unable to load students.';
          setLoadError(message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchStudents();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return students;
    }
    return students.filter((student) => {
      const name = (student.full_name || student.username || '').toLowerCase();
      const email = (student.email || '').toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [students, search]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const pendingCount = students.filter(
    (student) => normaliseStatus(student.status) === 'pending'
  ).length;

  const resetFormState = () => {
    setNameInput('');
    setEmailInput('');
    setFormError('');
    setInviteError('');
    setIsSubmitting(false);
  };

  const handleAddStudent = async () => {
    const trimmedName = nameInput.trim();
    const trimmedEmail = emailInput.trim().toLowerCase();

    if (!trimmedName) {
      setFormError('Student name is required.');
      return;
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setFormError('Please enter a valid student email address.');
      return;
    }

    setFormError('');
    setInviteError('');
    setIsSubmitting(true);

    try {
      const response = await inviteStudent({
        full_name: trimmedName,
        email: trimmedEmail,
      });
      const { student, temporary_password: temporaryPassword } = response || {};
      if (student) {
        setStudents((prev) => [student, ...prev]);
        setInviteResult({
          name: student.full_name || student.username || student.email,
          email: student.email,
          password: temporaryPassword,
        });
      }
      setShowModal(false);
      resetFormState();
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to invite student. Please try again.';
      setInviteError(message);
      setIsSubmitting(false);
    }
  };

  const openEditModal = (student) => {
    setEditModal(student);
    setEditName(student.full_name || student.username || '');
    setEditEmail(student.email || '');
    setEditError('');
    setResetResult(null);
    setIsResetting(false);
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditName('');
    setEditEmail('');
    setEditError('');
    setIsEditSaving(false);
    setIsResetting(false);
    setResetResult(null);
  };

  const handleSaveEdit = async () => {
    if (!editModal) return;
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim().toLowerCase();

    if (!trimmedName) {
      setEditError('Student name cannot be empty.');
      return;
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setEditError('Please enter a valid student email address.');
      return;
    }

    setEditError('');
    setIsEditSaving(true);
    try {
      const updated = await updateStudentApi(editModal.id, {
        full_name: trimmedName,
        email: trimmedEmail,
      });
      setStudents((prev) =>
        prev.map((student) => (student.id === updated.id ? { ...student, ...updated } : student))
      );
      closeEditModal();
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to update student. Please try again.';
      setEditError(message);
      setIsEditSaving(false);
    }
  };

  const handleResetStudentPassword = async () => {
    if (!editModal) return;
    setIsResetting(true);
    setResetResult(null);
    setEditError('');

    try {
      const response = await resetStudentPasswordApi(editModal.id);
      const { student, temporary_password: temporaryPassword } = response || {};
      if (student) {
        setStudents((prev) =>
          prev.map((item) => (item.id === student.id ? { ...item, ...student } : item))
        );
      }
      setResetResult({
        password: temporaryPassword,
        email: student?.email || editEmail,
      });
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to reset password. Please try again.';
      setEditError(message);
    } finally {
      setIsResetting(false);
    }
  };

  const openRemoveModal = (student) => {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    setRemoveModal({ student, code });
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
    const expectedCode = removeModal.code;
    if (removeInput.trim() !== expectedCode) {
      setRemoveError('Verification code does not match.');
      return;
    }
    setIsRemoving(true);
    try {
      await deleteStudentApi(removeModal.student.id);
      setStudents((prev) =>
        prev.filter((student) => student.id !== removeModal.student.id)
      );
      closeRemoveModal();
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to remove student. Please try again.';
      setRemoveError(message);
      setIsRemoving(false);
    }
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderAvatar = (student) => {
    const displayName = student.full_name || student.username || student.email || 'Student';
    const avatarUrl = student.avatar_url;
    const initial = (displayName || 'S').trim().charAt(0).toUpperCase();
    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={displayName}
          className="student-avatar"
        />
      );
    }
    return (
      <div className="student-avatar student-avatar-fallback" aria-hidden="true">
        {initial || 'S'}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="student-placeholder">Loading students…</div>;
    }
    if (loadError) {
      return <div className="student-placeholder student-placeholder-error">{loadError}</div>;
    }
    if (filteredStudents.length === 0) {
      return <div className="student-placeholder">No students found.</div>;
    }
    return paginatedStudents.map((student) => {
      const displayName = student.full_name || student.username || student.email || 'Student';
      const email = student.email || '—';
      const status = normaliseStatus(student.status);
      const isPending = status === 'pending';
      const invitedAt = formatDate(student.invited_at);
      const lastLogin = formatDate(student.last_login_at);

      return (
        <div
          key={student.id || `${email}-${displayName}`}
          className={`student-row${isPending ? ' pending' : ''}`}
        >
          {renderAvatar(student)}
          <div className="student-info">
            <div className="student-name-row">
              <div className="student-name">{displayName}</div>
              {isPending && <span className="student-status-tag pending">Pending</span>}
            </div>
            <div className="student-email">{email}</div>
            <div className="student-meta">
              {isPending && invitedAt && (
                <span className="student-meta-item">Invited {invitedAt}</span>
              )}
              {!isPending && lastLogin && (
                <span className="student-meta-item">Last login {lastLogin}</span>
              )}
            </div>
          </div>
          <div className="student-actions">
            <button
              type="button"
              className="student-action-button edit"
              onClick={() => openEditModal(student)}
              title="Edit student"
            >
              <span className="student-action-icon" aria-hidden="true">✏️</span>
              <span className="visually-hidden">Edit</span>
            </button>
            <button
              type="button"
              className="student-action-button remove"
              onClick={() => openRemoveModal(student)}
              title="Remove student"
            >
              <span className="student-action-icon" aria-hidden="true">🗑️</span>
              <span className="visually-hidden">Remove</span>
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="admin-students-bg">
      <div className="admin-students-container">
        <div className="admin-students-header">
          <div>
            <h2 className="admin-students-title">Students</h2>
            <div className="admin-students-subtitle">
              {pendingCount > 0
                ? `${pendingCount} student${pendingCount === 1 ? ' is' : 's are'} pending registration`
                : 'All invited students have registered.'}
            </div>
          </div>
          <div className="admin-students-actions">
            <div className="admin-students-search">
              <span className="admin-students-search-icon">
                &#128269;
              </span>
              <input
                type="text"
                placeholder="Search student"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-students-search-input"
              />
            </div>
            <button
              className="admin-students-add-btn"
              onClick={() => {
                resetFormState();
                setShowModal(true);
              }}
            >
              <span className="admin-students-add-icon">+</span>
              Add Students
            </button>
          </div>
        </div>

        {inviteResult && (
          <div className="admin-feedback success" role="status">
            <strong>Invitation sent.</strong>{' '}
            Invitation email dispatched to {inviteResult.name} ({inviteResult.email}).
            {inviteResult.password && (
              <div className="admin-feedback-password">
                Temporary password: <code>{inviteResult.password}</code>
              </div>
            )}
            <button
              type="button"
              className="admin-feedback-dismiss"
              onClick={() => setInviteResult(null)}
            >
              &times;
            </button>
          </div>
        )}

        <div className="admin-students-table student-table-scroll">
          <div className="admin-students-table-header">
            <div className="admin-students-table-header-count">
              {filteredStudents.length} Students
            </div>
          </div>
          <div>
            {renderContent()}
          </div>
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
                className={`pagination-btn${currentPage === i + 1 ? ' pagination-btn-active' : ''}`}
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

        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add Student</h3>
              <p>Enter the student's details to send an invitation:</p>
              <input
                type="text"
                className="admin-modal-input"
                placeholder="Student Name"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setFormError('');
                  setInviteError('');
                }}
                disabled={isSubmitting}
              />
              <input
                type="email"
                className="admin-modal-input"
                placeholder="student@email.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setFormError('');
                  setInviteError('');
                }}
                disabled={isSubmitting}
              />
              {(formError || inviteError) && (
                <div className="modal-error">
                  {formError || inviteError}
                </div>
              )}
              <div className="modal-info">
                The student will receive a welcome email containing their login email and a secure temporary password.
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => {
                    setShowModal(false);
                    resetFormState();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="admin-students-add-btn modal-process-btn"
                  onClick={handleAddStudent}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing…' : 'Process'}
                </button>
              </div>
            </div>
          </div>
        )}
        {editModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Edit Student Info</h3>
              <input
                type="text"
                className="admin-modal-input"
                placeholder="Student Name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setEditError('');
                }}
                disabled={isEditSaving || isResetting}
              />
              <input
                type="email"
                className="admin-modal-input"
                placeholder="student@email.com"
                value={editEmail}
                onChange={(e) => {
                  setEditEmail(e.target.value);
                  setEditError('');
                }}
                disabled={isEditSaving || isResetting}
              />
              <button
                type="button"
                className="admin-students-add-btn modal-reset-btn"
                onClick={handleResetStudentPassword}
                disabled={isResetting || isEditSaving}
              >
                {isResetting ? 'Sending…' : 'Reset Password'}
              </button>
              {resetResult && (
                <div className="modal-success">
                  Temporary password sent to {resetResult.email}.{' '}
                  {resetResult.password && (
                    <span>
                      Password: <code>{resetResult.password}</code>
                    </span>
                  )}
                </div>
              )}
              {editError && (
                <div className="modal-error">
                  {editError}
                </div>
              )}
              <div className="modal-info">
                Clicking the save button will update the student's information system-wide.
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={closeEditModal}
                  disabled={isEditSaving || isResetting}
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
        {removeModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Remove Student</h3>
              <p>
                Enter the verification code shown below to remove{' '}
                <strong>{removeModal.student.full_name || removeModal.student.username || removeModal.student.email}</strong>.
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
              {removeError && (
                <div className="modal-error">
                  {removeError}
                </div>
              )}
              <div className="modal-warning">
                This action cannot be undone.
              </div>
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
                  disabled={isRemoving || removeInput.trim() !== removeModal.code}
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

export default AdminStudents;
