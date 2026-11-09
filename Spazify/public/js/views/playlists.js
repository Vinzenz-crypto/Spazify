import { html, safeUrl, setHTML } from '../lib/html.js';
import { icon, brandIcon, PROVIDERS } from '../lib/icons.js';
import { formatDuration, plural, timeAgo } from '../lib/util.js';
import { state, getPlaylist, removeFromPlaylist, deletePlaylist, createMixtape, addToMixtape } from '../store.js';
import { avatar, empty, playlistArt, playlistCard, trackRow, moreButton } from '../ui/components.js';
import { openAddSongs, openCreateMixtape } from '../ui/modals.js';
import { confirmDialog, toast } from '../ui/overlays.js';
import { demoBanner } from './home.js';

function classMixCard(s) {
  const top = s.chart.slice(0, 4).map((e) => e.track);
  return html`<a class="playlist-card" href="#/playlists/class-mix" style="background:linear-gradient(160deg,rgba(139,92,246,.25),rgba(236,72,153,.12));border-color:rgba(167,139,250,.35)">
    <div style="position:relative">
      ${playlistArt({ id: 'class-mix', source: 'class', sample: top, covers: [] })}
      <span class="pl-source" style="background:var(--grad)">${icon('sparkles', { size: 16 })}</span>
    </div>
    <div><div class="pl-name">Class Mix</div><div class="pl-meta mt-1">Made for ${state.data.class.name} · ${Math.min(30, s.chart.length)} songs</div></div>
  </a>`;
}

function listView() {
  const s = state.stats;
  const all = [];
  for (const m of s.members) for (const p of m.playlists || []) all.push({ p, m });
  all.sort((a, b) => (b.p.updatedAt || b.p.createdAt || 0) - (a.p.updatedAt || a.p.createdAt || 0));
  const mixtapes = all.filter((x) => x.p.source === 'spazify');
  const shared = all.filter((x) => x.p.source !== 'spazify');
  const card = ({ p, m }) => playlistCard({ playlist: p, owner: m, href: `#/playlists/${encodeURIComponent(m.id)}/${encodeURIComponent(p.id)}` });
  return html`<div class="page">
    ${demoBanner()}
    <header class="page-header">
      <div>
        <span class="eyebrow">${icon('list-music', { size: 14 })}${plural(all.length, 'playlist')}</span>
        <h1 class="mt-1">Playlists</h1>
        <p class="subtitle">Mixtapes made in class and playlists your classmates chose to share.</p>
      </div>
      <div class="actions">
        <button type="button" class="btn btn-primary" data-new-mixtape>${icon('list-plus', { size: 18 })}New mixtape</button>
      </div>
    </header>

    <section>
      <div class="section-title"><h2>Made for your class</h2></div>
      <div class="grid grid-auto" style="--min:190px">
        ${s.chart.length ? classMixCard(s) : ''}
        ${mixtapes.map(card)}
        <button type="button" class="playlist-card" data-new-mixtape style="border-style:dashed;align-items:center;justify-content:center;min-height:240px;color:var(--text-2)">
          <span class="icon-bubble" style="width:56px;height:56px;border-radius:18px">${icon('plus', { size: 26 })}</span>
          <span style="font-weight:700">Create a mixtape</span>
          <span class="small faint">No music app needed</span>
        </button>
      </div>
    </section>

    <section class="section">
      <div class="section-title"><h2>Shared from music apps</h2><span class="faint small row" style="--gap:6px">${brandIcon('spotify', { size: 14 })}${brandIcon('apple', { size: 14 })}</span></div>
      ${shared.length
        ? html`<div class="grid grid-auto" style="--min:190px">${shared.map(card)}</div>`
        : html`<div class="card">${empty({ emoji: '🎧', title: 'No shared playlists yet', text: 'Classmates who connect Spotify or Apple Music can choose playlists to show here.' })}</div>`}
    </section>
  </div>`;
}

function classMixView() {
  const s = state.stats;
  const tracks = s.chart.slice(0, 30);
  return html`<div class="page">
    <a class="btn btn-ghost btn-sm" href="#/playlists">${icon('arrow-left', { size: 16 })}Playlists</a>
    <header class="playlist-head mt-2">
      ${playlistArt({ id: 'class-mix', source: 'class', sample: tracks.slice(0, 4).map((e) => e.track), covers: [] })}
      <div style="min-width:0">
        <span class="eyebrow">${icon('sparkles', { size: 14 })}Made for ${state.data.class.name}</span>
        <h1 class="mt-1">Class Mix</h1>
        <p class="muted mt-1">The ${tracks.length} songs your class loves most right now. Updates automatically.</p>
        <div class="row wrap mt-2" style="--gap:10px">
          ${tracks.length ? html`<button type="button" class="btn btn-white" data-action="play" data-key="${tracks[0].key}">${icon('play', { size: 18 })}Preview #1</button>` : ''}
          ${state.me && tracks.length ? html`<button type="button" class="btn" data-save-mix>${icon('copy', { size: 18 })}Save as my mixtape</button>` : ''}
        </div>
      </div>
    </header>
    <section class="card">
      ${tracks.length
        ? html`<div class="track-list">${tracks.map((e, i) => trackRow(e.track, { rank: i + 1, right: html`<span class="tabular small faint hide-sm">${formatDuration(e.track.duration)}</span>${moreButton(e.key)}` }))}</div>`
        : empty({ emoji: '🎶', title: 'Nothing here yet', text: 'The Class Mix fills up as soon as your class adds songs.' })}
    </section>
  </div>`;
}

function detailSkeleton() {
  return html`<div class="page"><div class="playlist-head"><div class="skeleton" style="width:210px;aspect-ratio:1"></div><div class="stack" style="flex:1"><div class="skeleton" style="height:20px;width:120px"></div><div class="skeleton" style="height:48px;width:60%"></div></div></div>${[1, 2, 3, 4, 5].map(() => html`<div class="skeleton" style="height:60px;margin-bottom:8px"></div>`)}</div>`;
}

function detailView({ playlist, owner }) {
  const mine = owner?.id === state.session?.memberId;
  const editable = mine && playlist.source === 'spazify';
  const tracks = playlist.tracks || [];
  const providerName = PROVIDERS[playlist.source]?.name;
  return html`<div class="page">
    <a class="btn btn-ghost btn-sm" href="#/playlists">${icon('arrow-left', { size: 16 })}Playlists</a>
    <header class="playlist-head mt-2">
      ${playlistArt(playlist)}
      <div style="min-width:0;flex:1">
        <span class="eyebrow">${playlist.source === 'spazify' ? html`${icon('list-music', { size: 14 })}Mixtape` : html`${brandIcon(playlist.source, { size: 14 })}${providerName} playlist`}</span>
        <h1 class="mt-1" style="overflow-wrap:anywhere">${playlist.name}</h1>
        ${playlist.description ? html`<p class="muted mt-1" style="max-width:640px">${playlist.description}</p>` : ''}
        <div class="row wrap mt-2 small muted" style="--gap:10px">
          ${owner ? html`<a class="row" style="--gap:8px" href="#/class/${encodeURIComponent(owner.id)}">${avatar(owner, { size: 26 })}<strong>${owner.name}</strong></a>` : ''}
          <span>· ${plural(tracks.length || playlist.trackCount || 0, 'song')}</span>
          ${playlist.updatedAt ? html`<span>· updated ${timeAgo(playlist.updatedAt)}</span>` : ''}
        </div>
        <div class="row wrap mt-3" style="--gap:10px">
          ${tracks.length ? html`<button type="button" class="btn btn-white" data-action="play" data-key="${tracks[0].key}">${icon('play', { size: 18 })}Preview</button>` : ''}
          ${editable ? html`<button type="button" class="btn btn-primary" data-add-to="${playlist.id}">${icon('plus', { size: 18 })}Add songs</button>` : ''}
          ${playlist.url ? html`<a class="btn" href="${safeUrl(playlist.url)}" target="_blank" rel="noopener noreferrer">${brandIcon(playlist.source, { size: 18 })}Open in ${providerName}</a>` : ''}
          ${mine ? html`<button type="button" class="btn btn-ghost" data-delete-playlist="${playlist.id}">${icon('trash-2', { size: 18 })}${playlist.source === 'spazify' ? 'Delete' : 'Stop sharing'}</button>` : ''}
        </div>
      </div>
    </header>
    <section class="card">
      ${tracks.length
        ? html`<div class="track-list">${tracks.map((t, i) => trackRow(t, {
            rank: i + 1,
            right: html`<span class="tabular small faint hide-sm">${formatDuration(t.duration)}</span>${editable ? html`<button type="button" class="btn btn-ghost btn-icon btn-xs" data-remove-track="${t.key}" aria-label="Remove ${t.title}">${icon('x', { size: 16 })}</button>` : moreButton(t.key)}`,
          }))}</div>`
        : empty({ emoji: playlist.emoji || '🎶', title: 'This mixtape is empty', text: editable ? 'Add the first songs - search for anything you like.' : 'Songs will appear here soon.', action: editable ? html`<button type="button" class="btn btn-primary" data-add-to="${playlist.id}">${icon('plus', { size: 18 })}Add songs</button>` : '' })}
    </section>
  </div>`;
}

let detailCache = null;

export const playlistsView = {
  title: (ctx) => (ctx.route.parts[1] === 'class-mix' ? 'Class Mix' : 'Playlists'),
  render(ctx) {
    const [, a, b] = ctx.route.parts;
    if (!a) return listView();
    if (a === 'class-mix') return classMixView();
    if (detailCache && detailCache.key === `${a}/${b}`) return detailView(detailCache.data);
    return detailSkeleton();
  },
  mount(el, ctx) {
    const [, a, b] = ctx.route.parts;
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-new-mixtape')) {
        openCreateMixtape((id) => {
          location.hash = `#/playlists/${encodeURIComponent(state.session.memberId)}/${encodeURIComponent(id)}`;
        });
      }
      if (t.dataset.addTo) {
        const p = state.me?.playlists?.find((x) => x.id === t.dataset.addTo);
        openAddSongs({ playlistId: t.dataset.addTo, playlistName: p?.name || 'mixtape' });
      }
      if (t.dataset.removeTrack) {
        removeFromPlaylist(b, t.dataset.removeTrack).catch((err) => toast(err.message, { type: 'error' }));
      }
      if (t.dataset.deletePlaylist) {
        const p = state.me?.playlists?.find((x) => x.id === t.dataset.deletePlaylist);
        const ok = await confirmDialog({
          title: p?.source === 'spazify' ? 'Delete this mixtape?' : 'Stop sharing this playlist?',
          text: p?.source === 'spazify' ? 'The mixtape will be gone for everybody.' : 'It stays in your music app - your class just won’t see it anymore.',
          confirmLabel: p?.source === 'spazify' ? 'Delete' : 'Stop sharing',
          danger: true,
        });
        if (!ok) return;
        await deletePlaylist(t.dataset.deletePlaylist).catch((err) => toast(err.message, { type: 'error' }));
        location.hash = '#/playlists';
      }
      if (t.hasAttribute('data-save-mix')) {
        try {
          const id = await createMixtape({ name: `${state.data.class.name} Mix`, description: `The top songs of ${state.data.class.name}.`, emoji: '✨', color: 290 });
          const tracks = state.stats.chart.slice(0, 30).map((x) => x.track);
          for (const tr of tracks) await addToMixtape(id, tr);
          toast('Saved as your mixtape!', { type: 'success' });
          location.hash = `#/playlists/${encodeURIComponent(state.session.memberId)}/${encodeURIComponent(id)}`;
        } catch (err) {
          toast(err.message, { type: 'error' });
        }
      }
    });

    if (a && a !== 'class-mix') {
      const key = `${a}/${b}`;
      // My own playlists are always fresh from memory; others are loaded from the server.
      const mine = a === state.session?.memberId ? state.me?.playlists?.find((p) => p.id === b) : null;
      if (mine) {
        const fresh = { playlist: mine, owner: state.me };
        const changed = !detailCache || detailCache.key !== key || detailCache.data.playlist !== mine;
        detailCache = { key, data: fresh };
        if (changed) ctx.rerender();
        return;
      }
      if (detailCache?.key === key) return;
      getPlaylist(a, b)
        .then((data) => {
          detailCache = { key, data: { ...data, owner: state.stats.membersById.get(a) || data.owner } };
          if (location.hash.includes(encodeURIComponent(b)) || location.hash.includes(b)) ctx.rerender();
        })
        .catch((err) => {
          setHTML(el, html`<div class="page">${empty({ emoji: '🤷', title: 'Playlist not found', text: err.message, action: html`<a class="btn" href="#/playlists">Back to playlists</a>` })}</div>`);
        });
    }
  },
};

export function clearPlaylistCache() {
  detailCache = null;
}

