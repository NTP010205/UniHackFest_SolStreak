'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('solstreak-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activeTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    setTheme(activeTheme);
    setReady(true);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <div className={`theme-toggle-shell ${ready ? 'is-ready' : ''}`}>
      <span aria-hidden="true" className="theme-toggle-icon">☾</span>
      <button
        type="button"
        role="switch"
        aria-checked={theme === 'light'}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        title={theme === 'dark' ? 'Dark theme — slide right for light' : 'Light theme — slide left for dark'}
        onClick={toggleTheme}
        className="theme-toggle-track"
      >
        <span className="theme-toggle-thumb" />
      </button>
      <span aria-hidden="true" className="theme-toggle-icon">☀</span>
    </div>
  );
}
