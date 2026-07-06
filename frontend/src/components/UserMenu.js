import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSettings, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import './UserMenu.css';

function getInitials(user) {
  const first = user?.first_name?.trim()?.[0] || '';
  const last = user?.last_name?.trim()?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return user?.email?.[0]?.toUpperCase() || '?';
}

function getDisplayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
  return name || user?.email || 'User';
}

const UserMenu = ({ onLogout }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const initials = getInitials(user);
  const displayName = getDisplayName(user);

  useEffect(() => {
    const onDoc = (e) => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  const handleSettings = () => {
    close();
    navigate('/settings');
  };

  const handleLogout = () => {
    close();
    onLogout();
  };

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`user-menu-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${displayName}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="user-menu-avatar" aria-hidden="true">
          {initials}
        </span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-info">
            <span className="user-menu-avatar user-menu-avatar--lg" aria-hidden="true">
              {initials}
            </span>
            <div className="user-menu-details">
              <span className="user-menu-name">{displayName}</span>
              <span className="user-menu-role">{user?.role}</span>
            </div>
          </div>

          <div className="user-menu-section">
            <span className="user-menu-section-label">Theme</span>
            <ThemeToggle />
          </div>

          <div className="user-menu-divider" />

          <button type="button" className="user-menu-item" role="menuitem" onClick={handleSettings}>
            <FiSettings aria-hidden="true" />
            <span>User settings</span>
          </button>

          <button type="button" className="user-menu-item user-menu-item--danger" role="menuitem" onClick={handleLogout}>
            <FiLogOut aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
