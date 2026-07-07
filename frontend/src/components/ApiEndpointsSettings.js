import React, { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { FiCode, FiCopy, FiCheck, FiSearch } from 'react-icons/fi';
import api, { API_BASE_URL } from '../config/api';
import './ApiEndpointsSettings.css';

const METHOD_COLORS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
};

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button type="button" className="api-endpoints-copy" onClick={handleCopy} title={label}>
      {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

const ApiEndpointsSettings = () => {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery(
    ['api-endpoints'],
    () => api.get('/endpoints').then((r) => r.data),
    { staleTime: 60_000 }
  );

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const filteredGroups = useMemo(() => {
    if (!data?.groups) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.groups;

    return data.groups
      .map((group) => ({
        ...group,
        endpoints: group.endpoints.filter(
          (ep) =>
            ep.method.toLowerCase().includes(q) ||
            ep.path.toLowerCase().includes(q) ||
            ep.url.toLowerCase().includes(q) ||
            ep.description.toLowerCase().includes(q) ||
            (ep.notes && ep.notes.toLowerCase().includes(q)) ||
            ep.auth_label.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.endpoints.length > 0);
  }, [data, search]);

  const toggleGroup = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) {
    return <div className="loading">Loading API endpoints…</div>;
  }

  if (isError) {
    return (
      <div className="api-endpoints-error">
        Could not load endpoints: {error?.response?.data?.error || error?.message || 'Request failed'}
      </div>
    );
  }

  return (
    <div className="settings-section api-endpoints-settings">
      <div className="api-endpoints-header">
        <h2>
          <FiCode /> API Endpoints
        </h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <p className="api-endpoints-intro">
        URLs below are resolved from this deployment&apos;s API worker. Use them in Postman, career sites, or
        integrations — no hard-coded domains required.
      </p>

      <div className="api-endpoints-bases">
        <div className="api-base-card">
          <span className="api-base-label">API origin</span>
          <code className="api-base-value">{data.api_origin}</code>
          <CopyButton value={data.api_origin} label="Copy origin" />
        </div>
        <div className="api-base-card">
          <span className="api-base-label">API base</span>
          <code className="api-base-value">{data.api_base}</code>
          <CopyButton value={data.api_base} label="Copy base" />
        </div>
        <div className="api-base-card">
          <span className="api-base-label">This app (frontend)</span>
          <code className="api-base-value">{appOrigin}</code>
          <CopyButton value={appOrigin} label="Copy app URL" />
        </div>
        <div className="api-base-card api-base-card--muted">
          <span className="api-base-label">Configured client base</span>
          <code className="api-base-value">{API_BASE_URL}</code>
          <CopyButton value={API_BASE_URL} label="Copy client base" />
        </div>
      </div>

      <p className="api-endpoints-auth-hint">
        Authenticated routes: <code>{data.auth_header}</code>
      </p>

      <div className="api-endpoints-search">
        <FiSearch aria-hidden />
        <input
          type="search"
          placeholder="Filter by path, method, description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter endpoints"
        />
      </div>

      <div className="api-endpoints-groups">
        {filteredGroups.map((group) => {
          const isOpen = expanded[group.id] !== false;
          return (
            <section key={group.id} className="api-endpoints-group">
              <button
                type="button"
                className="api-endpoints-group-toggle"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
              >
                <span className="api-endpoints-group-title">{group.label}</span>
                <span className="api-endpoints-group-count">{group.endpoints.length}</span>
              </button>

              {isOpen && (
                <div className="api-endpoints-table-wrap">
                  <table className="api-endpoints-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Path</th>
                        <th>Full URL</th>
                        <th>Auth</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.endpoints.map((ep) => (
                        <tr key={`${ep.method}-${ep.path}`}>
                          <td>
                            <span className={`api-method api-method--${METHOD_COLORS[ep.method] || 'default'}`}>
                              {ep.method}
                            </span>
                          </td>
                          <td>
                            <code className="api-path">{ep.path}</code>
                          </td>
                          <td className="api-url-cell">
                            <code className="api-url">{ep.url}</code>
                            <CopyButton value={ep.url} label="Copy URL" />
                          </td>
                          <td>
                            <span className={`api-auth api-auth--${ep.auth}`}>{ep.auth_label}</span>
                          </td>
                          <td>
                            <div>{ep.description}</div>
                            {ep.notes && <div className="api-endpoint-notes">{ep.notes}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <p className="api-endpoints-empty">No endpoints match your filter.</p>
      )}

      <p className="api-endpoints-footer">
        Generated {data.generated_at ? new Date(data.generated_at).toLocaleString() : '—'} from worker{' '}
        <code>{data.api_origin}</code>
      </p>
    </div>
  );
};

export default ApiEndpointsSettings;
