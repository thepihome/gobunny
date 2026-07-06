import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  FiCalendar,
  FiUser,
  FiClock,
  FiAlertTriangle,
  FiActivity,
  FiX,
} from 'react-icons/fi';
import './CRM.css';
import { iconSpinClass } from '../components/LoadingButton';
import CrmTimeline, {
  CRM_TYPE_CONFIG as TYPE_CONFIG,
  CRM_STATUS_CONFIG as STATUS_CONFIG,
  crmStatusBadge as statusBadge,
  crmDateKey as dateKey,
  crmIsFollowUpOverdue as isFollowUpOverdue,
} from '../components/CrmTimeline';
import CrmInteractionModal from '../components/CrmInteractionModal';
import IconButton from '../components/IconButton';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'followup', label: 'Follow-up date' },
];

function escapeCsvCell(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CRM = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const candidateFilterId = searchParams.get('candidate') || '';
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('cards');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [expandedId, setExpandedId] = useState(null);

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
    if (candidateFilterId) {
      rows = rows.filter((r) => String(r.candidate_id) === candidateFilterId);
    }
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
  }, [interactions, candidateFilterId, filterStatus, filterType, search, sortBy]);

  const filteredCandidateName = useMemo(() => {
    if (!candidateFilterId || !filtered.length) {
      const fromList = candidates?.find((c) => String(c.id) === candidateFilterId);
      if (fromList) return `${fromList.first_name} ${fromList.last_name}`.trim();
      const fromRow = interactions?.find((r) => String(r.candidate_id) === candidateFilterId);
      if (fromRow) return `${fromRow.candidate_first_name || ''} ${fromRow.candidate_last_name || ''}`.trim();
      return '';
    }
    const row = filtered[0];
    return `${row.candidate_first_name || ''} ${row.candidate_last_name || ''}`.trim();
  }, [candidateFilterId, filtered, candidates, interactions]);

  useEffect(() => {
    if (candidateFilterId) {
      setViewMode('timeline');
    }
  }, [candidateFilterId]);

  const openedLogFromUrl = useRef(false);

  useEffect(() => {
    openedLogFromUrl.current = false;
  }, [candidateFilterId]);

  useEffect(() => {
    const shouldOpenLog = searchParams.get('log') === '1';
    if (!shouldOpenLog || !candidateFilterId || !canWrite || openedLogFromUrl.current) {
      return;
    }

    openedLogFromUrl.current = true;
    setEditing(null);
    setShowModal(true);

    const next = new URLSearchParams(searchParams);
    next.delete('log');
    setSearchParams(next, { replace: true });
  }, [searchParams, candidateFilterId, canWrite, setSearchParams]);

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

  const updateMutation = useMutation(({ id, data }) => api.put(`/crm/${id}`, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      queryClient.invalidateQueries(['candidate']);
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const deleteMutation = useMutation((id) => api.delete(`/crm/${id}`), {
    onSuccess: () => {
      queryClient.invalidateQueries('crm');
      queryClient.invalidateQueries(['candidate']);
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditing(null);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setShowModal(true);
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
        <h1>CRM</h1>
        <div className="list-page-header-actions page-toolbar crm-header-actions">
          <IconButton
            icon={FiFilter}
            label={showFilters ? 'Hide filters' : 'Show filters'}
            active={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          />
          <div className="crm-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
              title="Card grid"
              aria-label="Card grid"
            >
              <FiGrid />
            </button>
            <button
              type="button"
              className={viewMode === 'timeline' ? 'active' : ''}
              onClick={() => setViewMode('timeline')}
              title="Timeline"
              aria-label="Timeline"
            >
              <FiList />
            </button>
          </div>
          {filtered.length > 0 && (
            <IconButton icon={FiDownload} label="Export CSV" onClick={exportCsv} />
          )}
          {canWrite && (
            <IconButton icon={FiPlus} label="Log interaction" variant="primary" onClick={openCreate} />
          )}
        </div>
      </div>

      {candidateFilterId && (
        <div className="crm-candidate-filter-banner">
          <span>
            Showing CRM activity for{' '}
            <strong>{filteredCandidateName || `candidate #${candidateFilterId}`}</strong>
          </span>
          <IconButton
            icon={FiX}
            label="Clear candidate filter"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete('candidate');
              setSearchParams(next, { replace: true });
            }}
          />
        </div>
      )}

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
              <IconButton
                icon={FiX}
                label="Clear filters"
                onClick={() => {
                  setFilterStatus('');
                  setFilterType('');
                  setSearch('');
                }}
              />
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
                <IconButton
                  icon={FiX}
                  label="Clear filters"
                  onClick={() => {
                    setFilterStatus('');
                    setFilterType('');
                    setSearch('');
                  }}
                />
              )}
            </>
          ) : (
            <>
              <p>No CRM activity yet.</p>
              {canWrite && (
                <IconButton icon={FiPlus} label="Log first interaction" variant="primary" onClick={openCreate} />
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
        <CrmTimeline
          items={filtered}
          showCandidateName
          showConsultant={user?.role === 'admin'}
          showActions={canWrite}
          onEdit={openEdit}
          onComplete={markComplete}
          onDelete={confirmDelete}
          actionLoadingId={
            updateMutation.isLoading && updateMutation.variables?.id != null
              ? updateMutation.variables.id
              : deleteMutation.isLoading
                ? deleteMutation.variables
                : null
          }
          actionType={
            deleteMutation.isLoading
              ? 'delete'
              : updateMutation.isLoading && updateMutation.variables?.data?.status === 'completed'
                ? 'complete'
                : updateMutation.isLoading
                  ? 'edit'
                  : null
          }
        />
      )}

      <CrmInteractionModal
        open={showModal}
        onClose={closeModal}
        interaction={editing}
        candidateId={editing ? '' : candidateFilterId}
        fallbackCandidateLabel={filteredCandidateName}
      />
    </div>
  );
};

export default CRM;
