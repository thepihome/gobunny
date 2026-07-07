import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEndpointsPayload, API_CATALOG } from '../apiCatalog.js';

describe('apiCatalog', () => {
  it('builds grouped payload with resolved URLs', () => {
    const request = new Request('https://api.example.com/api/endpoints', {
      headers: { Origin: 'https://app.example.com' },
    });
    const payload = buildEndpointsPayload(request, {});

    assert.equal(payload.api_origin, 'https://api.example.com');
    assert.equal(payload.api_base, 'https://api.example.com/api');
    assert.equal(payload.frontend_origin, 'https://app.example.com');
    assert.ok(payload.groups.length > 0);

    const careers = payload.groups.find((g) => g.id === 'careers');
    assert.ok(careers);
    const listJobs = careers.endpoints.find((e) => e.path === '/api/careers/jobs');
    assert.equal(listJobs.url, 'https://api.example.com/api/careers/jobs');
    assert.equal(listJobs.auth_label, 'Public');
  });

  it('uses PUBLIC_API_BASE_URL when set', () => {
    const request = new Request('https://internal.example.com/api/endpoints');
    const payload = buildEndpointsPayload(request, {
      PUBLIC_API_BASE_URL: 'https://public.example.com/api',
    });
    assert.equal(payload.api_origin, 'https://public.example.com');
  });

  it('catalog has unique method+path pairs', () => {
    const keys = API_CATALOG.map((e) => `${e.method} ${e.path}`);
    assert.equal(keys.length, new Set(keys).size);
  });
});
