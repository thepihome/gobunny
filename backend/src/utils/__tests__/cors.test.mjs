import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getAllowedOrigins, getCorsHeaders, handleCORS } from '../cors.js';

describe('cors', () => {
  it('includes CORS_EXTRA_ORIGINS alongside FRONTEND_URLS', () => {
    const env = {
      FRONTEND_URLS: 'https://app.example.com',
      CORS_EXTRA_ORIGINS: 'https://dev-godash-future-builds.gobunny.pages.dev',
    };
    const origins = getAllowedOrigins(env);
    assert.ok(origins.includes('https://app.example.com'));
    assert.ok(origins.includes('https://dev-godash-future-builds.gobunny.pages.dev'));
  });

  it('allows wildcard Cloudflare Pages preview origins', () => {
    const env = {
      CORS_EXTRA_ORIGINS: 'https://*.gobunny.pages.dev',
    };
    const headers = getCorsHeaders(
      env,
      'https://dev-godash-future-builds.gobunny.pages.dev'
    );
    assert.equal(
      headers['Access-Control-Allow-Origin'],
      'https://dev-godash-future-builds.gobunny.pages.dev'
    );
    assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
  });

  it('returns ACAO on preflight for allowed dev origin', () => {
    const env = {
      CORS_EXTRA_ORIGINS: 'https://dev-godash-future-builds.gobunny.pages.dev',
    };
    const request = new Request('https://api.example.com/api/auth/google', {
      method: 'OPTIONS',
      headers: { Origin: 'https://dev-godash-future-builds.gobunny.pages.dev' },
    });
    const response = handleCORS(env, request);
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get('Access-Control-Allow-Origin'),
      'https://dev-godash-future-builds.gobunny.pages.dev'
    );
  });

  it('allows PATCH in preflight methods', () => {
    const env = {
      CORS_EXTRA_ORIGINS: 'https://dev-godash-future-builds.gobunny.pages.dev',
    };
    const request = new Request('https://api.example.com/api/jobs/2/listing-type', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://dev-godash-future-builds.gobunny.pages.dev',
        'Access-Control-Request-Method': 'PATCH',
      },
    });
    const response = handleCORS(env, request);
    assert.match(
      response.headers.get('Access-Control-Allow-Methods'),
      /PATCH/
    );
  });

  it('omits ACAO for disallowed origins', () => {
    const env = { FRONTEND_URLS: 'https://app.example.com' };
    const headers = getCorsHeaders(env, 'https://evil.example.com');
    assert.equal(headers['Access-Control-Allow-Origin'], undefined);
  });
});
