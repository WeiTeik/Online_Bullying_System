import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getComplaints } from '../../services/api';

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

const statusClass = (status) => {
  const normalized = (status || '').toLowerCase();
  if (normalized.includes('progress')) return 'progress';
  if (normalized.includes('resolve') || normalized.includes('complete')) return 'resolved';
  if (normalized.includes('reject') || normalized.includes('fail')) return 'rejected';
  return 'new';
};

const normaliseStatusLabel = (status) => {
  const raw = (status || '').toString().trim();
  if (!raw) return 'New';
  const normalized = raw.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'new' || normalized === 'pending') return 'New';
  if (normalized === 'in_progress' || normalized === 'investigating') return 'Investigating';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const AdminReports = ({ currentUser, onRefreshComplaints }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      setComplaints([]);
      setLoading(false);
      setError('Please sign in to view complaints.');
      return;
    }

    const role = (currentUser.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      setComplaints([]);
      setLoading(false);
      setError('You do not have permission to view this page.');
      return;
    }

    let isMounted = true;
    const fetchComplaints = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getComplaints({ include_comments: false });
        if (isMounted) {
          setComplaints(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          const message =
            err?.response?.data?.error ||
            err?.message ||
            'Unable to load complaints.';
          setError(message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchComplaints();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const reportRows = useMemo(() => {
    return complaints.map((item) => ({
      key: item.id,
      complaintId: item.id,
      referenceCode: item.reference_code || `#${item.id}`,
      identifier: item.reference_code || (item.id != null ? String(item.id) : ''),
      submittedAt: item.submitted_at,
      date: formatDateTime(item.submitted_at),
      name: item.student_name || 'Anonymous',
      status: item.status || 'new',
      statusLabel: normaliseStatusLabel(item.status || 'new'),
    }));
  }, [complaints]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reportRows;
    return reportRows.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.referenceCode.toLowerCase().includes(q) ||
      r.date.toLowerCase().includes(q) ||
      r.statusLabel.toLowerCase().includes(q)
    );
  }, [search, reportRows]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));

  // reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // clamp currentPage when filteredData shrinks
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * rowsPerPage;
  const pageData = filteredData.slice(startIndex, startIndex + rowsPerPage);

  const goToPage = (n) => {
    if (loading || error) return;
    const page = Math.max(1, Math.min(totalPages, n));
    setCurrentPage(page);
  };

  const renderPageButtons = () => {
    const buttons = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let p = start; p <= end; p += 1) {
      buttons.push(
        <button
          key={p}
          type="button"
          onClick={() => goToPage(p)}
          aria-current={p === currentPage ? 'page' : undefined}
          disabled={p === currentPage || loading || !!error}
          className={`pagination-btn${p === currentPage ? ' pagination-btn-active' : ''}`}
        >
          {p}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="report-section">
      <div className="report-header">
        <h2 className="report-title">Reports</h2>
        <div className="report-header-actions">
          <div className="admin-students-search report-search">
            <span className="admin-students-search-icon" aria-hidden="true">
              &#128269;
            </span>
            <input
              type="search"
              value={search}
              disabled={loading || !!error}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name / reference / date / status"
              aria-label="Search reports"
              className="admin-students-search-input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="admin-search-clear"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

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
          {loading ? (
            <tr>
              <td colSpan="5" className="report-table-message">Loading complaints…</td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan="5" className="report-table-message report-table-error">{error}</td>
            </tr>
          ) : pageData.length === 0 ? (
            <tr>
              <td colSpan="5" className="report-table-message">No reports found.</td>
            </tr>
          ) : (
            pageData.map((row) => (
              <tr key={row.complaintId}>
                <td>{row.date}</td>
                <td>{row.referenceCode}</td>
                <td>{row.name}</td>
                <td>
                  <span
                    className={`status-badge ${statusClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
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

      <div className="report-pagination">
        <div className="report-pagination-summary">
          {loading
            ? 'Loading…'
            : filteredData.length === 0
            ? '0 items'
            : `Showing ${startIndex + 1}–${Math.min(startIndex + rowsPerPage, filteredData.length)} of ${filteredData.length}`}
        </div>

        <div className="report-pagination-controls">
          <button
            type="button"
            className="pagination-btn report-pagination-nav"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1 || loading || !!error}
          >
            « First
          </button>
          <button
            type="button"
            className="pagination-btn report-pagination-nav"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1 || loading || !!error}
          >
            ‹ Prev
          </button>

          {renderPageButtons()}

          <button
            type="button"
            className="pagination-btn report-pagination-nav"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || loading || !!error}
          >
            Next ›
          </button>
          <button
            type="button"
            className="pagination-btn report-pagination-nav"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || loading || !!error}
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
