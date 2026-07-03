import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  FiPlus,
  FiCheck,
  FiX,
  FiEdit2,
  FiFilter,
  FiCalendar,
  FiClock,
  FiUser,
  FiBriefcase,
  FiFileText,
  FiSave,
} from 'react-icons/fi';
import './Timesheets.css';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function formatConsultant(ts) {
  const name = [ts.user_first_name, ts.user_last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  return ts.user_email || '—';
}

function parseDateParts(iso) {
  if (!iso) return { dow: '', day: '', mon: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dow: '', day: '', mon: '' };
  return {
    dow: d.toLocaleDateString(undefined, { weekday: 'short' }),
    day: String(d.getDate()),
    mon: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
  };
}

const Timesheets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState(null);
  const [showFilters, setShowFilters] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    candidate_id: '',
    job_id: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: '',
  });

  const canCreate = user?.role === 'consultant' || user?.role === 'admin';

  const { data: timesheets, isLoading } = useQuery(
    'timesheets',
    () => api.get('/timesheets').then(res => res.data)
  );

  const { data: candidates } = useQuery(
    ['timesheet-candidates', user?.role],
    () =>
      user?.role === 'admin'
        ? api.get('/candidates').then(res => res.data)
        : api.get('/candidates/assigned').then(res => res.data),
    { enabled: !!user && (user?.role === 'consultant' || user?.role === 'admin') }
  );

  const { data: jobs } = useQuery(
    'jobs',
    () => api.get('/jobs').then(res => res.data),
    { enabled: !!user && (user?.role === 'consultant' || user?.role === 'admin') }
  );

  const filteredTimesheets = useMemo(() => {
    if (!timesheets?.length) return [];
    return timesheets.filter((ts) => {
      if (filterStatus && ts.status !== filterStatus) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const blob = [
        ts.description,
        ts.candidate_first_name,
        ts.candidate_last_name,
        ts.candidate_email,
        ts.job_title,
        ts.job_company,
        ts.user_email,
        ts.user_first_name,
        ts.user_last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [timesheets, filterStatus, search]);

  const stats = useMemo(() => {
    const list = filteredTimesheets;
    const hours = list.reduce((s, t) => s + (parseFloat(t.hours) || 0), 0);
    const pending = list.filter((t) => t.status === 'submitted').length;
    const drafts = list.filter((t) => t.status === 'draft').length;
    return { count: list.length, hours, pending, drafts };
  }, [filteredTimesheets]);

  const createMutation = useMutation((data) => api.post('/timesheets', data), {
    onSuccess: () => {
      queryClient.invalidateQueries('timesheets');
      closeModal();
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const updateMutation = useMutation(({ id, data }) => api.put(`/timesheets/${id}`, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('timesheets');
      closeModal();
    },
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const submitMutation = useMutation((id) => api.post(`/timesheets/${id}/submit`), {
    onSuccess: () => queryClient.invalidateQueries('timesheets'),
    onError: (e) => alert(e.response?.data?.error || e.message),
  });

  const approveMutation = useMutation(
    ({ id, action }) => api.post(`/timesheets/${id}/approve`, { action }),
    {
      onSuccess: () => queryClient.invalidateQueries('timesheets'),
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const closeModal = () => {
    setShowModal(false);
    setEditingTimesheet(null);
    setFormData({
      candidate_id: '',
      job_id: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
    });
  };

  const openCreate = () => {
    setEditingTimesheet(null);
    setFormData({
      candidate_id: '',
      job_id: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
    });
    setShowModal(true);
  };

  const openEdit = (ts) => {
    const d = ts.date ? String(ts.date).slice(0, 10) : new Date().toISOString().split('T')[0];
    setEditingTimesheet(ts);
    setFormData({
      candidate_id: ts.candidate_id != null ? String(ts.candidate_id) : '',
      job_id: ts.job_id != null ? String(ts.job_id) : '',
      date: d,
      hours: ts.hours != null ? String(ts.hours) : '',
      description: ts.description || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      candidate_id: formData.candidate_id ? parseInt(formData.candidate_id, 10) : null,
      job_id: formData.job_id ? parseInt(formData.job_id, 10) : null,
      date: formData.date,
      hours: formData.hours,
      description: formData.description || null,
    };
    if (editingTimesheet) {
      updateMutation.mutate({ id: editingTimesheet.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const hasActiveFilters = Boolean(filterStatus || search.trim());

  if (isLoading) {
    return <div className="loading">Loading timesheets...</div>;
  }

  return (
    <div className="timesheets-page list-page">
      <div className="page-header">
        <h1>Timesheets</h1>
        <div className="list-page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            <FiFilter /> {showFilters ? 'Hide' : 'Show'} filters
          </button>
          {canCreate && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <FiPlus /> Log time
            </button>
          )}
        </div>
      </div>

      <div className="timesheets-stats">
        <div className="timesheets-stat-card">
          <FiFileText className="timesheets-stat-icon" aria-hidden />
          <div>
            <span className="timesheets-stat-value">{stats.count}</span>
            <span className="timesheets-stat-label">Entries (filtered)</span>
          </div>
        </div>
        <div className="timesheets-stat-card timesheets-stat-card--hours">
          <FiClock className="timesheets-stat-icon" aria-hidden />
          <div>
            <span className="timesheets-stat-value">{stats.hours.toFixed(1)}</span>
            <span className="timesheets-stat-label">Hours total</span>
          </div>
        </div>
        <div className="timesheets-stat-card timesheets-stat-card--pending">
          <FiCalendar className="timesheets-stat-icon" aria-hidden />
          <div>
            <span className="timesheets-stat-value">{stats.pending}</span>
            <span className="timesheets-stat-label">Awaiting approval</span>
          </div>
        </div>
        <div className="timesheets-stat-card">
          <FiEdit2 className="timesheets-stat-icon" aria-hidden />
          <div>
            <span className="timesheets-stat-value">{stats.drafts}</span>
            <span className="timesheets-stat-label">Drafts</span>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="list-filters-panel timesheets-filters">
          <div className="filter-row">
            <div className="filter-group filter-group--wide">
              <label htmlFor="ts-filter-search">Search</label>
              <input
                id="ts-filter-search"
                type="text"
                placeholder="Description, candidate, job, consultant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label htmlFor="ts-filter-status">Status</label>
              <select
                id="ts-filter-status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>
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
                  setSearch('');
                }}
              >
                <FiX /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {filteredTimesheets.length === 0 ? (
        <div className="timesheets-empty">
          <FiCalendar className="timesheets-empty-icon" aria-hidden />
          {timesheets?.length > 0 ? (
            <>
              <p>No timesheets match your filters.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilterStatus('');
                    setSearch('');
                  }}
                >
                  <FiX /> Clear filters
                </button>
              )}
            </>
          ) : (
            <>
              <p>No timesheets yet.</p>
              {canCreate && (
                <button type="button" className="btn btn-primary" onClick={openCreate}>
                  <FiPlus /> Log your first entry
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="timesheets-card-grid">
          {filteredTimesheets.map((ts) => {
            const { dow, day, mon } = parseDateParts(ts.date);
            const consultantName = formatConsultant(ts);
            const candidateLabel =
              ts.candidate_first_name || ts.candidate_last_name
                ? `${ts.candidate_first_name || ''} ${ts.candidate_last_name || ''}`.trim()
                : null;
            const jobLabel = ts.job_title ? `${ts.job_title}${ts.job_company ? ` · ${ts.job_company}` : ''}` : null;

            return (
              <article key={ts.id} className="timesheet-card">
                <div className="timesheet-card__date-block">
                  <span className="timesheet-card__dow">{dow}</span>
                  <span className="timesheet-card__day">{day}</span>
                  <span className="timesheet-card__mon">{mon}</span>
                </div>
                <div className="timesheet-card__main">
                  <div className="timesheet-card__top">
                    <span className="timesheet-card__hours-pill">
                      <FiClock aria-hidden />
                      {ts.hours}h
                    </span>
                    <span
                      className={`timesheet-card__status timesheet-card__status--${ts.status || 'draft'}`}
                    >
                      {(ts.status || 'draft').replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                  </div>
                  <p className="timesheet-card__description">
                    {ts.description || <em className="timesheet-card__muted">No description</em>}
                  </p>
                  <div className="timesheet-card__chips">
                    {user?.role === 'admin' && (
                      <span className="timesheet-chip timesheet-chip--user">
                        <FiUser aria-hidden />
                        <span className="timesheet-chip__text">
                          <strong>{consultantName}</strong>
                          {ts.user_email && (
                            <span className="timesheet-chip__sub">{ts.user_email}</span>
                          )}
                        </span>
                      </span>
                    )}
                    {candidateLabel && (
                      <span className="timesheet-chip">
                        <FiUser aria-hidden />
                        {candidateLabel}
                      </span>
                    )}
                    {jobLabel && (
                      <span className="timesheet-chip">
                        <FiBriefcase aria-hidden />
                        {jobLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="timesheet-card__actions">
                  {ts.status === 'draft' && (user?.role === 'consultant' || user?.role === 'admin') && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary timesheet-card__btn"
                        onClick={() => openEdit(ts)}
                      >
                        <FiEdit2 /> Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-success timesheet-card__btn"
                        onClick={() => submitMutation.mutate(ts.id)}
                        disabled={submitMutation.isLoading && submitMutation.variables === ts.id}
                      >
                        <FiCheck className={iconSpinClass(submitMutation.isLoading && submitMutation.variables === ts.id)} />
                        {submitMutation.isLoading && submitMutation.variables === ts.id ? 'Submitting…' : 'Submit'}
                      </button>
                    </>
                  )}
                  {user?.role === 'admin' && ts.status === 'submitted' && (
                    <>
                      <button
                        type="button"
                        className="btn btn-success timesheet-card__btn"
                        onClick={() => approveMutation.mutate({ id: ts.id, action: 'approve' })}
                        disabled={approveMutation.isLoading && approveMutation.variables?.id === ts.id}
                      >
                        <FiCheck className={iconSpinClass(approveMutation.isLoading && approveMutation.variables?.id === ts.id && approveMutation.variables?.action === 'approve')} />
                        {approveMutation.isLoading && approveMutation.variables?.id === ts.id && approveMutation.variables?.action === 'approve' ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger timesheet-card__btn"
                        onClick={() => approveMutation.mutate({ id: ts.id, action: 'reject' })}
                        disabled={approveMutation.isLoading && approveMutation.variables?.id === ts.id}
                      >
                        <FiX className={iconSpinClass(approveMutation.isLoading && approveMutation.variables?.id === ts.id && approveMutation.variables?.action === 'reject')} />
                        {approveMutation.isLoading && approveMutation.variables?.id === ts.id && approveMutation.variables?.action === 'reject' ? 'Rejecting…' : 'Reject'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content timesheet-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTimesheet ? 'Edit timesheet' : 'Log time'}</h2>
            <p className="timesheet-modal__hint">
              {editingTimesheet
                ? 'Only draft entries can be edited. Submit when ready for approval.'
                : 'Add hours against a candidate and/or job. Submit when you are ready.'}
            </p>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="ts-date">Date</label>
                <input
                  id="ts-date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={editingTimesheet && editingTimesheet.status !== 'draft'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ts-hours">Hours</label>
                <input
                  id="ts-hours"
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  required
                  disabled={editingTimesheet && editingTimesheet.status !== 'draft'}
                />
              </div>
              <div className="form-group">
                <label htmlFor="ts-candidate">Candidate (optional)</label>
                <select
                  id="ts-candidate"
                  value={formData.candidate_id}
                  onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                  disabled={editingTimesheet && editingTimesheet.status !== 'draft'}
                >
                  <option value="">— Select candidate —</option>
                  {candidates?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.email ? ` (${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ts-job">Job (optional)</label>
                <select
                  id="ts-job"
                  value={formData.job_id}
                  onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                  disabled={editingTimesheet && editingTimesheet.status !== 'draft'}
                >
                  <option value="">— Select job —</option>
                  {jobs?.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {job.company}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="ts-desc">Description</label>
                <textarea
                  id="ts-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={4}
                  disabled={editingTimesheet && editingTimesheet.status !== 'draft'}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                {(!editingTimesheet || editingTimesheet.status === 'draft') && (
                  <LoadingButton
                    type="submit"
                    className="btn btn-primary"
                    icon={FiSave}
                    loading={createMutation.isLoading || updateMutation.isLoading}
                    loadingLabel="Saving…"
                  >
                    {editingTimesheet ? 'Save changes' : 'Create'}
                  </LoadingButton>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timesheets;
