/* eslint-env browser */

const DOC_ROOT = '../../';

function setActiveNav() {
  const current = document.body.dataset.page;
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === current) {
      link.classList.add('active');
    }
  });
}

function initThemeToggle() {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle) return;
  const root = document.documentElement;
  toggle.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initThemeToggle();
});

export { DOC_ROOT };
