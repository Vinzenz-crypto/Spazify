// Modals (dialogs / bottom sheets on phones), toasts and tooltips.
import { html, esc, setHTML } from '../lib/html.js';
import { icon } from '../lib/icons.js';

// ---------------- modals ----------------
const stack = [];
let modalCount = 0;

function focusables(root) {
  return [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

export function openModal({ title, body = '', foot = '', wide = false, onClose = null, onMount = null, initialFocus = null }) {
  const root = document.getElementById('modal-root');
  const id = `modal-title-${++modalCount}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <div class="modal-head"><h2 id="${id}">${esc(title)}</h2><button type="button" class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Close">${icon('x')}</button></div>
      <div class="modal-body"></div>
      <div class="modal-foot" hidden></div>
    </div>`;
  const bodyEl = backdrop.querySelector('.modal-body');
  const footEl = backdrop.querySelector('.modal-foot');
  const previousFocus = document.activeElement;
  let closed = false;

  const api = {
    el: backdrop,
    body: bodyEl,
    setBody(content) {
      setHTML(bodyEl, content);
    },
    setFoot(content) {
      setHTML(footEl, content);
      footEl.hidden = !String(content || '').trim();
    },
    setTitle(text) {
      backdrop.querySelector(`#${id}`).textContent = text;
    },
    close(result) {
      if (closed) return;
      closed = true;
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 180);
      if (!stack.length) document.documentElement.style.overflow = '';
      if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      onClose?.(result);
    },
    get closed() {
      return closed;
    },
  };

  api.setBody(body);
  api.setFoot(foot);
  backdrop.addEventListener('mousedown', (e) => {
    backdrop._downOnBackdrop = e.target === backdrop;
  });
  backdrop.addEventListener('click', (e) => {
    if ((e.target === backdrop && backdrop._downOnBackdrop) || e.target.closest('[data-close]')) api.close();
  });
  backdrop.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = focusables(backdrop);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  root.appendChild(backdrop);
  stack.push(api);
  document.documentElement.style.overflow = 'hidden';
  onMount?.(api);
  requestAnimationFrame(() => {
    const target = (initialFocus && backdrop.querySelector(initialFocus)) || focusables(bodyEl)[0] || backdrop.querySelector('[data-close]');
    target?.focus({ preventScroll: true });
  });
  return api;
}

export function closeAllModals() {
  [...stack].reverse().forEach((m) => m.close());
}

export function topModal() {
  return stack[stack.length - 1] || null;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack[stack.length - 1].close();
  }
});

export function confirmDialog({ title, text = '', confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, extra = '' }) {
  return new Promise((resolve) => {
    let result = false;
    const modal = openModal({
      title,
      body: html`${text ? html`<p class="muted">${text}</p>` : ''}${extra}`,
      foot: html`<button type="button" class="btn btn-ghost" data-close>${cancelLabel}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${confirmLabel}</button>`,
      onClose: () => resolve(result),
      initialFocus: '[data-confirm]',
    });
    modal.el.querySelector('[data-confirm]').addEventListener('click', () => {
      result = true;
      modal.close();
    });
  });
}

// ---------------- toasts ----------------
export function toast(message, { type = 'info', iconName = null, timeout = 3400 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'is-error' : ''}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const ic = iconName || (type === 'error' ? 'circle-alert' : type === 'success' ? 'circle-check-big' : null);
  el.innerHTML = `${ic ? icon(ic, { size: 18 }) : ''}<span></span>`;
  el.querySelector('span').textContent = message;
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

// ---------------- tooltips (charts) ----------------
let tooltipEl = null;
function showTip(target) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.innerHTML = '<strong></strong><span></span>';
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.querySelector('strong').textContent = target.dataset.tipValue || '';
  tooltipEl.querySelector('span').textContent = target.dataset.tipLabel || '';
  const r = target.getBoundingClientRect();
  const x = Math.min(window.innerWidth - 90, Math.max(90, r.left + r.width / 2));
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${Math.max(56, r.top)}px`;
  tooltipEl.classList.add('is-visible');
}
function hideTip() {
  tooltipEl?.classList.remove('is-visible');
}

export function installTooltips() {
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('[data-tip-value]');
    if (t) showTip(t);
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest?.('[data-tip-value]');
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const t = e.target.closest?.('[data-tip-value]');
    if (t) showTip(t);
    else hideTip();
  });
  document.addEventListener('scroll', hideTip, { passive: true, capture: true });
}
