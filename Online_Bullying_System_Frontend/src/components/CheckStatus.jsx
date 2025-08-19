import React, { useState } from 'react';

// Check Status Component
function ComplaintStatus({ complaints }) {
  return (
    <div className="complaint-status">
      <h2>Complaint Status</h2>

      {complaints.length === 0 ? (
        <div className="no-complaints">
          <p>No complaints submitted yet.</p>
        </div>
      ) : (
        <div className="complaints-list">
          {complaints.map(complaint => (
            <div key={complaint.id} className="complaint-card">
              <div className="complaint-header">
                <h3>Complaint #{complaint.id}</h3>
                <span className={`status ${complaint.status}`}>
                  {complaint.status.toUpperCase()}
                </span>
              </div>
              <div className="complaint-details">
                <p><strong>Type:</strong> {complaint.incidentType}</p>
                <p><strong>Submitted:</strong> {complaint.submittedAt}</p>
                <p><strong>Room:</strong> {complaint.roomNumber}</p>
                {!complaint.anonymous && (
                  <p><strong>Student:</strong> {complaint.studentName}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export {ComplaintStatus}