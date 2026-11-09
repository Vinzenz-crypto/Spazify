// Spazify - app start, router, layout and global buttons.
import { CONFIG } from './config.js';
import { html, setHTML, safeUrl } from './lib/html.js';
import { icon, logoMark } from './lib/icons.js';
import { copyText, timeAgo } from './lib/util.js';
import { onArtResolved } from './lib/music.js';
import { onPlayerChange, getPlayerState, togglePreview, stopPreview, seekPreview } from './lib/player.js';
import * as spotify from './lib/spotify.js';
import { canAutoSync, resync } from './lib/sync.js';
import { state, subscribe, boot, loadClass, toggleLike, signOut, isDemo, enterDemo, signInWithKey } from './store.js';
import { installTooltips, toast, closeAllModals } from './ui/overlays.js';
import { avatar, cover, getTrack, playOverlay, eq } from './ui/components.js';
import { openAddSongs, openLogTime, openSongMenu, openShareClass } from './ui/modals.js';
import { landingView } from './views/landing.js';
import { joinView, resumeAfterSpotify } from './views/join.js';
import { createView } from './views/create.js';
import { homeView } from './views/home.js';
import { chartsView } from './views/charts.js';
import { playlistsView } from './views/playlists.js';
import { challengesView, celebrate } from './views/challenges.js';
import { membersView } from './views/members.js';
import { meView, openConnectReview } from './views/me.js';
import { recapView } from './views/recap.js';
import { aboutView, setupView } from './views/about.js';

const PUBLIC = { '': landingView, join: joinView, create: createView, about: aboutView, setup: setupView };
const PRIVATE = { home: homeView, charts: chartsView, playlists: playlistsView, challenges: challengesView, class: membersView, me: meView, recap: recapView };
const NAV = [
  ['home', 'Home', 'house'],
  ['charts', 'Charts', 'chart-column'],
  ['playlists', 'Playlists', 'list-music'],
  ['challenges', 'Challenges', 'trophy'],
  ['class', 'Class', 'users'],
];

function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return { name: parts[0] || '', parts, query: new URLSearchParams(query || ''), key: raw };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function publicHeader() {
  const signedIn = Boolean(state.session);
  return html`<header class="public-header">
    <a class="brand-link" href="#/">${logoMark(34)}<span>${CONFIG.appName}</span></a>
    <nav aria-label="Main">
      <a class="btn btn-ghost btn-sm hide-sm" href="#/about">About</a>
      ${signedIn
        ? html`<a class="btn btn-sm btn-white" href="#/home">Open my class ${icon('arrow-right', { size: 16 })}</a>`
        : html`<a class="btn btn-ghost btn-sm hide-sm" href="#/demo">Demo</a><a class="btn btn-sm btn-white" href="#/join">Join a class</a>`}
    </nav>
  </header>`;
}

function footer() {
  return html`<footer class="footer">
    <div class="row" style="--gap:10px">${logoMark(22)}<span><strong style="color:var(--text)">${CONFIG.appName}</strong> · ${CONFIG.projectNote} · ${new Date().getFullYear()}</span></div>
    <nav aria-label="Footer"><a href="#/about">About & privacy</a><a href="#/setup">Site setup</a>${state.session ? '' : html`<a href="#/demo">Demo</a>`}</nav>
  </footer>`;
}

function shell(route) {
  const me = state.me;
  const cls = state.data?.class;
  const active = route.name;
  return html`<div class="shell">
    <aside class="sidebar" aria-label="Sidebar">
      <a class="brand-link" href="#/home">${logoMark(36)}<span>${CONFIG.appName}</span></a>
      <nav class="nav" aria-label="Main">
        ${NAV.map(([id, label, ic]) => html`<a href="#/${id}" class="${active === id ? 'is-active' : ''}" aria-current="${active === id ? 'page' : 'false'}" title="${label}">${icon(ic, { size: 21 })}<span>${label}</span></a>`)}
        <a href="#/me" class="${active === 'me' ? 'is-active' : ''}" aria-current="${active === 'me' ? 'page' : 'false'}" title="Me">${icon('user', { size: 21 })}<span>Me</span></a>
      </nav>
      ${cls
        ? html`<div class="sidebar-class">
            <div class="row" style="--gap:10px"><span style="font-size:24px">${cls.emoji}</span><div style="min-width:0"><div class="class-name truncate">${cls.name}</div><div class="small faint">${state.stats?.totals.members || 0} classmates</div></div></div>
            <button type="button" class="btn btn-sm btn-block mt-2" data-action="share-class">${icon('qr-code', { size: 16 })}<span class="code-pill" style="background:none;border:0;padding:0">${cls.code}</span></button>
          </div>`
        : ''}
      <div class="sidebar-bottom">
        <button type="button" class="btn btn-primary btn-block" data-action="add-songs">${icon('plus', { size: 18 })}<span>Add songs</span></button>
        ${me
          ? html`<a class="me-chip" href="#/me">${avatar(me, { size: 38, badge: true })}<span class="me-text" style="min-width:0"><span class="me-name truncate" style="display:block">${me.name}</span><span class="small faint">${isDemo() ? 'Demo mode' : me.lastSyncAt ? `Synced ${timeAgo(me.lastSyncAt)}` : 'View profile'}</span></span></a>`
          : ''}
      </div>
    </aside>
    <header class="topbar">
      <a class="brand-link" href="#/home">${logoMark(30)}<span>${CONFIG.appName}</span></a>
      <div class="topbar-right">
        ${cls ? html`<button type="button" class="btn btn-sm btn-ghost" data-action="share-class" aria-label="Invite classmates">${icon('qr-code', { size: 18 })}</button>` : ''}
        ${me ? html`<a href="#/me" aria-label="My profile">${avatar(me, { size: 34 })}</a>` : ''}
      </div>
    </header>
    <main class="main" id="main" tabindex="-1"><div id="view"></div></main>
    <nav class="tabbar" aria-label="Main">
      ${[...NAV.slice(0, 4), ['me', 'Me', 'user']].map(([id, label, ic]) => html`<a href="#/${id}" class="${active === id ? 'is-active' : ''}" aria-current="${active === id ? 'page' : 'false'}">${icon(ic, { size: 22 })}${label}</a>`)}
    </nav>
    <button type="button" class="fab" data-action="add-songs" aria-label="Add songs">${icon('plus', { size: 26 })}</button>
  </div>`;
}

function loadingView() {
  return html`<div class="page">
    <div class="skeleton" style="height:44px;width:260px;margin-bottom:24px"></div>
    <div class="grid grid-4">${[1, 2, 3, 4].map(() => html`<div class="skeleton" style="height:120px;border-radius:20px"></div>`)}</div>
    <div class="skeleton mt-3" style="height:220px;border-radius:28px"></div>
  </div>`;
}

function errorView() {
  return html`<div class="page"><div class="card" style="max-width:560px;margin:40px auto">
    <div class="empty"><div class="empty-icon">📡</div><h3>Can’t load your class</h3><p>${state.loadError || 'Something went wrong.'}</p>
      <div class="row wrap" style="--gap:8px;justify-content:center"><button type="button" class="btn btn-primary" data-action="retry">${icon('refresh-cw', { size: 18 })}Try again</button><button type="button" class="btn btn-ghost" data-action="sign-out">Sign out</button></div>
    </div></div></div>`;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
let lastRouteKey = null;
let lastRenderKey = null;
let cleanup = null;
let lastVersion = -1;
let busyRoute = null;

function focusSignature() {
  const a = document.activeElement;
  if (!a || a === document.body) return null;
  if (a.dataset?.action) return `[data-action="${a.dataset.action}"]${a.dataset.key ? `[data-key="${CSS.escape(a.dataset.key)}"]` : ''}`;
  if (a.id) return `#${CSS.escape(a.id)}`;
  if (a.name && a.closest('#view')) return `#view [name="${CSS.escape(a.name)}"]`;
  return null;
}

// Keep what somebody typed when the page is drawn again.
function captureForm() {
  const values = new Map();
  document.querySelectorAll('#view input, #view textarea, #view select').forEach((el) => {
    const id = el.name || el.dataset.input || el.id;
    if (!id) return;
    values.set(`${el.tagName}|${id}|${el.type}|${el.type === 'radio' ? el.value : ''}`, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
  });
  const a = document.activeElement;
  const selection = a && 'selectionStart' in a ? [a.selectionStart, a.selectionEnd] : null;
  return { values, selection };
}

function restoreForm(root, { values, selection }) {
  if (!values.size) return;
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    const id = el.name || el.dataset.input || el.id;
    const key = `${el.tagName}|${id}|${el.type}|${el.type === 'radio' ? el.value : ''}`;
    if (!id || !values.has(key)) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = values.get(key);
    else if (el.type !== 'file' && el.value !== values.get(key)) el.value = values.get(key);
  });
  const a = document.activeElement;
  if (selection && a && 'setSelectionRange' in a) {
    try {
      a.setSelectionRange(selection[0], selection[1]);
    } catch {
      /* not a text field */
    }
  }
}

// Everything the visible page depends on. If it didn't change, nothing is redrawn.
function renderKey(route) {
  return JSON.stringify([
    route.key,
    state.booted,
    oauthPending,
    state.session?.code,
    state.session?.memberId,
    state.apiAvailable,
    state.config.spotifyClientId,
    state.config.apple,
    state.dataVersion,
    Boolean(state.data),
    state.loadError,
  ]);
}

function render({ force = false } = {}) {
  const route = parseRoute();
  const key = renderKey(route);
  if (!force && key === lastRenderKey) return;
  lastRenderKey = key;

  const focusSel = focusSignature();
  const form = route.key === lastRouteKey ? captureForm() : null;
  const app = document.getElementById('app');
  if (!state.booted || oauthPending) {
    setHTML(app, html`<div class="splash"><div class="stack" style="align-items:center;--gap:18px">${logoMark(64)}${oauthPending ? html`<p class="muted">Connecting to Spotify…</p>` : ''}</div></div>`);
    return;
  }

  // Routes that do something and then go elsewhere.
  if (route.name === 'demo' || (route.name === 'key' && route.parts[1])) {
    if (busyRoute === route.key) return;
    busyRoute = route.key;
    setHTML(app, html`<div class="splash">${logoMark(64)}</div>`);
    const done = () => {
      busyRoute = null;
    };
    if (route.name === 'demo') {
      enterDemo().then(
        () => {
          done();
          location.replace('#/home');
          toast('Welcome to the demo class! 👋', { type: 'success' });
          setTimeout(celebrate, 1200);
        },
        (err) => {
          done();
          location.replace('#/');
          toast(err.message, { type: 'error' });
        },
      );
    } else {
      signInWithKey(route.parts[1]).then(
        (m) => {
          done();
          location.replace('#/home');
          toast(`Welcome back, ${m.name}!`, { type: 'success' });
        },
        (err) => {
          done();
          location.replace('#/join');
          toast(err.message, { type: 'error' });
        },
      );
    }
    return;
  }
  if (route.name === '' && state.session) {
    location.replace('#/home');
    return;
  }

  const isPrivate = Boolean(PRIVATE[route.name]);
  if (isPrivate && !state.session) {
    location.replace('#/');
    return;
  }
  const view = PRIVATE[route.name] || PUBLIC[route.name] || null;
  const routeChanged = route.key !== lastRouteKey;
  const useShell = Boolean(state.session) && (isPrivate || route.name === 'about' || route.name === 'setup') && view?.shell !== false;

  // Build the layout around the view.
  if (useShell) {
    setHTML(app, shell(route));
    document.body.classList.remove('no-shell');
  } else {
    const bare = view?.shell === false;
    setHTML(app, bare ? html`<div id="view"></div>` : html`${publicHeader()}<main id="main" tabindex="-1"><div id="view"></div></main>${footer()}`);
    document.body.classList.add('no-shell');
  }

  const container = document.getElementById('view');
  cleanup?.();
  cleanup = null;
  const viewEl = document.createElement('div');
  container.replaceChildren(viewEl);

  const ctx = { route, rerender: () => render({ force: true }) };
  if (!view) {
    setHTML(viewEl, html`<div class="page"><div class="empty"><div class="empty-icon">🧭</div><h3>Page not found</h3><a class="btn" href="#/">Go to the start page</a></div></div>`);
  } else if (isPrivate && !state.data) {
    setHTML(viewEl, state.loadError ? errorView() : loadingView());
  } else {
    setHTML(viewEl, view.render(ctx));
    cleanup = view.mount?.(viewEl, ctx) || null;
  }
  const title = view?.title?.(ctx);
  document.title = title && route.name ? `${title} · ${CONFIG.appName}` : `${CONFIG.appName} - ${CONFIG.tagline}`;
  if (routeChanged) {
    window.scrollTo({ top: 0 });
    if (lastRouteKey !== null) document.getElementById('main')?.focus({ preventScroll: true });
  } else if (focusSel) {
    try {
      document.querySelector(focusSel)?.focus({ preventScroll: true });
    } catch {
      /* ignore */
    }
  }
  if (form) restoreForm(viewEl, form);
  lastRouteKey = route.key;
  lastVersion = state.dataVersion;
}

// Re-render on data changes - but not in the middle of typing.
let pendingRender = false;
function onState() {
  const active = document.activeElement;
  const typing = active && active.closest('#view') && /^(INPUT|TEXTAREA)$/.test(active.tagName);
  if (typing && state.dataVersion !== lastVersion && PRIVATE[parseRoute().name]) {
    pendingRender = true;
    return;
  }
  render();
}
document.addEventListener('focusout', () => {
  if (!pendingRender) return;
  pendingRender = false;
  // Wait a moment so a click that moved the focus is not lost.
  setTimeout(() => render(), 250);
});

// ---------------------------------------------------------------------------
// Mini player
// ---------------------------------------------------------------------------
function renderPlayer() {
  const root = document.getElementById('player-root');
  const { current, playing, time, duration } = getPlayerState();
  if (!current) {
    root.innerHTML = '';
    document.documentElement.style.setProperty('--player-h', '0px');
    return;
  }
  const t = current.track;
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;
  const existing = root.querySelector('.player');
  if (existing && existing.dataset.key === t.key) {
    existing.querySelector('.player-progress span').style.width = `${progress}%`;
    setHTML(existing.querySelector('[data-toggle-slot]'), playerToggle(current, playing));
    setHTML(existing.querySelector('.player-sub'), playerSub(current, playing));
  } else {
    setHTML(
      root,
      html`<div class="player" data-key="${t.key}" role="region" aria-label="Song preview">
        ${cover(t, { size: 50 })}
        <div style="min-width:0"><div class="player-title truncate">${t.title}</div><div class="player-sub truncate">${playerSub(current, playing)}</div></div>
        <div class="player-actions">
          <span data-toggle-slot>${playerToggle(current, playing)}</span>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="song-menu" data-key="${t.key}" aria-label="Listen to the full song">${icon('external-link', { size: 18 })}</button>
          <button type="button" class="btn btn-ghost btn-icon btn-sm" data-action="close-player" aria-label="Close player">${icon('x', { size: 18 })}</button>
        </div>
        <div class="player-progress" data-seek><span style="width:${progress}%"></span></div>
      </div>`,
    );
  }
  document.documentElement.style.setProperty('--player-h', '76px');
}

function playerSub(current, playing) {
  if (current.error) return html`<span style="color:#fecdd3">${current.error}</span>`;
  if (current.loading) return 'Loading preview…';
  return html`${playing ? html`${eq()} ` : ''}${current.track.artist} · 30-second preview`;
}

function playerToggle(current, playing) {
  if (current.loading) return html`<span class="btn btn-icon btn-sm" aria-hidden="true"><span class="spinner" style="width:18px;height:18px"></span></span>`;
  return html`<button type="button" class="btn btn-white btn-icon btn-sm" data-action="play" data-key="${current.track.key}" aria-label="${playing ? 'Pause' : 'Play'}">${icon(playing ? 'pause' : 'play', { size: 18 })}</button>`;
}

let lastPlayingKey = null;
function updatePlayingRows() {
  const { current, playing } = getPlayerState();
  const key = current?.key || null;
  document.querySelectorAll('[data-track-row]').forEach((row) => {
    const isCurrent = row.dataset.trackRow === key;
    row.classList.toggle('is-playing', isCurrent);
  });
  document.querySelectorAll('.track-cover-btn[data-key]').forEach((btn) => {
    const k = btn.dataset.key;
    if (k !== key && k !== lastPlayingKey) return;
    const overlay = btn.querySelector('.play-overlay');
    if (overlay) overlay.outerHTML = String(playOverlay(k));
  });
  lastPlayingKey = key;
  void playing;
}

// ---------------------------------------------------------------------------
// Global buttons (data-action="...")
// ---------------------------------------------------------------------------
const ACTIONS = {
  play: (el) => {
    const track = getTrack(el.dataset.key);
    if (track) togglePreview(track);
  },
  like: (el) => {
    if (!state.me) return toast('Join a class to give hearts.');
    el.classList.add('pop');
    toggleLike(el.dataset.key).catch((err) => toast(err.message, { type: 'error' }));
  },
  'song-menu': (el) => {
    const track = getTrack(el.dataset.key);
    if (track) openSongMenu(track, state.stats?.chartByKey.get(el.dataset.key) || null);
  },
  'add-songs': () => {
    if (!state.me) {
      location.hash = '#/join';
      return;
    }
    openAddSongs();
  },
  'log-time': () => (state.me ? openLogTime() : (location.hash = '#/join')),
  'share-class': () => openShareClass(),
  copy: async (el) => {
    const ok = await copyText(el.dataset.copy || '');
    toast(ok ? 'Copied!' : 'Could not copy - please copy it by hand.', { type: ok ? 'success' : 'error', iconName: ok ? 'copy' : null });
  },
  'close-player': () => stopPreview(),
  retry: () => loadClass(),
  'sign-out': () => {
    signOut();
    location.hash = '#/';
  },
  'leave-demo': (el, e) => {
    e.preventDefault();
    signOut();
    location.hash = '#/create';
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && ACTIONS[el.dataset.action]) {
    if (el.tagName === 'A' && el.dataset.action !== 'leave-demo') e.preventDefault();
    ACTIONS[el.dataset.action](el, e);
  }
  const seek = e.target.closest('[data-seek]');
  if (seek) {
    const r = seek.getBoundingClientRect();
    seekPreview((e.clientX - r.left) / r.width);
  }
});

// Broken cover images fall back to the generated cover.
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (img?.tagName !== 'IMG') return;
    if (img.closest('.cover')) img.closest('.cover').classList.remove('has-img');
    if (img.closest('.cover, .playlist-art')) img.remove();
    else img.style.visibility = 'hidden';
  },
  true,
);

// When a cover is found later, put it into every matching place on the page.
onArtResolved((key, entry) => {
  if (!entry?.c) return;
  document.querySelectorAll(`[data-art-key="${CSS.escape(key)}"]`).forEach((el) => {
    if (el.querySelector('img')) return;
    const img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = safeUrl(entry.c);
    img.addEventListener('load', () => el.classList.add('has-img'), { once: true });
    el.appendChild(img);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
let oauthPending = false;

async function handleOAuthReturn() {
  const params = new URLSearchParams(location.search);
  if (!params.has('state') || !(params.has('code') || params.has('error'))) return;
  if (!spotify.hasSpotifyCallback()) {
    history.replaceState(null, '', location.pathname + location.hash);
    toast('The Spotify login took too long. Please try again.', { type: 'error' });
    return;
  }
  try {
    const intent = await spotify.finishSpotifyLogin();
    if (intent.action === 'join') {
      resumeAfterSpotify(intent);
      location.hash = '#/join';
    } else if (intent.action === 'connect') {
      location.hash = '#/me';
      const data = await spotify.collectSpotifyData({ playlists: true });
      const { perDay, cursor } = spotify.minutesFromRecent(data.recent, state.me?.syncCursor?.spotify);
      openConnectReview('spotify', { top: data.top, playlists: data.playlists, perDay, cursor });
    }
  } catch (err) {
    toast(err.message, { type: 'error', timeout: 6000 });
    if (err.intent?.action === 'join') {
      resumeAfterSpotify({ ...err.intent });
      // Go back to choosing how to join.
      import('./views/join.js').then(({ flow }) => {
        flow.step = 'method';
        flow.error = err.message;
        location.hash = '#/join';
      });
    }
  }
}

async function start() {
  const query = new URLSearchParams(location.search);
  oauthPending = query.has('state') && (query.has('code') || query.has('error'));
  installTooltips();
  subscribe(onState);
  onPlayerChange(() => {
    renderPlayer();
    updatePlayingRows();
  });
  window.addEventListener('hashchange', () => {
    closeAllModals();
    render({ force: true });
  });
  render();
  await boot();
  render();
  const wasPending = oauthPending;
  await handleOAuthReturn();
  if (wasPending) {
    oauthPending = false;
    render({ force: true });
  }
  if (state.session && canAutoSync()) {
    resync({ playlists: false })
      .then((r) => r.minutes && toast(`Synced with Spotify · +${r.minutes} min`, { type: 'success', iconName: 'refresh-cw' }))
      .catch(() => {});
  }
  setTimeout(celebrateIfHome, 900);
  setInterval(() => {
    if (document.visibilityState === 'visible' && state.session && !state.session.demo) loadClass({ silent: true });
  }, CONFIG.refreshInterval);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.session && !state.session.demo && Date.now() - state.lastLoadedAt > 15000) loadClass({ silent: true });
  });
}

function celebrateIfHome() {
  if (state.session && state.stats && ['home', 'challenges'].includes(parseRoute().name)) celebrate();
}

start();

