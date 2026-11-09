import { html } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { rankedBars } from '../lib/charts.js';
import { rankMovement, ranksOf, POINTS } from '../lib/aggregate.js';
import { formatNumber, plural } from '../lib/util.js';
import { state, previousRanks } from '../store.js';
import { avatarStack, cover, empty, likeButton, moreButton, trackRow, rememberTrack, playOverlay } from '../ui/components.js';
import { openModal } from '../ui/overlays.js';
import { demoBanner, heroSong } from './home.js';

let showAll = false;

function songsTab(s) {
  const chart = s.chart;
  if (!chart.length) {
    return html`<div class="card">${empty({ emoji: '📈', title: 'The charts are still empty', text: 'Add songs you love or connect Spotify - the class charts update instantly.', action: html`<button type="button" class="btn btn-primary" data-action="add-songs">${icon('plus', { size: 18 })}Add songs</button>` })}</div>`;
  }
  const moves = rankMovement(chart, previousRanks(ranksOf(chart)));
  const list = showAll ? chart : chart.slice(0, 50);
  return html`
    ${heroSong(chart[0])}
    <section class="card mt-3" aria-label="Class charts">
      <div class="track-list">
        ${list.slice(1).map((e) => {
          const listeners = [...e.listeners].map((id) => s.membersById.get(id));
          return trackRow(e.track, {
            rank: e.rank,
            move: moves.get(e.key),
            sub: html`${e.track.artist}`,
            right: html`<span class="hide-sm row" style="--gap:8px">${avatarStack(listeners, { max: 3, size: 24 })}</span>${state.me ? likeButton(e, state.me.likes?.includes(e.key)) : ''}${moreButton(e.key, `More about ${e.track.title}`)}`,
          });
        })}
      </div>
      ${chart.length > 50 && !showAll ? html`<div class="center mt-2"><button type="button" class="btn btn-sm" data-show-all>Show all ${chart.length} songs</button></div>` : ''}
    </section>`;
}

function artistRow(a) {
  const t = { ...a.topSong.track, key: a.topSong.key };
  rememberTrack(t);
  return html`<div class="track" data-track-row="${t.key}">
    <div class="track-rank"><span class="num ${a.rank <= 3 ? 'top' : ''}">${a.rank}</span></div>
    <button type="button" class="track-cover-btn" style="border-radius:50%" data-action="play" data-key="${t.key}" aria-label="Play ${t.title} by ${a.name}">${cover(t, { size: 48, cls: 'is-round' })}${playOverlay(t.key)}</button>
    <div class="track-main"><div class="track-title">${a.name}</div><div class="track-sub">${plural(a.listeners.size, 'listener')} · top song: ${t.title}</div></div>
    <div class="track-meta"><span class="tabular small faint hide-sm">${plural(a.songs.length, 'song')}</span></div>
  </div>`;
}

function artistsTab(s) {
  if (!s.artists.length) return html`<div class="card">${empty({ emoji: '🎤', title: 'No artists yet', text: 'Add some songs first.' })}</div>`;
  return html`<section class="card" aria-label="Top artists"><div class="track-list">${s.artists.slice(0, 50).map(artistRow)}</div></section>`;
}

function genresTab(s) {
  const genres = s.genres;
  if (!genres.length) {
    return html`<div class="card">${empty({ emoji: '🎼', title: 'No genres yet', text: 'Genres come from songs added by hand and from Apple Music. Spotify does not share genres with other apps.' })}</div>`;
  }
  const withGenre = s.chart.filter((e) => e.track.genre).length;
  return html`<section class="card">
    <div class="card-header"><div><h2 class="card-title">Genres by points</h2><div class="card-subtitle">Based on ${withGenre} of ${s.chart.length} songs that have a genre</div></div></div>
    ${rankedBars(genres.slice(0, 12).map((g) => ({ label: g.name, value: g.score })), { valueLabel: (v) => `${formatNumber(v)} pts`, caption: 'Genres by chart points' })}
  </section>`;
}

function explain() {
  openModal({
    title: 'How the charts work',
    body: html`<div class="prose" style="font-size:15px">
      <p>Every song collects points. The more classmates love a song, the higher it climbs:</p>
      <ul>
        <li><strong>Top songs</strong> from Spotify or Apple Music: a classmate’s #1 gets <strong>${POINTS.topTrack(1)} points</strong>, #2 gets ${POINTS.topTrack(2)} … down to 1 point.</li>
        <li><strong>Recent plays:</strong> +${POINTS.play} points per play (max. ${POINTS.maxPlays} per person).</li>
        <li><strong>Songs added by hand:</strong> +${POINTS.added} points each.</li>
        <li><strong>Hearts</strong> from classmates: +${POINTS.like} points each.</li>
      </ul>
      <p>▲ and ▼ show how a song moved since yesterday on this device. <strong>NEW</strong> marks songs that just entered the charts.</p>
    </div>`,
  });
}

export const chartsView = {
  title: () => 'Class charts',
  render(ctx) {
    const s = state.stats;
    const tab = ['songs', 'artists', 'genres'].includes(ctx.route.query.get('tab')) ? ctx.route.query.get('tab') : 'songs';
    const tabs = [
      ['songs', 'Songs', 'music'],
      ['artists', 'Artists', 'mic-vocal'],
      ['genres', 'Genres', 'chart-column'],
    ];
    return html`<div class="page">
      ${demoBanner()}
      <header class="page-header">
        <div>
          <span class="eyebrow">${icon('chart-column', { size: 14 })}${s.totals.songs} songs · ${s.totals.artists} artists</span>
          <h1 class="mt-1">Class charts</h1>
          <p class="subtitle">The songs ${state.data.class.name} can’t stop playing.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-ghost btn-sm" data-explain>${icon('circle-help', { size: 16 })}How it works</button>
          <button type="button" class="btn btn-primary" data-action="add-songs">${icon('plus', { size: 18 })}Add songs</button>
        </div>
      </header>
      <nav class="segmented" aria-label="Chart type" style="margin-bottom:18px">
        ${tabs.map(([id, label, ic]) => html`<a href="#/charts?tab=${id}" class="${tab === id ? 'is-active' : ''}" aria-current="${tab === id ? 'page' : 'false'}">${icon(ic, { size: 16 })}${label}</a>`)}
      </nav>
      ${tab === 'songs' ? songsTab(s) : tab === 'artists' ? artistsTab(s) : genresTab(s)}
    </div>`;
  },
  mount(el, ctx) {
    el.querySelector('[data-explain]')?.addEventListener('click', explain);
    el.querySelector('[data-show-all]')?.addEventListener('click', () => {
      showAll = true;
      ctx.rerender();
    });
  },
};
