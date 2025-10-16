import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toAbsoluteUrl } from '../services/api';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatResponseTime = (startValue, endValue) => {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  if (!start || !end) return null;
  const diffMs = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 1) return 'under 1 minute';

  const MINUTES_IN_DAY = 1440;
  const MINUTES_IN_HOUR = 60;
  const days = Math.floor(totalMinutes / MINUTES_IN_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_IN_DAY) / MINUTES_IN_HOUR);
  const minutes = totalMinutes % MINUTES_IN_HOUR;

  const parts = [];
  if (days) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours) parts.push(`${hours} hr${hours !== 1 ? 's' : ''}`);
  if (minutes && !days && parts.length < 2) {
    parts.push(`${minutes} min${minutes !== 1 ? 's' : ''}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'under 1 minute';
};

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const formatted = size % 1 === 0 ? size : size.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
};

const resolveAttachmentHref = (attachment) => {
  if (!attachment) return null;
  if (typeof attachment === 'string') {
    const trimmed = attachment.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
      return toAbsoluteUrl(trimmed);
    }
    return null;
  }
  const rawUrl =
    attachment.url ||
    attachment.href ||
    attachment.path ||
    attachment.download_url ||
    attachment.downloadUrl;
  return rawUrl ? toAbsoluteUrl(rawUrl) : null;
};

const buildDownloadHref = (url) => {
  if (!url) return null;
  return url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
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
            const statusUpdatedAt = complaint.updated_at || complaint.updatedAt;
            const responseTime = formatResponseTime(submittedAt, statusUpdatedAt);

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
                  {statusUpdatedAt && (
                    <p>
                      <strong>Status updated:</strong> {formatDateTime(statusUpdatedAt)}
                      {responseTime ? ` (response time: ${responseTime})` : ''}
                    </p>
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
                              : file?.name || `Attachment ${idx + 1}`;
                          const href = resolveAttachmentHref(file);
                          const downloadHref = buildDownloadHref(href);
                          const sizeLabel = typeof file === 'object' ? formatBytes(file?.size) : null;
                          return (
                            <li key={`${complaint.id}-att-${idx}`} className="complaint-attachment-item">
                              {href ? (
                                <a href={href} target="_blank" rel="noopener noreferrer">
                                  {label}
                                </a>
                              ) : (
                                <span>{label}</span>
                              )}
                              {sizeLabel ? (
                                <span className="complaint-attachment-size">{` (${sizeLabel})`}</span>
                              ) : null}
                              {href ? (
                                <span className="complaint-attachment-actions">
                                  <a href={href} target="_blank" rel="noopener noreferrer">
                                    View
                                  </a>
                                  <span aria-hidden="true">·</span>
                                  <a href={downloadHref || href} download>
                                    Download
                                  </a>
                                </span>
                              ) : null}
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
