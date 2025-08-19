import React, { useState } from 'react';

// Resources Component
function Resources() {
  return (
    <div className="resources">
      <h2>Support Resources</h2>

      <div className="resource-section">
        <h3>Emergency Contacts</h3>
        <div className="contact-grid">
          <div className="contact-card">
            <h4>Student Counselor</h4>
            <p>📞 +604-1234567</p>
            <p>📧 counselor@inti.edu.my</p>
          </div>
          <div className="contact-card">
            <h4>Talian Kasih (Counselors)</h4>
            <p>📞 15999</p>
            <p>
              <a 
                href="https://www.kpwkm.gov.my/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#007bff', textDecoration: 'underline' }}
              > https://www.kpwkm.gov.my/
              </a>
            </p>
          </div>
          <div className="contact-card">
            <h4>Emergency Services</h4>
            <p>📞 999</p>
            <p>Available 24/7</p>
          </div>
        </div>
      </div>

      <div className="resource-section">
        <h3>What Constitutes Bullying?</h3>
        <ul className="bullying-types">
          <li><strong>Physical Bullying:</strong> Hitting, kicking, pushing, damaging property</li>
          <li><strong>Verbal Bullying:</strong> Name-calling, insults, threats, inappropriate comments</li>
          <li><strong>Social Bullying:</strong> Exclusion, spreading rumors, public embarrassment</li>
          <li><strong>Cyber Bullying:</strong> Online harassment, threatening messages, sharing private information</li>
        </ul>
      </div>

      <div className="resource-section">
        <h3>Your Rights</h3>
        <ul className="rights-list">
          <li>Right to feel safe in your living environment</li>
          <li>Right to report incidents without fear of retaliation</li>
          <li>Right to confidential support and counseling</li>
          <li>Right to have complaints investigated promptly</li>
          <li>Right to be treated with dignity and respect</li>
        </ul>
      </div>
    </div>
  )
}

export {Resources}