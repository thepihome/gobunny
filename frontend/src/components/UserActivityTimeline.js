import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import api from '../config/api';
import { FiClock, FiDatabase, FiFilter, FiSearch } from 'react-icons/fi';
import '../pages/CandidateDetails.css';
import '../pages/CRM.css';

const LOG_ACTION_FILTERS = [
  { value: '', label: 'All', tone: 'neutral' },
  { value: 'create', label: 'Create', tone: 'create' },
  { value: 'update', label: 'Update', tone: 'update' },
  { value: 'delete', label: 'Delete', tone: 'delete' },
  { value: 'view', label: 'View', tone: 'view' },
];

const KNOWN_LOG_ACTIONS = new Set(['create', 'update', 'delete', 'view']);

function logActionClass(action) {
  return KNOWN_LOG_ACTIONS.has(action) ? action : 'unknown';
}

function formatCrmType(t) {
  if (!t) return 'Note';
  return String(t).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function crmStatusBadgeClass(status) {
  const s = status || 'open';
  const known = ['open', 'pending', 'scheduled', 'completed', 'cancelled'];
  return known.includes(s) ? `crm-badge crm-badge--${s}` : 'crm-badge crm-badge--unknown';
}

const UserActivityTimeline = ({ userId, userRole }) => {
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [kind, setKind] = useState('all');

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (action) params.set('action', action);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (kind !== 'all') params.set('kind', kind);
    return params.toString();
  }, [search, action, dateFrom, dateTo, kind]);

  const { data, isLoading } = useQuery(
    ['user-activity', userId, queryParams],
    () => api.get(`/users/${userId}/activity?${queryParams}`).then((res) => res.data),
    { enabled: !!userId }
  );

  const items = data?.items || [];
  const hasActiveFilters = search || action || dateFrom || dateTo || kind !== 'all';

  const roleHint =
    userRole === 'consultant'
      ? 'Platform activity logs and CRM interactions logged by this consultant.'
      : userRole === 'candidate'
        ? 'Profile activity and CRM interactions for this candidate (same view as on the candidate profile).'
        : 'Platform activity performed by this user.';

  return (
    <div className="user-activity-timeline activity-history">
      <div className="activity-history-header">
        <h4>
          <FiClock /> Activity &amp; CRM
        </h4>
        <div className="activity-history-controls">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> {showFilters ? 'Hide Filters' : 'Filters'}
          </button>
        </div>
      </div>

      <p className="user-activity-hint">{roleHint}</p>

      {showFilters && (
        <div className="activity-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label>
                <FiSearch /> Search
              </label>
              <input
                type="text"
                placeholder="Search description, fields, names..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="filter-input"
              >
                <option value="all">All</option>
                <option value="activity">Activity logs only</option>
                <option value="crm">CRM only</option>
              </select>
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Action</label>
              <div className="activity-action-filters">
                {LOG_ACTION_FILTERS.map(({ value, label, tone }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    className={`activity-filter-btn activity-filter-btn--${tone}${action === value ? ' active' : ''}`}
                    onClick={() => setAction(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Date from</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Date to</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="filter-input"
              />
            </div>
            {hasActiveFilters && (
              <div className="filter-group">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '24px' }}
                  onClick={() => {
                    setSearch('');
                    setAction('');
                    setDateFrom('');
                    setDateTo('');
                    setKind('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {data?.counts && (
        <div className="activity-stats">
          <span className="activity-count">
            {data.counts.total} item{data.counts.total !== 1 ? 's' : ''}
            {data.counts.activity_logs > 0 && ` · ${data.counts.activity_logs} log${data.counts.activity_logs !== 1 ? 's' : ''}`}
            {data.counts.crm > 0 && ` · ${data.counts.crm} CRM`}
            {hasActiveFilters && ' (filtered)'}
          </span>
        </div>
      )}

      {isLoading ? (
        <p>Loading activity…</p>
      ) : items.length > 0 ? (
        <div className="activity-list">
          {items.map((item) => {
            if (item.kind === 'crm') {
              return (
                <div key={item.id} className="activity-item activity-item--update">
                  <div className="activity-header">
                    <div className="activity-action">
                      <span className="activity-badge activity-update">
                        <FiDatabase style={{ marginRight: 4 }} />
                        CRM · {formatCrmType(item.action)}
                      </span>
                      {item.description && (
                        <span className="activity-description">{item.description}</span>
                      )}
                    </div>
                    <div className="activity-meta">
                      <span className={`${crmStatusBadgeClass(item.status)}`}>{item.status || 'open'}</span>
                      <span className="activity-time">
                        {new Date(item.interaction_date || item.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="activity-change">
                    {userRole === 'consultant' && item.candidate_name && (
                      <span>Candidate: <strong>{item.candidate_name}</strong></span>
                    )}
                    {userRole === 'candidate' && item.consultant_name && (
                      <span>Consultant: <strong>{item.consultant_name}</strong></span>
                    )}
                    {item.follow_up_date && (
                      <span> · Follow-up: {new Date(item.follow_up_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`activity-item activity-item--${logActionClass(item.action)}`}
              >
                <div className="activity-header">
                  <div className="activity-action">
                    <span className={`activity-badge activity-${logActionClass(item.action)}`}>
                      {item.action}
                    </span>
                    {item.description && (
                      <span className="activity-description">{item.description}</span>
                    )}
                  </div>
                  <div className="activity-meta">
                    {item.user_name && (
                      <span className="activity-user">{item.user_name}</span>
                    )}
                    <span className="activity-time">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                {item.field_name && (
                  <div className="activity-change">
                    <strong>{item.field_name}:</strong>
                    <span className="change-old">{item.old_value || '(empty)'}</span>
                    <span className="change-arrow">→</span>
                    <span className="change-new">{item.new_value || '(empty)'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="user-activity-empty">
          No activity or CRM records{hasActiveFilters ? ' matching your filters' : ''}.
        </p>
      )}
    </div>
  );
};

export default UserActivityTimeline;
