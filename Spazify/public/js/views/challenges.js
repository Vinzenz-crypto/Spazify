import { html } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { CHALLENGE_UNITS } from '../lib/aggregate.js';
import { meter, progressRing, rankedBars } from '../lib/charts.js';
import { confetti } from '../lib/confetti.js';
import { daysLeft, formatDate, formatHours, formatMinutes, formatNumber, storage } from '../lib/util.js';
import { state, deleteChallenge } from '../store.js';
import { avatar, avatarStack, empty } from '../ui/components.js';
import { openCreateChallenge } from '../ui/modals.js';
import { confirmDialog, toast } from '../ui/overlays.js';
import { demoBanner } from './home.js';

const CELEBRATED_KEY = 'spazify.celebrated.v1';

function valueText(c, v = c.value) {
  return c.type === 'minutes' ? formatHours(v * 60) : formatNumber(v);
}

function unitText(c) {
  const u = CHALLENGE_UNITS[c.type].unit;
  return u === 'h' ? 'hours' : u;
}

function statusBadge(c) {
  if (c.status === 'completed') return html`<span class="badge badge-done">${icon('check', { size: 12, stroke: 3 })}Completed</span>`;
  if (c.status === 'ended') return html`<span class="badge badge-ended">Ended</span>`;
  if (c.status === 'upcoming') return html`<span class="badge">Starts ${formatDate(c.startAt)}</span>`;
  const left = daysLeft(c.endAt);
  return html`<span class="badge badge-active">${icon('hourglass', { size: 12 })}${left > 1 ? `${left} days left` : left === 1 ? '1 day left' : 'Last day'}</span>`;
}

function challengeCard(c) {
  const s = state.stats;
  const me = state.me;
  const canDelete = me && (c.createdBy === me.id || me.role === 'owner');
  const creator = c.createdBy ? s.membersById.get(c.createdBy) : null;
  const contributors = c.contributors.slice(0, 5);
  const amountText = (a) => (c.type === 'minutes' ? formatMinutes(a) : formatNumber(a));
  const remaining = Math.max(0, c.goal - c.value);
  const members = c.type === 'members' ? s.members.filter((m) => m.joinedAt <= c.endAt) : [];
  return html`<article class="card challenge ${c.status === 'completed' ? 'is-completed' : ''}" id="ch-${c.id}">
    <div class="challenge-top">
      <span class="challenge-emoji" aria-hidden="true">${c.emoji}</span>
      <div style="min-width:0;flex:1">
        <div class="row wrap" style="--gap:8px">${statusBadge(c)}</div>
        <h2 class="challenge-title mt-1">${c.title}</h2>
        ${c.description ? html`<p class="challenge-desc">${c.description}</p>` : ''}
      </div>
      <span class="ring-wrap">${progressRing(c.pct, { size: 76, stroke: 8, label: `${Math.round(c.pct * 100)} percent done` })}<span class="ring-text">${Math.round(c.pct * 100)}%</span></span>
    </div>
    <div>
      <div class="challenge-progress"><span class="value">${valueText(c)}</span><span class="goal">/ ${formatNumber(c.goal)} ${unitText(c)}</span>
        ${c.status === 'active' && remaining > 0 ? html`<span class="small faint" style="margin-left:auto">${valueText(c, remaining)} ${unitText(c)} to go</span>` : ''}
      </div>
      <div class="mt-1">${meter(c.pct, { label: `${c.title}: ${Math.round(c.pct * 100)} percent` })}</div>
    </div>
    ${contributors.length && c.type !== 'members'
      ? html`<div>
          <div class="eyebrow" style="margin-bottom:6px">Top contributors</div>
          ${rankedBars(
            contributors.map((x) => {
              const m = s.membersById.get(x.memberId);
              return { label: m?.name || 'Someone', value: x.amount, prefix: avatar(m, { size: 26 }) };
            }),
            { valueLabel: amountText, max: contributors[0].amount, caption: `Top contributors to ${c.title}` },
          )}
        </div>`
      : ''}
    ${c.type === 'members' ? html`<div class="row" style="--gap:10px">${avatarStack(members, { max: 9, size: 30 })}</div>` : ''}
    <div class="row wrap small faint" style="--gap:12px">
      <span>${formatDate(c.startAt)} – ${formatDate(c.endAt)}</span>
      ${creator ? html`<span>· by ${creator.name}</span>` : ''}
      ${c.type === 'minutes' && c.status === 'active' ? html`<button type="button" class="btn btn-sm btn-primary" style="margin-left:auto" data-action="log-time">${icon('timer', { size: 16 })}Log time</button>` : ''}
      ${c.type === 'songs' && c.status === 'active' ? html`<button type="button" class="btn btn-sm btn-primary" style="margin-left:auto" data-action="add-songs">${icon('plus', { size: 16 })}Add songs</button>` : ''}
      ${c.type === 'members' && c.status === 'active' ? html`<button type="button" class="btn btn-sm btn-primary" style="margin-left:auto" data-action="share-class">${icon('user-plus', { size: 16 })}Invite</button>` : ''}
      ${canDelete ? html`<button type="button" class="btn btn-ghost btn-xs" data-delete-challenge="${c.id}" aria-label="Delete ${c.title}">${icon('trash-2', { size: 14 })}</button>` : ''}
    </div>
  </article>`;
}

export const challengesView = {
  title: () => 'Group challenges',
  render() {
    const list = state.stats.challenges;
    const active = list.filter((c) => c.status === 'active' || c.status === 'upcoming');
    const done = list.filter((c) => c.status === 'completed');
    const ended = list.filter((c) => c.status === 'ended');
    return html`<div class="page">
      ${demoBanner()}
      <header class="page-header">
        <div>
          <span class="eyebrow">${icon('trophy', { size: 14 })}${done.length} of ${list.length} completed</span>
          <h1 class="mt-1">Group challenges</h1>
          <p class="subtitle">Reach goals together as a class. Every song, every minute and every classmate counts.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn" data-action="log-time">${icon('timer', { size: 18 })}Log listening time</button>
          <button type="button" class="btn btn-primary" data-new-challenge>${icon('plus', { size: 18 })}New challenge</button>
        </div>
      </header>
      ${list.length
        ? html`
          ${active.length ? html`<section class="grid grid-2">${active.map(challengeCard)}</section>` : html`<div class="card">${empty({ emoji: '🏁', title: 'No active challenges', text: 'Start a new one - for example 20 hours of music this week!' })}</div>`}
          ${done.length ? html`<section class="section"><div class="section-title"><h2>Completed 🎉</h2></div><div class="grid grid-2">${done.map(challengeCard)}</div></section>` : ''}
          ${ended.length ? html`<section class="section"><div class="section-title"><h2>Ended</h2></div><div class="grid grid-2">${ended.map(challengeCard)}</div></section>` : ''}`
        : html`<div class="card">${empty({ emoji: '🏆', title: 'No challenges yet', text: 'Create the first group goal for your class.', action: html`<button type="button" class="btn btn-primary" data-new-challenge>${icon('plus', { size: 18 })}New challenge</button>` })}</div>`}
    </div>`;
  },
  mount(el) {
    el.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if (t.hasAttribute('data-new-challenge')) openCreateChallenge();
      if (t.dataset.deleteChallenge) {
        const ok = await confirmDialog({ title: 'Delete this challenge?', text: 'The progress is calculated from your music data, so nothing else gets lost.', confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        deleteChallenge(t.dataset.deleteChallenge).then(
          () => toast('Challenge deleted'),
          (err) => toast(err.message, { type: 'error' }),
        );
      }
    });
    celebrate();
  },
};

// Confetti the first time you see a completed challenge.
export function celebrate() {
  const code = state.session?.code;
  if (!code || !state.stats) return;
  const all = storage.get(CELEBRATED_KEY, {});
  const seen = new Set(all[code] || []);
  const fresh = state.stats.challenges.filter((c) => c.status === 'completed' && !seen.has(c.id));
  if (!fresh.length) return;
  fresh.forEach((c) => seen.add(c.id));
  all[code] = [...seen];
  storage.set(CELEBRATED_KEY, all);
  const message = fresh.length === 1 ? `Challenge completed: ${fresh[0].emoji} ${fresh[0].title}!` : `${fresh.length} challenges completed! 🎉`;
  setTimeout(() => {
    confetti();
    toast(message, { type: 'success', iconName: 'party-popper', timeout: 4500 });
  }, 400);
}
