import React from 'react';
import { useNavigate } from 'react-router-dom';

// Demo report data (replace with import in production)
const demoReportData = [
  { date: '30/07/2025', id: 'A0023', name: 'Ibrahim', status: 'New' },
  { date: '02/08/2025', id: 'A0024', name: 'Leong', status: 'In Progress' },
  { date: '04/08/2025', id: 'A0025', name: 'Sabrina', status: 'New' },
  { date: '07/08/2025', id: 'A0026', name: 'Omar', status: 'Resolved' },
  { date: '09/08/2025', id: 'A0027', name: 'Bella', status: 'New' },
];

const dashboardStats = [
  { label: 'New Case', value: 1 },
  { label: 'Progress Case', value: 1 },
  { label: 'Complete Case', value: 2 },
  { label: 'Total Case', value: 5 },
];

const AdminHome = () => {
  const navigate = useNavigate();

  // Show the latest 5 reports (sorted by date descending)
  const latestReports = [...demoReportData]
    .sort((a, b) => {
      const toISO = (d) => d.split('/').reverse().join('-');
      return new Date(toISO(b.date)) - new Date(toISO(a.date));
    })
    .slice(0, 5);

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="dashboard-cards">
        {dashboardStats.map(stat => (
          <div className="dashboard-card" key={stat.label}>
            <div className="card-label">{stat.label}</div>
            <div className="card-circle">
              <span>{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Latest Reports Section */}
      <div className="latest-reports" style={{ marginTop: 32 }}>
        <h3 style={{ marginBottom: 12 }}>Latest Reports</h3>
        <table className="report-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Complaint ID</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {latestReports.map((row) => (
              <tr key={row.id}>
                <td style={{ padding: '8px' }}>{row.date}</td>
                <td style={{ padding: '8px' }}>{row.id}</td>
                <td style={{ padding: '8px' }}>{row.name}</td>
                <td style={{ padding: '8px' }}>
                  <span
                    className={
                      `status-badge ${
                        row.status === 'In Progress'
                          ? 'progress'
                          : row.status === 'Resolved'
                          ? 'resolved'
                          : row.status === 'Rejected'
                          ? 'rejected'
                          : 'new'
                      }`
                    }
                  >
                    {row.status}
                  </span>
                </td>
                <td style={{ padding: '8px' }}>
                  <button className="action-btn" title="View Report Incident">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            className="view-more-btn"
            style={{ textDecoration: 'underline', color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => navigate('/admin/reports')}
          >
            View More
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminHome;