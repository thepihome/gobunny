import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import {
  FiGlobe,
  FiSave,
  FiRefreshCw,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiClock,
} from 'react-icons/fi';
import LoadingButton from './LoadingButton';

const PROVIDERS = [
  { value: '', label: 'Auto-detect' },
  { value: 'greenhouse', label: 'Greenhouse' },
  { value: 'ashby', label: 'Ashby' },
  { value: 'lever', label: 'Lever' },
  { value: 'workday', label: 'Workday' },
];

const emptySource = { name: '', careers_url: '', provider: '', enabled: true };

const ScannerSettings = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    schedule_enabled: false,
    schedule_cron: '0 6 * * *',
    default_job_status: 'active',
    title_positive: '',
    title_negative: 'Intern\nJunior',
  });
  const [newSource, setNewSource] = useState(emptySource);
  const [runBusy, setRunBusy] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery(
    ['scanner-status'],
    () => api.get('/scanner/status').then((r) => r.data),
    { refetchInterval: 5000 }
  );

  const { data: sources = [], isLoading: sourcesLoading } = useQuery(
    ['scanner-sources'],
    () => api.get('/scanner/sources').then((r) => r.data)
  );

  const { data: runs = [] } = useQuery(
    ['scanner-runs'],
    () => api.get('/scanner/runs?limit=10').then((r) => r.data),
    { refetchInterval: 10000 }
  );

  useEffect(() => {
    if (!status?.config) return;
    const c = status.config;
    setForm((prev) => ({
      ...prev,
      schedule_enabled: c.schedule_enabled,
      schedule_cron: c.schedule_cron || prev.schedule_cron,
      default_job_status: c.default_job_status || 'active',
      title_positive: (c.title_filter?.positive || []).join('\n'),
      title_negative: (c.title_filter?.negative || ['Intern', 'Junior']).join('\n'),
    }));
  }, [status]);

  const saveMutation = useMutation(
    (body) => api.put('/scanner/settings', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['scanner-status']);
        alert('Scanner settings saved.');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const addSourceMutation = useMutation(
    (body) => api.post('/scanner/sources', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['scanner-sources']);
        setNewSource(emptySource);
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const updateSourceMutation = useMutation(
    ({ id, body }) => api.put(`/scanner/sources/${id}`, body),
    {
      onSuccess: () => queryClient.invalidateQueries(['scanner-sources']),
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const deleteSourceMutation = useMutation(
    (id) => api.delete(`/scanner/sources/${id}`),
    {
      onSuccess: () => queryClient.invalidateQueries(['scanner-sources']),
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const handleSaveSettings = (e) => {
    e.preventDefault();
    saveMutation.mutate({
      schedule_enabled: form.schedule_enabled,
      schedule_cron: form.schedule_cron,
      default_job_status: form.default_job_status,
      title_filter: {
        positive: form.title_positive.split('\n').map((s) => s.trim()).filter(Boolean),
        negative: form.title_negative.split('\n').map((s) => s.trim()).filter(Boolean),
      },
    });
  };

  const handleRunNow = async () => {
    setRunBusy(true);
    try {
      const res = await api.post('/scanner/run');
      if (res.status === 202 || res.data?.status === 'started') {
        alert('Scan started. Results will appear in run history shortly.');
      } else {
        alert(res.data?.error || 'Scan request sent.');
      }
      queryClient.invalidateQueries(['scanner-runs']);
      queryClient.invalidateQueries(['scanner-status']);
      queryClient.invalidateQueries('jobs');
    } catch (e) {
      alert(e.response?.data?.error || e.response?.data?.hint || e.message);
    } finally {
      setRunBusy(false);
    }
  };

  const handleAddSource = (e) => {
    e.preventDefault();
    if (!newSource.name.trim() || !newSource.careers_url.trim()) {
      alert('Name and careers URL are required');
      return;
    }
    addSourceMutation.mutate({
      name: newSource.name.trim(),
      careers_url: newSource.careers_url.trim(),
      provider: newSource.provider || null,
      enabled: newSource.enabled,
    });
  };

  if (statusLoading || sourcesLoading) {
    return <div className="loading">Loading scanner settings…</div>;
  }

  const serviceUp = status?.service?.reachable;
  const lastRun = status?.last_run;

  return (
    <div className="settings-section">
      <h2>
        <FiGlobe /> Job portal scanner
      </h2>
      <p style={{ color: 'var(--text-muted, #666)', marginBottom: 16 }}>
        Scans company career pages via public ATS APIs (Greenhouse, Ashby, Lever, Workday).
        Runs as a separate process — start it with <code>cd scanner && npm start</code>.
        New jobs are stored in the same jobs list.
      </p>

      <div className="scanner-status-bar" style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: 'var(--surface-2, #f5f5f5)' }}>
        <strong>Scanner service:</strong>{' '}
        {serviceUp ? (
          <span style={{ color: 'green' }}>Running</span>
        ) : (
          <span style={{ color: '#c00' }}>Not reachable</span>
        )}
        {' · '}
        <strong>Enabled sources:</strong> {status?.enabled_sources ?? 0}
        {lastRun && (
          <>
            {' · '}
            <strong>Last run:</strong> #{lastRun.id} ({lastRun.status})
            {lastRun.completed_at && ` at ${lastRun.completed_at}`}
          </>
        )}
        {status?.service?.running && (
          <span style={{ marginLeft: 8, color: '#06c' }}>Scan in progress…</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <LoadingButton
          type="button"
          className="btn btn-primary"
          icon={FiPlay}
          loading={runBusy}
          loadingLabel="Starting…"
          onClick={handleRunNow}
          disabled={!serviceUp}
        >
          Run scan now
        </LoadingButton>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            queryClient.invalidateQueries(['scanner-status']);
            queryClient.invalidateQueries(['scanner-runs']);
          }}
        >
          <FiRefreshCw /> Refresh status
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="settings-form" style={{ marginBottom: 32 }}>
        <h3><FiClock /> Schedule &amp; filters</h3>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={form.schedule_enabled}
              onChange={(e) => setForm({ ...form, schedule_enabled: e.target.checked })}
            />
            {' '}Enable scheduled scans (cron runs in scanner process)
          </label>
        </div>

        <div className="form-group">
          <label>Cron expression (UTC)</label>
          <input
            type="text"
            value={form.schedule_cron}
            onChange={(e) => setForm({ ...form, schedule_cron: e.target.value })}
            placeholder="0 6 * * *"
          />
          <small>Daily at 6:00 UTC = <code>0 6 * * *</code></small>
        </div>

        <div className="form-group">
          <label>Default status for new jobs</label>
          <select
            value={form.default_job_status}
            onChange={(e) => setForm({ ...form, default_job_status: e.target.value })}
          >
            <option value="active">Active (visible immediately)</option>
            <option value="draft">Draft (review first)</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Title keywords (one per line, at least one must match)</label>
            <textarea
              rows={4}
              value={form.title_positive}
              onChange={(e) => setForm({ ...form, title_positive: e.target.value })}
              placeholder="Engineer&#10;Product Manager"
            />
            <small>Leave empty to include all titles (except negatives)</small>
          </div>
          <div className="form-group">
            <label>Exclude title keywords</label>
            <textarea
              rows={4}
              value={form.title_negative}
              onChange={(e) => setForm({ ...form, title_negative: e.target.value })}
            />
          </div>
        </div>

        <LoadingButton
          type="submit"
          className="btn btn-primary"
          icon={FiSave}
          loading={saveMutation.isLoading}
          loadingLabel="Saving…"
        >
          Save scanner settings
        </LoadingButton>
      </form>

      <h3>Tracked companies</h3>
      <form onSubmit={handleAddSource} className="settings-form" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Company name</label>
            <input
              value={newSource.name}
              onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              placeholder="Anthropic"
            />
          </div>
          <div className="form-group">
            <label>Careers URL</label>
            <input
              value={newSource.careers_url}
              onChange={(e) => setNewSource({ ...newSource, careers_url: e.target.value })}
              placeholder="https://job-boards.greenhouse.io/anthropic"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Provider</label>
            <select
              value={newSource.provider}
              onChange={(e) => setNewSource({ ...newSource, provider: e.target.value })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.value || 'auto'} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <label>
              <input
                type="checkbox"
                checked={newSource.enabled}
                onChange={(e) => setNewSource({ ...newSource, enabled: e.target.checked })}
              />
              {' '}Enabled
            </label>
            <LoadingButton
              type="submit"
              className="btn btn-secondary"
              icon={FiPlus}
              loading={addSourceMutation.isLoading}
            >
              Add source
            </LoadingButton>
          </div>
        </div>
      </form>

      {sources.length === 0 ? (
        <p>No sources configured. Add a company above or enable seeded sources in the database.</p>
      ) : (
        <table className="data-table" style={{ width: '100%', marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>URL</th>
              <th>Provider</th>
              <th>Enabled</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <a href={s.careers_url} target="_blank" rel="noreferrer">{s.careers_url}</a>
                </td>
                <td>{s.provider || 'auto'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(s.enabled)}
                    onChange={(e) =>
                      updateSourceMutation.mutate({
                        id: s.id,
                        body: { enabled: e.target.checked },
                      })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn-icon"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm(`Delete source "${s.name}"?`)) {
                        deleteSourceMutation.mutate(s.id);
                      }
                    }}
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Recent runs</h3>
      {runs.length === 0 ? (
        <p>No scan runs yet.</p>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Trigger</th>
              <th>Started</th>
              <th>Inserted</th>
              <th>Found</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              let summary = r.summary;
              if (typeof summary === 'string') {
                try { summary = JSON.parse(summary); } catch { summary = null; }
              }
              return (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.status}</td>
                  <td>{r.trigger_type}</td>
                  <td>{r.started_at || r.created_at}</td>
                  <td>{summary?.inserted ?? '—'}</td>
                  <td>{summary?.total_found ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScannerSettings;
