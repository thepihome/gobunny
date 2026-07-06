import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8787/api';

/** True while AuthContext is validating a stored token (suppresses 401 redirect race). */
let authBootstrapping = false;

export function setAuthBootstrapping(value) {
  authBootstrapping = Boolean(value);
}

export function isAuthBootstrapping() {
  return authBootstrapping;
}

if (
  typeof window !== 'undefined' &&
  !window.location.hostname.includes('localhost') &&
  API_BASE_URL.includes('localhost')
) {
  console.error(
    '[GoBunny] REACT_APP_API_URL is not set for this deployment. ' +
      'Add it under Cloudflare Pages → Settings → Environment variables (Preview), then redeploy.'
  );
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthRequest = requestUrl.includes('/auth/');
    const onLoginPage = window.location.pathname === '/login';

    if (status === 401 && !isAuthRequest && !onLoginPage && !authBootstrapping) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const BLOB_REVOKE_MS = 60_000;

/**
 * Fetch an authenticated file and return a blob URL plus revoke().
 * Call revoke() after the consumer is done (e.g. after opening a tab).
 */
export async function fetchAuthenticatedFile(path) {
  const response = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  let revoked = false;
  const revoke = () => {
    if (revoked) return;
    revoked = true;
    URL.revokeObjectURL(url);
  };
  const autoRevokeTimer = setTimeout(revoke, BLOB_REVOKE_MS);
  return {
    url,
    revoke: () => {
      clearTimeout(autoRevokeTimer);
      revoke();
    },
  };
}

/** Open an authenticated file in a new tab and schedule blob URL cleanup. */
export async function openAuthenticatedFile(path) {
  const { url, revoke } = await fetchAuthenticatedFile(path);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(revoke, BLOB_REVOKE_MS);
}

export default api;
