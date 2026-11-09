// "Class Recap": a full-screen story about the class (great for presenting).
import { html, setHTML } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { formatNumber, plural, prefersReducedMotion } from '../lib/util.js';
import { state } from '../store.js';
import { avatar, cover, rememberTrack } from '../ui/components.js';
import { confetti } from '../lib/confetti.js';

const DURATION = 6500;

function slides() {
  const s = state.stats;
  const cls = state.data.class;
  const hours = Math.round(s.totals.minutesMonth / 60);
  const anthem = s.chart[0];
  const topArtist = s.artists[0];
  const listeners = [...s.members].sort((a, b) => (s.memberStats.get(b.id)?.minutesWeek || 0) - (s.memberStats.get(a.id)?.minutesWeek || 0));
  const champ = listeners.find((m) => m.shareListening !== false && (s.memberStats.get(m.id)?.minutesWeek || 0) > 0);
  const collector = [...s.members].sort((a, b) => (b.songs?.length || 0) - (a.songs?.length || 0))[0];
  const genre = s.genres[0];
  const done = s.challenges.filter((c) => c.status === 'completed').length;
  const list = [];

  list.push({
    bg: 'linear-gradient(160deg,#4c1d95,#be185d 60%,#f59e0b)',
    body: html`<div class="kicker anim">${cls.emoji} ${cls.name}</div>
      <h2 class="anim" style="font-size:54px">Your class recap is here.</h2>
      <p class="anim" style="font-size:18px;opacity:.9">${plural(s.members.length, 'classmate')}. ${plural(s.totals.songs, 'song')}. One soundtrack.</p>
      <p class="anim small" style="opacity:.75">Tap to continue →</p>`,
  });

  list.push({
    bg: 'linear-gradient(160deg,#0f766e,#1d4ed8 70%,#7c3aed)',
    body: html`<div class="kicker anim">This month you listened</div>
      <div class="huge anim" data-count="${hours}">${formatNumber(hours)}</div>
      <h2 class="anim">hours of music together</h2>
      <p class="anim" style="opacity:.85;font-size:17px">${recapComparison(s.totals.minutesMonth)}</p>`,
  });

  if (anthem) {
    rememberTrack(anthem.track);
    list.push({
      bg: 'linear-gradient(160deg,#9d174d,#7c3aed 70%,#1e1b4b)',
      body: html`<div class="kicker anim">Your class anthem</div>
        <div class="anim">${cover(anthem.track, { size: 220, lazy: false })}</div>
        <h2 class="anim" style="font-size:38px">${anthem.track.title}</h2>
        <p class="anim" style="font-size:18px;opacity:.9">${anthem.track.artist} · ${plural(anthem.listeners.size, 'fan')} in your class</p>
        <div class="anim"><button type="button" class="btn btn-white" data-action="play" data-key="${anthem.key}" data-no-advance>${icon('play', { size: 18 })}Play preview</button></div>`,
    });
  }

  if (topArtist) {
    list.push({
      bg: 'linear-gradient(160deg,#b45309,#db2777 60%,#4c1d95)',
      body: html`<div class="kicker anim">Top artist</div>
        <div class="anim">${cover({ ...topArtist.topSong.track, key: topArtist.topSong.key }, { size: 200, cls: 'is-round', lazy: false })}</div>
        <h2 class="anim" style="font-size:46px">${topArtist.name}</h2>
        <p class="anim" style="font-size:17px;opacity:.9">${plural(topArtist.listeners.size, 'classmate')} listen to ${topArtist.name}. Favourite song: “${topArtist.topSong.track.title}”.</p>`,
    });
  }

  if (s.chart.length >= 3) {
    list.push({
      bg: 'linear-gradient(160deg,#1e3a8a,#6d28d9 55%,#be185d)',
      body: html`<div class="kicker anim">Your top 5</div>
        <div class="slide-list">
          ${s.chart.slice(0, 5).map((e, i) => html`<div class="item anim"><span class="n">${i + 1}</span>${cover(e.track, { size: 52, lazy: false })}<div style="min-width:0"><div class="truncate" style="font-weight:750">${e.track.title}</div><div class="truncate small" style="opacity:.8">${e.track.artist}</div></div></div>`)}
        </div>`,
    });
  }

  if (champ) {
    const st = s.memberStats.get(champ.id);
    list.push({
      bg: 'linear-gradient(160deg,#065f46,#0e7490 60%,#312e81)',
      body: html`<div class="kicker anim">Listening champion of the week</div>
        <div class="anim">${avatar(champ, { size: 120 })}</div>
        <h2 class="anim" style="font-size:48px">${champ.name}</h2>
        <p class="anim" style="font-size:18px;opacity:.9">${formatNumber(Math.round(st.minutesWeek / 60 * 10) / 10)} hours this week. Respect! 🎧</p>
        ${collector && (collector.songs?.length || 0) > 0 ? html`<p class="anim small" style="opacity:.85">Song collector: <strong>${collector.name}</strong> with ${plural(collector.songs.length, 'song')} added.</p>` : ''}`,
    });
  }

  if (genre) {
    list.push({
      bg: 'linear-gradient(160deg,#701a75,#c2410c 70%,#facc15)',
      body: html`<div class="kicker anim">Your class sound</div>
        <h2 class="anim" style="font-size:64px">${genre.name}</h2>
        <p class="anim" style="font-size:18px;opacity:.9">followed by ${s.genres.slice(1, 3).map((g) => g.name).join(' and ') || 'lots of variety'}.</p>
        <p class="anim" style="opacity:.8">${formatNumber(s.totals.artists)} different artists - what a mix!</p>`,
    });
  }

  list.push({
    bg: 'linear-gradient(160deg,#4c1d95,#db2777 55%,#f59e0b)',
    final: true,
    body: html`<div class="kicker anim">That’s a wrap</div>
      <h2 class="anim" style="font-size:50px">${done ? `${plural(done, 'challenge')} completed.` : 'Keep listening!'}</h2>
      <p class="anim" style="font-size:18px;opacity:.9">Thanks for sharing your music, ${cls.name}. 💜</p>
      <div class="row wrap anim" style="--gap:10px"><a class="btn btn-white" href="#/charts" data-no-advance>See the charts</a><button type="button" class="btn" style="--btn-bg:rgba(0,0,0,.25);color:#fff" data-restart data-no-advance>${icon('refresh-cw', { size: 16 })}Replay</button></div>`,
  });
  return list;
}

function recapComparison(minutes) {
  const songs = Math.max(1, Math.round(minutes / 3.3));
  const days = minutes / 60 / 24;
  if (days >= 1.5) return `That’s about ${formatNumber(songs)} songs - or ${formatNumber(Math.round(days * 10) / 10)} days of music without a break.`;
  return `That’s about ${plural(songs, 'song')} in a row.`;
}

let timer = null;
let index = 0;
let list = [];
let paused = false;
let startedAt = 0;
let remaining = DURATION;

function show(el, i) {
  index = Math.max(0, Math.min(list.length - 1, i));
  const frame = el.querySelector('.recap-frame');
  const slide = list[index];
  setHTML(frame.querySelector('[data-slide]'), html`<div class="slide" style="--slide-bg:${slide.bg}">${slide.body}</div>`);
  frame.querySelectorAll('.recap-bars span').forEach((b, j) => {
    b.className = j < index ? 'is-done' : j === index ? 'is-current' : '';
    b.style.setProperty('--dur', `${DURATION}ms`);
    // restart the CSS animation
    const i2 = b.querySelector('i');
    i2.style.animation = 'none';
    void i2.offsetWidth;
    i2.style.animation = '';
  });
  const counter = frame.querySelector('[data-count]');
  if (counter && !prefersReducedMotion()) countUp(counter, Number(counter.dataset.count));
  if (slide.final) setTimeout(() => confetti({ count: 120 }), 300);
  schedule(el, DURATION);
}

function countUp(node, target) {
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / 1400);
    node.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function schedule(el, ms) {
  clearTimeout(timer);
  startedAt = Date.now();
  remaining = ms;
  if (paused) return;
  timer = setTimeout(() => {
    if (index < list.length - 1) show(el, index + 1);
  }, ms);
}

function setPaused(el, value) {
  paused = value;
  el.querySelector('.recap')?.classList.toggle('is-paused', paused);
  if (paused) {
    clearTimeout(timer);
    remaining -= Date.now() - startedAt;
  } else {
    schedule(el, Math.max(500, remaining));
  }
}

export const recapView = {
  title: () => 'Class recap',
  shell: false,
  render() {
    list = slides();
    return html`<div class="recap" role="dialog" aria-modal="true" aria-label="Class recap">
      <div class="recap-frame">
        <div class="recap-bars" aria-hidden="true">${list.map(() => html`<span><i></i></span>`)}</div>
        <a class="btn btn-icon btn-sm recap-close" style="--btn-bg:rgba(0,0,0,.3);color:#fff" href="#/home" aria-label="Close recap">${icon('x', { size: 18 })}</a>
        <button type="button" class="recap-tap prev" data-prev aria-label="Previous"></button>
        <button type="button" class="recap-tap next" data-next aria-label="Next"></button>
        <div data-slide aria-live="polite"></div>
      </div>
    </div>`;
  },
  mount(el) {
    paused = false;
    show(el, 0);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-restart]')) return show(el, 0);
      if (e.target.closest('[data-no-advance]')) return;
      if (e.target.closest('[data-prev]')) return show(el, index - 1);
      if (e.target.closest('[data-next]')) return index < list.length - 1 ? show(el, index + 1) : null;
    });
    const onKey = (e) => {
      if (!el.isConnected) return document.removeEventListener('keydown', onKey);
      if (e.key === 'ArrowRight') show(el, index + 1);
      if (e.key === 'ArrowLeft') show(el, index - 1);
      if (e.key === ' ') {
        e.preventDefault();
        setPaused(el, !paused);
      }
      if (e.key === 'Escape') location.hash = '#/home';
    };
    document.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-no-advance], a')) return;
      setPaused(el, true);
    });
    el.addEventListener('pointerup', () => paused && setPaused(el, false));
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
  },
};
