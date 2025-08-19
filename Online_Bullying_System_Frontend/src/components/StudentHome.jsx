import React from 'react';

function HomePage() {
  return (
    <div className="home-page">
      <section className="hero">
        <h2>Online Bullying Complaint System</h2>
        <p className="hero-subtitle">
          A safe and confidential platform for hostel students to report bullying incidents
        </p>
        <div className="hero-stats">
          <div className="stat">
            <h3>24/7</h3>
            <p>Available Support</p>
          </div>
          <div className="stat">
            <h3>100%</h3>
            <p>Confidential</p>
          </div>
          <div className="stat">
            <h3>Fast</h3>
            <p>Response Time</p>
          </div>
        </div>
      </section>

      <section className="features">
        <h3>How It Works</h3>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h4>Submit Report</h4>
            <p>Fill out a secure form with details about the incident</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔍</div>
            <h4>Investigation</h4>
            <p>Our team reviews and investigates your complaint promptly</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✅</div>
            <h4>Resolution</h4>
            <p>We work to resolve the issue and ensure your safety</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage;