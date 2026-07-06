import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  FiMenu,
  FiX,
  FiHome,
  FiBriefcase,
  FiFileText,
  FiUsers,
  FiClock,
  FiDatabase,
  FiSettings,
  FiLayers,
  FiUserCheck,
  FiChevronsLeft,
  FiChevronsRight,
} from 'react-icons/fi';
import { APP_UI_VERSION } from '../version';
import NotificationBell from './NotificationBell';
import BrandLogo from './BrandLogo';
import UserMenu from './UserMenu';
import { PageTransition, MotionSidebarItem } from './motion';
import './Layout.css';

const SIDEBAR_COLLAPSED_KEY = 'gobunny-sidebar-collapsed';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: FiHome, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_dashboard' },
    { path: '/jobs', label: 'Jobs', icon: FiBriefcase, roles: ['candidate', 'consultant', 'admin'], permission: 'tab_jobs' },
    { path: '/resumes', label: 'Resume Studio', icon: FiFileText, roles: ['candidate'], permission: 'tab_resumes' },
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
    <div className={`layout ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <nav className="navbar layer-front">
        <div className="navbar-content">
          <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <Link to="/" className="navbar-brand" onClick={() => setSidebarOpen(false)} aria-label="GoDash by GoBunnyy home">
            <BrandLogo variant="navbar" />
          </Link>
          <div className="navbar-trailing">
            <NotificationBell />
            <UserMenu onLogout={handleLogout} />
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
        <aside className={`sidebar layer-mid ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sidebar-header">
            <button
              type="button"
              className="sidebar-collapse-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
            </button>
          </div>
          <nav className="sidebar-nav">
            {filteredMenuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path ||
                (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <MotionSidebarItem
                  key={item.path}
                  className="sidebar-item-wrap"
                  isActive={isActive}
                  delay={index * 0.04}
                >
                  <Link
                    to={item.path}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon aria-hidden="true" />
                    <span className="sidebar-item-label">{item.label}</span>
                  </Link>
                </MotionSidebarItem>
              );
            })}
          </nav>
        </aside>

        <main className="main-content layer-recess">
          <div className="page-stage">
            <PageTransition>{children}</PageTransition>
          </div>
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

