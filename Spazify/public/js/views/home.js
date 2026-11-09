import { html, safeUrl } from '../lib/html.js';
import { icon, PROVIDERS, PROVIDER_CHART_ORDER } from '../lib/icons.js';
import { coverUrl } from '../lib/music.js';
import { listeningColumns, progressRing, segmentedBar, sparkline } from '../lib/charts.js';
import { rankMovement, ranksOf, CHALLENGE_UNITS } from '../lib/aggregate.js';
import { firstName, formatHours, formatMinutes, formatNumber, greeting, plural, timeAgo, daysLeft } from '../lib/util.js';
import { state, isDemo, previousRanks } from '../store.js';
import { avatar, cover, coverStyle, delta, empty, likeButton, moreButton, sectionHeader, statTile, trackRow, playOverlay, rememberTrack } from '../ui/components.js';

export function demoBanner() {
  if (isDemo()) {
    return html`<div class="banner is-info">${icon('sparkles', { size: 18 })}<span><strong>Demo class.</strong> Everything you do here is saved only on this device - try adding songs, hearts and challenges!</span><a class="btn btn-sm btn-white" href="#/create" data-action="leave-demo">Create your class</a></div>`;
  }
  if (state.session?.backend === 'local') {
    return html`<div class="banner">${icon('cloud-off', { size: 18 })}<span>This class is saved on this device only. To share it with your classmates, deploy the site with server functions (see Site setup).</span></div>`;
  }
  if (state.loadError) return html`<div class="banner">${icon('cloud-off', { size: 18 })}<span>${state.loadError}</span></div>`;
  return '';
}

export function heroSong(entry, { label = '#1 in your class' } = {}) {
  if (!entry) return '';
  rememberTrack(entry.track);
  const url = coverUrl(entry.track);
  const { h1, h2 } = coverStyle(entry.key);
  const liked = state.me?.likes?.includes(entry.key);
  const listeners = [...entry.listeners].map((id) => state.stats.membersById.get(id)).filter(Boolean);
  return html`<section class="hero-song" aria-label="Number one song">
    <div class="hero-song-bg ${url ? '' : 'is-gen'}" style="${url ? `background-image:url('${safeUrl(url)}')` : `background:linear-gradient(135deg,hsl(${h1} 70% 45%),hsl(${h2} 80% 35%))`}"></div>
    <button type="button" class="track-cover-btn" data-action="play" data-key="${entry.key}" aria-label="Play a preview of ${entry.track.title}" style="border-radius:20px">
      ${cover(entry.track, { size: 172, lazy: false })}${playOverlay(entry.key)}
    </button>
    <div class="hero-info">
      <span class="crown">${icon('crown', { size: 15 })}${label}</span>
      <div class="hero-title">${entry.track.title}</div>
      <div class="hero-artist">${entry.track.artist}</div>
      <div class="row wrap mt-3" style="--gap:10px">
        <button type="button" class="btn btn-white" data-action="play" data-key="${entry.key}">${icon('play', { size: 18 })}Preview</button>
        ${state.me ? likeButton(entry, liked) : ''}
        <span class="row small" style="--gap:8px;color:rgba(255,255,255,.85)">
          <span class="avatar-stack" style="--size:26px">${listeners.slice(0, 4).map((m) => avatar(m, { size: 26 }))}</span>
          ${plural(entry.listeners.size, 'listener')}
        </span>
      </div>
    </div>
  </section>`;
}

function challengeMini(c) {
  const unit = CHALLENGE_UNITS[c.type];
  const value = c.type === 'minutes' ? formatHours(c.value * 60) : formatNumber(c.value);
  const left = daysLeft(c.endAt);
  return html`<a class="row" href="#/challenges" style="--gap:14px;padding:10px;border-radius:16px" data-hover>
    <span class="ring-wrap">${progressRing(c.pct, { size: 58, stroke: 6, label: `${Math.round(c.pct * 100)}% done` })}<span class="ring-text" style="font-size:13px">${Math.round(c.pct * 100)}%</span></span>
    <span style="min-width:0;flex:1">
      <span class="row" style="--gap:6px"><span>${c.emoji}</span><strong class="truncate">${c.title}</strong></span>
      <span class="small muted">${value} / ${formatNumber(c.goal)} ${unit.unit === 'h' ? 'hours' : unit.unit}</span>
      <span class="small faint" style="display:block">${c.status === 'completed' ? 'Completed 🎉' : left > 0 ? `${left} ${left === 1 ? 'day' : 'days'} left` : 'Ends today'}</span>
    </span>
  </a>`;
}

function activityText(a, members) {
  const who = members.get(a.memberId);
  const name = html`<strong>${who?.name || 'Someone'}</strong>`;
  switch (a.type) {
    case 'join':
      return html`${name} joined the class ${who?.provider && who.provider !== 'private' ? html`with ${PROVIDERS[who.provider].name}` : ''}`;
    case 'add':
      return html`${name} added <strong>${a.track.title}</strong> by ${a.track.artist}`;
    case 'mixtape':
      return html`${name} made the mixtape <strong>${a.playlist.name}</strong>`;
    case 'playlist':
      return html`${name} shared the playlist <strong>${a.playlist.name}</strong>`;
    case 'sync':
      return html`${name} synced ${PROVIDERS[a.provider]?.name || 'their music'}`;
    case 'challenge':
      return html`${name} started the challenge <strong>${a.challenge.emoji} ${a.challenge.title}</strong>`;
    default:
      return name;
  }
}

export function activityFeed(list, members, limit = 8) {
  if (!list.length) return html`<p class="faint small">Nothing happened yet.</p>`;
  return html`<div class="feed">${list.slice(0, limit).map((a) => html`<div class="feed-item">
    ${avatar(members.get(a.memberId), { size: 34 })}
    <div class="feed-text">${activityText(a, members)}<div class="feed-time">${timeAgo(a.at)}</div></div>
  </div>`)}</div>`;
}

export const homeView = {
  title: () => `${state.data?.class?.name || 'Class'} · Home`,
  render() {
    const s = state.stats;
    const cls = state.data.class;
    const me = state.me;
    const t = s.totals;
    const chart = s.chart;
    const moves = rankMovement(chart, previousRanks(ranksOf(chart)));
    const myStats = me ? s.memberStats.get(me.id) : null;
    const activeChallenges = s.challenges.filter((c) => c.status === 'active' || c.status === 'upcoming').slice(0, 3);
    const shownChallenges = activeChallenges.length ? activeChallenges : s.challenges.slice(0, 2);
    const fresh = s.activity.filter((a) => a.type === 'add' && a.note).slice(0, 3);
    const spark = s.byDay.map((d) => d.minutes);
    const connected = Object.entries(t.providers).filter(([p, n]) => p !== 'private' && n).reduce((a, [, n]) => a + n, 0);
    const newSongsWeek = s.activity.filter((a) => a.type === 'add' && Date.now() - a.at < 7 * 86400000).length;

    const providerParts = PROVIDER_CHART_ORDER.map((p) => ({ label: PROVIDERS[p].name, value: t.providers[p] || 0, color: PROVIDERS[p].chart, ink: '#0b0b12' }));

    return html`<div class="page">
      ${demoBanner()}
      <header class="page-header">
        <div>
          <div class="row" style="--gap:10px"><span class="eyebrow">${cls.emoji} ${cls.name}</span><span class="chip chip-live">Live</span></div>
          <h1 class="mt-1">${greeting()}, ${firstName(me?.name)} 👋</h1>
          <p class="subtitle">Here is what ${cls.name} is listening to right now.</p>
        </div>
        <div class="actions">
          <a class="btn" href="#/recap">${icon('sparkles', { size: 18 })}Class recap</a>
          <button type="button" class="btn btn-primary" data-action="add-songs">${icon('plus', { size: 18 })}Add songs</button>
        </div>
      </header>

      <section class="grid grid-4" aria-label="Class statistics">
        ${statTile({ iconName: 'headphones', label: 'Listening this week', value: formatHours(t.minutesWeek), unit: 'h', foot: delta(t.minutesWeek, t.minutesPrevWeek), extra: sparkline(spark) })}
        ${statTile({ iconName: 'users', label: 'Classmates', value: formatNumber(t.members), foot: html`${connected} connected a music app` })}
        ${statTile({ iconName: 'music', label: 'Different songs', value: formatNumber(t.songs), foot: newSongsWeek ? `+${newSongsWeek} added this week` : `${t.playlists} playlists shared` })}
        ${statTile({ iconName: 'mic-vocal', label: 'Artists', value: formatNumber(t.artists), foot: s.artists[0] ? html`Top: ${s.artists[0].name}` : '' })}
      </section>

      <div class="home-grid section">
        <div class="stack" style="--gap:18px;min-width:0">
          ${chart.length
            ? heroSong(chart[0])
            : html`<div class="card">${empty({ emoji: '🎶', title: 'No songs yet', text: 'Be the first! Add a few songs you love - or connect Spotify.', action: html`<button type="button" class="btn btn-primary" data-action="add-songs">${icon('plus', { size: 18 })}Add songs</button>` })}</div>`}

          ${chart.length > 1
            ? html`<section class="card">
                ${sectionHeader('Class top 10', { link: '#/charts', linkLabel: 'Full charts', subtitle: 'Most listened, loved and added songs' })}
                <div class="track-list">
                  ${chart.slice(1, 10).map((e) => trackRow(e.track, {
                    rank: e.rank,
                    move: moves.get(e.key),
                    sub: html`${e.track.artist}<span class="hide-sm faint"> · ${plural(e.listeners.size, 'listener')}</span>`,
                    right: html`${state.me ? likeButton(e, state.me.likes?.includes(e.key)) : ''}${moreButton(e.key, `More about ${e.track.title}`)}`,
                  }))}
                </div>
              </section>`
            : ''}

          <section class="card">
            ${sectionHeader('Listening time', { subtitle: 'Hours your class listened per day (last 14 days)' })}
            ${listeningColumns(s.byDay, { label: 'Class listening time per day, last 14 days' })}
          </section>

          ${fresh.length
            ? html`<section>
                <div class="section-title"><h2>Fresh picks</h2><span class="faint small">why your classmates love their songs</span></div>
                <div class="grid grid-3">
                  ${fresh.map((a) => {
                    const who = s.membersById.get(a.memberId);
                    rememberTrack(a.track);
                    return html`<article class="quote-card">
                      <blockquote>${a.note}</blockquote>
                      <div class="row" style="--gap:10px">
                        <button type="button" class="track-cover-btn" data-action="play" data-key="${a.track.key}" aria-label="Play a preview of ${a.track.title}">${cover(a.track, { size: 40 })}${playOverlay(a.track.key)}</button>
                        <div style="min-width:0"><div class="track-title" style="font-size:14px">${a.track.title}</div><div class="small faint truncate">${who?.name || 'Someone'} · ${timeAgo(a.at)}</div></div>
                      </div>
                    </article>`;
                  })}
                </div>
              </section>`
            : ''}
        </div>

        <aside class="stack" style="--gap:18px;min-width:0" aria-label="Class activity">
          <section class="card">
            ${sectionHeader('Challenges', { link: '#/challenges', linkLabel: 'All' })}
            ${shownChallenges.length ? html`<div class="stack" style="--gap:4px">${shownChallenges.map(challengeMini)}</div>` : html`<p class="faint small">No challenges yet.</p>`}
          </section>

          ${me
            ? html`<section class="card card-glow">
                ${sectionHeader('Your week')}
                <div class="grid grid-2" style="gap:12px">
                  <div><div class="stat-value" style="font-size:26px">${formatMinutes(myStats?.minutesWeek || 0)}</div><div class="small faint">listened</div></div>
                  <div><div class="stat-value" style="font-size:26px">${formatNumber(me.songs?.length || 0)}</div><div class="small faint">songs added</div></div>
                </div>
                <div class="row wrap mt-3" style="--gap:8px">
                  <button type="button" class="btn btn-sm btn-primary" data-action="log-time">${icon('timer', { size: 16 })}Log time</button>
                  <a class="btn btn-sm" href="#/me">${icon('user', { size: 16 })}My profile</a>
                </div>
              </section>`
            : ''}

          ${s.artists.length
            ? html`<section class="card">
                ${sectionHeader('Top artists', { link: '#/charts?tab=artists', linkLabel: 'All' })}
                <div class="stack" style="--gap:2px">
                  ${s.artists.slice(0, 5).map((a, i) => html`<button type="button" class="track no-rank" style="width:100%;border:0;background:none;text-align:left;color:inherit" data-action="play" data-key="${a.topSong.key}" aria-label="Play ${a.topSong.track.title} by ${a.name}">
                    ${cover({ ...a.topSong.track, key: a.topSong.key }, { size: 44, cls: 'is-round' })}
                    <div class="track-main"><div class="track-title">${i + 1}. ${a.name}</div><div class="track-sub">${plural(a.listeners.size, 'listener')} · ${plural(a.songs.length, 'song')}</div></div>
                    <span></span>
                  </button>`)}
                </div>
              </section>`
            : ''}

          <section class="card">
            ${sectionHeader('How your class joined')}
            ${segmentedBar(providerParts, { label: 'How classmates joined' })}
          </section>

          <section class="card">
            ${sectionHeader('Latest activity')}
            ${activityFeed(s.activity, s.membersById, 7)}
          </section>
        </aside>
      </div>
    </div>`;
  },
};
