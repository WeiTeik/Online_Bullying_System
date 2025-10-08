import React, { useEffect, useRef, useState } from 'react';
import { createComplaint } from '../services/api';

const resolveStudentName = (user) =>
  user?.full_name || user?.username || user?.email || '';

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
  const attachmentInputRef = useRef(null)
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
      const selectedFiles = Array.from(files)
      setFormData(prev => {
        const deduped = selectedFiles.filter(
          file =>
            !prev.attachments.some(
              f =>
                f.name === file.name &&
                f.size === file.size &&
                f.lastModified === file.lastModified
            )
        )
        return {
          ...prev,
          attachments: [...prev.attachments, ...deduped]
        }
      })
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = ''
      }
    } else {
      setFormData(prev => ({
        ...prev,
        ...(name === 'anonymous'
          ? {
              anonymous: checked,
              studentName: checked ? '' : resolveStudentName(currentUser),
            }
          : name === 'studentName'
          ? prev
          : { [name]: type === 'checkbox' ? checked : value })
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

    const payload = {
      user_id: currentUser?.id || null,
      student_name: formData.anonymous ? null : formData.studentName,
      anonymous: formData.anonymous,
      incident_type: formData.incidentType,
      incident_date: formData.incidentDate,
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
          <label htmlFor="incidentDate">Date of Incident:</label>
          <input
            type="date"
            id="incidentDate"
            name="incidentDate"
            value={formData.incidentDate}
            onChange={handleChange}
            required
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
          {formData.attachments.length > 0 && (
            <ul className="attachment-list">
              {formData.attachments.map((file, idx) => (
                <li key={idx} className="attachment-list-item">
                  <span className="attachment-file-name">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="attachment-remove-btn"
                  >
                    Delete
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
