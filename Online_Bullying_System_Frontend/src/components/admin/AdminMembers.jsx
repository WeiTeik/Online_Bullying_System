import React, { useState } from 'react';
import './admin.css';

const mockAdmins = [
  {
    id: 1,
    name: 'Alice Admin',
    email: 'alice@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/10.jpg',
  },
  {
    id: 2,
    name: 'Bob Admin',
    email: 'bob@admin.com',
    avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
  },
  {
    id: 3,
    name: 'Charlie Admin',
    email: 'charlie@admin.com',
    avatar: 'https://randomuser.me/api/portraits/men/12.jpg',
  },
  {
    id: 4,
    name: 'Diana Admin',
    email: 'diana@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/13.jpg',
  },
  {
    id: 5,
    name: 'Eve Admin',
    email: 'eve@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/14.jpg',
  },
  {
    id: 6,
    name: 'Frank Admin',
    email: 'frank@admin.com',
    avatar: 'https://randomuser.me/api/portraits/men/15.jpg',
  },
  {
    id: 7,
    name: 'Grace Admin',
    email: 'grace@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/16.jpg',
  },
  {
    id: 8,
    name: 'Henry Admin',
    email: 'henry@admin.com',
    avatar: 'https://randomuser.me/api/portraits/men/17.jpg',
  },
  {
    id: 9,
    name: 'Ivy Admin',
    email: 'ivy@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/18.jpg',
  },
  {
    id: 10,
    name: 'Jack Admin',
    email: 'jack@admin.com',
    avatar: 'https://randomuser.me/api/portraits/men/19.jpg',
  },
  {
    id: 11,
    name: 'Kate Admin',
    email: 'kate@admin.com',
    avatar: 'https://randomuser.me/api/portraits/women/20.jpg',
  },
];

const AdminMembers = () => {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [removeModal, setRemoveModal] = useState(false);
  const [removeAdmin, setRemoveAdmin] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const adminsPerPage = 10;

  const filteredAdmins = mockAdmins.filter(
    admin =>
      admin.name.toLowerCase().includes(search.toLowerCase()) ||
      admin.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredAdmins.length / adminsPerPage);
  const paginatedAdmins = filteredAdmins.slice(
    (currentPage - 1) * adminsPerPage,
    currentPage * adminsPerPage
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleRemoveAdmin = () => {
    setRemoveModal(false);
    alert('Admin removed: ' + (removeAdmin?.name || ''));
    setRemoveAdmin(null);
  };

  const handleAddAdmin = () => {
    if (!emailInput.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setShowModal(false);
    setEmailInput('');
    alert('Admin invite processed for: ' + emailInput);
  };

  return (
    <div className="admin-students-bg">
      <div className="admin-students-container">
        <div className="admin-students-header">
          <h2 className="admin-students-title">Admins</h2>
          <div className="admin-students-actions">
            <div className="admin-students-search">
              <span className="admin-students-search-icon">
                &#128269;
              </span>
              <input
                type="text"
                placeholder="Search admin"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="admin-students-search-input"
              />
            </div>
            <button
              className="admin-students-add-btn"
              onClick={() => setShowModal(true)}
            >
              <span className="admin-students-add-icon">+</span>
              Add Admin
            </button>
          </div>
        </div>
        <div className="admin-students-table student-table-scroll">
          <div className="admin-students-table-header">
            <div className="admin-students-table-header-left">
              <span className="admin-students-table-header-label">
                User Name
              </span>
            </div>
            <div className="admin-students-table-header-count">
              {filteredAdmins.length} Admins
            </div>
            <span className="admin-students-table-header-label">
              Action
            </span>
          </div>
          <div>
            {paginatedAdmins.map((admin, idx) => (
              <div key={admin.id} className="student-row">
                <img
                  src={admin.avatar}
                  alt={admin.name}
                  className="student-avatar"
                />
                <div className="student-info">
                  <div className="student-name">{admin.name}</div>
                  <div className="student-email">
                    {admin.email}
                  </div>
                </div>
                <div className="student-action">
                  <button
                    className="student-action-btn"
                    onClick={() =>
                      setMenuOpen(menuOpen === idx ? null : idx)
                    }
                  >
                    &#8942;
                  </button>
                  {menuOpen === idx && (
                    <div className="student-action-menu">
                      <button
                        onClick={() => {
                          setRemoveAdmin(admin);
                          setRemoveModal(true);
                          setMenuOpen(null);
                        }}
                      >
                        Remove Admin
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                className={`pagination-btn${currentPage === i + 1 ? ' pagination-btn-active' : ''}`}
                onClick={() => handlePageChange(i + 1)}
                aria-current={currentPage === i + 1 ? 'page' : undefined}
              >
                {i + 1}
              </button>
            ))}
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Add Admin</h3>
              <p>Enter the admin's email address to invite:</p>
              <input
                type="email"
                className="admin-modal-input"
                placeholder="admin@email.com"
                value={emailInput}
                onChange={e => {
                  setEmailInput(e.target.value);
                  setEmailError('');
                }}
              />
              {emailError && (
                <div className="modal-error">
                  {emailError}
                </div>
              )}
              <div className="modal-info">
                Clicking the proceed button will add this Admin into the entire system. Proceed?
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="admin-students-add-btn modal-process-btn"
                  onClick={handleAddAdmin}
                >
                  Process
                </button>
              </div>
            </div>
          </div>
        )}
        {removeModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Remove Admin</h3>
              <p>
                Are you sure you want to remove{' '}
                <strong>{removeAdmin?.name}</strong> from the system?
              </p>
              <div className="modal-warning">
                This action cannot be undone.
              </div>
              <div className="modal-actions">
                <button
                  className="btn"
                  onClick={() => setRemoveModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleRemoveAdmin}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMembers;