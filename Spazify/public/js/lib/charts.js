// Small chart builders (HTML + SVG). Values always appear in a tooltip on
// hover/focus and in a table view, so nothing depends on colour alone.
import { html, raw } from './html.js';
import { dateFromKey, formatMinutes, formatNumber } from './util.js';

function niceMax(value) {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (const s of steps) if (s * pow >= value) return s * pow;
  return 10 * pow;
}

// Daily listening time as columns (one series -> no legend; the title names it).
export function listeningColumns(days, { label = 'Listening time per day' } = {}) {
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 0);
  // Small values get a minute scale (0 / 30 / 60 min), bigger ones an hour scale.
  const top = maxMinutes <= 60 ? 60 : maxMinutes <= 120 ? 120 : niceMax(maxMinutes / 60) * 60;
  const ticks = [0, top / 2, top];
  const todayIndex = days.length - 1;
  const weekday = (key) => dateFromKey(key).toLocaleDateString('en-GB', { weekday: 'narrow' });
  const longDate = (key) => dateFromKey(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const tickLabel = (m) => (top <= 120 ? `${Math.round(m)} min` : `${formatNumber(Math.round((m / 60) * 10) / 10)} h`);
  const compact = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10} h` : `${m} min`);
  return html`
    <figure class="colchart" aria-label="${label}">
      <div class="colchart-plot">
        <div class="colchart-grid" aria-hidden="true">
          ${ticks.map((t) => html`<div class="gridline" style="bottom:${(t / top) * 100}%"><span>${tickLabel(t)}</span></div>`)}
        </div>
        <div class="colchart-cols">
          ${days.map((d, i) => {
            const pct = top ? (d.minutes / top) * 100 : 0;
            return html`<button type="button" class="col ${i === todayIndex ? 'is-today' : ''}" data-tip-value="${formatMinutes(d.minutes)}" data-tip-label="${i === todayIndex ? 'Today' : longDate(d.key)}" aria-label="${longDate(d.key)}: ${formatMinutes(d.minutes)}">
              ${i === todayIndex && d.minutes ? html`<span class="col-label" style="bottom:calc(${pct}% + 6px)">${compact(d.minutes)}</span>` : ''}
              <span class="col-bar" style="height:${pct}%"></span>
            </button>`;
          })}
        </div>
      </div>
      <div class="colchart-x" aria-hidden="true">
        ${days.map((d, i) => html`<span class="${i === todayIndex ? 'is-today' : ''}">${i === todayIndex ? 'Today' : weekday(d.key)}</span>`)}
      </div>
      <details class="chart-table">
        <summary>Show as table</summary>
        <table>
          <thead><tr><th scope="col">Day</th><th scope="col">Listening time</th></tr></thead>
          <tbody>${days.map((d) => html`<tr><td>${longDate(d.key)}</td><td>${formatMinutes(d.minutes)}</td></tr>`)}</tbody>
        </table>
      </details>
    </figure>
  `;
}

// Ranked horizontal bars, one hue, largest first (for genres, contributors...).
export function rankedBars(items, { valueLabel = (v) => formatNumber(v), max = null, caption = '' } = {}) {
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return html`
    <div class="ranked" role="list" aria-label="${caption}">
      ${items.map(
        (item) => html`<div class="ranked-row" role="listitem" tabindex="0" data-tip-value="${valueLabel(item.value)}" data-tip-label="${item.label}">
          <div class="ranked-label">${item.prefix || ''}<span>${item.label}</span></div>
          <div class="ranked-track"><span class="ranked-bar" style="width:${Math.max(2, (item.value / top) * 100)}%"></span></div>
          <div class="ranked-value">${valueLabel(item.value)}</div>
        </div>`,
      )}
    </div>
  `;
}

// One whole split into a few parts (tall segmented bar + legend of names).
export function segmentedBar(parts, { label = '' } = {}) {
  const visible = parts.filter((p) => p.value > 0);
  const total = visible.reduce((s, p) => s + p.value, 0) || 1;
  return html`
    <div class="segbar-wrap">
      <div class="segbar" role="img" aria-label="${label}: ${visible.map((p) => `${p.label} ${p.value}`).join(', ')}">
        ${visible.map((p) => {
          const share = Math.round((p.value / total) * 100);
          return html`<div class="segbar-part" tabindex="0" style="flex:${p.value};background:${p.color};color:${p.ink || '#fff'}" data-tip-value="${p.value} (${share}%)" data-tip-label="${p.label}">
            <span class="segbar-text">${share >= 12 ? `${share}%` : ''}</span>
          </div>`;
        })}
      </div>
      <ul class="legend">
        ${visible.map((p) => html`<li><span class="swatch" style="background:${p.color}"></span>${p.label}</li>`)}
      </ul>
    </div>
  `;
}

// Circular progress (used on challenge cards). The number in the middle is text.
let ringId = 0;
export function progressRing(pct, { size = 64, stroke = 7, label = '' } = {}) {
  const id = `ring-grad-${++ringId}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return raw(`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label || `${Math.round(p * 100)} percent`}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(139,108,240,.18)" stroke-width="${stroke}"/>
    <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="--ring-c:${c}"/>
  </svg>`);
}

export function meter(pct, { label = '' } = {}) {
  const p = Math.max(0, Math.min(1, pct));
  return html`<div class="meter ${p >= 1 ? 'is-complete' : ''}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}">
    <span class="meter-fill" style="width:${p * 100}%"></span>
  </div>`;
}

// 14-point sparkline: earlier days muted, the current week in the accent colour.
export function sparkline(values, { width = 120, height = 34 } = {}) {
  if (!values.length) return '';
  const max = Math.max(...values, 1);
  const pad = 5;
  const step = (width - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, height - pad - (v / max) * (height - pad * 2)]);
  const half = Math.floor(values.length / 2);
  const path = (list) => list.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const last = pts[pts.length - 1];
  return raw(`<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <path d="${path(pts.slice(0, half + 1))}" fill="none" stroke="rgba(185,184,211,.45)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path(pts.slice(half))}" fill="none" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="#a78bfa" stroke="#13131d" stroke-width="2"/>
  </svg>`);
}
