import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [editingKpi, setEditingKpi] = useState(null);
  const [kpiForm, setKpiForm] = useState({ name: '', description: '', metric_type: '', display_order: 0 });

  const { data: kpis, isLoading } = useQuery('kpis', () =>
    api.get('/kpis/my-kpis').then(res => res.data)
  );

  const { data: metricTypes, isLoading: isLoadingMetricTypes, error: metricTypesError } = useQuery(
    'metric-types',
    () => api.get('/kpis/metric-types').then(res => {
      console.log('Metric types response:', res.data);
      return res.data;
    }),
    {
      onError: (error) => {
        console.error('Error fetching metric types:', error);
      }
    }
  );

  const createKpiMutation = useMutation(
    (data) => api.post('/kpis', data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kpis');
        setShowKpiModal(false);
        setKpiForm({ name: '', description: '', metric_type: '', display_order: 0 });
      },
    }
  );

  const updateKpiMutation = useMutation(
    ({ id, data }) => api.put(`/kpis/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kpis');
        setShowKpiModal(false);
        setEditingKpi(null);
        setKpiForm({ name: '', description: '', metric_type: '', display_order: 0 });
      },
    }
  );

  const deleteKpiMutation = useMutation(
    (id) => api.delete(`/kpis/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('kpis');
      },
    }
  );

  const handleCreateKpi = () => {
    setEditingKpi(null);
    setKpiForm({ name: '', description: '', metric_type: '', display_order: 0 });
    setShowKpiModal(true);
  };

  const handleEditKpi = (kpi) => {
    setEditingKpi(kpi);
    setKpiForm({
      name: kpi.name,
      description: kpi.description || '',
      metric_type: kpi.metric_type,
      display_order: kpi.display_order,
    });
    setShowKpiModal(true);
  };

  const handleSubmitKpi = (e) => {
    e.preventDefault();
    if (editingKpi) {
      updateKpiMutation.mutate({ id: editingKpi.id, data: kpiForm });
    } else {
      createKpiMutation.mutate(kpiForm);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.first_name}!</h1>
        <button className="btn btn-primary" onClick={handleCreateKpi}>
          <FiPlus /> Add KPI
        </button>
      </div>

      <div className="kpi-grid">
        {kpis && kpis.length > 0 ? (
          kpis.map((kpi) => {
            const isClickable = kpi.metric_type === 'custom_filter' && kpi.query_config;
            const handleKpiClick = () => {
              if (isClickable) {
                try {
                  const config = JSON.parse(kpi.query_config);
                  if (config.type === 'candidate_filter') {
                    const params = new URLSearchParams();
                    // Use new conditions format if available, fallback to old filters format
                    if (config.conditions && Array.isArray(config.conditions)) {
                      params.set('query', encodeURIComponent(JSON.stringify(config.conditions)));
                    } else if (config.filters) {
                      // Legacy format - convert to new format for backward compatibility
                      const conditions = [];
                      Object.entries(config.filters).forEach(([key, value]) => {
                        if (value) {
                          conditions.push({ field: key, value: String(value), operator: 'like' });
                        }
                      });
                      if (conditions.length > 0) {
                        params.set('query', encodeURIComponent(JSON.stringify(conditions)));
                      }
                    }
                    navigate(`/candidates?${params.toString()}`);
                  }
                } catch (e) {
                  console.error('Error parsing KPI config:', e);
                }
              }
            };

            return (
              <div 
                key={kpi.id} 
                className={`kpi-card ${isClickable ? 'kpi-clickable' : ''}`}
                onClick={isClickable ? handleKpiClick : undefined}
                style={isClickable ? { cursor: 'pointer' } : {}}
              >
                <div className="kpi-header">
                  <h3>{kpi.name}</h3>
                  <div className="kpi-actions" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEditKpi(kpi)} className="btn-icon">
                      <FiEdit />
                    </button>
                    <button onClick={() => deleteKpiMutation.mutate(kpi.id)} className="btn-icon">
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
                <div className="kpi-value">{kpi.current_value ?? 'N/A'}</div>
                {kpi.description && <p className="kpi-description">{kpi.description}</p>}
                {isClickable && <p className="kpi-hint">Click to view filtered candidates</p>}
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <p>No KPIs configured. Click "Add KPI" to create your first KPI.</p>
          </div>
        )}
      </div>

      {showKpiModal && (
        <div className="modal-overlay" onClick={() => setShowKpiModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingKpi ? 'Edit KPI' : 'Create KPI'}</h2>
            <form onSubmit={handleSubmitKpi}>
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
                  <div style={{ color: 'red', fontSize: '12px' }}>
                    Error loading metric types. Please refresh the page.
                  </div>
                ) : !metricTypes || metricTypes.length === 0 ? (
                  <div style={{ color: 'orange', fontSize: '12px' }}>
                    No metric types available for your role.
                  </div>
                ) : (
                  <select
                    value={kpiForm.metric_type}
                    onChange={(e) => setKpiForm({ ...kpiForm, metric_type: e.target.value })}
                    required
                  >
                    <option value="">Select metric type</option>
                    {metricTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Display Order</label>
                <input
                  type="number"
                  value={kpiForm.display_order}
                  onChange={(e) => setKpiForm({ ...kpiForm, display_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowKpiModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingKpi ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;


