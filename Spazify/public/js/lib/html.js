// Safe HTML templates: every value inside html`...` is escaped automatically,
// unless it is itself the result of html`...` (or raw()). This protects the site
// against names or song titles that contain HTML (XSS).

export class SafeHTML {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => ESCAPES[c]);
}

function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += renderValue(values[i]) + strings[i + 1];
  return new SafeHTML(out);
}

export function raw(value) {
  return new SafeHTML(String(value ?? ''));
}

// Only allow http(s) links (and in-app hash links) in href/src attributes.
export function safeUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  if (s.startsWith('#') || s.startsWith('/')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

export function classes(...list) {
  return list.flat().filter(Boolean).join(' ');
}

export function setHTML(el, content) {
  if (el) el.innerHTML = String(content);
}
