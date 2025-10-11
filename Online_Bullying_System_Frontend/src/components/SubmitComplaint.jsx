import React, { useEffect, useRef, useState } from 'react';
import { createComplaint } from '../services/api';

const resolveStudentName = (user) =>
  user?.full_name || user?.username || user?.email || '';

const normaliseIncidentDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const formatDateTimeLocal = (date) => {
  const pad = (num) => num.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const ATTACHMENT_RULES = Object.freeze({
  maxFiles: 5,
  maxFileBytes: 5 * 1024 * 1024, // 5 MB per file
  maxTotalBytes: 20 * 1024 * 1024, // 20 MB combined
});

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'txt',
  'rtf',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'heic',
  'heif',
]);

const IMAGE_ATTACHMENT_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'heic',
  'heif',
]);

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/rtf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const PROHIBITED_ATTACHMENT_EXTENSIONS = new Set([
  'exe',
  'msi',
  'bat',
  'cmd',
  'com',
  'scr',
  'sh',
  'bash',
  'zsh',
  'ksh',
  'csh',
  'ps1',
  'psm1',
  'jar',
  'js',
  'mjs',
  'cpl',
  'vbs',
  'hta',
  'dll',
  'so',
  'apk',
  'ipa',
  'pkg',
  'dmg',
  'app',
  'iso',
  'img',
]);

const PROHIBITED_ATTACHMENT_MIME_PREFIXES = [
  'application/x-ms',
  'application/x-dosexec',
  'application/x-executable',
  'application/java-archive',
  'text/javascript',
  'application/javascript',
  'application/x-sh',
  'application/x-bat',
  'application/vnd.android.package-archive',
  'application/x-ms-installer',
  'application/x-apple-diskimage',
];

const ACCEPT_ATTRIBUTE = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.rtf',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.heic',
  '.heif',
].join(',');

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value % 1 === 0 ? value : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
};

const getExtension = (filename = '') => {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return '';
  return parts.pop();
};

const hasDangerousDoubleExtension = (filename = '') => {
  const parts = filename.toLowerCase().split('.');
  if (parts.length <= 2) return false;
  return parts.slice(0, -1).some(part => PROHIBITED_ATTACHMENT_EXTENSIONS.has(part));
};

const evaluateAttachments = (currentFiles, incomingFiles) => {
  const errors = [];
  let accepted = Array.isArray(currentFiles) ? [...currentFiles] : [];
  let totalSize = accepted.reduce((sum, file) => sum + (file?.size || 0), 0);

  incomingFiles.forEach(file => {
    if (!file) return;

    if (accepted.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
      return;
    }

    if (accepted.length >= ATTACHMENT_RULES.maxFiles) {
      errors.push(`You can attach up to ${ATTACHMENT_RULES.maxFiles} files per complaint.`);
      return;
    }

    const extension = getExtension(file.name);
    const mime = (file.type || '').toLowerCase();

    if (!extension || !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || PROHIBITED_ATTACHMENT_EXTENSIONS.has(extension) || hasDangerousDoubleExtension(file.name)) {
      errors.push(`'${file.name}' is not an accepted file type. Allowed formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, RTF and common image formats.`);
      return;
    }

    if (mime && PROHIBITED_ATTACHMENT_MIME_PREFIXES.some(prefix => mime.startsWith(prefix))) {
      errors.push(`'${file.name}' appears to be executable content and is not permitted.`);
      return;
    }

    const mimeAllowed =
      !mime ||
      ALLOWED_ATTACHMENT_MIME_TYPES.has(mime) ||
      (mime.startsWith('image/') && IMAGE_ATTACHMENT_EXTENSIONS.has(extension));

    if (!mimeAllowed) {
      errors.push(`'${file.name}' has an unsupported file signature.`);
      return;
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      errors.push(`'${file.name}' appears to be empty or corrupt.`);
      return;
    }

    if (file.size > ATTACHMENT_RULES.maxFileBytes) {
      errors.push(`'${file.name}' exceeds the per-file limit of ${formatBytes(ATTACHMENT_RULES.maxFileBytes)}.`);
      return;
    }

    if (totalSize + file.size > ATTACHMENT_RULES.maxTotalBytes) {
      errors.push(`Total attachment size cannot exceed ${formatBytes(ATTACHMENT_RULES.maxTotalBytes)}.`);
      return;
    }

    accepted = [...accepted, file];
    totalSize += file.size;
  });

  return {
    attachments: accepted,
    errors: Array.from(new Set(errors)),
  };
};

function SubmitComplaint({ onSubmit, currentUser }) {

  const [formData, setFormData] = useState({
    studentName: resolveStudentName(currentUser),
    roomNumber: '',
    incidentType: '',
    description: '',
    incidentDate: '',
    witnesses: '',
    anonymous: false,
    attachments: []
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(null)
  const [attachmentError, setAttachmentError] = useState(null)
  const attachmentInputRef = useRef(null)
  const incidentDateMax = formatDateTimeLocal(new Date())
  const handleAttachmentTrigger = () => {
    if (attachmentInputRef.current) {
      attachmentInputRef.current.click()
    }
  }

  useEffect(() => {
    setFormData(prev => {
      if (prev.anonymous) return prev;
      return {
        ...prev,
        studentName: resolveStudentName(currentUser),
      };
    });
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target
    if (type === 'file') {
      const selectedFiles = Array.from(files || [])
      const evaluation = evaluateAttachments(formData.attachments, selectedFiles)
      setFormData(prev => ({
        ...prev,
        attachments: evaluation.attachments
      }))
      setAttachmentError(evaluation.errors.length ? evaluation.errors.join(' ') : null)
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
    } else {
      let adjustedValue = value
      if (name === 'incidentDate' && value) {
        const limit = formatDateTimeLocal(new Date())
        adjustedValue = value > limit ? limit : value
      }
      setFormData(prev => ({
        ...prev,
        ...(name === 'anonymous'
          ? {
              anonymous: checked,
              studentName: checked ? '' : resolveStudentName(currentUser),
            }
          : name === 'studentName'
          ? prev
          : { [name]: type === 'checkbox' ? checked : adjustedValue })
      }))
    }
  }

  const handleRemoveAttachment = (index) => {
    setFormData(prev => {
      const updated = prev.attachments.filter((_, i) => i !== index)
      if (updated.length === 0 && attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
      return {
        ...prev,
        attachments: updated
      }
    })
    setAttachmentError(null)
  }

  const resetForm = () => {
    setFormData({
      studentName: resolveStudentName(currentUser),
      roomNumber: '',
      incidentType: '',
      description: '',
      incidentDate: '',
      witnesses: '',
      anonymous: false,
      attachments: []
    })
    setAttachmentError(null)
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setSubmitError(null)
    setSubmitSuccess(null)
    setIsSubmitting(true)

    const normalisedIncidentDate = normaliseIncidentDate(formData.incidentDate)
    if (normalisedIncidentDate && new Date(normalisedIncidentDate) > new Date()) {
      setSubmitError('Incident date cannot be in the future.')
      setIsSubmitting(false)
      return
    }

    const payload = {
      user_id: currentUser?.id || null,
      student_name: formData.anonymous ? null : formData.studentName,
      anonymous: formData.anonymous,
      incident_type: formData.incidentType,
      incident_date: normalisedIncidentDate,
      description: formData.description,
      room_number: formData.roomNumber,
      witnesses: formData.witnesses,
      attachments: formData.attachments.map(file => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    }

    try {
      const created = await createComplaint(payload)
      if (onSubmit) {
        onSubmit(created)
      }
      resetForm()
      setSubmitSuccess('Complaint submitted successfully.')
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.message ||
        'Unable to submit complaint. Please try again.'
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="submit-complaint">
      <h2>Submit a Complaint</h2>
      <p className="form-intro">
        Please provide as much detail as possible. All information is kept confidential.
      </p>
      {submitError && <div className="form-error">{submitError}</div>}
      {submitSuccess && <div className="form-success">{submitSuccess}</div>}

      <form onSubmit={handleSubmit} className="complaint-form">
        <div className="form-group switch-group">
          <label className="switch-label">
            <span>Submit anonymously</span>
            <div className="switch">
              <input
                type="checkbox"
                name="anonymous"
                checked={formData.anonymous}
                onChange={handleChange}
              />
              <span className="slider"></span>
            </div>
          </label>
          <p className="switch-description">Your identity will not be revealed</p>
        </div>

        <div className="form-group">
          <label htmlFor="studentName">Student Name:</label>
          <input
            type="text"
            id="studentName"
            name="studentName"
            value={formData.studentName}
            onChange={handleChange}
            required={!formData.anonymous}
            readOnly={!formData.anonymous}
            disabled={formData.anonymous}
          />
        </div>

        <div className="form-group">
          <label htmlFor="roomNumber">Room Number:</label>
          <input
            type="text"
            id="roomNumber"
            name="roomNumber"
            value={formData.roomNumber}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="incidentType">Type of Incident:</label>
          <select
            id="incidentType"
            name="incidentType"
            value={formData.incidentType}
            onChange={handleChange}
            required
          >
            <option value="">Select incident type</option>
            <option value="verbal-bullying">Verbal Bullying</option>
            <option value="physical-bullying">Physical Bullying</option>
            <option value="cyber-bullying">Cyber Bullying</option>
            <option value="social-exclusion">Social Exclusion</option>
            <option value="harassment">Harassment</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="incidentDate">Date and Time of Incident:</label>
          <input
            type="datetime-local"
            id="incidentDate"
            name="incidentDate"
            value={formData.incidentDate}
            onChange={handleChange}
            required
            max={incidentDateMax}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description of Incident:</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows="6"
            placeholder="Please provide detailed information about what happened..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="witnesses">Witnesses (if any):</label>
          <textarea
            id="witnesses"
            name="witnesses"
            value={formData.witnesses}
            onChange={handleChange}
            rows="3"
            placeholder="Names or descriptions of any witnesses..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="attachment">Attachment (optional):</label>
          <input
            type="file"
            id="attachment"
            name="attachment"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            ref={attachmentInputRef}
            onChange={handleChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="attachment-trigger-btn"
            onClick={handleAttachmentTrigger}
          >
            Choose Files
          </button>
          <span className="attachment-summary">
            {formData.attachments.length === 0
              ? 'No files selected'
              : `${formData.attachments.length} file${formData.attachments.length > 1 ? 's' : ''} attached`}
          </span>
          {attachmentError && <div className="attachment-error">{attachmentError}</div>}
          {formData.attachments.length > 0 && (
            <ul className="attachment-list">
              {formData.attachments.map((file, idx) => (
                <li key={idx} className="attachment-list-item">
                  <span className="attachment-file-name">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="attachment-remove-btn"
                    aria-label={`Remove ${file.name}`}
                  >
                    <svg
                      className="attachment-remove-icon"
                      viewBox="0 0 12 12"
                      focusable="false"
                      aria-hidden="true"
                    >
                      <path
                        d="M1 1l10 10M11 1L1 11"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </form>
    </div>
  )
}

export { SubmitComplaint };
