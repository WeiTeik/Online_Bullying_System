import React, { useState } from 'react';

function SubmitComplaint({ onSubmit }) {
  const [formData, setFormData] = useState({
    studentName: '',
    studentId: '',
    roomNumber: '',
    incidentType: '',
    description: '',
    incidentDate: '',
    witnesses: '',
    anonymous: false
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({
      studentName: '',
      studentId: '',
      roomNumber: '',
      incidentType: '',
      description: '',
      incidentDate: '',
      witnesses: '',
      anonymous: false
    })
    alert('Complaint submitted successfully!')
  }

  return (
    <div className="submit-complaint">
      <h2>Submit a Complaint</h2>
      <p className="form-intro">
        Please provide as much detail as possible. All information is kept confidential.
      </p>

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
            disabled={formData.anonymous}
          />
        </div>

        <div className="form-group">
          <label htmlFor="studentId">Student ID:</label>
          <input
            type="text"
            id="studentId"
            name="studentId"
            value={formData.studentId}
            onChange={handleChange}
            required={!formData.anonymous}
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

        <button type="submit" className="submit-btn">
          Submit Complaint
        </button>
      </form>
    </div>
  )
}

export { SubmitComplaint };