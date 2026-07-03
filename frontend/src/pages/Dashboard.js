import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { parseQueryConfig } from '../utils/kpiConfig';
import DashboardCharts from '../components/DashboardCharts';
import DashboardQuickActions from '../components/DashboardQuickActions';
import LoadingButton, { iconSpinClass } from '../components/LoadingButton';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiBarChart2,
  FiGrid,
  FiTrendingUp,
  FiRefreshCw,
} from 'react-icons/fi';
import './Dashboard.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiGrid },
  { id: 'kpis', label: 'KPIs', icon: FiTrendingUp },
  { id: 'analytics', label: 'Analytics', icon: FiBarChart2 },
];

const SUMMARY_LABELS = {
  active_jobs: 'Active Jobs',
  my_matches: 'My Matches',
  my_resumes: 'My Resumes',
  avg_match_score: 'Avg Match Score',
  total_candidates: 'Candidates',
  assigned_candidates: 'Assigned',
  pending_timesheets: 'Pending Timesheets',
  total_users: 'Total Users',
};

function buildKpiNavigateUrl(config) {
  if (!config || config.type !== 'candidate_filter') return null;
  const params = new URLSearchParams();
  if (config.conditions?.length) {
    params.set('query', encodeURIComponent(JSON.stringify(config.conditions)));
  } else if (config.filters) {
    const conditions = Object.entries(config.filters)
      .filter(([, value]) => value)
      .map(([field, value]) => ({ field, value: String(value), operator: 'like' }));
    if (conditions.length) {
      params.set('query', encodeURIComponent(JSON.stringify(conditions)));
    }
  }
  return params.toString() ? `/candidates?${params.toString()}` : null;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [kpiError, setKpiError] = useState('');
  const [kpiForm, setKpiForm] = useState({
    name: '',
    description: '',
    metric_type: '',
    display_order: 0,
  });

  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery(
    'kpis',
    () => api.get('/kpis/my-kpis').then((res) => res.data),
    { staleTime: 60_000 }
  );

  const {
    data: analytics,
    isLoading: analyticsLoading,
    refetch: refetchAnalytics,
    isFetching: analyticsFetching,
  } = useQuery(
    'dashboard-analytics',
    () => api.get('/dashboard/analytics').then((res) => res.data),
    { staleTime: 120_000 }
  );

  const { data: metricTypes, isLoading: isLoadingMetricTypes, error: metricTypesError } = useQuery(
    'metric-types',
    () => api.get('/kpis/metric-types').then((res) => res.data)
  );

  const resetKpiForm = () => {
    setKpiForm({ name: '', description: '', metric_type: '', display_order: 0 });
    setKpiError('');
    setEditingKpi(null);
  };

  const createKpiMutation = useMutation((data) => api.post('/kpis', data), {
    onSuccess: () => {
      queryClient.invalidateQueries('kpis');
      setShowKpiModal(false);
      resetKpiForm();
    },
    onError: (err) => {
      setKpiError(err.response?.data?.error || 'Failed to create KPI');
    },
  });

  const updateKpiMutation = useMutation(({ id, data }) => api.put(`/kpis/${id}`, data), {
    onSuccess: () => {
      queryClient.invalidateQueries('kpis');
      setShowKpiModal(false);
      resetKpiForm();
    },
    onError: (err) => {
      setKpiError(err.response?.data?.error || 'Failed to update KPI');
    },
  });

  const deleteKpiMutation = useMutation((id) => api.delete(`/kpis/${id}`), {
    onSuccess: () => queryClient.invalidateQueries('kpis'),
    onError: (err) => {
      alert(err.response?.data?.error || 'Failed to delete KPI');
    },
  });

  const handleCreateKpi = () => {
    resetKpiForm();
    setShowKpiModal(true);
  };

  const handleEditKpi = (kpi) => {
    setEditingKpi(kpi);
    setKpiForm({
      name: kpi.name,
      description: kpi.description || '',
      metric_type: kpi.metric_type,
      display_order: kpi.display_order ?? 0,
    });
    setKpiError('');
    setShowKpiModal(true);
  };

  const handleDeleteKpi = (kpi) => {
    if (window.confirm(`Delete KPI "${kpi.name}"?`)) {
      deleteKpiMutation.mutate(kpi.id);
    }
  };

  const handleSubmitKpi = (e) => {
    e.preventDefault();
    setKpiError('');
    const payload = {
      ...kpiForm,
      display_order: Number.isFinite(Number(kpiForm.display_order))
        ? Number(kpiForm.display_order)
        : 0,
    };
    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  const handleKpiClick = (kpi) => {
    const config = parseQueryConfig(kpi.query_config);
    const url = buildKpiNavigateUrl(config);
    if (url) navigate(url);
  };

  const isLoading = kpisLoading && analyticsLoading;

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const summaryEntries = Object.entries(analytics?.summary || {}).filter(
    ([, value]) => value !== null && value !== undefined
  );

  return (
    <div className="dashboard list-page">
      <header className="dashboard-header">
        <div className="dashboard-header-text">
          <span className="page-eyebrow">Dashboard</span>
          <h1>Welcome back, {user?.first_name}</h1>
          <p className="dashboard-subtitle">
            {user?.role === 'admin' && 'Organization overview, KPIs, and business intelligence'}
            {user?.role === 'consultant' && 'Pipeline metrics, timesheets, and candidate insights'}
            {user?.role === 'candidate' && 'Track matches, applications, and career progress'}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <LoadingButton
            className="btn btn-secondary"
            icon={FiRefreshCw}
            loading={analyticsFetching}
            onClick={() => refetchAnalytics()}
          >
            Refresh
          </LoadingButton>
          <button type="button" className="btn btn-primary" onClick={handleCreateKpi}>
            <FiPlus /> Add KPI
          </button>
        </div>
      </header>

      <nav className="dashboard-tabs" aria-label="Dashboard sections">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon /> {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === 'overview' && (
        <div className="dashboard-section">
          {summaryEntries.length > 0 && (
            <div className="summary-strip">
              {summaryEntries.map(([key, value]) => (
                <div key={key} className="summary-chip">
                  <span className="summary-chip-value">{value}</span>
                  <span className="summary-chip-label">{SUMMARY_LABELS[key] || key}</span>
                </div>
              ))}
            </div>
          )}

          <section className="dashboard-panel">
            <h2>Quick Actions</h2>
            <DashboardQuickActions role={user?.role} />
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <h2>Key Metrics</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('kpis')}>
                Manage KPIs
              </button>
            </div>
            {kpisError ? (
              <div className="error">Failed to load KPIs. Try refreshing.</div>
            ) : (
              <div className="kpi-grid kpi-grid--compact">
                {kpis?.length ? (
                  kpis.slice(0, 4).map((kpi) => {
                    const config = parseQueryConfig(kpi.query_config);
                    const isClickable = kpi.metric_type === 'custom_filter' && buildKpiNavigateUrl(config);
                    return (
                      <div
                        key={kpi.id}
                        className={`kpi-card ${isClickable ? 'kpi-clickable' : ''}`}
                        onClick={isClickable ? () => handleKpiClick(kpi) : undefined}
                        onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleKpiClick(kpi) : undefined}
                        role={isClickable ? 'button' : undefined}
                        tabIndex={isClickable ? 0 : undefined}
                      >
                        <div className="kpi-header">
                          <h3>{kpi.name}</h3>
                        </div>
                        <div className="kpi-value">{kpi.current_value ?? '—'}</div>
                        {kpi.description && <p className="kpi-description">{kpi.description}</p>}
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state empty-state--inline">
                    <p>No KPIs yet. Add one to track what matters to you.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <h2>Analytics Preview</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveTab('analytics')}>
                View all charts
              </button>
            </div>
            <DashboardCharts
              charts={analytics?.charts?.slice(0, 2)}
              isLoading={analyticsLoading}
            />
          </section>
        </div>
      )}

      {activeTab === 'kpis' && (
        <div className="dashboard-section">
          <div className="kpi-grid">
            {kpis?.length ? (
              kpis.map((kpi) => {
                const config = parseQueryConfig(kpi.query_config);
                const isClickable = kpi.metric_type === 'custom_filter' && buildKpiNavigateUrl(config);
                return (
                  <div
                    key={kpi.id}
                    className={`kpi-card ${isClickable ? 'kpi-clickable' : ''}`}
                    onClick={isClickable ? () => handleKpiClick(kpi) : undefined}
                    onKeyDown={isClickable ? (e) => e.key === 'Enter' && handleKpiClick(kpi) : undefined}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                  >
                    <div className="kpi-header">
                      <h3>{kpi.name}</h3>
                      <div className="kpi-actions" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => handleEditKpi(kpi)} className="btn-icon" aria-label="Edit KPI">
                          <FiEdit />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteKpi(kpi)}
                          className={`btn-icon${deleteKpiMutation.isLoading && deleteKpiMutation.variables === kpi.id ? ' is-loading' : ''}`}
                          aria-label="Delete KPI"
                          disabled={deleteKpiMutation.isLoading && deleteKpiMutation.variables === kpi.id}
                        >
                          <FiTrash2 className={iconSpinClass(deleteKpiMutation.isLoading && deleteKpiMutation.variables === kpi.id)} />
                        </button>
                      </div>
                    </div>
                    <div className="kpi-value">{kpi.current_value ?? '—'}</div>
                    {kpi.description && <p className="kpi-description">{kpi.description}</p>}
                    {isClickable && <p className="kpi-hint">Click to view filtered candidates</p>}
                  </div>
                );
              })
            ) : (
              <div className="empty-state">
                <p>No KPIs configured. Click &quot;Add KPI&quot; to create your first metric.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="dashboard-section">
          <p className="dashboard-section-desc">
            Interactive business intelligence charts based on your role and live platform data.
          </p>
          <DashboardCharts charts={analytics?.charts} isLoading={analyticsLoading} />
        </div>
      )}

      {showKpiModal && (
        <div className="modal-overlay" onClick={() => setShowKpiModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingKpi ? 'Edit KPI' : 'Create KPI'}</h2>
            <form onSubmit={handleSubmitKpi}>
              {kpiError && <div className="error">{kpiError}</div>}
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={kpiForm.name}
                  onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={kpiForm.description}
                  onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Metric Type</label>
                {isLoadingMetricTypes ? (
                  <select disabled>
                    <option>Loading metric types...</option>
                  </select>
                ) : metricTypesError ? (
                  <div className="error">Error loading metric types. Please refresh.</div>
                ) : !metricTypes?.length ? (
                  <div className="error">No metric types available for your role.</div>
                ) : (
                  <select
                    value={kpiForm.metric_type}
                    onChange={(e) => setKpiForm({ ...kpiForm, metric_type: e.target.value })}
                    required
                    disabled={!!editingKpi && editingKpi.metric_type === 'custom_filter'}
                  >
                    <option value="">Select metric type</option>
                    {metricTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                )}
                {kpiForm.metric_type === 'custom_filter' && (
                  <p className="form-hint">Save custom filters from the Candidates page.</p>
                )}
              </div>
              <div className="form-group">
                <label>Display Order</label>
                <input
                  type="number"
                  min="0"
                  value={kpiForm.display_order}
                  onChange={(e) => setKpiForm({ ...kpiForm, display_order: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKpiModal(false)}>
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  className="btn btn-primary"
                  icon={editingKpi ? FiEdit : FiPlus}
                  loading={createKpiMutation.isLoading || updateKpiMutation.isLoading}
                  loadingLabel={editingKpi ? 'Updating…' : 'Creating…'}
                >
                  {editingKpi ? 'Update' : 'Create'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
