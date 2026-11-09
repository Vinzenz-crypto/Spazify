// Reusable pieces of UI (all return safe HTML).
import { html, safeUrl } from '../lib/html.js';
import { icon, brandIcon, PROVIDERS } from '../lib/icons.js';
import { coverUrl, requestArt } from '../lib/music.js';
import { hashString, formatNumber } from '../lib/util.js';
import { getPlayerState } from '../lib/player.js';

// Remember every song we render, so buttons can refer to it by key.
const trackRegistry = new Map();
export function rememberTrack(track) {
  if (track?.key) trackRegistry.set(track.key, track);
  return track?.key;
}
export function getTrack(key) {
  return trackRegistry.get(key) || null;
}

function initials(title) {
  const words = String(title || '♪')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '♪';
  if (words.length === 1) return Array.from(words[0]).slice(0, 2).join('').toUpperCase();
  return (Array.from(words[0])[0] + Array.from(words[1])[0]).toUpperCase();
}

export function coverStyle(key) {
  const h = hashString(key || '');
  const h1 = h % 360;
  const h2 = (h1 + 35 + ((h >>> 9) % 90)) % 360;
  return { h1, h2, pattern: (h >>> 17) % 4 };
}

export function cover(track, { size = 48, cls = '', lazy = true } = {}) {
  const key = track?.key || track?.title || '';
  const url = coverUrl(track);
  if (!url && track?.key) requestArt(track);
  const { h1, h2, pattern } = coverStyle(key);
  const sizeCss = typeof size === 'number' ? `${size}px` : size;
  return html`<div class="cover ${url ? 'has-img' : ''} ${cls}" style="--size:${sizeCss}" data-art-key="${key}">
    <div class="cover-gen" data-pattern="${pattern}" style="--h1:${h1};--h2:${h2}" aria-hidden="true"><span>${initials(track?.title)}</span></div>
    ${url ? html`<img src="${safeUrl(url)}" alt="" ${lazy ? 'loading="lazy"' : ''} decoding="async" referrerpolicy="no-referrer">` : ''}
  </div>`;
}

export function avatar(member, { size = 40, badge = false } = {}) {
  const a = member?.avatar || { emoji: '🎧', color: 265 };
  const showBadge = badge && member?.provider && member.provider !== 'private';
  return html`<span class="avatar" style="--size:${size}px;--h:${Number(a.color) || 0}" aria-hidden="true">${a.emoji}${showBadge ? html`<span class="avatar-badge">${brandIcon(member.provider, { size: 14 })}</span>` : ''}</span>`;
}

export function avatarStack(members, { max = 5, size = 30 } = {}) {
  const list = members.filter(Boolean);
  const shown = list.slice(0, max);
  const more = list.length - shown.length;
  return html`<span class="avatar-stack" style="--size:${size}px">
    ${shown.map((m) => avatar(m, { size }))}${more > 0 ? html`<span class="avatar-more">+${more}</span>` : ''}
  </span>`;
}

export function providerChip(provider) {
  const p = PROVIDERS[provider] || PROVIDERS.private;
  return html`<span class="chip">${brandIcon(p.id, { size: 14 })}${p.name}</span>`;
}

export function eq(paused = false) {
  return html`<span class="eq ${paused ? 'is-paused' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

export function moveBadge(move) {
  if (!move) return '';
  if (move.type === 'new') return html`<span class="move new" title="New in the charts">NEW</span>`;
  if (move.type === 'up') return html`<span class="move up" title="Up ${move.by}">▲${move.by}</span>`;
  if (move.type === 'down') return html`<span class="move down" title="Down ${move.by}">▼${move.by}</span>`;
  return html`<span class="move same" title="Same position">–</span>`;
}

export function playOverlay(key) {
  const { current, playing } = getPlayerState();
  const active = current?.key === key;
  if (active && current.loading) return html`<span class="play-overlay"><span class="spinner" style="width:18px;height:18px"></span></span>`;
  if (active && playing) return html`<span class="play-overlay">${eq()}</span>`;
  return html`<span class="play-overlay">${icon('play', { size: 20 })}</span>`;
}

export function trackRow(track, { rank = null, move = null, sub = null, right = '', note = '', size = 48, coverAction = 'play' } = {}) {
  rememberTrack(track);
  const { current } = getPlayerState();
  const active = current?.key === track.key;
  return html`<div class="track ${rank === null ? 'no-rank' : ''} ${active ? 'is-playing' : ''}" data-track-row="${track.key}">
    ${rank !== null ? html`<div class="track-rank"><span class="num ${rank <= 3 ? 'top' : ''}">${rank}</span>${moveBadge(move)}</div>` : ''}
    <button type="button" class="track-cover-btn" data-action="${coverAction}" data-key="${track.key}" aria-label="Play a preview of ${track.title}">
      ${cover(track, { size })}${playOverlay(track.key)}
    </button>
    <div class="track-main">
      <div class="track-title">${track.title}${track.explicit ? html` <span class="badge" title="Explicit">E</span>` : ''}</div>
      <div class="track-sub">${sub ?? track.artist}</div>
    </div>
    <div class="track-meta">${right}</div>
    ${note ? html`<div class="track-note">“${note}”</div>` : ''}
  </div>`;
}

export function likeButton(entry, liked) {
  const count = entry?.likedBy?.size || 0;
  return html`<button type="button" class="like-btn ${liked ? 'is-liked' : ''}" data-action="like" data-key="${entry.key}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? 'Remove heart from' : 'Give a heart to'} ${entry.track.title}">
    ${icon('heart', { size: 17 })}<span>${count || ''}</span>
  </button>`;
}

export function moreButton(key, label = 'More options') {
  return html`<button type="button" class="btn btn-ghost btn-icon btn-xs" data-action="song-menu" data-key="${key}" aria-label="${label}">${icon('external-link', { size: 16 })}</button>`;
}

export function empty({ emoji = '🎵', title, text = '', action = '' }) {
  return html`<div class="empty">
    <div class="empty-icon" aria-hidden="true">${emoji}</div>
    <h3>${title}</h3>
    ${text ? html`<p>${text}</p>` : ''}
    ${action}
  </div>`;
}

export function statTile({ iconName, label, value, unit = '', foot = '', extra = '' }) {
  return html`<div class="card stat">
    <div class="stat-top"><span class="icon-bubble" style="width:32px;height:32px;border-radius:10px">${icon(iconName, { size: 16 })}</span>${label}</div>
    <div class="stat-value">${value}${unit ? html`<small>${unit}</small>` : ''}</div>
    <div class="stat-foot"><span>${foot}</span>${extra}</div>
  </div>`;
}

export function delta(current, previous, { suffix = 'vs last week' } = {}) {
  if (!previous) return '';
  const change = Math.round(((current - previous) / previous) * 100);
  if (!Number.isFinite(change) || change === 0) return html`<span class="faint">same as last week</span>`;
  return html`<span><span class="delta ${change > 0 ? 'up' : 'down'}">${change > 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> <span class="faint">${suffix}</span></span>`;
}

export function playlistArt(playlist, { size = '100%' } = {}) {
  const covers = playlist.covers?.length ? playlist.covers : (playlist.tracks || []).map((t) => coverUrl(t)).filter(Boolean).slice(0, 4);
  const sample = playlist.sample || playlist.tracks || [];
  if (playlist.cover) {
    return html`<div class="playlist-art" style="--h:${playlist.color ?? hashString(playlist.id) % 360};width:${size}"><img src="${safeUrl(playlist.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }
  if (playlist.source === 'spazify' || sample.length < 4) {
    return html`<div class="playlist-art" style="--h:${playlist.color ?? hashString(playlist.id) % 360};width:${size}"><span aria-hidden="true">${playlist.emoji || '🎶'}</span></div>`;
  }
  const items = sample.slice(0, 4).map((t, i) => ({ ...t, cover: t.cover || covers[i] }));
  return html`<div class="mosaic" style="width:${size}">${items.map((t) => cover(t, { size: '100%' }))}</div>`;
}

export function playlistCard({ playlist, owner, href }) {
  return html`<a class="playlist-card" href="${href}">
    <div style="position:relative">
      ${playlistArt(playlist)}
      ${playlist.source !== 'spazify' ? html`<span class="pl-source">${brandIcon(playlist.source, { size: 18 })}</span>` : ''}
    </div>
    <div>
      <div class="pl-name truncate">${playlist.emoji && playlist.source !== 'spazify' ? `${playlist.emoji} ` : ''}${playlist.name}</div>
      <div class="pl-meta mt-1">${owner ? avatar(owner, { size: 22 }) : ''}<span class="truncate">${owner ? owner.name : ''} · ${formatNumber(playlist.trackCount || 0)} songs</span></div>
    </div>
  </a>`;
}

export function sectionHeader(title, { link = null, linkLabel = 'See all', subtitle = '' } = {}) {
  return html`<div class="card-header">
    <div><h2 class="card-title">${title}</h2>${subtitle ? html`<div class="card-subtitle">${subtitle}</div>` : ''}</div>
    ${link ? html`<a class="card-link" href="${link}">${linkLabel}${icon('chevron-right', { size: 16 })}</a>` : ''}
  </div>`;
}
