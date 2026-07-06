import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const CHART_VAR_KEYS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
];

const FALLBACK_PALETTE = ['#2b3d7e', '#7c3aed', '#0891b2', '#059669', '#d97706', '#f43f5e'];

export function getCssVar(name, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function getChartPalette() {
  return CHART_VAR_KEYS.map((key, i) => getCssVar(key, FALLBACK_PALETTE[i]));
}

export function getChartStyles() {
  return {
    palette: getChartPalette(),
    primary: getCssVar('--primary-color', '#2b3d7e'),
    primaryLight: getCssVar('--primary-light', '#3d5299'),
    text: getCssVar('--text-secondary-color', '#64748b'),
    heading: getCssVar('--text-heading', '#0f172a'),
    grid: getCssVar('--border-color', '#e2e8f0'),
    surface: getCssVar('--surface-color', '#ffffff'),
    success: getCssVar('--success-color', '#059669'),
    warning: getCssVar('--warning-color', '#d97706'),
    error: getCssVar('--error-color', '#dc2626'),
  };
}

/** Re-reads CSS chart palette when theme mode or accent changes. */
export function useChartColors() {
  const { themeMode, accentTheme, resolvedTheme } = useTheme();
  const [styles, setStyles] = useState(getChartStyles);

  useEffect(() => {
    setStyles(getChartStyles());
  }, [themeMode, accentTheme, resolvedTheme]);

  return styles;
}
