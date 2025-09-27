import React from 'react';
import StudentProfilePage from '../StudentProfilePage';

const AdminSettings = () => (
  <div className="admin-settings">
    <StudentProfilePage showHistory={false} />
  </div>
);

export default AdminSettings;