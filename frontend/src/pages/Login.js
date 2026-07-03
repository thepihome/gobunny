import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import './Auth.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const Login = () => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);
  const buttonRef = useRef(null);
  const callbackRef = useRef(null);
  callbackRef.current = async (response) => {
    if (!response?.credential) {
      setError('Google sign-in did not return a credential. Try again or check OAuth origins.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle(response.credential);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Sign in failed';
      setError(msg);
      console.error('[GoBunny] Google login failed:', err.response?.status, msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured. Set REACT_APP_GOOGLE_CLIENT_ID.');
      return;
    }
    const handleCredential = (response) => {
      if (callbackRef.current) callbackRef.current(response);
    };
    if (typeof window.google === 'undefined') {
      const checkGoogle = () => {
        if (typeof window.google !== 'undefined' && window.google.accounts) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredential,
            auto_select: false,
          });
          if (buttonRef.current) {
            window.google.accounts.id.renderButton(buttonRef.current, {
              type: 'standard',
              theme: 'filled_blue',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
            });
          }
        } else {
          setTimeout(checkGoogle, 100);
        }
      };
      checkGoogle();
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: false,
    });
    if (buttonRef.current) {
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
      });
    }
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="auth-brand">
        <span className="brand-mark" aria-hidden="true">GB</span>
        <div className="auth-brand-text">
          <h1>GoBunny</h1>
          <p>Platform</p>
        </div>
      </div>
      <div className="auth-card">
        <h2>Sign in</h2>
        <p className="auth-subtitle">Use your Google account to access the GoBunny platform</p>
        {error && <div className="error">{error}</div>}
        <div className="google-signin-wrapper">
          {GOOGLE_CLIENT_ID ? (
            <div
              ref={buttonRef}
              className="google-button-container"
              style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}
            />
          ) : (
            <p className="error">REACT_APP_GOOGLE_CLIENT_ID is not set.</p>
          )}
        </div>
        {loading && <p className="auth-loading">Signing in...</p>}
      </div>
      <p className="auth-footer">Consulting &amp; career services — one standard of excellence</p>
    </div>
  );
};

export default Login;
