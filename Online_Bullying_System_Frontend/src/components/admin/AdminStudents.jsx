import React, { useState } from 'react';
import './admin.css';

const mockStudents = [
	{
		id: 1,
		name: '123',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
	},
	{
		id: 2,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
	},
	{
		id: 3,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
	},
	{
		id: 4,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/4.jpg',
	},
	{
		id: 5,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
	},
	{
		id: 6,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/6.jpg',
	},
	{
		id: 7,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
	},
	{
		id: 8,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
	},
  {
		id: 9,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
	},
  {
		id: 10,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
	},
  {
		id: 11,
		name: 'Ramon Ridwan',
		email: 'Ramonridwan@protonmail.com',
		avatar: 'https://randomuser.me/api/portraits/women/8.jpg',
	},
];

const ActionMenu = ({ onClose }) => (
	<div className="student-action-menu">
		<button onClick={onClose}>Edit Info</button>
		<button onClick={onClose}>Remove Student</button>
	</div>
);

const AdminStudents = () => {
    const [search, setSearch] = useState('');
    const [menuOpen, setMenuOpen] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [emailError, setEmailError] = useState('');
    const [editModal, setEditModal] = useState(false);
    const [editStudent, setEditStudent] = useState(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editError, setEditError] = useState('');
    const [removeModal, setRemoveModal] = useState(false);
    const [removeStudent, setRemoveStudent] = useState(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const studentsPerPage = 10;

    const filteredStudents = mockStudents.filter(
        student =>
            student.name.toLowerCase().includes(search.toLowerCase()) ||
            student.email.toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const paginatedStudents = filteredStudents.slice(
        (currentPage - 1) * studentsPerPage,
        currentPage * studentsPerPage
    );

    const handleAddStudent = () => {
        if (!emailInput.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setEmailError('Please enter a valid email address.');
            return;
        }
        setEmailError('');
        setShowModal(false);
        setEmailInput('');
        alert('Student invite processed for: ' + emailInput);
    };

    const handleEditStudent = () => {
        if (!editName.trim()) {
            setEditError('Name cannot be empty.');
            return;
        }
        if (!editEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            setEditError('Please enter a valid email address.');
            return;
        }
        setEditError('');
        setEditModal(false);
        setEditStudent(null);
        alert('Student info updated for: ' + editName + ' (' + editEmail + ')');
    };

    const handleResetPassword = () => {
        alert('Password reset link sent to: ' + editEmail);
    };

    const handleRemoveStudent = () => {
        setRemoveModal(false);
        alert('Student removed: ' + (removeStudent?.name || ''));
        setRemoveStudent(null);
    };

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Reset to first page when search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    return (
        <div className="admin-students-bg">
            <div className="admin-students-container">
                <div className="admin-students-header">
                    <h2 className="admin-students-title">Students</h2>
                    <div className="admin-students-actions">
                        <div className="admin-students-search">
                            <span className="admin-students-search-icon">
                                &#128269;
                            </span>
                            <input
                                type="text"
                                placeholder="Search student"
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
                            Add Students
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
                            {filteredStudents.length} Students
                        </div>
                        <span className="admin-students-table-header-label">
                            Action
                        </span>
                    </div>
                    <div>
                        {paginatedStudents.map((student, idx) => (
                            <div key={student.id} className="student-row">
                                <img
                                    src={student.avatar}
                                    alt={student.name}
                                    className="student-avatar"
                                />
                                <div className="student-info">
                                    <div className="student-name">{student.name}</div>
                                    <div className="student-email">
                                        {student.email}
                                    </div>
                                </div>
                                <div className="student-action">
                                    <button
                                        className="student-action-btn"
                                        onClick={() =>
                                            setMenuOpen(
                                                menuOpen === idx ? null : idx
                                            )
                                        }
                                    >
                                        &#8942;
                                    </button>
                                    {menuOpen === idx && (
                                        <div className="student-action-menu">
                                            <button
                                                onClick={() => {
                                                    setEditStudent(student);
                                                    setEditName(student.name);
                                                    setEditEmail(student.email);
                                                    setEditError('');
                                                    setEditModal(true);
                                                    setMenuOpen(null);
                                                }}
                                            >
                                                Edit Info
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setRemoveStudent(student);
                                                    setRemoveModal(true);
                                                    setMenuOpen(null);
                                                }}
                                            >
                                                Remove Student
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
                            <h3>Add Student</h3>
                            <p>Enter the student's email address to invite:</p>
                            <input
                                type="email"
                                className="admin-modal-input"
                                placeholder="student@email.com"
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
                                Clicking the proceed button will added Students into the entire system proceed?
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
                                    onClick={handleAddStudent}
                                >
                                    Process
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {editModal && (
                    <div className="modal-overlay">
                        <div className="modal">
                            <h3>Edit Student Info</h3>
                            <input
                                type="text"
                                className="admin-modal-input"
                                placeholder="Student Name"
                                value={editName}
                                onChange={e => {
                                    setEditName(e.target.value);
                                    setEditError('');
                                }}
                            />
                            <input
                                type="email"
                                className="admin-modal-input"
                                placeholder="student@email.com"
                                value={editEmail}
                                onChange={e => {
                                    setEditEmail(e.target.value);
                                    setEditError('');
                                }}
                            />
                            <button
                                className="admin-students-add-btn modal-reset-btn"
                                onClick={handleResetPassword}
                                type="button"
                            >
                                Reset Password
                            </button>
                            {editError && (
                                <div className="modal-error">
                                    {editError}
                                </div>
                            )}
                            <div className="modal-info">
                                Clicking the proceed button will edit student Info into the entire system proceed?
                            </div>
                            <div className="modal-actions">
                                <button
                                    className="btn"
                                    onClick={() => setEditModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="admin-students-add-btn modal-process-btn"
                                    onClick={handleEditStudent}
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
                            <h3>Remove Student</h3>
                            <p>
                                Are you sure you want to remove{' '}
                                <strong>{removeStudent?.name}</strong> from the system?
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
                                    onClick={handleRemoveStudent}
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

export default AdminStudents;