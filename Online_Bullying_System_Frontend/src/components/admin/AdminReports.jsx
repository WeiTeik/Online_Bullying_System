import React, { useState, useMemo, useEffect } from 'react';

const reportData = [
  { date: '20/06/2025', id: 'A0011', name: 'Jocelyn', status: 'New' },
  { date: '14/06/2025', id: 'A0010', name: 'Anonymous', status: 'New' },
  { date: '22/05/2025', id: 'A0009', name: 'Elyn', status: 'Rejected' },
  { date: '14/01/2025', id: 'A0008', name: 'Yi Qi', status: 'In Progress' },
  { date: '02/07/2025', id: 'A0012', name: 'Hafiz', status: 'New' },
  { date: '05/07/2025', id: 'A0013', name: 'Siti', status: 'In Progress' },
  { date: '07/07/2025', id: 'A0014', name: 'Alex', status: 'Resolved' },
  { date: '10/07/2025', id: 'A0015', name: 'Maya', status: 'New' },
  { date: '12/07/2025', id: 'A0016', name: 'Daniel', status: 'In Progress' },
  { date: '15/07/2025', id: 'A0017', name: 'Chong Wei', status: 'Resolved' },
  { date: '18/07/2025', id: 'A0018', name: 'Farah', status: 'New' },
  { date: '20/07/2025', id: 'A0019', name: 'Anonymous', status: 'New' },
  { date: '22/07/2025', id: 'A0020', name: 'Nur', status: 'In Progress' },
  { date: '25/07/2025', id: 'A0021', name: 'Rafa', status: 'New' },
  { date: '28/07/2025', id: 'A0022', name: 'Tina', status: 'Resolved' },
  { date: '30/07/2025', id: 'A0023', name: 'Ibrahim', status: 'New' },
  { date: '02/08/2025', id: 'A0024', name: 'Leong', status: 'In Progress' },
  { date: '04/08/2025', id: 'A0025', name: 'Sabrina', status: 'New' },
  { date: '07/08/2025', id: 'A0026', name: 'Omar', status: 'Resolved' },
  { date: '09/08/2025', id: 'A0027', name: 'Bella', status: 'New' },
  { date: '12/08/2025', id: 'A0028', name: 'Khalid', status: 'In Progress' },
  { date: '14/08/2025', id: 'A0029', name: 'Jasmine', status: 'New' },
  { date: '17/08/2025', id: 'A0030', name: 'Arif', status: 'Resolved' },
  { date: '19/08/2025', id: 'A0031', name: 'Hannah', status: 'New' },
  { date: '21/08/2025', id: 'A0032', name: 'Marcus', status: 'In Progress' },
  { date: '24/08/2025', id: 'A0033', name: 'Lin', status: 'New' },
  { date: '26/08/2025', id: 'A0034', name: 'Priya', status: 'Resolved' },
  { date: '29/08/2025', id: 'A0035', name: 'Azlan', status: 'New' },
  { date: '31/08/2025', id: 'A0036', name: 'Anonymous', status: 'In Progress' }
];

const AdminReports = () => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reportData;
    return reportData.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.date.toLowerCase().includes(q) ||
      r.status.toLowerCase().includes(q)
    );
  }, [search]);

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
          disabled={p === currentPage}
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
      <div
        className="report-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
      >
        <h2 style={{ margin: 0 }}>Reports</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name / ID / date / status"
            aria-label="Search reports"
            className="report-search"
            style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="clear-btn"
              style={{ padding: '6px 8px' }}
            >
              ×
            </button>
          )}
        </div>
      </div>

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
          {pageData.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ padding: '12px', textAlign: 'center' }}>No reports found.</td>
            </tr>
          ) : (
            pageData.map((row) => (
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
            ))
          )}
        </tbody>
      </table>

      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ fontSize: 13, color: '#555' }}>
          {filteredData.length === 0
            ? '0 items'
            : `Showing ${startIndex + 1}–${Math.min(startIndex + rowsPerPage, filteredData.length)} of ${filteredData.length}`}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            style={{ padding: '6px 8px', marginRight: 8 }}
          >
            « First
          </button>
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            style={{ padding: '6px 8px', marginRight: 8 }}
          >
            ‹ Prev
          </button>

          {renderPageButtons()}

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 8px', marginLeft: 8 }}
          >
            Next ›
          </button>
          <button
            type="button"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            style={{ padding: '6px 8px', marginLeft: 8 }}
          >
            Last »
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;