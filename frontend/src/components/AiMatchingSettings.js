import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { FiSave, FiZap, FiRefreshCw } from 'react-icons/fi';
import LoadingButton from './LoadingButton';

const AiMatchingSettings = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    provider: 'openai',
    openai_model: 'gpt-4o-mini',
    openai_api_key: '',
    anthropic_model: 'claude-3-5-sonnet-20241022',
    anthropic_api_key: '',
    gemini_model: 'gemini-1.5-flash',
    gemini_api_key: '',
    min_match_score: 35,
  });
  const [recomputeBusy, setRecomputeBusy] = useState(false);
  const [recomputeLog, setRecomputeLog] = useState('');

  const { data, isLoading } = useQuery(
    ['settings-ai-matching'],
    () => api.get('/permissions/ai-matching').then((r) => r.data),
    { refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      provider: data.provider || 'openai',
      openai_model: data.openai_model || prev.openai_model,
      anthropic_model: data.anthropic_model || prev.anthropic_model,
      gemini_model: data.gemini_model || prev.gemini_model,
      min_match_score: data.min_match_score ?? 35,
    }));
  }, [data]);

  const saveMutation = useMutation(
    (body) => api.put('/permissions/ai-matching', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['settings-ai-matching']);
        alert('AI settings saved.');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const handleSave = (e) => {
    e.preventDefault();
    const body = {
      provider: form.provider,
      openai_model: form.openai_model,
      anthropic_model: form.anthropic_model,
      gemini_model: form.gemini_model,
      min_match_score: form.min_match_score,
    };
    if (form.openai_api_key.trim()) body.openai_api_key = form.openai_api_key.trim();
    if (form.anthropic_api_key.trim()) body.anthropic_api_key = form.anthropic_api_key.trim();
    if (form.gemini_api_key.trim()) body.gemini_api_key = form.gemini_api_key.trim();
    saveMutation.mutate(body);
  };

  const runRecomputeAll = async () => {
    if (!window.confirm('Run AI matching for every active job? This calls your AI provider once per candidate per job and may take several minutes.')) return;
    setRecomputeBusy(true);
    setRecomputeLog('');
    try {
      const jobsRes = await api.get('/jobs');
      const jobs = (jobsRes.data || []).filter((j) => j.status === 'active');
      const lines = [];
      for (const job of jobs) {
        try {
          const r = await api.post(`/matches/ai-recompute-job/${job.id}`);
          lines.push(`Job #${job.id} ${job.title}: upserted ${r.data.upserted}, cleared ${r.data.below_threshold_removed}, failures ${r.data.failures?.length || 0}`);
        } catch (err) {
          lines.push(`Job #${job.id}: ${err.response?.data?.error || err.message}`);
        }
      }
      setRecomputeLog(lines.join('\n'));
      queryClient.invalidateQueries('jobs');
      queryClient.invalidateQueries('all-matches');
    } finally {
      setRecomputeBusy(false);
    }
  };

  if (isLoading) return <div className="loading">Loading AI settings…</div>;

  return (
    <div className="settings-section">
      <h2>
        <FiZap /> AI job matching
      </h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        Choose a provider and model, paste API keys (stored in the app database; restrict admin access). Candidates only see jobs with a stored match at or above the minimum score after you run matching.
      </p>

      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
          <label>Active provider</label>
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          >
            <option value="openai">OpenAI (ChatGPT API)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        <div className="form-group">
          <label>Minimum match score (0–100)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={form.min_match_score}
            onChange={(e) => setForm({ ...form, min_match_score: parseInt(e.target.value, 10) || 0 })}
          />
          <small>Matches below this are removed for that job–candidate pair.</small>
        </div>

        <h3 style={{ marginTop: 24 }}>OpenAI</h3>
        <div className="form-group">
          <label>Model</label>
          <input
            type="text"
            value={form.openai_model}
            onChange={(e) => setForm({ ...form, openai_model: e.target.value })}
            placeholder="gpt-4o-mini"
          />
        </div>
        <div className="form-group">
          <label>API key {data?.openai_key_set && <span style={{ color: '#666' }}>(saved: {data.openai_key_preview})</span>}</label>
          <input
            type="password"
            autoComplete="off"
            value={form.openai_api_key}
            onChange={(e) => setForm({ ...form, openai_api_key: e.target.value })}
            placeholder={data?.openai_key_set ? 'Leave blank to keep existing' : 'sk-...'}
          />
        </div>

        <h3 style={{ marginTop: 24 }}>Anthropic</h3>
        <div className="form-group">
          <label>Model</label>
          <input
            type="text"
            value={form.anthropic_model}
            onChange={(e) => setForm({ ...form, anthropic_model: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>API key {data?.anthropic_key_set && <span style={{ color: '#666' }}>(saved: {data.anthropic_key_preview})</span>}</label>
          <input
            type="password"
            autoComplete="off"
            value={form.anthropic_api_key}
            onChange={(e) => setForm({ ...form, anthropic_api_key: e.target.value })}
            placeholder={data?.anthropic_key_set ? 'Leave blank to keep existing' : 'sk-ant-...'}
          />
        </div>

        <h3 style={{ marginTop: 24 }}>Google Gemini</h3>
        <div className="form-group">
          <label>Model id</label>
          <input
            type="text"
            value={form.gemini_model}
            onChange={(e) => setForm({ ...form, gemini_model: e.target.value })}
            placeholder="gemini-1.5-flash"
          />
        </div>
        <div className="form-group">
          <label>API key {data?.gemini_key_set && <span style={{ color: '#666' }}>(saved: {data.gemini_key_preview})</span>}</label>
          <input
            type="password"
            autoComplete="off"
            value={form.gemini_api_key}
            onChange={(e) => setForm({ ...form, gemini_api_key: e.target.value })}
            placeholder={data?.gemini_key_set ? 'Leave blank to keep existing' : 'AIza...'}
          />
        </div>

        <div className="form-actions">
          <LoadingButton type="submit" className="btn btn-primary" icon={FiSave} loading={saveMutation.isLoading} loadingLabel="Saving…">
            Save AI settings
          </LoadingButton>
        </div>
      </form>

      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #eee' }}>
        <h3>
          <FiRefreshCw /> Recompute matches
        </h3>
        <p style={{ color: '#666' }}>
          Runs AI scoring for every active candidate against each active job (for each job, sequentially). Do this after changing provider, keys, or posting many jobs.
        </p>
        <LoadingButton
          type="button"
          className="btn btn-secondary"
          icon={FiRefreshCw}
          loading={recomputeBusy}
          loadingLabel="Running…"
          onClick={runRecomputeAll}
        >
          Recompute AI matches for all active jobs
        </LoadingButton>
        {recomputeLog && (
          <pre
            style={{
              marginTop: 12,
              fontSize: 12,
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 6,
              maxHeight: 240,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {recomputeLog}
          </pre>
        )}
      </div>
    </div>
  );
};

export default AiMatchingSettings;
