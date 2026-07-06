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
    primaryLight: '#4F63C4',
    secondary: '#64748b',
    background: '#f4f6fc',
    surface: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    navbar: '#ffffff',
    accent: '#7C3AED',
  },
  ocean: {
    name: 'Ocean',
    primary: '#0369a1',
    primaryLight: '#0ea5e9',
    secondary: '#64748b',
    background: '#f0f9ff',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#bae6fd',
    navbar: '#ffffff',
    accent: '#06b6d4',
  },
  violet: {
    name: 'Violet',
    primary: '#5b21b6',
    primaryLight: '#8b5cf6',
    secondary: '#64748b',
    background: '#faf5ff',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#ddd6fe',
    navbar: '#ffffff',
    accent: '#ec4899',
  },
  emerald: {
    name: 'Emerald',
    primary: '#047857',
    primaryLight: '#10b981',
    secondary: '#64748b',
    background: '#ecfdf5',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#a7f3d0',
    navbar: '#ffffff',
    accent: '#0891b2',
  },
  sunset: {
    name: 'Sunset',
    primary: '#c2410c',
    primaryLight: '#f97316',
    secondary: '#64748b',
    background: '#fff7ed',
    surface: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    border: '#fed7aa',
    navbar: '#ffffff',
    accent: '#e11d48',
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

const darkenHex = (hex, amount = 20) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const r = Math.max(0, parseInt(normalized.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(normalized.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(normalized.slice(4, 6), 16) - amount);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const resolveStoredMode = (saved) => {
  if (!saved) return 'system';
  if (saved === 'system' || saved === 'light' || saved === 'dark') return saved;
  if (saved === 'dark') return 'dark';
  return 'light';
};

const resolveStoredAccent = (saved) => {
  const legacyMap = { blue: 'ocean', green: 'emerald', purple: 'violet' };
  const normalized = legacyMap[saved] || saved;
  if (!normalized || normalized === 'ui8' || normalized === 'light' || normalized === 'dark' || normalized === 'system') {
    return 'gobunny';
  }
  return accentThemes[normalized] ? normalized : 'gobunny';
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
  const primaryLight = theme.primaryLight || (isDark ? '#7b9ae0' : '#4f63c4');
  const accent = theme.accent || '#7c3aed';

  root.style.setProperty('--primary-color', theme.primary);
  root.style.setProperty('--primary-hover', isDark ? theme.primary : darkenHex(theme.primary, 18));
  root.style.setProperty('--primary-light', primaryLight);
  root.style.setProperty('--primary-vivid', isDark ? primaryLight : theme.primary);
  root.style.setProperty('--secondary-color', theme.secondary);
  root.style.setProperty('--background-color', theme.background);
  root.style.setProperty('--bg-primary', theme.background);
  const glassSurface = isDark ? 'rgba(30, 41, 59, 0.68)' : 'rgba(255, 255, 255, 0.62)';
  const glassMuted = isDark ? 'rgba(15, 23, 42, 0.48)' : 'rgba(255, 255, 255, 0.38)';
  root.style.setProperty('--surface-color', glassSurface);
  root.style.setProperty('--bg-secondary', glassSurface);
  root.style.setProperty('--text-color', theme.text);
  root.style.setProperty('--text-primary', theme.text);
  root.style.setProperty('--text-heading', isDark ? theme.text : '#0f172a');
  root.style.setProperty('--text-secondary-color', theme.textSecondary);
  root.style.setProperty('--text-secondary', theme.textSecondary);
  root.style.setProperty('--border-color', theme.border);
  root.style.setProperty('--navbar-color', theme.navbar);
  root.style.setProperty(
    '--gradient-primary',
    `linear-gradient(135deg, ${theme.primary} 0%, ${primaryLight} 55%, ${accent} 100%)`
  );
  root.style.setProperty(
    '--gradient-profile',
    `linear-gradient(135deg, ${theme.primary} 0%, ${primaryLight} 100%)`
  );
  root.style.setProperty('--accent-violet', accent);

  root.style.setProperty('--chart-1', theme.primary);
  root.style.setProperty('--chart-2', accent);
  root.style.setProperty('--chart-3', primaryLight);
  root.style.setProperty('--chart-4', '#059669');
  root.style.setProperty('--chart-5', '#d97706');
  root.style.setProperty('--chart-6', '#f43f5e');

  const mesh = isDark
    ? `linear-gradient(168deg, ${theme.background} 0%, ${theme.surface} 50%, ${theme.background} 100%)`
    : `linear-gradient(180deg, #f8fafc 0%, ${theme.background} 55%, #ffffff 100%)`;

  root.style.setProperty('--mesh-gradient', mesh);

  if (isDark) {
    root.style.setProperty('--glass-bg', 'rgba(30, 41, 59, 0.55)');
    root.style.setProperty('--glass-bg-strong', 'rgba(30, 41, 59, 0.68)');
    root.style.setProperty('--glass-bg-muted', 'rgba(15, 23, 42, 0.48)');
    root.style.setProperty('--glass-panel-bg', 'rgba(30, 41, 59, 0.68)');
    root.style.setProperty('--glass-panel-border', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--glass-sidebar-bg', 'rgba(15, 23, 42, 0.58)');
    root.style.setProperty('--glass-filter-bg', 'rgba(15, 23, 42, 0.48)');
    root.style.setProperty('--glass-table-header', 'rgba(15, 23, 42, 0.55)');
    root.style.setProperty('--surface-muted', glassMuted);
    root.style.setProperty('--border-light', '#1e293b');
    root.style.setProperty('--chrome-panel-bg', '#1e293b');
    root.style.setProperty('--chrome-panel-muted', '#0f172a');
    root.style.setProperty('--chrome-panel-hover', '#334155');
    root.style.setProperty('--chrome-btn-bg', 'rgba(255, 255, 255, 0.12)');
  } else {
    root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.5)');
    root.style.setProperty('--glass-bg-strong', 'rgba(255, 255, 255, 0.62)');
    root.style.setProperty('--glass-bg-muted', 'rgba(255, 255, 255, 0.38)');
    root.style.setProperty('--glass-panel-bg', 'rgba(255, 255, 255, 0.62)');
    root.style.setProperty('--glass-panel-border', 'rgba(255, 255, 255, 0.55)');
    root.style.setProperty('--glass-sidebar-bg', 'rgba(255, 255, 255, 0.52)');
    root.style.setProperty('--glass-filter-bg', 'rgba(255, 255, 255, 0.38)');
    root.style.setProperty('--glass-table-header', 'rgba(248, 250, 252, 0.55)');
    root.style.setProperty('--surface-muted', glassMuted);
    root.style.setProperty('--border-light', '#f1f5f9');
    root.style.setProperty('--chrome-panel-bg', '#ffffff');
    root.style.setProperty('--chrome-panel-muted', '#f8fafc');
    root.style.setProperty('--chrome-panel-hover', '#f1f5f9');
    root.style.setProperty('--chrome-btn-bg', '#f1f5f9');
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
