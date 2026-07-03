import React from 'react';
import { FiSun, FiMoon, FiMonitor } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

const MODES = [
  { id: 'light', label: 'Light', icon: FiSun },
  { id: 'dark', label: 'Dark', icon: FiMoon },
  { id: 'system', label: 'System', icon: FiMonitor },
];

const ThemeToggle = ({ compact = false }) => {
  const { themeMode, setColorMode } = useTheme();

  return (
    <div
      className={`theme-toggle ${compact ? 'theme-toggle--compact' : ''}`}
      role="radiogroup"
      aria-label="Theme selection"
    >
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`theme-toggle-option ${themeMode === id ? 'active' : ''}`}
          data-theme={id}
          role="radio"
          aria-checked={themeMode === id}
          aria-label={label}
          title={label}
          onClick={() => setColorMode(id)}
        >
          <Icon aria-hidden="true" />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
