import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import {
  FiMail,
  FiSave,
  FiSend,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import LoadingButton from './LoadingButton';

const SECURE_OPTIONS = [
  { value: 'starttls', label: 'STARTTLS (port 587)' },
  { value: 'ssl', label: 'SSL/TLS (port 465)' },
  { value: 'off', label: 'None (port 25)' },
];

const EmailSettings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedAction, setExpandedAction] = useState('user_signup');
  const [testTo, setTestTo] = useState(user?.email || '');
  const [form, setForm] = useState({
    enabled: false,
    app_name: 'GoBunny',
    smtp: {
      host: '',
      port: 587,
      secure: 'starttls',
      username: '',
      password: '',
      from_name: '',
      from_email: '',
    },
    actions: {},
    templates: {},
  });

  const { data, isLoading, isError, error } = useQuery(
    ['settings-email'],
    () => api.get('/permissions/email').then((r) => r.data),
    { refetchOnWindowFocus: false, retry: false }
  );

  useEffect(() => {
    if (!data) return;
    setForm((prev) => ({
      ...prev,
      enabled: !!data.enabled,
      app_name: data.app_name || 'GoBunny',
      smtp: {
        ...prev.smtp,
        host: data.smtp?.host || '',
        port: data.smtp?.port ?? 587,
        secure: data.smtp?.secure || 'starttls',
        username: data.smtp?.username || '',
        password: '',
        from_name: data.smtp?.from_name || '',
        from_email: data.smtp?.from_email || '',
      },
      actions: { ...(data.actions || {}) },
      templates: { ...(data.templates || {}) },
    }));
    if (!testTo && user?.email) setTestTo(user.email);
  }, [data, testTo, user?.email]);

  const saveMutation = useMutation(
    (body) => api.put('/permissions/email', body),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['settings-email']);
        alert('Email settings saved.');
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const testMutation = useMutation(
    (to) => api.post('/permissions/email/test', { to }),
    {
      onSuccess: (res) => alert(res.data?.message || 'Test email sent.'),
      onError: (e) => alert(e.response?.data?.error || e.response?.data?.details || e.message),
    }
  );

  const resetTemplateMutation = useMutation(
    (actionId) => api.post(`/permissions/email/templates/${actionId}/reset`),
    {
      onSuccess: (res, actionId) => {
        setForm((prev) => ({
          ...prev,
          templates: {
            ...prev.templates,
            [actionId]: res.data.template,
          },
        }));
        queryClient.invalidateQueries(['settings-email']);
      },
      onError: (e) => alert(e.response?.data?.error || e.message),
    }
  );

  const handleSave = (e) => {
    e.preventDefault();
    const body = {
      enabled: form.enabled,
      app_name: form.app_name,
      smtp: { ...form.smtp },
      actions: form.actions,
      templates: form.templates,
    };
    if (!body.smtp.password?.trim()) delete body.smtp.password;
    saveMutation.mutate(body);
  };

  const updateTemplate = (actionId, field, value) => {
    setForm((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [actionId]: {
          ...(prev.templates[actionId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const toggleAction = (actionId, enabled) => {
    setForm((prev) => ({
      ...prev,
      actions: { ...prev.actions, [actionId]: enabled },
    }));
  };

  if (isLoading) return <div className="loading">Loading email settings…</div>;

  if (isError) {
    const status = error?.response?.status;
    const msg = error?.response?.data?.error || error?.message;
    return (
      <div className="settings-section email-settings">
        <h2><FiMail /> Email &amp; SMTP</h2>
        <div className="error" style={{ marginTop: 16 }}>
          <p><strong>Could not load email settings{status ? ` (${status})` : ''}.</strong></p>
          <p>{msg || 'The API endpoint may not be deployed yet.'}</p>
          {status === 404 && (
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--text-muted, #666)' }}>
              Deploy the latest backend Worker (includes <code>/api/permissions/email</code>).
              Production deploys from <code>main</code>; the email feature is on{' '}
              <code>dev/godash-future-builds</code> until merged.
            </p>
          )}
        </div>
      </div>
    );
  }

  const catalog = data?.action_catalog || [];

  return (
    <div className="settings-section email-settings">
      <h2>
        <FiMail /> Email &amp; SMTP
      </h2>
      <p className="email-settings-intro">
        Configure outbound email via SMTP. Choose which events send mail and customize templates
        with <code>{'{{variable}}'}</code> placeholders. Credentials are stored encrypted in the database.
      </p>

      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
          <label className="email-toggle-label">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            {' '}Enable outbound email
          </label>
          <small>When off, no transactional emails are sent regardless of per-action toggles.</small>
        </div>

        <div className="form-group">
          <label>Application name (used in templates)</label>
          <input
            type="text"
            value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })}
            placeholder="GoBunny"
          />
        </div>

        <h3 className="email-section-heading">SMTP server</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Host</label>
            <input
              type="text"
              value={form.smtp.host}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, host: e.target.value } })}
              placeholder="smtp.example.com"
            />
          </div>
          <div className="form-group">
            <label>Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={form.smtp.port}
              onChange={(e) =>
                setForm({ ...form, smtp: { ...form.smtp, port: parseInt(e.target.value, 10) || 587 } })
              }
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Security</label>
            <select
              value={form.smtp.secure}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, secure: e.target.value } })}
            >
              {SECURE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              autoComplete="off"
              value={form.smtp.username}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, username: e.target.value } })}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>
              Password
              {data?.smtp?.password_set && (
                <span className="email-key-hint"> (saved — leave blank to keep)</span>
              )}
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={form.smtp.password}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, password: e.target.value } })}
              placeholder={data?.smtp?.password_set ? '••••••••' : 'SMTP password'}
            />
          </div>
          <div className="form-group">
            <label>From email</label>
            <input
              type="email"
              value={form.smtp.from_email}
              onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, from_email: e.target.value } })}
              placeholder="noreply@yourcompany.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label>From display name</label>
          <input
            type="text"
            value={form.smtp.from_name}
            onChange={(e) => setForm({ ...form, smtp: { ...form.smtp, from_name: e.target.value } })}
            placeholder="GoBunny"
          />
        </div>

        <h3 className="email-section-heading">Notification actions</h3>
        <p className="email-actions-hint">
          Toggle which events trigger an email. Each action has its own template below.
        </p>

        <div className="email-actions-list">
          {catalog.map((action) => {
            const isOpen = expandedAction === action.id;
            const tpl = form.templates[action.id] || {};
            return (
              <div key={action.id} className="email-action-card">
                <div className="email-action-header">
                  <label className="email-action-toggle">
                    <input
                      type="checkbox"
                      checked={form.actions[action.id] !== false}
                      onChange={(e) => toggleAction(action.id, e.target.checked)}
                    />
                    <span className="email-action-title">{action.label}</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-link email-expand-btn"
                    onClick={() => setExpandedAction(isOpen ? null : action.id)}
                    aria-expanded={isOpen}
                  >
                    Template {isOpen ? <FiChevronUp /> : <FiChevronDown />}
                  </button>
                </div>
                <p className="email-action-desc">{action.description}</p>

                {isOpen && (
                  <div className="email-template-editor">
                    <p className="email-vars-hint">
                      Variables:{' '}
                      {action.variables.map((v) => (
                        <code key={v}>{'{{' + v + '}}'}</code>
                      ))}
                    </p>
                    <div className="form-group">
                      <label>Subject</label>
                      <input
                        type="text"
                        value={tpl.subject || ''}
                        onChange={(e) => updateTemplate(action.id, 'subject', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Plain text body</label>
                      <textarea
                        rows={5}
                        value={tpl.body_text || ''}
                        onChange={(e) => updateTemplate(action.id, 'body_text', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>HTML body</label>
                      <textarea
                        rows={6}
                        value={tpl.body_html || ''}
                        onChange={(e) => updateTemplate(action.id, 'body_html', e.target.value)}
                        className="email-html-textarea"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (window.confirm(`Reset "${action.label}" template to default?`)) {
                          resetTemplateMutation.mutate(action.id);
                        }
                      }}
                      disabled={resetTemplateMutation.isLoading}
                    >
                      <FiRefreshCw /> Reset to default
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="form-actions">
          <LoadingButton
            type="submit"
            className="btn btn-primary"
            icon={FiSave}
            loading={saveMutation.isLoading}
            loadingLabel="Saving…"
          >
            Save email settings
          </LoadingButton>
        </div>
      </form>

      <div className="email-test-panel">
        <h3>
          <FiSend /> Send test email
        </h3>
        <p>Uses the &quot;New user signup&quot; template with sample data. Save settings first.</p>
        <div className="form-row email-test-row">
          <div className="form-group">
            <label>Recipient</label>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <LoadingButton
            type="button"
            className="btn btn-secondary"
            icon={FiSend}
            loading={testMutation.isLoading}
            loadingLabel="Sending…"
            onClick={() => testMutation.mutate(testTo)}
          >
            Send test
          </LoadingButton>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
