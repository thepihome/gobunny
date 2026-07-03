import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5023/api';

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

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle auth errors — avoid silent redirect loop on login page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';
    const isAuthRequest = requestUrl.includes('/auth/');
    const onLoginPage = window.location.pathname === '/login';

    if (status === 401 && !isAuthRequest && !onLoginPage) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

