import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiX, FiHome, FiBriefcase, FiFileText, FiUsers, FiClock, FiDatabase, FiSettings, FiLogOut } from 'react-icons/fi';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: FiHome, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_dashboard' },
    { path: '/jobs', label: 'Jobs', icon: FiBriefcase, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_jobs' },
    { path: '/resumes', label: 'My Resumes', icon: FiFileText, roles: ['candidate'], permission: 'tab_resumes' },
    { path: '/matches', label: 'Matches', icon: FiFileText, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_matches' },
    { path: '/candidates', label: 'Candidates', icon: FiUsers, roles: ['consultant', 'admin'], permission: 'tab_candidates' },
    { path: '/timesheets', label: 'Timesheets', icon: FiClock, roles: ['consultant', 'admin'], permission: 'tab_timesheets' },
    { path: '/crm', label: 'CRM', icon: FiDatabase, roles: ['consultant', 'admin'], permission: 'tab_crm' },
    { path: '/settings', label: 'Settings', icon: FiSettings, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_settings' },
  ];

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-content">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <h1 className="navbar-title">Job Hunting Platform</h1>
          <div className="navbar-user">
            <span>{user?.first_name} {user?.last_name}</span>
            <span className="navbar-role">{user?.role}</span>
            <button onClick={handleLogout} className="btn-logout">
              <FiLogOut /> Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="layout-body">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <nav className="sidebar-nav">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path));
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

