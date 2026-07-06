import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import api, { setAuthBootstrapping } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children, initialUser = null }) => {
  const [user, setUser] = useState(initialUser);
  /** False until token/no-token bootstrap finishes — gates PrivateRoute. */
  const [sessionChecked, setSessionChecked] = useState(Boolean(initialUser));
  const bootstrapAbortRef = useRef(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  useEffect(() => {
    if (initialUser) {
      setSessionChecked(true);
      return undefined;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setSessionChecked(true);
      return undefined;
    }

    const controller = new AbortController();
    bootstrapAbortRef.current = controller;
    setAuthBootstrapping(true);
    setSessionChecked(false);
    setUser(null);

    api
      .get('/auth/me', { signal: controller.signal })
      .then((response) => {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      })
      .catch((error) => {
        if (error.code === 'ERR_CANCELED') return;
        clearSession();
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setAuthBootstrapping(false);
          setSessionChecked(true);
        }
      });

    return () => {
      controller.abort();
      setAuthBootstrapping(false);
    };
  }, [initialUser, clearSession]);

  const loginWithGoogle = async (credential) => {
    const response = await api.post('/auth/google', { credential });
    const { token, user: loggedInUser } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setSessionChecked(true);
    setAuthBootstrapping(false);
    return loggedInUser;
  };

  const logout = () => {
    bootstrapAbortRef.current?.abort();
    setAuthBootstrapping(false);
    clearSession();
    setSessionChecked(true);
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      const updatedUser = response.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearSession();
      }
      throw error;
    }
  };

  const loading = !sessionChecked;

  return (
    <AuthContext.Provider
      value={{ user, loginWithGoogle, logout, loading, sessionChecked, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
