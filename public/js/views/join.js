// Joining a class: class code -> how to join (Spotify / Apple Music / Amazon
// Music / private) -> profile + songs, or "what do you want to share" review.
import { CONFIG } from '../config.js';
import { html, setHTML, safeUrl } from '../lib/html.js';
import { icon, brandIcon, PROVIDERS } from '../lib/icons.js';
import { searchSongs, SearchError } from '../lib/music.js';
import { trackKey } from '../lib/normalize.js';
import { debounce, plural } from '../lib/util.js';
import * as spotify from '../lib/spotify.js';
import * as apple from '../lib/apple.js';
import { topForSave, playlistWithTracks } from '../lib/sync.js';
import { state, previewClass, joinClass, cleanTrackForSave, enterDemo, signInWithKey } from '../store.js';
import { cover, avatar, rememberTrack } from '../ui/components.js';
import { avatarPicker, bindAvatarPicker, EMOJIS, HUES, openShareClass, openPersonalKey } from '../ui/modals.js';
import { openModal, toast } from '../ui/overlays.js';
import { celebrate } from './challenges.js';

const MAX_PICKS = 10;

function freshFlow() {
  return {
    step: 'code',
    code: '',
    kind: 'remote',
    cls: null,
    memberCount: 0,
    isNewClass: false,
    provider: null,
    name: '',
    avatar: { emoji: EMOJIS[Math.floor(Math.random() * 12)], color: HUES[Math.floor(Math.random() * HUES.length)] },
    picks: [],
    connected: null,
    shareTop: true,
    shareListening: true,
    selected: new Set(),
    busy: false,
    error: '',
    searchTerm: '',
    results: [],
    searching: false,
    searchError: '',
  };
}

export const flow = freshFlow();
let root = null;

export function resetFlow() {
  Object.assign(flow, freshFlow());
}

// Used by "create class" to jump right into joining the new class.
export function startJoinForNewClass(cls, kind) {
  resetFlow();
  Object.assign(flow, { code: cls.code, cls, kind, memberCount: 0, isNewClass: true, step: 'method' });
}

// Used after the Spotify login redirect.
export function resumeAfterSpotify(intent) {
  resetFlow();
  Object.assign(flow, { code: intent.code, kind: intent.kind, cls: intent.cls, memberCount: intent.memberCount || 0, isNewClass: Boolean(intent.isNewClass), provider: 'spotify', step: 'connecting' });
  loadConnected('spotify');
}

function go(step) {
  flow.step = step;
  flow.error = '';
  draw();
  root?.querySelector('h1')?.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const STEP_ORDER = { code: 1, method: 2, profile: 3, songs: 4, apple: 3, connecting: 3, review: 4 };

function stepsBar() {
  const n = STEP_ORDER[flow.step] || 1;
  return html`<div class="join-steps" aria-hidden="true">${[1, 2, 3, 4].map((i) => html`<span class="${i <= n ? 'is-done' : ''}"></span>`)}</div>`;
}

function classPreview() {
  if (!flow.cls) return '';
  return html`<div class="class-preview">
    <span class="class-emoji">${flow.cls.emoji || '🎧'}</span>
    <div style="min-width:0">
      <div style="font-weight:700;font-size:17px" class="truncate">${flow.cls.name}</div>
      <div class="small faint">Code <span class="code-pill" style="font-size:11px;padding:2px 8px">${flow.cls.code}</span> · ${plural(flow.memberCount, 'classmate')}</div>
    </div>
  </div>`;
}

function switchWarning() {
  const s = state.session;
  if (!s || s.demo || s.code === flow.code) return '';
  return html`<div class="banner" style="margin-bottom:16px">${icon('info', { size: 18 })}<span>You are already in <strong>${state.data?.class?.name || s.code}</strong> on this device. Joining another class switches this device to the new class - copy your personal key first if you want to come back.</span><button type="button" class="btn btn-sm" data-join="personal-key">${icon('key-round', { size: 16 })}My key</button></div>`;
}

function errorBox() {
  return flow.error ? html`<div class="banner" role="alert">${icon('triangle-alert', { size: 18 })}<span>${flow.error}</span></div>` : '';
}

// ---------------- step views ----------------
function viewCode() {
  return html`
    <h1 tabindex="-1">Join your class</h1>
    <p class="muted mt-1">Enter the code your teacher or a classmate shared with you.</p>
    <form class="stack mt-3" style="--gap:14px" data-form="code">
      ${errorBox()}
      <input class="input input-code" name="code" value="${flow.code}" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC123" aria-label="Class code" required>
      <button class="btn btn-primary btn-lg btn-block ${flow.busy ? 'is-loading' : ''}" type="submit">Continue ${icon('arrow-right', { size: 18 })}</button>
    </form>
    <div class="divider mt-3">or</div>
    <div class="stack mt-3" style="--gap:10px">
      <a class="btn btn-block" href="#/create">${icon('plus', { size: 18 })}Create a new class</a>
      <button type="button" class="btn btn-block" data-join="demo">${icon('play', { size: 18 })}Explore the demo class</button>
      <button type="button" class="btn btn-ghost btn-block btn-sm" data-join="key">${icon('key-round', { size: 16 })}I already joined - use my personal key</button>
    </div>`;
}

function providerButton(id, title, desc, tag = '') {
  return html`<button type="button" class="provider-btn ${id}" data-provider="${id}">
    ${brandIcon(id, { size: 30 })}
    <span class="p-text"><span class="p-name">${title}</span><span class="p-desc">${desc}</span></span>
    ${tag ? html`<span class="p-tag">${tag}</span>` : icon('chevron-right', { size: 18 })}
  </button>`;
}

function viewMethod() {
  const spotifyReady = Boolean(state.config.spotifyClientId);
  const appleReady = Boolean(state.config.apple);
  return html`
    ${flow.isNewClass
      ? html`<div class="banner is-info" style="margin-bottom:18px">${icon('party-popper', { size: 18 })}<span>Your class is ready! Now join it yourself - you will be the class owner.</span></div>`
      : ''}
    ${switchWarning()}
    <h1 tabindex="-1">How do you want to join?</h1>
    <div class="mt-2">${classPreview()}</div>
    ${errorBox()}
    <div class="provider-list mt-3">
      ${providerButton('spotify', 'Continue with Spotify', 'Share your top songs and playlists automatically', spotifyReady ? '' : 'Not set up')}
      ${providerButton('apple', 'Continue with Apple Music', appleReady ? 'Share your recently played songs and playlists' : 'Pick your favourite songs in one minute')}
      ${providerButton('amazon', 'Continue with Amazon Music', 'Pick your favourite songs in one minute')}
      ${providerButton('private', 'Join privately', 'No music account - you only share what you add')}
    </div>
    <p class="small faint mt-3 row" style="--gap:8px;align-items:flex-start">${icon('shield-check', { size: 16 })}<span>We never see your password or email. You can change what you share - or delete everything - at any time.</span></p>
    <button type="button" class="btn btn-ghost btn-sm mt-2" data-back="code">${icon('arrow-left', { size: 16 })}Different class</button>`;
}

function providerNote() {
  if (flow.provider === 'amazon') {
    return html`<div class="banner is-info">${brandIcon('amazon', { size: 20 })}<span>Amazon Music doesn’t offer a public connection for other apps yet. No problem: pick your favourite songs by hand - you decide exactly what you share.</span></div>`;
  }
  if (flow.provider === 'apple') {
    return html`<div class="banner is-info">${brandIcon('apple', { size: 20 })}<span>The automatic Apple Music connection isn’t set up on this site, so just pick your favourite songs by hand. It takes one minute!</span></div>`;
  }
  if (flow.provider === 'spotify') {
    return html`<div class="banner is-info">${brandIcon('spotify', { size: 20 })}<span>The Spotify login isn’t set up on this site yet - pick your favourite songs by hand instead.</span></div>`;
  }
  return html`<div class="banner is-info">${icon('lock', { size: 18 })}<span>Private mode: no account, no tracking. Your class only sees the nickname and songs you choose.</span></div>`;
}

function viewProfile() {
  return html`
    <h1 tabindex="-1">Who are you?</h1>
    <p class="muted mt-1">Your classmates will see this name. A nickname is totally fine.</p>
    <div class="stack mt-3" style="--gap:18px">
      ${providerNote()}
      ${errorBox()}
      <div class="row" style="--gap:14px">
        <span data-avatar-preview>${avatar({ avatar: flow.avatar }, { size: 64 })}</span>
        <label class="field" style="flex:1"><span class="label">Name or nickname</span>
          <input class="input" name="name" maxlength="32" value="${flow.name}" placeholder="e.g. Mia or DJ Pancake" autocomplete="nickname" data-input="name" required></label>
      </div>
      <div data-picker>${avatarPicker(flow.avatar)}</div>
      <button type="button" class="btn btn-primary btn-lg btn-block" data-next="songs">Continue ${icon('arrow-right', { size: 18 })}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-back="method">${icon('arrow-left', { size: 16 })}Back</button>
    </div>`;
}

function resultsList() {
  if (!flow.searchTerm) {
    return html`<p class="faint small center" style="padding:14px 0">Search for songs you love right now - they will appear in the class charts.</p>`;
  }
  if (flow.searching && !flow.results.length) return html`<div class="stack" style="--gap:8px">${[1, 2, 3].map(() => html`<div class="skeleton" style="height:58px"></div>`)}</div>`;
  if (flow.searchError) return html`<div class="banner">${icon('cloud-off', { size: 18 })}<span>${flow.searchError}</span></div>`;
  if (!flow.results.length) return html`<p class="faint small center" style="padding:14px 0">Nothing found. Try another spelling.</p>`;
  const picked = new Set(flow.picks.map((p) => p.key));
  return html`<div class="search-results">${flow.results.map((t, i) => {
    rememberTrack(t);
    const done = picked.has(t.key);
    return html`<div class="result ${done ? 'is-added' : ''}">
      <button type="button" class="track-cover-btn" data-action="play" data-key="${t.key}" aria-label="Play a preview of ${t.title}">${cover(t, { size: 46 })}<span class="play-overlay">${icon('play', { size: 18 })}</span></button>
      <div class="track-main"><div class="track-title">${t.title}</div><div class="track-sub">${t.artist}</div></div>
      ${done ? html`<span class="chip chip-live">Added</span>` : html`<button type="button" class="btn btn-sm btn-primary" data-pick="${i}" ${flow.picks.length >= MAX_PICKS ? 'disabled' : ''}>${icon('plus', { size: 16 })}Add</button>`}
    </div>`;
  })}</div>`;
}

function pickedList() {
  if (!flow.picks.length) return '';
  return html`<div class="field"><span class="label">Your songs (${flow.picks.length}/${MAX_PICKS})</span>
    <div class="picked">${flow.picks.map((t) => html`<span class="chip">${cover(t, { size: 28 })}<span class="truncate" style="max-width:180px">${t.title}</span><button type="button" data-unpick="${t.key}" aria-label="Remove ${t.title}">${icon('x', { size: 13 })}</button></span>`)}</div>
  </div>`;
}

function viewSongs() {
  return html`
    <h1 tabindex="-1">Add songs you love</h1>
    <p class="muted mt-1">Pick a few favourites (you can add more later). They count for the class charts.</p>
    <div class="stack mt-3" style="--gap:14px">
      ${errorBox()}
      <div class="input-icon">${icon('search')}<input class="input" type="search" placeholder="Search a song or an artist…" value="${flow.searchTerm}" autocomplete="off" enterkeyhint="search" data-input="search" aria-label="Search songs"></div>
      <div data-picked>${pickedList()}</div>
      <div data-results aria-live="polite">${resultsList()}</div>
      <button type="button" class="btn btn-primary btn-lg btn-block ${flow.busy ? 'is-loading' : ''}" data-finish>${flow.picks.length ? html`Join ${flow.cls?.name || 'class'} ${icon('arrow-right', { size: 18 })}` : 'Skip and join'}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-back="profile">${icon('arrow-left', { size: 16 })}Back</button>
    </div>`;
}

function viewConnecting() {
  const name = PROVIDERS[flow.provider]?.name || 'your music app';
  return html`<div class="stack center" style="--gap:16px;align-items:center;padding:30px 0">
    ${brandIcon(flow.provider || 'spotify', { size: 56 })}
    <h1 tabindex="-1" style="font-size:26px">Reading your ${name} data…</h1>
    <p class="muted">Your top songs, recent plays and playlists. Nothing is shared before you confirm.</p>
    <div class="spinner"></div>
    ${errorBox()}
    ${flow.error ? html`<div class="row wrap" style="justify-content:center;--gap:8px"><button type="button" class="btn" data-back="method">${icon('arrow-left', { size: 16 })}Back</button><button type="button" class="btn btn-primary" data-provider="private">Join privately instead</button></div>` : ''}
  </div>`;
}

function viewApple() {
  return html`<div class="stack" style="--gap:16px">
    <div class="row" style="--gap:14px">${brandIcon('apple', { size: 48 })}<h1 tabindex="-1" style="font-size:28px">Connect Apple Music</h1></div>
    <p class="muted">Apple will ask you to sign in and allow access. We only read your recently played songs and the playlists you pick.</p>
    ${errorBox()}
    <button type="button" class="btn btn-primary btn-lg btn-block ${flow.busy ? 'is-loading' : ''}" data-apple-connect>${brandIcon('apple', { size: 20 })}Connect Apple Music</button>
    <button type="button" class="btn btn-ghost btn-sm" data-back="method">${icon('arrow-left', { size: 16 })}Back</button>
  </div>`;
}

function viewReview() {
  const c = flow.connected;
  const pname = PROVIDERS[flow.provider]?.name;
  return html`
    <h1 tabindex="-1">What do you want to share?</h1>
    <p class="muted mt-1">Connected to ${pname}. You decide - and you can change it later.</p>
    <div class="stack mt-3" style="--gap:14px">
      ${errorBox()}
      <div class="row" style="--gap:14px">
        <span data-avatar-preview>${avatar({ avatar: flow.avatar }, { size: 56 })}</span>
        <label class="field" style="flex:1"><span class="label">Name in your class</span>
          <input class="input" maxlength="32" value="${flow.name}" data-input="name" autocomplete="nickname"></label>
      </div>
      <details><summary class="small faint" style="cursor:pointer">Change avatar</summary><div class="mt-2" data-picker>${avatarPicker(flow.avatar)}</div></details>
      <label class="switch">
        <input type="checkbox" data-toggle="shareTop" ${flow.shareTop ? 'checked' : ''}>
        <span class="switch-ui"></span>
        <span class="switch-text"><strong>My top songs</strong><span>${plural(c.top.length, 'song')} - they count for the class charts</span></span>
        <span class="row" style="--gap:4px" aria-hidden="true">${c.top.slice(0, 3).map((t) => cover(t, { size: 30 }))}</span>
      </label>
      <label class="switch">
        <input type="checkbox" data-toggle="shareListening" ${flow.shareListening ? 'checked' : ''}>
        <span class="switch-ui"></span>
        <span class="switch-text"><strong>My listening time</strong><span>Counts for group challenges like “Class Marathon”</span></span>
      </label>
      ${c.playlists.length
        ? html`<div class="field"><span class="label">Playlists to show your class <span class="faint">(optional)</span></span>
          <div class="stack" style="--gap:8px;max-height:280px;overflow:auto;padding-right:4px">
            ${c.playlists.map((p) => html`<label class="check-card">
              <input type="checkbox" data-playlist="${p.id}" ${flow.selected.has(p.id) ? 'checked' : ''}>
              <span class="check-box">${icon('check', { size: 15, stroke: 3 })}</span>
              <span class="playlist-art" style="--h:270;width:40px;flex:none;font-size:18px;border-radius:8px">🎶${p.cover ? html`<img src="${safeUrl(p.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}</span>
              <span style="min-width:0;flex:1"><strong class="truncate" style="display:block">${p.name}</strong><span class="small faint">${p.trackCount ? plural(p.trackCount, 'song') : ''}${p.own === false && p.ownerName ? ` · by ${p.ownerName}` : ''}</span></span>
            </label>`)}
          </div></div>`
        : ''}
      <button type="button" class="btn btn-primary btn-lg btn-block ${flow.busy ? 'is-loading' : ''}" data-finish>Join ${flow.cls?.name || 'class'} ${icon('arrow-right', { size: 18 })}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-back="method">${icon('arrow-left', { size: 16 })}Back</button>
    </div>`;
}

const STEPS = { code: viewCode, method: viewMethod, profile: viewProfile, songs: viewSongs, connecting: viewConnecting, apple: viewApple, review: viewReview };

function draw() {
  if (!root?.isConnected) return;
  const body = root.querySelector('[data-join-body]');
  if (!body) return;
  const active = document.activeElement;
  const focusKey = active?.dataset?.input;
  const selStart = active?.selectionStart;
  setHTML(body, html`${stepsBar()}${(STEPS[flow.step] || viewCode)()}`);
  if (focusKey) {
    const el = body.querySelector(`[data-input="${focusKey}"]`);
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(selStart, selStart);
      } catch {
        /* not a text input */
      }
    }
  }
  const picker = body.querySelector('[data-picker]');
  if (picker) {
    bindAvatarPicker(picker, flow.avatar, (a) => setHTML(body.querySelector('[data-avatar-preview]'), avatar({ avatar: a }, { size: flow.step === 'review' ? 56 : 64 })));
  }
}

function drawSearchParts() {
  const body = root?.querySelector('[data-join-body]');
  if (!body) return;
  const r = body.querySelector('[data-results]');
  const p = body.querySelector('[data-picked]');
  if (r) setHTML(r, resultsList());
  if (p) setHTML(p, pickedList());
  const finish = body.querySelector('[data-finish]');
  if (finish && flow.step === 'songs') setHTML(finish, flow.picks.length ? html`Join ${flow.cls?.name || 'class'} ${icon('arrow-right', { size: 18 })}` : 'Skip and join');
}

// ---------------- logic ----------------
async function checkCode(code) {
  const clean = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  flow.code = clean;
  if (clean.length < 4) {
    flow.error = 'Please enter the class code (6 letters or numbers).';
    draw();
    return;
  }
  if (clean === CONFIG.demoCode) {
    startDemo();
    return;
  }
  flow.busy = true;
  flow.error = '';
  draw();
  try {
    const { data, kind } = await previewClass(clean);
    flow.cls = data.class;
    flow.kind = kind;
    flow.memberCount = data.members?.length || 0;
    flow.busy = false;
    go('method');
  } catch (err) {
    flow.busy = false;
    flow.error = err.status === 404 ? `There is no class with the code “${clean}”. Please check the code.` : err.message;
    draw();
  }
}

async function startDemo() {
  try {
    await enterDemo();
    location.hash = '#/home';
    toast('Welcome to the demo class! 👋', { type: 'success' });
    setTimeout(celebrate, 1200);
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
}

async function chooseProvider(provider) {
  flow.provider = provider;
  flow.error = '';
  if (provider === 'spotify' && state.config.spotifyClientId) {
    flow.busy = true;
    draw();
    try {
      await spotify.startSpotifyLogin(state.config.spotifyClientId, {
        action: 'join',
        code: flow.code,
        kind: flow.kind,
        cls: flow.cls,
        memberCount: flow.memberCount,
        isNewClass: flow.isNewClass,
      });
    } catch (err) {
      flow.busy = false;
      flow.error = err.message;
      draw();
    }
    return;
  }
  if (provider === 'apple' && state.config.apple) {
    go('apple');
    apple.prepareAppleMusic().catch((err) => {
      flow.error = err.message;
      draw();
    });
    return;
  }
  go('profile');
}

async function loadConnected(provider) {
  try {
    if (provider === 'spotify') {
      const data = await spotify.collectSpotifyData({ playlists: true });
      const { perDay, cursor } = spotify.minutesFromRecent(data.recent, null);
      flow.connected = { top: data.top, playlists: data.playlists, perDay, cursor, profileName: data.profile.name };
      flow.name = flow.name || String(data.profile.name || '').split(' ')[0].slice(0, 32);
    } else {
      const data = await apple.collectAppleData();
      const { perDay, cursor } = apple.appleMinutes(data.recent, data.recentIds, null);
      flow.connected = { top: data.top, playlists: data.playlists, perDay, cursor, profileName: '' };
    }
    flow.selected = new Set();
    flow.step = 'review';
    flow.error = '';
    draw();
  } catch (err) {
    flow.step = 'connecting';
    flow.error = err.message || 'Could not read your music data.';
    draw();
  }
}

async function connectApple() {
  flow.busy = true;
  flow.error = '';
  draw();
  try {
    await apple.authorizeAppleMusic();
    flow.busy = false;
    flow.step = 'connecting';
    draw();
    await loadConnected('apple');
  } catch (err) {
    flow.busy = false;
    flow.error = err.message || 'Apple Music could not be connected.';
    draw();
  }
}

async function finish() {
  const name = flow.name.trim();
  if (!name) {
    flow.error = 'Please enter a name or nickname.';
    if (flow.step === 'songs') flow.step = 'profile';
    draw();
    return;
  }
  flow.busy = true;
  flow.error = '';
  draw();
  try {
    const member = { name, avatar: flow.avatar, provider: flow.provider || 'private', likes: [], listening: {}, songs: [], topTracks: [], playlists: [] };
    if (flow.connected) {
      const c = flow.connected;
      member.topTracks = flow.shareTop ? topForSave(c.top) : [];
      member.listening = Object.fromEntries(Object.entries(c.perDay || {}).map(([d, m]) => [d, { s: m, m: 0 }]));
      member.shareListening = flow.shareListening;
      member.syncCursor = { [flow.provider]: c.cursor };
      member.lastSyncAt = Date.now();
      const chosen = c.playlists.filter((p) => flow.selected.has(p.id)).slice(0, 8);
      member.playlists = await Promise.all(chosen.map((p) => playlistWithTracks(flow.provider, p).catch(() => null))).then((l) => l.filter(Boolean));
    } else {
      const now = Date.now();
      member.songs = flow.picks.map((t, i) => ({ ...cleanTrackForSave(t), addedAt: now - i }));
    }
    const wasNew = flow.isNewClass;
    await joinClass({ code: flow.code, kind: flow.kind, member });
    const clsName = flow.cls?.name;
    resetFlow();
    location.hash = '#/home';
    toast(`Welcome to ${clsName || 'your class'}! 🎉`, { type: 'success' });
    if (wasNew) setTimeout(openShareClass, 600);
    else setTimeout(celebrate, 900);
  } catch (err) {
    flow.busy = false;
    flow.error = err.message;
    draw();
  }
}

const runSearch = debounce(async () => {
  const term = flow.searchTerm.trim();
  if (!term) {
    flow.searching = false;
    flow.results = [];
    drawSearchParts();
    return;
  }
  try {
    const results = await searchSongs(term, { limit: 15 });
    if (flow.searchTerm.trim() !== term) return;
    flow.results = results.map((t) => ({ ...t, key: trackKey(t.title, t.artist) }));
    flow.searchError = '';
  } catch (err) {
    if (flow.searchTerm.trim() !== term) return;
    flow.results = [];
    flow.searchError = err instanceof SearchError ? err.message : 'Search failed. Please try again.';
  }
  flow.searching = false;
  drawSearchParts();
}, 350);

function openKeyDialog() {
  const modal = openModal({
    title: 'Use your personal key',
    body: html`<form class="stack" style="--gap:14px" id="key-form">
      <p class="muted">You find your personal key on the “Me” page of the device where you joined. It starts with <code>SPZ1.</code></p>
      <textarea class="textarea" name="key" required placeholder="SPZ1.R.ABC123.m_…" aria-label="Personal key" spellcheck="false"></textarea>
    </form>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="key-form" class="btn btn-primary">Sign in</button>`,
  });
  modal.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.el.querySelector('button[type="submit"]');
    btn.classList.add('is-loading');
    try {
      const member = await signInWithKey(e.target.key.value);
      modal.close();
      location.hash = '#/home';
      toast(`Welcome back, ${member.name}!`, { type: 'success' });
    } catch (err) {
      btn.classList.remove('is-loading');
      toast(err.message, { type: 'error' });
    }
  });
}

function bind(el) {
  el.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form="code"]');
    if (!form) return;
    e.preventDefault();
    checkCode(form.code.value);
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('.input-code')) {
      const caret = t.selectionStart;
      t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      try {
        t.setSelectionRange(caret, caret);
      } catch {
        /* ignore */
      }
      flow.code = t.value;
    }
    if (t.dataset.input === 'name') flow.name = t.value;
    if (t.dataset.input === 'search') {
      flow.searchTerm = t.value;
      flow.searching = Boolean(t.value.trim());
      flow.searchError = '';
      if (!t.value.trim()) flow.results = [];
      drawSearchParts();
      runSearch();
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.toggle) flow[t.dataset.toggle] = t.checked;
    if (t.dataset.playlist) {
      if (t.checked) flow.selected.add(t.dataset.playlist);
      else flow.selected.delete(t.dataset.playlist);
    }
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button, a');
    if (!t || !el.contains(t)) return;
    if (t.dataset.join === 'demo') startDemo();
    if (t.dataset.join === 'key') openKeyDialog();
    if (t.dataset.join === 'personal-key') openPersonalKey();
    if (t.dataset.provider) chooseProvider(t.dataset.provider);
    if (t.dataset.back) go(t.dataset.back);
    if (t.dataset.next === 'songs') {
      if (!flow.name.trim()) {
        flow.error = 'Please enter a name or nickname.';
        draw();
        return;
      }
      go('songs');
    }
    if (t.dataset.pick !== undefined) {
      const track = flow.results[Number(t.dataset.pick)];
      if (track && flow.picks.length < MAX_PICKS && !flow.picks.some((p) => p.key === track.key)) {
        flow.picks.push(track);
        drawSearchParts();
      }
    }
    if (t.dataset.unpick) {
      flow.picks = flow.picks.filter((p) => p.key !== t.dataset.unpick);
      drawSearchParts();
    }
    if (t.hasAttribute('data-finish')) finish();
    if (t.hasAttribute('data-apple-connect')) connectApple();
  });
}

export const joinView = {
  title: () => 'Join your class',
  render(ctx) {
    return html`<div class="join-wrap"><div class="card join-card" data-join-body></div>
      <p class="center small faint mt-3">${icon('lock', { size: 13 })} Your password always stays with Spotify or Apple.</p></div>`;
  },
  mount(el, ctx) {
    root = el;
    const code = (ctx.route.parts[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code && code !== flow.code && flow.step === 'code') {
      flow.code = code;
      draw();
      checkCode(code);
    } else if (code && code !== flow.code && flow.step !== 'connecting' && flow.step !== 'review') {
      resetFlow();
      flow.code = code;
      draw();
      checkCode(code);
    } else {
      draw();
    }
    bind(el);
    if (flow.step === 'code') setTimeout(() => el.querySelector('.input-code')?.focus({ preventScroll: true }), 50);
  },
};
