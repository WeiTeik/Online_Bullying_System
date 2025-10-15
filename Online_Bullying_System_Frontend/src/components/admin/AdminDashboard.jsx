import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import AdminHome from './AdminHome';
import AdminReports from './AdminReports';
import AdminStudents from './AdminStudents';
import AdminMembers from './AdminMembers';
import AdminStatistics from './AdminStatistics';
import AdminSettings from './AdminSettings';
import AdminReportIncident from './AdminReportIncident';
import youMatterLogo from '../../assets/YouMatter_logo_bg_removed.png';
import { toAbsoluteUrl } from '../../services/api';
import './admin.css';

const navItems = [
  { label: 'Dashboard', icon: '🏠', section: 'dashboard', path: '/admin' },
  { label: 'Reports', icon: '📄', section: 'reports', path: '/admin/reports' },
  { label: 'Students', icon: '👥', section: 'students', path: '/admin/students' },
  { label: 'Admins', icon: '🛡️', section: 'admins', path: '/admin/admins' },
  { label: 'Statistics', icon: '📊', section: 'statistics', path: '/admin/statistics' },
  { label: 'Settings', icon: '⚙️', section: 'settings', path: '/admin/settings' },
  { label: 'Logout', icon: '↩️', section: 'logout', path: '/login' },
];

const AdminDashboard = ({
  currentUser,
  complaints,
  complaintsLoading,
  complaintsError,
  onRefreshComplaints,
  onUserUpdate,
  onLogout,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false); // <--- added state
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item) => {
    if (item.section === 'logout') {
      // open confirmation modal instead of immediate navigation
      setShowLogoutConfirm(true);
      return;
    }
    navigate(item.path);
    setActiveSection(item.section);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    if (typeof onLogout === 'function') {
      onLogout();
      return;
    }
    navigate('/login');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const avatarLabel = (currentUser?.full_name || currentUser?.username || currentUser?.email || 'Admin').trim();
  const avatarInitial = avatarLabel.charAt(0).toUpperCase();
  const avatarSrc = currentUser?.avatar_url ? toAbsoluteUrl(currentUser.avatar_url) : null;

  // Sync activeSection with location (supports direct linking / refresh)
  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, ''); // remove trailing slash
    if (path === '/admin') {
      setActiveSection('dashboard');
      return;
    }
    const match = navItems.find((n) => n.path === path);
    if (match) {
      setActiveSection(match.section);
    } else {
      // handle nested or unknown admin paths
      if (path.startsWith('/admin/reports')) setActiveSection('reports');
      else if (path.startsWith('/admin/students')) setActiveSection('students');
      else if (path.startsWith('/admin/admins')) setActiveSection('admins');
      else if (path.startsWith('/admin/statistics')) setActiveSection('statistics');
      else if (path.startsWith('/admin/settings')) setActiveSection('settings');
    }
  }, [location.pathname]);

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="sidebar">
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleNavClick(item)}
                onKeyPress={(e) => { if (e.key === 'Enter') handleNavClick(item); }}
                className={`nav-item${activeSection === item.section ? ' active' : ''}`}
                key={item.label}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>
      )}

      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-left">
        <button
          className="hamburger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle sidebar"
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>
          <img src={youMatterLogo} alt="YouMatter Logo" className="logo-img" />
        </div>
        <div className="admin-header-right">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={avatarLabel}
              className="admin-avatar"
            />
          ) : (
            <div className="admin-avatar admin-avatar--fallback" aria-hidden="true">
              {avatarInitial}
            </div>
          )}
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="modal">
            <h3 id="logout-title">Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={confirmLogout}>Yes, logout</button>
              <button className="btn" onClick={cancelLogout}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      

      {/* Main Content */}
      <div className="main-section">

        {/* Nested routes render the individual section components */}
        <Routes>
          <Route
            index
            element={
              <AdminHome
                complaints={complaints}
                isLoading={complaintsLoading}
                error={complaintsError}
              />
            }
          />
          <Route
            path="reports"
            element={
              <AdminReports
                currentUser={currentUser}
                onRefreshComplaints={onRefreshComplaints}
              />
            }
          />
          <Route
            path="reports/:complaintIdentifier"
            element={
              <AdminReportIncident
                currentUser={currentUser}
                onRefreshComplaints={onRefreshComplaints}
              />
            }
          />
          <Route path="students" element={<AdminStudents />} />
          <Route
            path="admins"
            element={<AdminMembers currentUser={currentUser} />}
          />
          <Route path="statistics" element={<AdminStatistics />} />
          <Route
            path="settings"
            element={
              <AdminSettings
                currentUser={currentUser}
                onUserUpdate={onUserUpdate}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
};

export default AdminDashboard;
