import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivateRoute from '../PrivateRoute';
import { AuthProvider } from '../../context/AuthContext';

jest.mock('../../config/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
  setAuthBootstrapping: jest.fn(),
  isAuthBootstrapping: jest.fn(() => false),
  API_BASE_URL: 'http://localhost:8787/api',
}));

const api = require('../../config/api').default;
const { setAuthBootstrapping } = require('../../config/api');

describe('PrivateRoute session bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('shows loading while token exists without cached user until /auth/me resolves', async () => {
    localStorage.setItem('token', 'stored-token');
    localStorage.removeItem('user');

    let resolveMe;
    api.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMe = () => resolve({ data: { user: { id: 1, role: 'admin' } } });
        })
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <PrivateRoute>
            <div>Protected content</div>
          </PrivateRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
    expect(setAuthBootstrapping).toHaveBeenCalledWith(true);

    await act(async () => {
      resolveMe();
    });

    await waitFor(() => {
      expect(screen.getByText('Protected content')).toBeInTheDocument();
    });
    expect(setAuthBootstrapping).toHaveBeenCalledWith(false);
  });

  it('redirects to login when token bootstrap fails', async () => {
    localStorage.setItem('token', 'bad-token');
    api.get.mockRejectedValue({ response: { status: 401 } });

    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <AuthProvider>
            <PrivateRoute>
              <div>Protected content</div>
            </PrivateRoute>
          </AuthProvider>
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  it('renders immediately with initialUser in tests', () => {
    render(
      <MemoryRouter>
        <AuthProvider initialUser={{ id: 1, role: 'admin' }}>
          <PrivateRoute>
            <div>Protected content</div>
          </PrivateRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected content')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
