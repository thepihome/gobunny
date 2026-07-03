import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const accentThemes = {
  gobunny: {
    name: 'GoBunny',
    primary: '#2B3D7E',
    secondary: '#64748b',
    background: '#fafbfc',
    surface: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    navbar: '#ffffff',
  },
  blue: {
    name: 'Blue',
    primary: '#1e3a5f',
    secondary: '#64748b',
    background: '#f0f4f8',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#cbd5e0',
    navbar: '#1e3a5f',
  },
  green: {
    name: 'Green',
    primary: '#059669',
    secondary: '#64748b',
    background: '#f0fdf4',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#bbf7d0',
    navbar: '#065f46',
  },
  purple: {
    name: 'Purple',
    primary: '#5b21b6',
    secondary: '#64748b',
    background: '#faf5ff',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#ddd6fe',
    navbar: '#4c1d95',
  },
};

const darkTheme = {
  primary: '#5b7fd4',
  secondary: '#94a3b8',
  background: '#0f172a',
  surface: '#1e293b',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
  border: '#334155',
  navbar: '#0f172a',
};

const getSystemTheme = () =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const resolveStoredMode = (saved) => {
  if (!saved) return 'system';
  if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  if (saved === 'dark') return 'dark';
  return 'light';
};

const resolveStoredAccent = (saved) => {
  if (!saved || saved === 'ui8' || saved === 'light' || saved === 'dark' || saved === 'system') {
    return 'gobunny';
  }
  return accentThemes[saved] ? saved : 'gobunny';
};

const migrateLegacyTheme = () => {
  const legacy = localStorage.getItem('theme');
  if (!legacy) return;

  const hasMode = localStorage.getItem('themeMode');
  const hasAccent = localStorage.getItem('accentTheme');

  if (!hasMode) {
    if (legacy === 'dark') {
      localStorage.setItem('themeMode', 'dark');
    } else if (legacy === 'system') {
      localStorage.setItem('themeMode', 'system');
    } else {
      localStorage.setItem('themeMode', 'light');
    }
  }

  if (!hasAccent) {
    localStorage.setItem('accentTheme', resolveStoredAccent(legacy));
  }
};

const applyThemeVariables = (theme, isDark) => {
  const root = document.documentElement;
  const isLightNavbar = theme.navbar === '#ffffff' || theme.navbar.toLowerCase() === '#fff';

  root.style.setProperty('--primary-color', theme.primary);
  root.style.setProperty('--primary-hover', isDark ? theme.primary : '#1e2d5f');
  root.style.setProperty('--primary-light', isDark ? '#7b9ae0' : '#3d5299');
  root.style.setProperty('--secondary-color', theme.secondary);
  root.style.setProperty('--background-color', theme.background);
  root.style.setProperty('--bg-primary', theme.background);
  root.style.setProperty('--surface-color', theme.surface);
  root.style.setProperty('--bg-secondary', theme.surface);
  root.style.setProperty('--text-color', theme.text);
  root.style.setProperty('--text-primary', theme.text);
  root.style.setProperty('--text-heading', isDark ? theme.text : '#0f172a');
  root.style.setProperty('--text-secondary-color', theme.textSecondary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--border-color', theme.border);
  root.style.setProperty('--navbar-color', theme.navbar);
  root.style.setProperty('--gradient-primary', theme.primary);
  root.style.setProperty('--gradient-profile', `linear-gradient(135deg, ${theme.primary} 0%, ${isDark ? '#7b9ae0' : theme.primary} 100%)`);

  const mesh = isDark
    ? `linear-gradient(168deg, ${theme.background} 0%, ${theme.surface} 50%, ${theme.background} 100%)`
    : `linear-gradient(180deg, #f8fafc 0%, ${theme.background} 55%, #ffffff 100%)`;

  root.style.setProperty('--mesh-gradient', mesh);

  if (isDark) {
    root.style.setProperty('--glass-panel-bg', theme.surface);
    root.style.setProperty('--glass-panel-border', 'rgba(148, 163, 184, 0.14)');
    root.style.setProperty('--glass-sidebar-bg', theme.surface);
    root.style.setProperty('--glass-filter-bg', theme.background);
    root.style.setProperty('--glass-table-header', theme.background);
    root.style.setProperty('--surface-muted', '#334155');
    root.style.setProperty('--border-light', '#1e293b');
  } else {
    root.style.setProperty('--glass-panel-bg', '#ffffff');
    root.style.setProperty('--glass-panel-border', 'rgba(15, 23, 42, 0.08)');
    root.style.setProperty('--glass-sidebar-bg', '#ffffff');
    root.style.setProperty('--glass-filter-bg', '#f8fafc');
    root.style.setProperty('--glass-table-header', '#f8fafc');
    root.style.setProperty('--surface-muted', '#f1f5f9');
    root.style.setProperty('--border-light', '#f1f5f9');
  }

  root.dataset.navbarStyle = isLightNavbar ? 'light' : 'dark';
};

export const ThemeProvider = ({ children }) => {
  migrateLegacyTheme();

  const [themeMode, setThemeMode] = useState(() =>
    resolveStoredMode(localStorage.getItem('themeMode'))
  );
  const [accentTheme, setAccentTheme] = useState(() =>
    resolveStoredAccent(localStorage.getItem('accentTheme'))
  );
  const [resolvedTheme, setResolvedTheme] = useState('light');

  const getEffectiveTheme = useCallback(() => {
    if (themeMode === 'system') return getSystemTheme();
    return themeMode;
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    const effective = getEffectiveTheme();
    setResolvedTheme(effective);

    if (themeMode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', themeMode);
    }

    const isDark = effective === 'dark';
    const theme = isDark ? darkTheme : accentThemes[accentTheme] || accentThemes.gobunny;
    applyThemeVariables(theme, isDark);

    localStorage.setItem('themeMode', themeMode);
    localStorage.setItem('accentTheme', accentTheme);
    localStorage.setItem('theme', isDark ? 'dark' : accentTheme);
  }, [themeMode, accentTheme, getEffectiveTheme]);

  useEffect(() => {
    if (themeMode !== 'system') return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const effective = media.matches ? 'dark' : 'light';
      setResolvedTheme(effective);
      const theme = effective === 'dark' ? darkTheme : accentThemes[accentTheme] || accentThemes.gobunny;
      applyThemeVariables(theme, effective === 'dark');
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [themeMode, accentTheme]);

  const setColorMode = (mode) => setThemeMode(mode);
  const changeAccentTheme = (name) => {
    if (accentThemes[name]) setAccentTheme(name);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        accentTheme,
        resolvedTheme,
        accentThemes,
        themes: accentThemes,
        currentTheme: accentTheme,
        setColorMode,
        changeTheme: changeAccentTheme,
        changeAccentTheme,
        isDark: resolvedTheme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
