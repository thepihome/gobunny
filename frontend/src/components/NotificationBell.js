import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import {
  FiBell,
  FiBriefcase,
  FiTrendingUp,
  FiAlertCircle,
  FiCalendar,
  FiClock,
  FiUserPlus,
  FiCheckSquare,
  FiDatabase,
  FiTrash2,
} from 'react-icons/fi';
import './NotificationBell.css';
import LoadingButton from './LoadingButton';

const TYPE_META = {
  new_job: { Icon: FiBriefcase, label: 'Jobs' },
  match_updated: { Icon: FiTrendingUp, label: 'Matches' },
  task_overdue: { Icon: FiAlertCircle, label: 'Tasks' },
  followup_overdue: { Icon: FiAlertCircle, label: 'CRM' },
  crm_upcoming: { Icon: FiCalendar, label: 'Schedule' },
  timesheet_approval: { Icon: FiClock, label: 'Timesheets' },
  timesheet_drafts: { Icon: FiClock, label: 'Timesheets' },
  timesheet_submitted: { Icon: FiCheckSquare, label: 'Timesheets' },
  new_candidate: { Icon: FiUserPlus, label: 'Candidates' },
};

function TypeIcon({ type }) {
  const Icon = TYPE_META[type]?.Icon || FiDatabase;
  return <Icon aria-hidden className="notification-type-icon" />;
}

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery(
    'notifications',
    () => api.get('/notifications').then((res) => res.data),
    { refetchInterval: 90 * 1000, refetchOnWindowFocus: true }
  );

  const markSeenMutation = useMutation(
    () => api.post('/notifications/seen'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const clearMutation = useMutation(
    () => api.post('/notifications/clear'),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('notifications');
      },
    }
  );

  const list = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? list.filter((n) => n.unread !== false).length;

  useEffect(() => {
    const onDoc = (e) => {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next && unreadCount > 0) {
        markSeenMutation.mutate();
      }
      return next;
    });
  };

  const onItemClick = (href) => {
    if (href) navigate(href);
    setOpen(false);
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    if (list.length === 0 || clearMutation.isLoading) return;
    clearMutation.mutate();
  };

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="notification-bell-btn"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      >
        <FiBell className="notification-bell-icon" />
        {unreadCount > 0 && (
          <span className="notification-bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel" role="dialog" aria-label="Notifications list">
          <div className="notification-panel-head">
            <div className="notification-panel-head-main">
              <strong>Notifications</strong>
              {unreadCount > 0 && (
                <span className="notification-panel-unread">{unreadCount} unread</span>
              )}
            </div>
            <div className="notification-panel-head-actions">
              {(isLoading || isFetching) && (
                <span className="notification-panel-sync">Updating…</span>
              )}
              {list.length > 0 && (
                <LoadingButton
                  className="notification-clear-btn"
                  icon={FiTrash2}
                  loading={clearMutation.isLoading}
                  loadingLabel="Clearing…"
                  onClick={handleClearAll}
                >
                  Clear all
                </LoadingButton>
              )}
            </div>
          </div>
          <ul className="notification-list">
            {isLoading && !list.length && (
              <li className="notification-empty">Loading…</li>
            )}
            {!isLoading && list.length === 0 && (
              <li className="notification-empty">You&apos;re all caught up.</li>
            )}
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  className={`notification-item${n.unread ? ' notification-item--unread' : ''}`}
                  onClick={() => onItemClick(n.href)}
                >
                  <span className="notification-item-icon">
                    <TypeIcon type={n.type} />
                  </span>
                  <span className="notification-item-text">
                    <span className="notification-item-title">{n.title}</span>
                    <span className="notification-item-body">{n.body}</span>
                    {TYPE_META[n.type]?.label && (
                      <span className="notification-item-tag">{TYPE_META[n.type].label}</span>
                    )}
                  </span>
                  {n.unread && <span className="notification-item-dot" aria-label="Unread" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
