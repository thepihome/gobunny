import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { FiMenu, FiX, FiHome, FiBriefcase, FiFileText, FiUsers, FiClock, FiDatabase, FiSettings, FiLogOut, FiLayers, FiUserCheck } from 'react-icons/fi';
import { APP_UI_VERSION } from '../version';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
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
    { path: '/users', label: 'Users', icon: FiUserCheck, roles: ['admin'], permission: 'tab_users' },
    { path: '/metadata', label: 'Metadata', icon: FiLayers, roles: ['admin'], permission: 'tab_metadata' },
    // Register tab: admin-only in UI; permission 'tab_register' controls visibility via settings/groups in future
    { path: '/register', label: 'Register', icon: FiUsers, roles: ['admin'], permission: 'tab_register' },
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
          <Link to="/" className="navbar-brand" onClick={() => setSidebarOpen(false)}>
            <span className="brand-mark" aria-hidden="true">GB</span>
            <span className="brand-text">
              <span className="brand-name">GoBunny</span>
              <span className="brand-tagline">Platform</span>
            </span>
          </Link>
          <div className="navbar-trailing">
            <ThemeToggle compact />
            <NotificationBell />
            <div className="navbar-user">
              <span>{user?.first_name} {user?.last_name}</span>
              <span className="navbar-role">{user?.role}</span>
              <button onClick={handleLogout} className="btn-logout">
                <FiLogOut /> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="layout-body">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              key="sidebar-backdrop"
              className="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
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
          <div
            className="layout-build-stamp"
            title="If this version does not change after deploy, the browser or CDN is still serving an old index.html or bundle."
          >
            UI {APP_UI_VERSION}
            {process.env.REACT_APP_BUILD_REF ? ` · ${process.env.REACT_APP_BUILD_REF}` : ''}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

