/**
 * Theme toggle utility — handles dark/light mode switching.
 * Persists user preference to localStorage.
 */

const STORAGE_KEY = 'edutrack-theme';

/** Apply saved theme on module load (prevents flash of wrong theme) */
function applySavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/** Toggle between dark and light themes */
export function toggleTheme() {
  const isCurrentlyLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isCurrentlyLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(STORAGE_KEY, 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem(STORAGE_KEY, 'light');
  }
  updateToggleIcons();
}

/** Get current theme */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Update all toggle button icons on the page */
function updateToggleIcons() {
  const isLight = getTheme() === 'light';
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    const sunIcon = btn.querySelector('.icon-sun');
    const moonIcon = btn.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = isLight ? 'none' : 'block';
      moonIcon.style.display = isLight ? 'block' : 'none';
    }
  });
}

/** Initialize theme system — call once on page load */
export function initTheme() {
  applySavedTheme();
  // Wire up all toggle buttons
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
  updateToggleIcons();
}
