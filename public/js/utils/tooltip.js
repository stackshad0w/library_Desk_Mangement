/**
 * Lightweight cursor-following tooltips. Any element with a `data-tip`
 * attribute shows a styled tooltip on hover (multi-line via \n).
 * Ported from the V16 seat tooltips and generalised for the whole app.
 */

let tipEl = null;

function ensure() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'app-tooltip';
    tipEl.style.display = 'none';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

function show(e, text) {
  const tip = ensure();
  tip.textContent = text;
  tip.style.display = 'block';
  move(e);
}

function move(e) {
  if (!tipEl || tipEl.style.display === 'none') return;
  const pad = 14;
  const r = tipEl.getBoundingClientRect();
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - pad;
  tipEl.style.left = Math.max(8, x) + 'px';
  tipEl.style.top = Math.max(8, y) + 'px';
}

function hide() {
  if (tipEl) tipEl.style.display = 'none';
}

export function initTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) show(e, el.getAttribute('data-tip'));
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('[data-tip]')) hide();
  });
  document.addEventListener('mousemove', (e) => {
    if (tipEl && tipEl.style.display !== 'none') {
      if (e.target.closest('[data-tip]')) move(e);
      else hide();
    }
  });
  // Hide on scroll/leave so it never gets stranded
  window.addEventListener('scroll', hide, true);
}
