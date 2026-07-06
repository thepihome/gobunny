import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StaggerGrid, StaggerItem } from './motion';
import {
  FiBriefcase,
  FiUsers,
  FiFileText,
  FiClock,
  FiDatabase,
  FiSettings,
  FiLayers,
} from 'react-icons/fi';

const ACTIONS_BY_ROLE = {
  candidate: [
    { path: '/jobs', label: 'Browse Jobs', icon: FiBriefcase, desc: 'Find open positions' },
    { path: '/matches', label: 'View Matches', icon: FiFileText, desc: 'AI-matched opportunities' },
    { path: '/resumes', label: 'My Resumes', icon: FiFileText, desc: 'Manage resume files' },
    { path: '/settings', label: 'Profile', icon: FiSettings, desc: 'Update your profile' },
  ],
  consultant: [
    { path: '/candidates', label: 'Candidates', icon: FiUsers, desc: 'Manage your pipeline' },
    { path: '/jobs', label: 'Jobs', icon: FiBriefcase, desc: 'Active job listings' },
    { path: '/matches', label: 'Matches', icon: FiFileText, desc: 'Review job matches' },
    { path: '/timesheets', label: 'Timesheets', icon: FiClock, desc: 'Log and submit hours' },
    { path: '/crm', label: 'CRM', icon: FiDatabase, desc: 'Track interactions' },
  ],
  admin: [
    { path: '/candidates', label: 'Candidates', icon: FiUsers, desc: 'Full candidate list' },
    { path: '/jobs', label: 'Jobs', icon: FiBriefcase, desc: 'Manage postings' },
    { path: '/metadata', label: 'Metadata', icon: FiLayers, desc: 'Roles & configuration' },
    { path: '/settings', label: 'Settings', icon: FiSettings, desc: 'System settings' },
    { path: '/register', label: 'Register', icon: FiUsers, desc: 'Add new users' },
  ],
};

export default function DashboardQuickActions({ role }) {
  const navigate = useNavigate();
  const actions = ACTIONS_BY_ROLE[role] || ACTIONS_BY_ROLE.candidate;

  return (
    <StaggerGrid className="quick-actions-grid">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <StaggerItem key={action.path}>
            <button
              type="button"
              className="quick-action-card"
              onClick={() => navigate(action.path)}
            >
              <span className="quick-action-icon">
                <Icon />
              </span>
              <span className="quick-action-text">
                <strong>{action.label}</strong>
                <small>{action.desc}</small>
              </span>
            </button>
          </StaggerItem>
        );
      })}
    </StaggerGrid>
  );
}
