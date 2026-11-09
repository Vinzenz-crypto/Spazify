import { raw } from './html.js';
import { ICON_PATHS } from './icon-paths.js';

// <svg> for a Lucide icon. Decorative by default (aria-hidden).
export function icon(name, { size = 20, cls = '', label = '', stroke = 2 } = {}) {
  const inner = ICON_PATHS[name] || ICON_PATHS.music;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return raw(
    `<svg class="icon ${cls}" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" focusable="false">${inner}</svg>`,
  );
}

// Brand marks. Spotify + Apple Music paths from Simple Icons (CC0).
const BRAND_PATHS = {
  spotify:
    'M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z',
  apple:
    'M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z',
};

// Simple, original mark for Amazon Music (a note above a smile-shaped arc).
const AMAZON_SVG =
  '<circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M14.6 5.5v6.6a2.1 2.1 0 1 1-1.4-2V7.3l-3.4.9v5.3a2.1 2.1 0 1 1-1.4-2V7.2z" fill="#0b1c2c"/><path d="M5.6 16.6c3.9 2.3 8.9 2.3 12.8 0" stroke="#0b1c2c" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M16.6 15.6l2 .9-.9 2" stroke="#0b1c2c" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

const PRIVATE_SVG =
  '<circle cx="12" cy="12" r="12" fill="currentColor"/><path d="M8.5 11V9.5a3.5 3.5 0 0 1 7 0V11" stroke="#1b1033" stroke-width="1.7" fill="none" stroke-linecap="round"/><rect x="7" y="11" width="10" height="7.5" rx="2" fill="#1b1033"/>';

export const PROVIDERS = {
  spotify: { id: 'spotify', name: 'Spotify', short: 'Spotify', color: '#1ed760', chart: '#17a34a' },
  apple: { id: 'apple', name: 'Apple Music', short: 'Apple', color: '#fa2d48', chart: '#ef3b52' },
  amazon: { id: 'amazon', name: 'Amazon Music', short: 'Amazon', color: '#25d1da', chart: '#1b9fae' },
  private: { id: 'private', name: 'Private', short: 'Private', color: '#a78bfa', chart: '#8b6cf0' },
};

// Order used for the "how did your class join" bar (validated for colour-blind safety).
export const PROVIDER_CHART_ORDER = ['spotify', 'private', 'apple', 'amazon'];

export function brandIcon(provider, { size = 20, cls = '' } = {}) {
  const p = PROVIDERS[provider] ? provider : 'private';
  const label = PROVIDERS[p].name;
  if (p === 'amazon' || p === 'private') {
    return raw(
      `<svg class="brand ${cls}" role="img" aria-label="${label}" width="${size}" height="${size}" viewBox="0 0 24 24" style="color:${PROVIDERS[p].color}" fill="none">${p === 'amazon' ? AMAZON_SVG : PRIVATE_SVG}</svg>`,
    );
  }
  return raw(
    `<svg class="brand ${cls}" role="img" aria-label="${label}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" style="color:${PROVIDERS[p].color}"><path d="${BRAND_PATHS[p]}"/></svg>`,
  );
}

let logoCount = 0;
export function logoMark(size = 32) {
  // Unique gradient id per logo: a gradient inside a hidden SVG would break the others.
  const id = `lg-logo-${++logoCount}`;
  return raw(`<svg class="logo-mark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#ec4899"/><stop offset="1" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" fill="url(#${id})"/>
    <g fill="#fff">
      <rect x="10" y="20" width="5" height="12" rx="2.5" opacity=".9"/>
      <rect x="18" y="12" width="5" height="24" rx="2.5"/>
      <rect x="26" y="16" width="5" height="18" rx="2.5" opacity=".95"/>
      <rect x="34" y="22" width="5" height="8" rx="2.5" opacity=".85"/>
    </g>
  </svg>`);
}
