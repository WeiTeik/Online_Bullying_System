import React from 'react';
import StudentProfilePage from '../StudentProfilePage';

const AdminSettings = ({ currentUser, onUserUpdate, onLogout }) => (
  <StudentProfilePage
    currentUser={currentUser}
    onUserUpdate={onUserUpdate}
    onLogout={onLogout}
    showHistory={false}
    allowNameEdit
  />
);

export default AdminSettings;
