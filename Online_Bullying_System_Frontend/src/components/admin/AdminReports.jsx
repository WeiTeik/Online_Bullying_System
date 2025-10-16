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

const normaliseStatusKey = (status) => {
  const raw = (status || '').toString().trim();
  if (!raw) return 'new';
  return raw.toLowerCase().replace(/\s+/g, '_');
};

const parseDateFilter = (value, endOfDay = false) => {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00';
  const date = new Date(`${value}${suffix}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const DEFAULT_FILTERS = Object.freeze({
  status: 'all',
  startDate: '',
  endDate: '',
});

const AdminReports = ({ currentUser, onRefreshComplaints }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(() => ({ ...DEFAULT_FILTERS }));
  const [filterError, setFilterError] = useState('');
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
      submittedTime: (() => {
        if (!item.submitted_at) return null;
        const submittedDate = new Date(item.submitted_at);
        const time = submittedDate.getTime();
        return Number.isNaN(time) ? null : time;
      })(),
      date: formatDateTime(item.submitted_at),
      name: item.student_name || 'Anonymous',
      status: item.status || 'new',
      statusLabel: normaliseStatusLabel(item.status || 'new'),
      statusKey: normaliseStatusKey(item.status || 'new'),
    }));
  }, [complaints]);

  const statusOptions = useMemo(() => {
    const optionsMap = new Map();
    reportRows.forEach((row) => {
      if (!row.statusKey || optionsMap.has(row.statusKey)) return;
      optionsMap.set(row.statusKey, row.statusLabel);
    });
    const options = Array.from(optionsMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const baseOptions = [{ value: 'all', label: 'All statuses' }, ...options];
    if (filters.status !== 'all' && !optionsMap.has(filters.status)) {
      baseOptions.push({
        value: filters.status,
        label: normaliseStatusLabel(filters.status),
      });
    }
    return baseOptions;
  }, [reportRows, filters.status]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    const startTime = parseDateFilter(filters.startDate);
    const endTime = parseDateFilter(filters.endDate, true);

    return reportRows.filter((r) => {
      if (filters.status !== 'all' && r.statusKey !== filters.status) return false;
      if (startTime && (r.submittedTime == null || r.submittedTime < startTime)) return false;
      if (endTime && (r.submittedTime == null || r.submittedTime > endTime)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.referenceCode.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q) ||
        r.statusLabel.toLowerCase().includes(q)
      );
    });
  }, [search, reportRows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));

  // reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

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

  const handleOpenFilters = () => {
    if (filterPanelOpen) {
      setFilterError('');
      setDraftFilters({ ...filters });
      setFilterPanelOpen(false);
      return;
    }
    setFilterError('');
    setDraftFilters({ ...filters });
    setFilterPanelOpen(true);
  };

  const handleApplyFilters = () => {
    if (draftFilters.startDate && draftFilters.endDate) {
      const startTime = parseDateFilter(draftFilters.startDate);
      const endTime = parseDateFilter(draftFilters.endDate, true);
      if (startTime && endTime && startTime > endTime) {
        setFilterError('Start date cannot be later than end date.');
        return;
      }
    }
    setFilterError('');
    setFilters({ ...draftFilters });
    setFilterPanelOpen(false);
  };

  const handleCancelFilters = () => {
    setFilterError('');
    setDraftFilters({ ...filters });
    setFilterPanelOpen(false);
  };

  const handleClearFilters = () => {
    setFilterError('');
    setDraftFilters({ ...DEFAULT_FILTERS });
    setFilters({ ...DEFAULT_FILTERS });
    setFilterPanelOpen(false);
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
          <button
            type="button"
            className="filter-button"
            aria-expanded={filterPanelOpen}
            onClick={handleOpenFilters}
          >
            <span className="sr-only">Toggle report filters</span>
            <svg className="filter-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.586a2 2 0 0 1-.586 1.414l-4.828 4.828A2 2 0 0 0 14 14.242V19l-4 2v-6.758a2 2 0 0 0-.586-1.414L4.586 9A2 2 0 0 1 4 7.586z"
                fill="currentColor"
              />
            </svg>
          </button>
          {filterPanelOpen && (
            <div className="filter-panel" role="dialog" aria-label="Report filters">
              <h4>Filter reports</h4>
              <div className="filter-section filter-section-range">
                <div>
                  <label htmlFor="report-start-date" className="filter-label">
                    Start date
                  </label>
                  <input
                    id="report-start-date"
                    type="date"
                    value={draftFilters.startDate}
                    max={draftFilters.endDate || undefined}
                    onChange={(event) => {
                      setFilterError('');
                      const nextValue = event.target.value;
                      setDraftFilters((prev) => ({
                        ...prev,
                        startDate: nextValue,
                      }));
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="report-end-date" className="filter-label">
                    End date
                  </label>
                  <input
                    id="report-end-date"
                    type="date"
                    value={draftFilters.endDate}
                    min={draftFilters.startDate || undefined}
                    onChange={(event) => {
                      setFilterError('');
                      const nextValue = event.target.value;
                      setDraftFilters((prev) => ({
                        ...prev,
                        endDate: nextValue,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="filter-section">
                <label htmlFor="report-status-filter" className="filter-label">
                  Status
                </label>
                <select
                  id="report-status-filter"
                  value={draftFilters.status}
                  onChange={(event) => {
                    setFilterError('');
                    setDraftFilters((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }));
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              {filterError && <p className="filter-error">{filterError}</p>}
              <div className="filter-actions">
                <button type="button" className="btn" onClick={handleClearFilters}>
                  Clear
                </button>
                <button type="button" className="btn" onClick={handleCancelFilters}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleApplyFilters}>
                  Apply
                </button>
              </div>
            </div>
          )}
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
