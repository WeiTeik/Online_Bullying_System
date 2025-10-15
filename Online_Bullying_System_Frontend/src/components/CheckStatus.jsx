import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const normaliseStatus = (status = '') => {
  const raw = (status || '').toString().trim();
  if (!raw) return 'Pending';
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'new' || normalized === 'pending') return 'Pending';
  if (normalized === 'in_progress' || normalized === 'investigating') return 'Investigating';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const STATUS_KEYS = ['new', 'in_progress', 'resolved', 'rejected'];

const STATUS_NOTICE = {
  new: 'We have received your report and it is pending review by the school team.',
  in_progress: 'Our team is investigating your report. We will notify you once there is an update.',
  resolved: 'Your report has been resolved. Thank you for helping us keep the community safe.',
  rejected:
    'This report was rejected. Please review the feedback from school staff and submit a new report if needed.',
};

const deriveStatusInfo = (value) => {
  const raw = (value || '').toString().trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  const canonical =
    normalized === 'pending'
      ? 'new'
      : STATUS_KEYS.includes(normalized)
      ? normalized
      : normalized;

  const fallbackClass = STATUS_KEYS.includes(canonical) ? canonical : 'new';
  const labelSource = STATUS_KEYS.includes(canonical) ? canonical : normalized || raw;

  return {
    raw,
    canonical,
    statusClass: fallbackClass,
    label: normaliseStatus(labelSource || 'new'),
    notice: STATUS_NOTICE[STATUS_KEYS.includes(canonical) ? canonical : ''] || null,
  };
};

function ComplaintStatus({ complaints = [], loading, error, onAddComment, currentUser }) {
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentErrors, setCommentErrors] = useState({});
  const [commentSubmitting, setCommentSubmitting] = useState({});
  const [expanded, setExpanded] = useState({});
  const location = useLocation();
  const navigate = useNavigate();
  const [focusedComplaintId, setFocusedComplaintId] = useState(() => location.state?.complaintId || null);
  const complaintRefs = useRef({});

  const handleToggleExpanded = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDraftChange = (id, value) => {
    setCommentDrafts((prev) => ({ ...prev, [id]: value }));
    setCommentErrors((prev) => ({ ...prev, [id]: null }));
  };

  const handleCommentSubmit = async (complaintId) => {
    const draft = (commentDrafts[complaintId] || '').trim();
    if (!draft) {
      setCommentErrors((prev) => ({
        ...prev,
        [complaintId]: 'Please enter a comment before submitting.',
      }));
      return;
    }
    if (!onAddComment) return;

    setCommentErrors((prev) => ({ ...prev, [complaintId]: null }));
    setCommentSubmitting((prev) => ({ ...prev, [complaintId]: true }));
    try {
      await onAddComment(complaintId, draft);
      setCommentDrafts((prev) => ({ ...prev, [complaintId]: '' }));
      setExpanded((prev) => ({ ...prev, [complaintId]: true }));
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to add comment. Please try again.';
      setCommentErrors((prev) => ({ ...prev, [complaintId]: message }));
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [complaintId]: false }));
    }
  };

  useEffect(() => {
    const complaintId = location.state?.complaintId;
    if (!complaintId) return;
    setFocusedComplaintId(complaintId);
    setExpanded((prev) => ({ ...prev, [complaintId]: true }));
    const clearState = setTimeout(() => {
      navigate(location.pathname, { replace: true });
    }, 0);
    return () => clearTimeout(clearState);
  }, [location, navigate]);

  useEffect(() => {
    if (!focusedComplaintId) return;
    const node = complaintRefs.current[focusedComplaintId];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('is-highlighted');
    const removeHighlight = setTimeout(() => {
      node.classList.remove('is-highlighted');
    }, 3000);
    const clearFocus = setTimeout(() => {
      setFocusedComplaintId(null);
    }, 3500);
    return () => {
      clearTimeout(removeHighlight);
      clearTimeout(clearFocus);
    };
  }, [focusedComplaintId, complaints]);

  return (
    <div className="complaint-status">
      <h2>Complaint Status</h2>

      {loading ? (
        <div className="no-complaints">
          <p>Loading complaints...</p>
        </div>
      ) : error ? (
        <div className="no-complaints">
          <p>{error}</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="no-complaints">
          <p>No complaints submitted yet.</p>
        </div>
      ) : (
        <div className="complaints-list">
          {complaints.map((complaint) => {
            const statusInfo = deriveStatusInfo(complaint.status);
            const comments = complaint.comments || [];
            const incidentType = complaint.incident_type || complaint.incidentType;
            const submittedAt = complaint.submitted_at || complaint.submittedAt;
            const roomNumber = complaint.room_number || complaint.roomNumber;
            const studentName = complaint.student_name || complaint.studentName;
            const incidentDate = complaint.incident_date || complaint.incidentDate;
            const attachments = complaint.attachments || [];
            const isExpanded = expanded[complaint.id] ?? true;
            const draft = commentDrafts[complaint.id] || '';

            return (
              <div
                key={complaint.id}
                className={`complaint-card${focusedComplaintId === complaint.id ? ' is-highlighted' : ''}`}
                ref={(el) => {
                  if (el) {
                    complaintRefs.current[complaint.id] = el;
                  } else {
                    delete complaintRefs.current[complaint.id];
                  }
                }}
              >
                <div className="complaint-header">
                  <div>
                    <h3>
                      Complaint{' '}
                      {complaint.reference_code
                        ? `#${complaint.reference_code}`
                        : `#${complaint.id}`}
                    </h3>
                    <p className="complaint-subtitle">
                      Submitted: {formatDateTime(submittedAt)}
                    </p>
                  </div>
                  <span className={`status ${statusInfo.statusClass}`}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="complaint-details">
                  {statusInfo.notice && (
                    <div className={`status-notice status-notice--${statusInfo.statusClass}`}>
                      {statusInfo.notice}
                    </div>
                  )}
                  <p><strong>Type:</strong> {incidentType || '—'}</p>
                  <p><strong>Incident Date:</strong> {formatDateTime(incidentDate)}</p>
                  <p><strong>Room:</strong> {roomNumber || '—'}</p>
                  <p><strong>Student:</strong> {studentName || '—'}</p>
                  <p className="complaint-description">
                    <strong>Description:</strong> {complaint.description || '—'}
                  </p>
                  {complaint.witnesses && (
                    <p><strong>Witnesses:</strong> {complaint.witnesses}</p>
                  )}
                  {attachments.length > 0 && (
                    <div className="complaint-attachments">
                      <strong>Attachments:</strong>
                      <ul>
                        {attachments.map((file, idx) => {
                          const label =
                            typeof file === 'string'
                              ? file
                              : file?.name || 'Attachment';
                          return (
                            <li key={`${complaint.id}-att-${idx}`}>
                              {label}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="toggle-comments-btn"
                  onClick={() => handleToggleExpanded(complaint.id)}
                >
                  {isExpanded ? 'Hide Comments' : `View Comments (${comments.length})`}
                </button>

                {isExpanded && (
                  <div className="complaint-comments">
                    <h4>Comments</h4>
                    {comments.length === 0 ? (
                      <p className="no-comments">No comments yet.</p>
                    ) : (
                      <ul className="comment-list">
                        {comments.map((comment) => (
                          <li key={comment.id} className="comment-item">
                            <div className="comment-meta">
                              <span className="comment-author">
                                {comment.author_name}
                                {comment.author_role && (
                                  <span className="comment-role"> ({normaliseStatus(comment.author_role.toLowerCase())})</span>
                                )}
                              </span>
                              <span className="comment-date">
                                {formatDateTime(comment.created_at)}
                              </span>
                            </div>
                            <p className="comment-message">{comment.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}

                    {currentUser && (
                      <div className="comment-form">
                        <textarea
                          rows="3"
                          placeholder="Leave a comment..."
                          value={draft}
                          onChange={(e) => handleDraftChange(complaint.id, e.target.value)}
                          disabled={commentSubmitting[complaint.id]}
                        />
                        <button
                          type="button"
                          onClick={() => handleCommentSubmit(complaint.id)}
                          disabled={commentSubmitting[complaint.id]}
                        >
                          {commentSubmitting[complaint.id] ? 'Posting...' : 'Post Comment'}
                        </button>
                        {commentErrors[complaint.id] && (
                          <p className="comment-error">{commentErrors[complaint.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export { ComplaintStatus };
