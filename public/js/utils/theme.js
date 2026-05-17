const STORAGE_KEY = 'selectedTheme';

function applySavedTheme() {
  applyBodyTheme(localStorage.getItem(STORAGE_KEY) || 'default');
}

export function applyBodyTheme(themeName) {
  document.body.className = document.body.className
    .split(' ')
    .filter(c => !c.startsWith('theme-'))
    .join(' ');

  if (themeName && themeName !== 'default') {
    document.body.classList.add(`theme-${themeName}`);
  }

  if (['light', 'sepia'].includes(themeName)) {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  updateToggleIcons(themeName);
}

export function toggleTheme() {
  const current = localStorage.getItem(STORAGE_KEY) || 'default';
  const next = ['light', 'sepia'].includes(current) ? 'default' : 'light';

  if (window.SwamiAbhyasika?.setTheme) {
    window.SwamiAbhyasika.setTheme(next);
  } else {
    localStorage.setItem(STORAGE_KEY, next);
    applyBodyTheme(next);
  }
}

export function getTheme() {
  return localStorage.getItem(STORAGE_KEY) || 'default';
}

function updateToggleIcons(themeName) {
  const isLight = ['light', 'sepia'].includes(themeName);

  const lightIcon = document.getElementById('theme-toggle-light-icon');
  const darkIcon = document.getElementById('theme-toggle-dark-icon');
  if (lightIcon && darkIcon) {
    lightIcon.classList.toggle('hidden', isLight);
    darkIcon.classList.toggle('hidden', !isLight);
  }

  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    const sunIcon = btn.querySelector('.icon-sun');
    const moonIcon = btn.querySelector('.icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = isLight ? 'none' : 'block';
      moonIcon.style.display = isLight ? 'block' : 'none';
    }
  });
}

export function initTheme() {
  applySavedTheme();
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
}
