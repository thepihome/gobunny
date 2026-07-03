import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus,
  FiFilter,
  FiDownload,
  FiGrid,
  FiList,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiSave,
  FiPhone,
  FiMail,
  FiCalendar,
  FiFileText,
  FiLinkedin,
  FiMessageSquare,
  FiVideo,
  FiBriefcase,
  FiCheckSquare,
  FiUser,
  FiClock,
  FiAlertTriangle,
  FiActivity,
  FiX,
} from 'react-icons/fi';
import './CRM.css';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';

const TYPE_CONFIG = {
  call: { label: 'Phone call', Icon: FiPhone },
  email: { label: 'Email', Icon: FiMail },
  meeting: { label: 'Meeting', Icon: FiCalendar },
  note: { label: 'Note', Icon: FiFileText },
  linkedin: { label: 'LinkedIn', Icon: FiLinkedin },
  sms: { label: 'SMS', Icon: FiMessageSquare },
  video_call: { label: 'Video call', Icon: FiVideo },
  interview: { label: 'Interview', Icon: FiBriefcase },
  task: { label: 'Task', Icon: FiCheckSquare },
};

const STATUS_CONFIG = {
  open: { label: 'Open', className: 'crm-badge--open' },
  pending: { label: 'Pending', className: 'crm-badge--pending' },
  scheduled: { label: 'Scheduled', className: 'crm-badge--scheduled' },
  completed: { label: 'Completed', className: 'crm-badge--completed' },
  cancelled: { label: 'Cancelled', className: 'crm-badge--cancelled' },
};

const VALID_STATUSES = Object.keys(STATUS_CONFIG);

function statusBadge(row) {
  const s = row.status;
  if (s && STATUS_CONFIG[s]) return STATUS_CONFIG[s];
  return { label: s ? String(s) : 'Unknown', className: 'crm-badge--unknown' };
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'followup', label: 'Follow-up date' },
];

function dateKey(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function isFollowUpOverdue(row) {
  if (!row.follow_up_date) return false;
  if (['completed', 'cancelled'].includes(row.status)) return false;
  const d = new Date(row.follow_up_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function escapeCsvCell(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function emptyForm() {
  return {
    candidate_id: '',
    interaction_type: 'call',
    interaction_date: new Date().toISOString().split('T')[0],
    notes: '',
    follow_up_date: '',
    status: 'open',
  };
}

const CRM = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('cards');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedId, setExpandedId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const canWrite = user?.role === 'consultant' || user?.role === 'admin';

  const { data: interactions, isLoading } = useQuery('crm', () => api.get('/crm').then((res) => res.data));

  const { data: candidates } = useQuery(
    ['crm-candidates', user?.role],
    () =>
      user?.role === 'admin'
        ? api.get('/candidates').then((res) => res.data)
        : api.get('/candidates/assigned').then((res) => res.data),
    { enabled: !!user && canWrite }
  );

  const filtered = useMemo(() => {
    if (!interactions?.length) return [];
    let rows = [...interactions];
    if (filterStatus) rows = rows.filter((r) => r.status === filterStatus);
    if (filterType) rows = rows.filter((r) => r.interaction_type === filterType);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const blob = [
          r.notes,
          r.candidate_first_name,
          r.candidate_last_name,
          r.candidate_email,
          r.consultant_first_name,
          r.consultant_last_name,
          r.consultant_email,
          r.interaction_type,
          r.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    rows.sort((a, b) => {
      if (sortBy === 'followup') {
        const fa = a.follow_up_date ? new Date(a.follow_up_date).getTime() : Infinity;
        const fb = b.follow_up_date ? new Date(b.follow_up_date).getTime() : Infinity;
        return fa - fb;
      }
      const ta = new Date(a.interaction_date).getTime();
      const tb = new Date(b.interaction_date).getTime();
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
    return rows;
  }, [interactions, filterStatus, filterType, search, sortBy]);

  const stats = useMemo(() => {
    const list = interactions || [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const thisMonth = list.filter((r) => {
      const d = new Date(r.interaction_date);
      return d.getFullYear() === y && d.getMonth() === m;
    }).length;
    const openLike = list.filter((r) => r.status === 'open' || r.status === 'pending').length;
    const overdue = list.filter(isFollowUpOverdue).length;
    const byType = {};
    list.forEach((r) => {
      const t = r.interaction_type || 'note';
      byType[t] = (byType[t] || 0) + 1;
    });
    const byStatus = {};
    list.forEach((r) => {
      const s = r.status || 'open';
      byStatus[s] = (byStatus[s] || 0) + 1;
    });
    return {
      total: list.length,
      thisMonth,
      openLike,
      overdue,
      byType,
      byStatus,
      maxType: Math.max(1, ...Object.values(byType), 0),
    };
  }, [interactions]);

  const typeDistribution = useMemo(() => {
    const entries = Object.keys(TYPE_CONFIG).map((key) => ({
      key,
      count: stats.byType[key] || 0,
      label: TYPE_CONFIG[key].label,
    }));
    return entries.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
  }, [stats.byType]);

  const createMutation = useMutation((data) => api.post('/crm', data), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      closeModal();
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const updateMutation = useMutation(({ id, data }) => api.put(`/crm/${id}`, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      closeModal();
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const deleteMutation = useMutation((id) => api.delete(`/crm/${id}`), {
    onSuccess: () => queryClient.invalidateQueries('crm'),
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditing(null);
    setFormData(emptyForm());
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm());
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    const typeKey = row.interaction_type && TYPE_CONFIG[row.interaction_type] ? row.interaction_type : 'note';
    setFormData({
      candidate_id: row.candidate_id != null ? String(row.candidate_id) : '',
      interaction_type: typeKey,
      interaction_date: dateKey(row.interaction_date) || new Date().toISOString().split('T')[0],
      notes: row.notes || '',
      follow_up_date: row.follow_up_date ? dateKey(row.follow_up_date) : '',
      status: VALID_STATUSES.includes(row.status) ? row.status : 'open',
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      candidate_id: parseInt(formData.candidate_id, 10),
      interaction_type: formData.interaction_type,
      interaction_date: formData.interaction_date,
      notes: formData.notes || null,
      follow_up_date: formData.follow_up_date || null,
      status: formData.status,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const markComplete = (row) => {
    updateMutation.mutate({ id: row.id, data: { status: 'completed' } });
  };

  const confirmDelete = (row) => {
    if (!window.confirm(`Delete this ${row.interaction_type || 'interaction'} with ${row.candidate_first_name || ''} ${row.candidate_last_name || ''}?`)) {
      return;
    }
    deleteMutation.mutate(row.id);
  };

  const exportCsv = () => {
    const headers = [
      'id',
      'interaction_date',
      'type',
      'status',
      'candidate',
      'candidate_email',
      'consultant',
      'notes',
      'follow_up_date',
    ];
    const lines = [
      headers.join(','),
      ...filtered.map((r) =>
        [
          r.id,
          dateKey(r.interaction_date),
          r.interaction_type,
          r.status,
          `${r.candidate_first_name || ''} ${r.candidate_last_name || ''}`.trim(),
          r.candidate_email || '',
          `${r.consultant_first_name || ''} ${r.consultant_last_name || ''}`.trim(),
          r.notes || '',
          r.follow_up_date ? dateKey(r.follow_up_date) : '',
        ]
          .map(escapeCsvCell)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = Boolean(filterStatus || filterType || search.trim());
  const toggleExpanded = (id) => setExpandedId((prev) => (prev === id ? null : id));

  if (isLoading) {
    return <div className="loading">Loading CRM…</div>;
  }

  return (
    <div className="crm-page list-page">
      <div className="page-header">
        <div>
          <h1>CRM</h1>
          <p className="crm-subtitle">
            Track candidate touchpoints, follow-ups, and team activity in one place.
          </p>
        </div>
        <div className="list-page-header-actions crm-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <FiFilter /> {showFilters ? 'Hide' : 'Show'} filters
          </button>
          <div className="crm-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              title="Card grid"
            >
              <FiGrid />
            </button>
            <button
              type="button"
              className={viewMode === 'timeline' ? 'active' : ''}
              onClick={() => setViewMode('timeline')}
              title="Timeline"
            >
              <FiList />
            </button>
          </div>
          {filtered.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={exportCsv}>
              <FiDownload /> Export CSV
            </button>
          )}
          {canWrite && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus /> Log interaction
            </button>
          )}
        </div>
      </div>

      <section className="crm-stats" aria-label="Summary">
        <div className="crm-stat-card">
          <FiActivity className="crm-stat-icon" aria-hidden />
          <div>
            <span className="crm-stat-value">{stats.total}</span>
            <span className="crm-stat-label">Total interactions</span>
          </div>
        </div>
        <div className="crm-stat-card crm-stat-card--accent">
          <FiCalendar className="crm-stat-icon" aria-hidden />
          <div>
            <span className="crm-stat-value">{stats.thisMonth}</span>
            <span className="crm-stat-label">This month</span>
          </div>
        </div>
        <div className="crm-stat-card">
          <FiClock className="crm-stat-icon" aria-hidden />
          <div>
            <span className="crm-stat-value">{stats.openLike}</span>
            <span className="crm-stat-label">Open / pending</span>
          </div>
        </div>
        <div className={`crm-stat-card ${stats.overdue > 0 ? 'crm-stat-card--warn' : ''}`}>
          <FiAlertTriangle className="crm-stat-icon" aria-hidden />
          <div>
            <span className="crm-stat-value">{stats.overdue}</span>
            <span className="crm-stat-label">Overdue follow-ups</span>
          </div>
        </div>
      </section>

      <section className="crm-insights glass-surface" aria-label="Activity by type">
        <div className="crm-insights-head">
          <h2>Activity mix</h2>
          <span className="crm-insights-hint">Distribution across interaction types</span>
        </div>
        {typeDistribution.length === 0 ? (
          <p className="crm-insights-empty">No data yet — log your first interaction.</p>
        ) : (
          <div className="crm-type-bars">
            {typeDistribution.map(({ key, count, label }) => {
              const pct = Math.round((count / stats.maxType) * 100);
              return (
                <div key={key} className="crm-type-bar-row">
                  <span className="crm-type-bar-label">{label}</span>
                  <div className="crm-type-bar-track">
                    <div
                      className="crm-type-bar-fill"
                      style={{ width: `${pct}%` }}
                      title={`${count} interactions`}
                    />
                  </div>
                  <span className="crm-type-bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="crm-pipeline" aria-label="Filter by status">
        <span className="crm-pipeline-title">Pipeline</span>
        <div className="crm-pipeline-chips">
          <button
            type="button"
            className={`crm-pipeline-chip ${!filterStatus ? 'crm-pipeline-chip--active' : ''}`}
            onClick={() => setFilterStatus('')}
          >
            All <strong>{stats.total}</strong>
          </button>
          {Object.keys(STATUS_CONFIG).map((s) => (
            <button
              key={s}
              type="button"
              className={`crm-pipeline-chip ${filterStatus === s ? 'crm-pipeline-chip--active' : ''}`}
              onClick={() => setFilterStatus((prev) => (prev === s ? '' : s))}
            >
              {STATUS_CONFIG[s].label} <strong>{stats.byStatus[s] || 0}</strong>
            </button>
          ))}
        </div>
      </section>

      {showFilters && (
        <div className="list-filters-panel crm-filters">
          <div className="filter-row">
            <div className="filter-group filter-group--wide">
              <label htmlFor="crm-search">Search</label>
              <input
                id="crm-search"
                type="search"
                placeholder="Notes, candidate, consultant, type…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="crm-type">Type</label>
              <select id="crm-type" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All types</option>
                {Object.entries(TYPE_CONFIG).map(([k, { label }]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="crm-sort">Sort</label>
              <select id="crm-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFilterStatus('');
                  setFilterType('');
                  setSearch('');
                }}
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      <p className="crm-result-meta">
        Showing <strong>{filtered.length}</strong> of <strong>{interactions?.length || 0}</strong> interactions
        {hasActiveFilters && ' (filtered)'}
      </p>

      {filtered.length === 0 ? (
        <div className="crm-empty glass-surface">
          <FiActivity className="crm-empty-icon" aria-hidden />
          {interactions?.length > 0 ? (
            <>
              <p>No interactions match your filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilterStatus('');
                    setFilterType('');
                    setSearch('');
                  }}
                >
                  Clear filters
                </button>
              )}
            </>
          ) : (
            <>
              <p>No CRM activity yet.</p>
              {canWrite && (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <FiPlus /> Log your first interaction
                </button>
              )}
            </>
          )}
        </div>
      ) : viewMode === 'cards' ? (
        <div className="crm-card-grid">
          {filtered.map((row) => {
            const tc = TYPE_CONFIG[row.interaction_type] || TYPE_CONFIG.note;
            const TypeIcon = tc.Icon;
            const sc = statusBadge(row);
            const overdue = isFollowUpOverdue(row);
            const expanded = expandedId === row.id;

            return (
              <article key={row.id} className={`crm-card ${overdue ? 'crm-card--overdue' : ''}`}>
                <div className="crm-card__top">
                  <div className="crm-card__type">
                    <span className="crm-type-icon" aria-hidden>
                      <TypeIcon />
                    </span>
                    <div>
                      <h3>{tc.label}</h3>
                      <time dateTime={dateKey(row.interaction_date)}>
                        {new Date(row.interaction_date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </time>
                    </div>
                  </div>
                  <span className={`crm-badge ${sc.className}`}>{sc.label}</span>
                </div>

                <div className="crm-card__people">
                  <span className="crm-card__person">
                    <FiUser aria-hidden />
                    <span>
                      <strong>
                        {row.candidate_first_name} {row.candidate_last_name}
                      </strong>
                      {row.candidate_email && <span className="crm-card__email">{row.candidate_email}</span>}
                    </span>
                  </span>
                  {user?.role === 'admin' && (row.consultant_first_name || row.consultant_last_name) && (
                    <span className="crm-card__person crm-card__person--muted">
                      Owner: {row.consultant_first_name} {row.consultant_last_name}
                    </span>
                  )}
                </div>

                {row.notes && (
                  <div className="crm-card__notes-wrap">
                    <p className={`crm-card__notes ${expanded ? 'crm-card__notes--full' : ''}`}>{row.notes}</p>
                    {row.notes.length > 140 && (
                      <button type="button" className="crm-card__expand" onClick={() => toggleExpanded(row.id)}>
                        {expanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}

                <div className="crm-card__footer">
                  {row.follow_up_date && (
                    <span className={`crm-follow-tag ${overdue ? 'crm-follow-tag--late' : ''}`}>
                      <FiClock aria-hidden />
                      Follow-up: {new Date(row.follow_up_date).toLocaleDateString()}
                      {overdue && ' · Due'}
                    </span>
                  )}
                  {canWrite && (
                    <div className="crm-card__actions">
                      {row.status !== 'completed' && row.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn btn-success crm-card__btn"
                          onClick={() => markComplete(row)}
                          disabled={updateMutation.isLoading && updateMutation.variables?.id === row.id}
                          title="Mark completed"
                        >
                          <FiCheck className={iconSpinClass(updateMutation.isLoading && updateMutation.variables?.id === row.id)} />
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary crm-card__btn" onClick={() => openEdit(row)} title="Edit">
                        <FiEdit2 />
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger crm-card__btn"
                        onClick={() => confirmDelete(row)}
                        disabled={deleteMutation.isLoading && deleteMutation.variables === row.id}
                        title="Delete"
                      >
                        <FiTrash2 className={iconSpinClass(deleteMutation.isLoading && deleteMutation.variables === row.id)} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="crm-timeline">
          {filtered.map((row) => {
            const tc = TYPE_CONFIG[row.interaction_type] || TYPE_CONFIG.note;
            const TypeIcon = tc.Icon;
            const sc = statusBadge(row);
            return (
              <div key={row.id} className="crm-timeline-item">
                <div className="crm-timeline-marker">
                  <TypeIcon aria-hidden />
                </div>
                <div className="crm-timeline-body glass-surface">
                  <div className="crm-timeline-head">
                    <strong>{tc.label}</strong>
                    <span className={`crm-badge ${sc.className}`}>{sc.label}</span>
                  </div>
                  <time className="crm-timeline-date" dateTime={dateKey(row.interaction_date)}>
                    {new Date(row.interaction_date).toLocaleString()}
                  </time>
                  <p className="crm-timeline-who">
                    {row.candidate_first_name} {row.candidate_last_name}
                    {user?.role === 'admin' && row.consultant_first_name && (
                      <span className="crm-timeline-owner">
                        {' · '}
                        {row.consultant_first_name} {row.consultant_last_name}
                      </span>
                    )}
                  </p>
                  {row.notes && <p className="crm-timeline-notes">{row.notes}</p>}
                  {canWrite && (
                    <div className="crm-timeline-actions">
                      {row.status !== 'completed' && row.status !== 'cancelled' && (
                        <button type="button" className="btn btn-success crm-timeline-btn" onClick={() => markComplete(row)}>
                          Complete
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary crm-timeline-btn" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger crm-timeline-btn" onClick={() => confirmDelete(row)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay crm-modal-overlay" onClick={closeModal}>
          <div className="modal-content crm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? 'Edit interaction' : 'Log interaction'}</h2>
            <p className="crm-modal-hint">
              Record calls, emails, meetings, and tasks. Set follow-ups to keep momentum.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="crm-f-candidate">Candidate</label>
                <select
                  id="crm-f-candidate"
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                  required
                >
                  <option value="">Select candidate</option>
                  {candidates?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.email ? ` (${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="crm-f-type">Interaction type</label>
                <select
                  id="crm-f-type"
                  value={formData.interaction_type}
                  onChange={(e) => setFormData({ ...formData, interaction_type: e.target.value })}
                  required
                >
                  {Object.entries(TYPE_CONFIG).map(([k, { label }]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="crm-f-date">Date</label>
                  <input
                    id="crm-f-date"
                    type="date"
                    value={formData.interaction_date}
                    onChange={(e) => setFormData({ ...formData, interaction_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="crm-f-status">Status</label>
                  <select
                    id="crm-f-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {Object.entries(STATUS_CONFIG).map(([k, { label }]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="crm-f-notes">Notes</label>
                <textarea
                  id="crm-f-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={5}
                  placeholder="Outcomes, next steps, objections…"
                />
              </div>
              <div className="form-group">
                <label htmlFor="crm-f-follow">Follow-up date (optional)</label>
                <input
                  id="crm-f-follow"
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  className="btn btn-primary"
                  icon={FiSave}
                  loading={createMutation.isLoading || updateMutation.isLoading}
                  loadingLabel="Saving…"
                >
                  {editing ? 'Save changes' : 'Create'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
