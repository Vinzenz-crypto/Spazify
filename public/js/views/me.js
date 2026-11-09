import { html } from '../lib/html.js';
import { icon, brandIcon, PROVIDERS } from '../lib/icons.js';
import { listeningColumns } from '../lib/charts.js';
import { LIMITS } from '../lib/model.js';
import { formatMinutes, lastDays, plural, timeAgo } from '../lib/util.js';
import * as spotify from '../lib/spotify.js';
import * as apple from '../lib/apple.js';
import { resync, topForSave, mergeMinutes, playlistWithTracks } from '../lib/sync.js';
import { state, updateMe, removeSong, updateSongNote, setShareListening, leaveClass, signOut, isDemo } from '../store.js';
import { avatar, empty, playlistCard, providerChip, trackRow, cover } from '../ui/components.js';
import { openEditProfile, openPersonalKey, openCreateMixtape } from '../ui/modals.js';
import { confirmDialog, openModal, toast } from '../ui/overlays.js';
import { demoBanner } from './home.js';

function connectionCard() {
  const me = state.me;
  const p = me.provider;
  const cfg = state.config;
  const demo = isDemo();
  // Joined with a music app but picked the songs by hand (no real connection).
  const connected = (p === 'spotify' || p === 'apple') && Boolean(me.lastSyncAt || me.syncCursor?.[p]);
  if (connected) {
    const linked = p === 'spotify' ? spotify.isSpotifyConnected() : true;
    return html`<section class="card">
      <div class="row wrap" style="--gap:14px">
        ${brandIcon(p, { size: 40 })}
        <div style="flex:1;min-width:180px">
          <div class="card-title">Connected to ${PROVIDERS[p].name}</div>
          <div class="small faint">${me.lastSyncAt ? `Last synced ${timeAgo(me.lastSyncAt)}` : 'Not synced yet'}${linked ? '' : ' · login expired on this device'}</div>
        </div>
        <div class="row wrap" style="--gap:8px">
          ${linked ? html`<button type="button" class="btn btn-primary btn-sm" data-sync>${icon('refresh-cw', { size: 16 })}Sync now</button>` : html`<button type="button" class="btn btn-primary btn-sm" data-connect="${p}">${icon('log-in', { size: 16 })}Reconnect</button>`}
          ${linked ? html`<button type="button" class="btn btn-sm" data-choose-playlists>${icon('list-music', { size: 16 })}Playlists</button>` : ''}
          <button type="button" class="btn btn-ghost btn-sm" data-disconnect>${icon('log-out', { size: 16 })}Disconnect</button>
        </div>
      </div>
      <p class="small faint mt-2">Syncing updates your top songs and adds new listening time from your recent plays. Your login stays on this device - it is never sent to our server.</p>
    </section>`;
  }
  const canSpotify = Boolean(cfg.spotifyClientId) && !demo;
  const canApple = Boolean(cfg.apple) && !demo;
  return html`<section class="card">
    <div class="row wrap" style="--gap:14px">
      ${brandIcon(p, { size: 40 })}
      <div style="flex:1;min-width:200px">
        <div class="card-title">${p === 'private' ? 'Private mode' : `${PROVIDERS[p].name} (songs added by hand)`}</div>
        <div class="small faint">You only share the songs you add yourself.${canSpotify || canApple ? ' Want to share your top songs automatically?' : ''}</div>
      </div>
      <div class="row wrap" style="--gap:8px">
        ${canSpotify ? html`<button type="button" class="btn btn-sm" data-connect="spotify">${brandIcon('spotify', { size: 16 })}Connect Spotify</button>` : ''}
        ${canApple ? html`<button type="button" class="btn btn-sm" data-connect="apple">${brandIcon('apple', { size: 16 })}Connect Apple Music</button>` : ''}
      </div>
    </div>
  </section>`;
}

function render() {
  const me = state.me;
  const s = state.stats;
  if (!me) return html`<div class="page">${empty({ emoji: '🙈', title: 'Not signed in' })}</div>`;
  const st = s.memberStats.get(me.id);
  const days = lastDays(14).map((key) => ({ key, minutes: (me.listening?.[key]?.s || 0) + (me.listening?.[key]?.m || 0) }));
  const mixtapes = (me.playlists || []).filter((p) => p.source === 'spazify');
  const shared = (me.playlists || []).filter((p) => p.source !== 'spazify');
  return html`<div class="page">
    ${demoBanner()}
    <header class="profile-head">
      ${avatar(me, { size: 96, badge: true })}
      <div style="min-width:0">
        <div class="row wrap" style="--gap:8px">${providerChip(me.provider)}${me.role === 'owner' ? html`<span class="badge badge-owner">${icon('crown', { size: 11 })}Class owner</span>` : ''}</div>
        <h1 class="mt-1" style="font-size:clamp(30px,4vw,44px)">${me.name}</h1>
        <p class="muted small mt-1">${plural(me.songs?.length || 0, 'song')} added · ${formatMinutes(st?.minutesWeek || 0)} this week</p>
      </div>
      <button type="button" class="btn" data-edit-profile>${icon('pencil', { size: 16 })}Edit profile</button>
    </header>

    ${connectionCard()}

    <div class="grid grid-2 section" style="align-items:start">
      <div class="stack" style="--gap:18px">
        <section class="card">
          <div class="card-header">
            <div><h2 class="card-title">My songs</h2><div class="card-subtitle">${me.songs?.length || 0} of ${LIMITS.songs} · they count for the class charts</div></div>
            <button type="button" class="btn btn-sm btn-primary card-link" style="color:#fff" data-action="add-songs">${icon('plus', { size: 16 })}Add</button>
          </div>
          ${(me.songs || []).length
            ? html`<div class="track-list">${me.songs.map((t) => trackRow(t, {
                note: t.note,
                right: html`<button type="button" class="btn btn-ghost btn-icon btn-xs" data-edit-note="${t.key}" aria-label="Edit note for ${t.title}">${icon('pencil', { size: 15 })}</button><button type="button" class="btn btn-ghost btn-icon btn-xs" data-remove-song="${t.key}" aria-label="Remove ${t.title}">${icon('trash-2', { size: 15 })}</button>`,
              }))}</div>`
            : empty({ emoji: '💿', title: 'No songs yet', text: 'Add songs you love - and tell your class why.', action: html`<button type="button" class="btn btn-primary" data-action="add-songs">${icon('plus', { size: 18 })}Add songs</button>` })}
        </section>
        ${(me.topTracks || []).length
          ? html`<section class="card">
              <div class="card-header"><div><h2 class="card-title">My top songs</h2><div class="card-subtitle">From ${PROVIDERS[me.provider]?.name || 'your music app'} · updated when you sync</div></div>
                <button type="button" class="btn btn-ghost btn-sm card-link" data-hide-top>${icon('eye-off', { size: 16 })}Hide</button></div>
              <div class="track-list">${me.topTracks.slice(0, 10).map((t, i) => trackRow(t, { rank: i + 1, right: t.plays ? html`<span class="small faint tabular">${t.plays}× played</span>` : '' }))}</div>
            </section>`
          : ''}
      </div>

      <div class="stack" style="--gap:18px">
        <section class="card">
          <div class="card-header"><div><h2 class="card-title">My listening time</h2><div class="card-subtitle">Last 14 days</div></div>
            <button type="button" class="btn btn-sm card-link" data-action="log-time">${icon('timer', { size: 16 })}Log time</button></div>
          ${listeningColumns(days, { label: 'My listening time, last 14 days' })}
          <label class="switch mt-2">
            <input type="checkbox" data-share-listening ${me.shareListening !== false ? 'checked' : ''}>
            <span class="switch-ui"></span>
            <span class="switch-text"><strong>Share my listening time</strong><span>Your class sees your minutes and they count for challenges.</span></span>
          </label>
        </section>

        <section class="card">
          <div class="card-header"><h2 class="card-title">My mixtapes & playlists</h2>
            <button type="button" class="btn btn-sm card-link" data-new-mixtape>${icon('list-plus', { size: 16 })}New</button></div>
          ${mixtapes.length || shared.length
            ? html`<div class="grid grid-auto" style="--min:150px">${[...mixtapes, ...shared].map((p) => playlistCard({ playlist: p, owner: me, href: `#/playlists/${encodeURIComponent(me.id)}/${encodeURIComponent(p.id)}` }))}</div>`
            : html`<p class="faint small">You have no mixtapes yet. Create one and collect songs for a topic - like “Songs for the class trip”.</p>`}
        </section>

        <section class="card">
          <div class="card-header"><div><h2 class="card-title">Privacy & data</h2><div class="card-subtitle">You are in control</div></div></div>
          <div class="stack" style="--gap:10px">
            <button type="button" class="btn btn-block" data-personal-key>${icon('key-round', { size: 18 })}Use on another device</button>
            <button type="button" class="btn btn-block" data-download>${icon('download', { size: 18 })}Download my data</button>
            <button type="button" class="btn btn-block btn-ghost" data-sign-out>${icon('log-out', { size: 18 })}Sign out on this device</button>
            <button type="button" class="btn btn-block btn-danger" data-leave>${icon('trash-2', { size: 18 })}Leave class & delete my data</button>
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

// After connecting Spotify / Apple Music from the "Me" page: choose what to share.
export function openConnectReview(provider, data) {
  const selected = new Set();
  let shareTop = true;
  const modal = openModal({
    title: `Share from ${PROVIDERS[provider].name}`,
    body: html`<div class="stack" style="--gap:14px">
      <label class="switch"><input type="checkbox" data-top checked><span class="switch-ui"></span>
        <span class="switch-text"><strong>My top songs</strong><span>${plural(data.top.length, 'song')} for the class charts</span></span>
        <span class="row" style="--gap:4px" aria-hidden="true">${data.top.slice(0, 3).map((t) => cover(t, { size: 30 }))}</span></label>
      ${data.playlists.length
        ? html`<div class="field"><span class="label">Playlists to show your class</span><div class="stack" style="--gap:8px;max-height:300px;overflow:auto">
          ${data.playlists.map((p) => html`<label class="check-card"><input type="checkbox" data-pl="${p.id}"><span class="check-box">${icon('check', { size: 15, stroke: 3 })}</span><span style="min-width:0;flex:1"><strong class="truncate" style="display:block">${p.name}</strong><span class="small faint">${p.trackCount ? plural(p.trackCount, 'song') : ''}</span></span></label>`)}
        </div></div>`
        : ''}
    </div>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>Save & share</button>`,
  });
  modal.el.addEventListener('change', (e) => {
    if (e.target.matches('[data-top]')) shareTop = e.target.checked;
    if (e.target.dataset.pl) {
      if (e.target.checked) selected.add(e.target.dataset.pl);
      else selected.delete(e.target.dataset.pl);
    }
  });
  modal.el.querySelector('[data-save]').addEventListener('click', async (e) => {
    e.target.classList.add('is-loading');
    try {
      const chosen = data.playlists.filter((p) => selected.has(p.id)).slice(0, 8);
      const lists = (await Promise.all(chosen.map((p) => playlistWithTracks(provider, p).catch(() => null)))).filter(Boolean);
      await updateMe((m) => {
        m.provider = provider;
        m.topTracks = shareTop ? topForSave(data.top) : [];
        m.listening = mergeMinutes(m.listening, data.perDay);
        m.syncCursor = { ...(m.syncCursor || {}), [provider]: data.cursor };
        m.lastSyncAt = Date.now();
        const keep = (m.playlists || []).filter((p) => p.source === 'spazify' || !lists.some((l) => l.id === p.id));
        m.playlists = [...keep, ...lists].slice(0, LIMITS.playlists);
      });
      modal.close();
      toast(`${PROVIDERS[provider].name} connected!`, { type: 'success' });
    } catch (err) {
      e.target.classList.remove('is-loading');
      toast(err.message, { type: 'error' });
    }
  });
}

async function choosePlaylists() {
  const me = state.me;
  try {
    let data;
    if (me.provider === 'spotify') {
      const profile = await spotify.fetchSpotifyProfile();
      data = { top: me.topTracks || [], playlists: await spotify.fetchSpotifyPlaylists(profile.id), perDay: {}, cursor: me.syncCursor?.spotify };
    } else {
      await apple.authorizeAppleMusic();
      const d = await apple.collectAppleData();
      data = { top: me.topTracks || [], playlists: d.playlists, perDay: {}, cursor: me.syncCursor?.apple };
    }
    openConnectReview(me.provider, data);
  } catch (err) {
    toast(err.message, { type: 'error' });
  }
}

function editNote(key) {
  const song = state.me?.songs?.find((s) => s.key === key);
  if (!song) return;
  const modal = openModal({
    title: 'Why do you love this song?',
    body: html`<form class="stack" style="--gap:12px" id="note-form">
      <div class="row" style="--gap:12px">${cover(song, { size: 48 })}<div><div class="track-title">${song.title}</div><div class="track-sub">${song.artist}</div></div></div>
      <textarea class="textarea" name="note" maxlength="${LIMITS.note}" placeholder="e.g. This song always puts me in a good mood.">${song.note || ''}</textarea>
      <span class="hint">Write it in English - your class can read it on the dashboard.</span>
    </form>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="note-form" class="btn btn-primary">Save note</button>`,
    initialFocus: 'textarea',
  });
  modal.el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    modal.close();
    updateSongNote(key, e.target.note.value).then(
      () => toast('Note saved', { type: 'success' }),
      (err) => toast(err.message, { type: 'error' }),
    );
  });
}

function downloadData() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), class: state.data?.class, me: state.me }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `spazify-${(state.me?.name || 'me').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const meView = {
  title: () => 'My profile',
  render,
  mount(el) {
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-share-listening]')) {
        setShareListening(e.target.checked).then(
          () => toast(e.target.checked ? 'Your listening time is shared again' : 'Your listening time is now private'),
          (err) => toast(err.message, { type: 'error' }),
        );
      }
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-edit-profile')) openEditProfile();
      if (b.hasAttribute('data-personal-key')) openPersonalKey();
      if (b.hasAttribute('data-download')) downloadData();
      if (b.hasAttribute('data-new-mixtape')) openCreateMixtape((id) => (location.hash = `#/playlists/${encodeURIComponent(state.me.id)}/${encodeURIComponent(id)}`));
      if (b.dataset.editNote) editNote(b.dataset.editNote);
      if (b.dataset.removeSong) removeSong(b.dataset.removeSong).then(() => toast('Song removed'), (err) => toast(err.message, { type: 'error' }));
      if (b.hasAttribute('data-hide-top')) {
        const ok = await confirmDialog({ title: 'Hide your top songs?', text: 'They will be removed from the class charts until you sync again.', confirmLabel: 'Hide' });
        if (ok) updateMe((m) => (m.topTracks = [])).catch((err) => toast(err.message, { type: 'error' }));
      }
      if (b.hasAttribute('data-sync')) {
        b.classList.add('is-loading');
        try {
          const res = await resync();
          toast(`Synced ${res.songs} songs${res.minutes ? ` and ${formatMinutes(res.minutes)} of new listening time` : ''}`, { type: 'success' });
        } catch (err) {
          toast(err.message, { type: 'error' });
        } finally {
          b.classList.remove('is-loading');
        }
      }
      if (b.hasAttribute('data-choose-playlists')) choosePlaylists();
      if (b.dataset.connect === 'spotify') {
        spotify.startSpotifyLogin(state.config.spotifyClientId, { action: 'connect', code: state.session.code }).catch((err) => toast(err.message, { type: 'error' }));
      }
      if (b.dataset.connect === 'apple') {
        try {
          await apple.prepareAppleMusic();
          await apple.authorizeAppleMusic();
          const d = await apple.collectAppleData();
          const { perDay, cursor } = apple.appleMinutes(d.recent, d.recentIds, state.me.syncCursor?.apple);
          openConnectReview('apple', { top: d.top, playlists: d.playlists, perDay, cursor });
        } catch (err) {
          toast(err.message, { type: 'error' });
        }
      }
      if (b.hasAttribute('data-disconnect')) {
        const p = state.me.provider;
        const ok = await confirmDialog({
          title: `Disconnect ${PROVIDERS[p].name}?`,
          text: `Your top songs and ${PROVIDERS[p].name} playlists will be removed from the class. Songs you added by hand stay.`,
          confirmLabel: 'Disconnect',
          danger: true,
        });
        if (!ok) return;
        if (p === 'spotify') spotify.disconnectSpotify();
        if (p === 'apple') apple.disconnectAppleMusic();
        updateMe((m) => {
          m.provider = 'private';
          m.topTracks = [];
          m.playlists = (m.playlists || []).filter((x) => x.source === 'spazify');
        }).then(() => toast('Disconnected'), (err) => toast(err.message, { type: 'error' }));
      }
      if (b.hasAttribute('data-sign-out')) {
        const key = state.session?.demo ? null : true;
        const ok = await confirmDialog({
          title: 'Sign out on this device?',
          text: key ? 'Your songs stay in the class. To edit them again later, you need your personal key - copy it first!' : 'This resets the demo on this device.',
          confirmLabel: 'Sign out',
          extra: key ? html`<button type="button" class="btn btn-sm mt-2" data-personal-key-inline>${icon('key-round', { size: 16 })}Show my personal key</button>` : '',
        });
        if (ok) {
          signOut();
          location.hash = '#/';
        }
      }
      if (b.hasAttribute('data-leave')) {
        const ok = await confirmDialog({ title: 'Leave the class?', text: 'Your songs, playlists and listening time will be deleted from the class. This cannot be undone.', confirmLabel: 'Leave & delete', danger: true });
        if (!ok) return;
        try {
          await leaveClass();
          location.hash = '#/';
          toast('You left the class. Your data was deleted.');
        } catch (err) {
          toast(err.message, { type: 'error' });
        }
      }
    });
  },
};

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-personal-key-inline]')) openPersonalKey();
});

