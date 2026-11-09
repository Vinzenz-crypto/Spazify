import { html } from '../lib/html.js';
import { icon, PROVIDERS } from '../lib/icons.js';
import { listeningColumns, rankedBars } from '../lib/charts.js';
import { tasteMatch } from '../lib/aggregate.js';
import { qrSvg } from '../lib/qr.js';
import { formatDate, formatMinutes, formatNumber, lastDays, plural, timeAgo } from '../lib/util.js';
import { state, removeMember } from '../store.js';
import { avatar, empty, playlistCard, providerChip, trackRow, moreButton, likeButton } from '../ui/components.js';
import { classLink } from '../ui/modals.js';
import { confirmDialog, toast } from '../ui/overlays.js';
import { demoBanner } from './home.js';

function memberCard(m) {
  const s = state.stats;
  const st = s.memberStats.get(m.id);
  const me = state.me;
  const isMe = m.id === state.session?.memberId;
  const match = me && !isMe ? tasteMatch(me, m) || null : null;
  return html`<a class="member-card" href="#/class/${encodeURIComponent(m.id)}">
    ${avatar(m, { size: 64, badge: true })}
    <div class="m-name">${m.name}${isMe ? html` <span class="faint small">(you)</span>` : ''}</div>
    ${m.role === 'owner' ? html`<span class="badge badge-owner">${icon('crown', { size: 11 })}Owner</span>` : ''}
    <div class="m-song truncate">${st?.topSong ? html`${icon('music-2', { size: 12 })} ${st.topSong.title}` : 'No songs yet'}</div>
    <div class="m-stats"><span>${formatMinutes(st?.minutesWeek || 0)}</span><span class="faint">·</span><span>${plural(st?.songsAdded || 0, 'song')}</span></div>
    ${match !== null ? html`<span class="match">${icon('heart', { size: 12 })}${match}% match</span>` : ''}
  </a>`;
}

function listView() {
  const s = state.stats;
  const cls = state.data.class;
  const sorted = [...s.members].sort((a, b) => (s.memberStats.get(b.id)?.minutesWeek || 0) - (s.memberStats.get(a.id)?.minutesWeek || 0));
  const leaders = sorted.filter((m) => m.shareListening !== false && (s.memberStats.get(m.id)?.minutesWeek || 0) > 0).slice(0, 8);
  return html`<div class="page">
    ${demoBanner()}
    <header class="page-header">
      <div>
        <span class="eyebrow">${cls.emoji} Class code <span class="code-pill" style="font-size:12px">${cls.code}</span></span>
        <h1 class="mt-1">${cls.name}</h1>
        <p class="subtitle">${plural(s.members.length, 'classmate')} · ${formatNumber(Math.round(s.totals.minutesTotal / 60))} hours of music shared</p>
      </div>
      <div class="actions"><button type="button" class="btn btn-primary" data-action="share-class">${icon('user-plus', { size: 18 })}Invite classmates</button></div>
    </header>

    <div class="home-grid">
      <section aria-label="Classmates">
        <div class="grid grid-auto" style="--min:170px">${s.members.map(memberCard)}</div>
      </section>
      <aside class="stack" style="--gap:18px">
        <section class="card">
          <div class="card-header"><div><h2 class="card-title">Join this class</h2><div class="card-subtitle">Scan with your phone camera</div></div></div>
          <div class="row" style="--gap:16px;align-items:center">
            ${qrSvg(classLink(cls.code), { size: 120, label: `QR code to join ${cls.name}` })}
            <div><div class="big-code" style="font-size:30px">${cls.code}</div><button type="button" class="btn btn-sm mt-2" data-action="share-class">${icon('qr-code', { size: 16 })}Show big</button></div>
          </div>
        </section>
        <section class="card">
          <div class="card-header"><div><h2 class="card-title">Most listening this week</h2><div class="card-subtitle">Only classmates who share their listening time</div></div></div>
          ${leaders.length
            ? rankedBars(
                leaders.map((m) => ({ label: m.name, value: s.memberStats.get(m.id).minutesWeek, prefix: avatar(m, { size: 26 }) })),
                { valueLabel: formatMinutes, caption: 'Listening time this week' },
              )
            : html`<p class="faint small">No listening time this week yet.</p>`}
        </section>
      </aside>
    </div>
  </div>`;
}

function profileView(id) {
  const s = state.stats;
  const m = s.membersById.get(id);
  if (!m) {
    return html`<div class="page">${empty({ emoji: '🤷', title: 'Classmate not found', text: 'Maybe they left the class.', action: html`<a class="btn" href="#/class">Back to the class</a>` })}</div>`;
  }
  const st = s.memberStats.get(m.id);
  const isMe = m.id === state.session?.memberId;
  const me = state.me;
  const match = me && !isMe ? tasteMatch(me, m) || null : null;
  const canRemove = me?.role === 'owner' && !isMe;
  const days = lastDays(14).map((key) => ({ key, minutes: (m.listening?.[key]?.s || 0) + (m.listening?.[key]?.m || 0) }));
  const chartEntry = (t) => s.chartByKey.get(t.key);
  const rowRight = (t) => {
    const e = chartEntry(t);
    return html`${e && state.me ? likeButton(e, state.me.likes?.includes(e.key)) : ''}${moreButton(t.key)}`;
  };
  return html`<div class="page">
    <a class="btn btn-ghost btn-sm" href="#/class">${icon('arrow-left', { size: 16 })}Classmates</a>
    <header class="profile-head mt-2">
      ${avatar(m, { size: 96, badge: true })}
      <div style="min-width:0">
        <div class="row wrap" style="--gap:8px">${providerChip(m.provider)}${m.role === 'owner' ? html`<span class="badge badge-owner">${icon('crown', { size: 11 })}Owner</span>` : ''}${match !== null ? html`<span class="match">${icon('heart', { size: 12 })}${match}% music match with you</span>` : ''}</div>
        <h1 class="mt-1" style="font-size:clamp(30px,4vw,44px)">${m.name}${isMe ? ' (you)' : ''}</h1>
        <p class="muted small mt-1">Joined ${timeAgo(m.joinedAt)}${m.lastSyncAt && m.provider !== 'private' ? ` · synced ${timeAgo(m.lastSyncAt)}` : ''}</p>
      </div>
      ${isMe ? html`<a class="btn" href="#/me">${icon('pencil', { size: 16 })}Edit my profile</a>` : ''}
      ${canRemove ? html`<button type="button" class="btn btn-danger btn-sm" data-remove-member="${m.id}">${icon('trash-2', { size: 16 })}Remove from class</button>` : ''}
    </header>

    <section class="grid grid-4">
      <div class="card stat"><div class="stat-top">This week</div><div class="stat-value">${formatMinutes(st?.minutesWeek || 0)}</div></div>
      <div class="card stat"><div class="stat-top">All time</div><div class="stat-value">${formatMinutes(st?.minutesTotal || 0)}</div></div>
      <div class="card stat"><div class="stat-top">Songs added</div><div class="stat-value">${formatNumber(st?.songsAdded || 0)}</div></div>
      <div class="card stat"><div class="stat-top">Artists</div><div class="stat-value">${formatNumber(st?.artists || 0)}</div></div>
    </section>

    <div class="grid grid-2 section" style="align-items:start">
      <div class="stack" style="--gap:18px">
        ${(m.songs || []).length
          ? html`<section class="card"><div class="card-header"><h2 class="card-title">Songs ${isMe ? 'you' : m.name} added</h2></div>
              <div class="track-list">${m.songs.map((t) => trackRow(t, { right: rowRight(t), note: t.note }))}</div></section>`
          : ''}
        ${(m.topTracks || []).length
          ? html`<section class="card"><div class="card-header"><div><h2 class="card-title">Top songs</h2><div class="card-subtitle">From ${PROVIDERS[m.provider]?.name || 'their music app'}</div></div></div>
              <div class="track-list">${m.topTracks.slice(0, 15).map((t, i) => trackRow(t, { rank: i + 1, right: rowRight(t) }))}</div></section>`
          : ''}
        ${!(m.songs || []).length && !(m.topTracks || []).length ? html`<div class="card">${empty({ emoji: '🎧', title: 'No songs yet', text: `${m.name} hasn’t shared any songs yet.` })}</div>` : ''}
      </div>
      <div class="stack" style="--gap:18px">
        ${m.shareListening !== false
          ? html`<section class="card"><div class="card-header"><h2 class="card-title">Listening time</h2></div>${listeningColumns(days, { label: `${m.name}'s listening time, last 14 days` })}</section>`
          : html`<section class="card"><p class="faint small row" style="--gap:8px">${icon('eye-off', { size: 16 })}${m.name} keeps their listening time private.</p></section>`}
        ${(m.playlists || []).length
          ? html`<section><div class="section-title"><h2>Playlists</h2></div><div class="grid grid-auto" style="--min:160px">${m.playlists.map((p) => playlistCard({ playlist: p, owner: m, href: `#/playlists/${encodeURIComponent(m.id)}/${encodeURIComponent(p.id)}` }))}</div></section>`
          : ''}
      </div>
    </div>
    <p class="faint small mt-4">Member since ${formatDate(m.joinedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>`;
}

export const membersView = {
  title: (ctx) => (ctx.route.parts[1] ? state.stats?.membersById.get(ctx.route.parts[1])?.name || 'Classmate' : 'Classmates'),
  render(ctx) {
    return ctx.route.parts[1] ? profileView(ctx.route.parts[1]) : listView();
  },
  mount(el) {
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-remove-member]');
      if (!b) return;
      const m = state.stats.membersById.get(b.dataset.removeMember);
      const ok = await confirmDialog({ title: `Remove ${m?.name || 'this classmate'}?`, text: 'Their songs, playlists and listening time will be deleted from the class.', confirmLabel: 'Remove', danger: true });
      if (!ok) return;
      try {
        await removeMember(b.dataset.removeMember);
        toast('Removed from the class');
        location.hash = '#/class';
      } catch (err) {
        toast(err.message, { type: 'error' });
      }
    });
  },
};
