// Small helpers used all over the app.

export const DAY = 86400000;

export function uid(prefix = '', length = 10) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return prefix + out;
}

export function hashString(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hueFor(str) {
  return hashString(str) % 360;
}

// Deterministic random numbers (used for the demo class).
export function seededRandom(seed) {
  let a = typeof seed === 'number' ? seed : hashString(seed);
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function plural(n, word, pluralWord = `${word}s`) {
  return `${formatNumber(n)} ${n === 1 ? word : pluralWord}`;
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-GB').format(Math.round(n || 0));
}

export function formatCompact(n) {
  return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}

export function formatDuration(ms) {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// 75 -> "1 h 15 min", 45 -> "45 min"
export function formatMinutes(minutes) {
  const m = Math.round(minutes || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

export function formatHours(minutes, digits = 1) {
  const h = (minutes || 0) / 60;
  if (h >= 100) return formatNumber(h);
  return h.toFixed(h >= 10 || h === 0 ? 0 : digits).replace(/\.0$/, '');
}

export function dateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function lastDays(n, now = Date.now()) {
  const out = [];
  const base = new Date(now);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
    out.push(dateKey(d));
  }
  return out;
}

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function timeAgo(ts, now = Date.now()) {
  if (!ts) return 'never';
  const diff = Math.max(0, now - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  const w = Math.round(d / 7);
  if (w < 5) return w === 1 ? 'last week' : `${w} weeks ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function daysLeft(endAt, now = Date.now()) {
  return Math.ceil((endAt - now) / DAY);
}

export function formatDate(ts, opts = { day: 'numeric', month: 'short' }) {
  return new Date(ts).toLocaleDateString('en-GB', opts);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// localStorage that never throws (private windows, blocked storage, ...).
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const session = {
  get(key, fallback = null) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function countryCode() {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en-US'];
  for (const l of langs) {
    const m = String(l).match(/-([A-Za-z]{2})$/);
    if (m) return m[1].toUpperCase();
  }
  return 'DE';
}

export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
