import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { getComplaintByIdentifier, addComplaintComment, updateComplaintStatus, toAbsoluteUrl } from '../../services/api';

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
  const raw =
    attachment.url ||
    attachment.href ||
    attachment.path ||
    attachment.download_url ||
    attachment.downloadUrl;
  return raw ? toAbsoluteUrl(raw) : null;
};

const buildDownloadHref = (url) => {
  if (!url) return null;
  return url.includes('?') ? `${url}&download=1` : `${url}?download=1`;
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

  const handleDownloadPdf = () => {
    if (!incident) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    const columnGap = 12;
    const columnWidth = (contentWidth - columnGap) / 2;
    const headerHeight = 40;

    const caseCode = incident.reference_code || incident.referenceCode || '-';
    const incidentType = incident.incident_type || '—';

    doc.setFillColor(6, 190, 182);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Incident Report', margin, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Generated on ${formatDateTimeLong(new Date())}`, margin, headerHeight - 10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Case ${caseCode}`, pageWidth - margin, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(`Type: ${incidentType}`, pageWidth - margin, headerHeight - 10, { align: 'right' });

    doc.setTextColor(0, 0, 0);

    let cursorY = headerHeight + 12;

    const newPage = () => {
      doc.addPage();
      cursorY = margin;
    };

    const ensureSpace = (height) => {
      if (cursorY + height > pageHeight - margin) {
        newPage();
      }
    };

    const addSectionHeading = (text) => {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(text, margin, cursorY);
      doc.setDrawColor(221, 229, 238);
      doc.setLineWidth(0.4);
      doc.line(margin, cursorY + 1.5, margin + contentWidth, cursorY + 1.5);
      cursorY += 8;
    };

    addSectionHeading('Summary');

    const columns = [
      { x: margin, y: cursorY, width: columnWidth },
      { x: margin + columnWidth + columnGap, y: cursorY, width: columnWidth },
    ];

    const resetColumnsToNewPage = () => {
      newPage();
      columns[0].y = cursorY;
      columns[1].y = cursorY;
    };

    const addFieldToColumn = (columnIndex, label, value) => {
      const column = columns[columnIndex];
      const textValue =
        value && typeof value === 'string' ? value : value ? String(value) : '-';
      const lines = doc.splitTextToSize(textValue, column.width);
      const blockHeight = 5 + lines.length * 5 + 3;
      if (column.y + blockHeight > pageHeight - margin) {
        resetColumnsToNewPage();
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(label, column.x, column.y);
      doc.setFont('helvetica', 'normal');
      column.y += 5;
      doc.text(lines, column.x, column.y);
      column.y += lines.length * 5 + 3;
    };

    addFieldToColumn(0, 'Case ID', caseCode);
    addFieldToColumn(0, 'Status', selectedStatusLabel);
    addFieldToColumn(0, 'Reported By', incident.student_name || 'Anonymous');
    addFieldToColumn(0, 'Reported On', formatDateTimeLong(submittedAt) || '-');
    addFieldToColumn(0, 'Last Updated', formatDateTimeLong(updatedAt) || '-');
    addFieldToColumn(0, 'Response Time', responseTime || '—');

    addFieldToColumn(1, 'Date of Incident', formatDateOnly(incident.incident_date) || '-');
    addFieldToColumn(1, 'Room Number', incident.room_number || '-');
    addFieldToColumn(1, 'Type of Incident', incident.incident_type || '-');
    addFieldToColumn(1, 'Witnesses', humanizeList(incident.witnesses));

    cursorY = Math.max(columns[0].y, columns[1].y) + 10;

    const addCard = (title, body) => {
      ensureSpace(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, margin, cursorY);
      cursorY += 6;

      const toLines = (value) => {
        const stringValue =
          value && typeof value === 'string' ? value : value ? String(value) : '-';
        return doc.splitTextToSize(stringValue, contentWidth - 10);
      };

      const bodyLines = Array.isArray(body)
        ? body.flatMap((line, index) => {
            const lines = toLines(line);
            return index < body.length - 1 ? [...lines, ''] : lines;
          })
        : toLines(body);

      const blockHeight = Math.max(18, bodyLines.length * 5 + 8);

      if (cursorY + blockHeight > pageHeight - margin) {
        newPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(title, margin, cursorY);
        cursorY += 6;
      }

      doc.setFillColor(248, 250, 255);
      doc.setDrawColor(215, 226, 252);
      doc.roundedRect(margin, cursorY, contentWidth, blockHeight, 3, 3, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(56, 66, 82);
      doc.text(bodyLines, margin + 4, cursorY + 7);
      doc.setTextColor(0, 0, 0);

      cursorY += blockHeight + 10;
    };

    addCard('Incident Description', incident.description || 'No description provided.');

    const attachmentsBody =
      incident.attachments && incident.attachments.length > 0
        ? incident.attachments.map((file, index) => {
            const size = formatBytes(file.size);
            const label = file.name || `Attachment ${index + 1}`;
            return size ? `• ${label} (${size})` : `• ${label}`;
          })
        : ['No attachments included.'];
    addCard('Attachments', attachmentsBody);

    ensureSpace(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Comments', margin, cursorY);
    cursorY += 6;

    const addCommentCard = (titleText, bodyText) => {
      const bodyLines = doc.splitTextToSize(bodyText, contentWidth - 12);
      const blockHeight = Math.max(20, bodyLines.length * 5 + 14);
      if (cursorY + blockHeight > pageHeight - margin) {
        newPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('Comments (cont.)', margin, cursorY);
        cursorY += 6;
      }

      doc.setDrawColor(215, 226, 252);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, cursorY, contentWidth, blockHeight, 2, 2, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(35, 46, 71);
      doc.text(titleText, margin + 4, cursorY + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(bodyLines, margin + 4, cursorY + 13);
      doc.setTextColor(0, 0, 0);

      cursorY += blockHeight + 6;
    };

    if (comments.length === 0) {
      addCommentCard(
        'No comments recorded.',
        'No administrator comments have been added to this incident.'
      );
    } else {
      comments.forEach((comment) => {
        const author = comment.author_name || 'System';
        const timestamp = formatDateTimeLong(comment.created_at);
        const titleText = timestamp ? `${author} • ${timestamp}` : author;
        addCommentCard(titleText, comment.message || '-');
      });
    }

    doc.save(`incident-${incident.reference_code || incident.id || 'report'}.pdf`);
  };

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
        <div className="incident-header__actions">
          <h1>Report Incident</h1>
          <button
            type="button"
            className="incident-download-btn"
            onClick={handleDownloadPdf}
            aria-label="Download incident report as PDF"
            disabled={!incident}
          >
            <svg
              className="incident-download-icon"
              viewBox="0 0 24 24"
              role="img"
              aria-hidden="true"
            >
              <path
                d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4.004 4.004a1 1 0 0 1-1.414 0L7.285 11.707a1 1 0 1 1 1.414-1.414L11 12.586V4a1 1 0 0 1 1-1z"
                fill="currentColor"
              />
              <path
                d="M5 15a1 1 0 0 1 1 1v3h12v-3a1 1 0 1 1 2 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a1 1 0 0 1 1-1z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
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
                  {incident.attachments.map((file, idx) => {
                    const label =
                      typeof file === 'string' ? file : file?.name || `Attachment ${idx + 1}`;
                    const href = resolveAttachmentHref(file);
                    const downloadHref = buildDownloadHref(href);
                    const sizeLabel =
                      typeof file === 'object' && Number.isFinite(file?.size)
                        ? formatBytes(file.size)
                        : '';
                    const key =
                      typeof file === 'object' && file?.stored_name
                        ? `${file.stored_name}-${idx}`
                        : `${label}-${idx}`;
                    const attachmentContent = (
                      <>
                        <span className="incident-attachment-icon" aria-hidden="true">📎</span>
                        <span className="incident-attachment-label">{label}</span>
                        {sizeLabel ? (
                          <span className="incident-attachment-size">{sizeLabel}</span>
                        ) : null}
                      </>
                    );
                    return (
                      <li key={key} className="incident-attachment-item">
                        {href ? (
                          <a
                            className="incident-attachment-btn incident-attachment-link"
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {attachmentContent}
                          </a>
                        ) : (
                          <div className="incident-attachment-btn incident-attachment-btn--static">
                            {attachmentContent}
                          </div>
                        )}
                        {href ? (
                          <div className="incident-attachment-download">
                            <a href={downloadHref || href} download>
                              Download copy
                            </a>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
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
