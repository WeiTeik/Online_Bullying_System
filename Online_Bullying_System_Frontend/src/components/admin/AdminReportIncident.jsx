import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getComplaintByIdentifier, addComplaintComment, updateComplaintStatus } from '../../services/api';

const formatDateTimeLong = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateOnly = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const humanizeList = (list) => {
  if (!list) return '-';
  if (Array.isArray(list)) {
    if (list.length === 0) return '-';
    if (list.length === 1) return list[0] || '-';
    return list.join(', ');
  }
  if (typeof list === 'string') {
    const trimmed = list.trim();
    return trimmed || '-';
  }
  return `${list}`;
};

const statusToBadge = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('progress')) return 'badge-progress';
  if (normalized.includes('resolve') || normalized.includes('complete')) return 'badge-resolved';
  if (normalized.includes('reject') || normalized.includes('fail')) return 'badge-rejected';
  return 'badge-new';
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

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const formatted = size % 1 === 0 ? size : size.toFixed(1);
  return `${formatted} ${units[idx]}`;
};

const AdminReportIncident = ({ currentUser, onRefreshComplaints }) => {
  const { complaintIdentifier } = useParams();
  const navigate = useNavigate();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('new');
  const [adminNotes, setAdminNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchIncident = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getComplaintByIdentifier(complaintIdentifier);
        if (isMounted) {
          setIncident(data);
          setSelectedStatus((data?.status || 'new').toLowerCase());
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err?.response?.data?.error ||
            err?.message ||
            'Unable to load complaint details.';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (complaintIdentifier) {
      fetchIncident();
    } else {
      setIncident(null);
      setLoading(false);
      setError('Invalid complaint identifier.');
    }

    return () => {
      isMounted = false;
    };
  }, [complaintIdentifier]);

  useEffect(() => {
    if (!feedbackMessage) return undefined;
    const timer = setTimeout(() => setFeedbackMessage(''), 3500);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  const role = (currentUser?.role || '').toUpperCase();
  const canManage = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const handleSaveStatus = async () => {
    if (!incident || !canManage) return;
    setFeedbackMessage('');
    setIsStatusSaving(true);
    try {
      const updated = await updateComplaintStatus(incident.id, selectedStatus);
      setIncident(updated);
      setSelectedStatus((updated?.status || selectedStatus).toLowerCase());
      setFeedbackMessage(`Status updated to “${STATUS_OPTIONS.find(opt => opt.value === selectedStatus)?.label || selectedStatus}”.`);
      if (onRefreshComplaints) onRefreshComplaints();
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Failed to update complaint status.';
      setFeedbackMessage(message);
    } finally {
      setIsStatusSaving(false);
    }
  };

  const handleSubmitComment = async (event) => {
    event.preventDefault();
    if (!incident || !canManage) {
      setFeedbackMessage('You do not have permission to comment on this complaint.');
      return;
    }
    const message = adminNotes.trim();
    if (!message) {
      setFeedbackMessage('Please enter a comment before sending.');
      return;
    }
    setIsCommentSubmitting(true);
    setFeedbackMessage('');
    try {
      const comment = await addComplaintComment(incident.id, {
        author_id: currentUser?.id,
        message,
      });
      setIncident((prev) => ({
        ...prev,
        comments: [...(prev?.comments || []), comment],
      }));
      setAdminNotes('');
      setFeedbackMessage('Comment submitted successfully.');
      if (onRefreshComplaints) onRefreshComplaints();
    } catch (err) {
      const errMessage =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to submit comment.';
      setFeedbackMessage(errMessage);
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const comments = useMemo(() => incident?.comments || [], [incident]);
  const selectedStatusLabel = useMemo(() => {
    const match = STATUS_OPTIONS.find((option) => option.value === selectedStatus);
    if (match) return match.label;
    return (selectedStatus || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'New';
  }, [selectedStatus]);
  const submittedAt = incident?.submitted_at || incident?.submittedAt;
  const updatedAt = incident?.updated_at || incident?.updatedAt;
  const responseTime = useMemo(
    () => formatResponseTime(submittedAt, updatedAt),
    [submittedAt, updatedAt]
  );

  if (loading) {
    return (
      <div className="admin-report-incident">
        <div className="incident-header">
          <button type="button" className="incident-back" onClick={() => navigate('/admin/reports')}>
            ← Back to reports
          </button>
        </div>
        <div className="incident-empty-state">
          <h2>Loading</h2>
          <p>Please wait while we load the complaint.</p>
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="admin-report-incident">
        <div className="incident-header">
          <button type="button" className="incident-back" onClick={() => navigate('/admin/reports')}>
            ← Back to reports
          </button>
        </div>
        <div className="incident-empty-state">
          <h2>Incident Not Available</h2>
          <p>{error || 'The requested incident could not be located.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-report-incident">
      <div className="incident-header">
        <button type="button" className="incident-back" onClick={() => navigate('/admin/reports')}>
          ← Back to reports
        </button>
        <h1>Report Incident</h1>
      </div>

      {feedbackMessage && (
        <div className="incident-feedback" role="status">
          {feedbackMessage}
        </div>
      )}

      <section className="incident-card">
        <header className="incident-card__hero">
          <div>
            <p className="incident-card__label">Case ID :</p>
            <p className="incident-card__value">{incident.reference_code}</p>
          </div>
          <div className="incident-card__status">
            <span className={`incident-status-pill ${statusToBadge(selectedStatus)}`}>
              {selectedStatusLabel}
            </span>
          </div>
        </header>
        {updatedAt && (
          <div className="incident-card__status-meta">
            <p>
              Status updated on {formatDateTimeLong(updatedAt)}
              {responseTime ? ` (response time: ${responseTime})` : ''}
            </p>
          </div>
        )}

        <div className="incident-card__reported">
          <span className="incident-card__label">Reported by:</span>
          <div className="incident-card__reporter">
            <strong>{incident.student_name || 'Anonymous'}</strong>
            <span>on {formatDateTimeLong(incident.submitted_at)}</span>
          </div>
        </div>

        <dl className="incident-details">
          <div className="incident-details__row">
            <dt>Date of Incident:</dt>
            <dd>{formatDateOnly(incident.incident_date)}</dd>
          </div>
          <div className="incident-details__row">
            <dt>Room Number:</dt>
            <dd>{incident.room_number || '-'}</dd>
          </div>
          <div className="incident-details__row">
            <dt>Type of Incident:</dt>
            <dd>{incident.incident_type || '-'}</dd>
          </div>
          <div className="incident-details__row">
            <dt>Incident Description:</dt>
            <dd>{incident.description || '-'}</dd>
          </div>
          <div className="incident-details__row">
            <dt>Witnesses (if any):</dt>
            <dd>{humanizeList(incident.witnesses)}</dd>
          </div>
          <div className="incident-details__row">
            <dt>Attachment:</dt>
            <dd>
              {incident.attachments && incident.attachments.length > 0 ? (
                <ul className="incident-attachments">
                  {incident.attachments.map((file, idx) => (
                    <li key={`${file.name}-${idx}`}>
                      <span className="incident-attachment-icon" aria-hidden="true">📎</span>
                      <span>{file.name || `Attachment ${idx + 1}`}</span>
                      {file.size ? (
                        <span className="incident-attachment-size">{formatBytes(file.size)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <span>-</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="incident-action">
          <label htmlFor="incident-status" className="incident-card__label">
            Action
          </label>
          <div className="incident-action__controls">
            <select
              id="incident-status"
              className="incident-status-select"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              disabled={!canManage || isStatusSaving}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="incident-proceed-btn"
              onClick={handleSaveStatus}
              disabled={!canManage || isStatusSaving}
            >
              {isStatusSaving ? 'Saving…' : 'Proceed'}
            </button>
          </div>
        </div>

        <div className="incident-comment-section">
          <h2>Comments</h2>
          {comments.length === 0 ? (
            <p className="incident-comment-existing">No comments recorded yet.</p>
          ) : (
            <ul className="incident-comment-list">
              {comments.map((comment) => (
                <li key={comment.id} className="incident-comment-item">
                  <div className="incident-comment-meta">
                    <strong>{comment.author_name || 'System'}</strong>
                    <span>{formatDateTimeLong(comment.created_at)}</span>
                  </div>
                  <p>{comment.message}</p>
                </li>
              ))}
            </ul>
          )}
          <form className="incident-comment-form" onSubmit={handleSubmitComment}>
            <label htmlFor="incident-notes" className="sr-only">
              Leave a message
            </label>
            <textarea
              id="incident-notes"
              rows="3"
              placeholder={canManage ? 'Leave a message' : 'You do not have permission to comment'}
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              disabled={!canManage || isCommentSubmitting}
            />
            <button
              type="submit"
              className="incident-send-btn"
              aria-label="Send comment"
              disabled={!canManage || isCommentSubmitting}
            >
              <span className="incident-send-icon" aria-hidden="true">
                {isCommentSubmitting ? '…' : '✈️'}
              </span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default AdminReportIncident;
