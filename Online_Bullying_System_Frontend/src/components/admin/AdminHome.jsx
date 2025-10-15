import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin.css'; 

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normaliseStatus = (status) => {
  const raw = (status || '').toString().trim();
  if (!raw) return 'New';
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'new' || normalized === 'pending') return 'New';
  if (normalized === 'in_progress' || normalized === 'investigating') return 'Investigating';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const statusClass = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('progress')) return 'progress';
  if (normalized.includes('resolve') || normalized.includes('complete')) return 'resolved';
  if (normalized.includes('reject') || normalized.includes('fail')) return 'rejected';
  return 'new';
};

const AdminHome = ({ complaints = [], isLoading, error }) => {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const totals = complaints.reduce(
      (acc, complaint) => {
        const status = (complaint.status || '').toLowerCase();
        if (status === 'in_progress') acc.progress += 1;
        else if (status === 'resolved') acc.complete += 1;
        else if (status === 'rejected') acc.rejected += 1;
        else if (status === 'new') acc.new += 1;
        else acc.other += 1;
        acc.total += 1;
        return acc;
      },
      { new: 0, progress: 0, complete: 0, rejected: 0, other: 0, total: 0 }
    );

    return [
      { label: 'New Case', value: totals.new },
      { label: 'Investigating Case', value: totals.progress },
      { label: 'Complete Case', value: totals.complete },
      { label: 'Reject Case', value: totals.rejected },
      { label: 'Total Case', value: totals.total },
    ];
  }, [complaints]);

  const latestReports = useMemo(() => {
    if (!Array.isArray(complaints) || complaints.length === 0) {
      return [];
    }
    const getTime = (item) => new Date(item.submitted_at || item.submittedAt || 0).getTime();
    return [...complaints]
      .sort((a, b) => getTime(b) - getTime(a))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        referenceCode: item.reference_code || (item.id != null ? `#${item.id}` : ''),
        identifier: item.reference_code || (item.id != null ? String(item.id) : ''),
        name: item.student_name || 'Anonymous',
        submittedAt: item.submitted_at || item.submittedAt,
        status: item.status || 'new',
      }));
  }, [complaints]);

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="dashboard-cards">
        {stats.map(stat => (
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
        <table className="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Complaint ID</th>
              <th>Name</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>
                  Loading recent reports…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '12px', color: '#c0392b' }}>
                  {error}
                </td>
              </tr>
            ) : latestReports.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>
                  No reports available yet.
                </td>
              </tr>
            ) : (
              latestReports.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.submittedAt)}</td>
                  <td>{row.referenceCode}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`status-badge ${statusClass(row.status)}`}>
                      {normaliseStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="action-btn"
                      title="View Report Incident"
                      onClick={() => row.identifier && navigate(`/admin/reports/${encodeURIComponent(row.identifier)}`)}
                      disabled={!row.identifier}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button
            className="view-more-btn"
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
