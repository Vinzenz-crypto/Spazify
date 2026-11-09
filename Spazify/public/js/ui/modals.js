// The dialogs of the app: add songs, log listening time, song menu, share
// class, create challenge / mixtape, edit profile, personal key.
import { html, safeUrl, setHTML } from '../lib/html.js';
import { icon, brandIcon } from '../lib/icons.js';
import { searchSongs, listenLinks, SearchError } from '../lib/music.js';
import { trackKey } from '../lib/normalize.js';
import { CHALLENGE_TEMPLATES, LIMITS } from '../lib/model.js';
import { CHALLENGE_UNITS } from '../lib/aggregate.js';
import { qrSvg } from '../lib/qr.js';
import { debounce, formatDuration, dateKey, DAY, formatMinutes } from '../lib/util.js';
import { openModal, toast } from './overlays.js';
import { cover, avatar, rememberTrack, avatarStack, eq } from './components.js';
import {
  state,
  addSong,
  hasSong,
  updateSongNote,
  removeSong,
  addToMixtape,
  logMinutes,
  createChallenge,
  createMixtape,
  updateProfile,
  personalKey,
  isDemo,
} from '../store.js';

export const EMOJIS = ['🎧', '🦊', '🐼', '🐸', '🦄', '🐙', '🐯', '🦉', '🐳', '🌵', '🍕', '🎸', '🚀', '🌙', '⚡', '🔥', '🍀', '🐧', '🦋', '🌈', '🍩', '🐢', '🦖', '👾', '😎', '🤖', '👻', '🐝', '🍓', '🌸', '🎮', '⚽'];
export const MIX_EMOJIS = ['🎶', '🔥', '💜', '🌧️', '🚌', '📚', '💪', '🌃', '☀️', '🎉', '🎤', '📼', '🌊', '🍂', '❄️', '💤'];
export const HUES = [265, 290, 330, 0, 20, 40, 145, 175, 200, 225];

export function classLink(code) {
  const url = new URL('./', window.location.href);
  url.search = '';
  url.hash = `#/join/${code}`;
  return url.href;
}

// ---------------------------------------------------------------------------
// Add songs (search the iTunes catalogue, or type the song by hand)
// ---------------------------------------------------------------------------
export function openAddSongs({ playlistId = null, playlistName = '' } = {}) {
  const toPlaylist = Boolean(playlistId);
  const added = new Set();
  let results = [];
  let lastTerm = '';
  let searching = false;
  let errorText = '';

  const modal = openModal({
    title: toPlaylist ? `Add songs to “${playlistName}”` : 'Add songs you love',
    body: html`<div class="stack" style="--gap:14px">
      ${!toPlaylist ? html`<p class="muted small">Your songs show up in the class charts. Add a short note about why you love them - in English, of course 😉</p>` : ''}
      <div class="input-icon">
        ${icon('search')}
        <input class="input" type="search" placeholder="Search a song or an artist…" autocomplete="off" enterkeyhint="search" aria-label="Search songs" data-search>
      </div>
      <div data-results aria-live="polite"></div>
      <details class="manual-add">
        <summary class="small faint" style="cursor:pointer">Can't find your song? Add it by hand</summary>
        <form class="stack mt-2" style="--gap:10px" data-manual>
          <input class="input" name="title" placeholder="Song title" required maxlength="120" aria-label="Song title">
          <input class="input" name="artist" placeholder="Artist" required maxlength="120" aria-label="Artist">
          <button class="btn btn-secondary" type="submit">${icon('plus', { size: 18 })}Add song</button>
        </form>
      </details>
    </div>`,
    initialFocus: '[data-search]',
  });

  const resultsEl = modal.body.querySelector('[data-results]');
  const input = modal.body.querySelector('[data-search]');

  const isAdded = (t) => (toPlaylist ? added.has(t.key) : hasSong(t.key) || added.has(t.key));

  function suggestions() {
    const chart = state.stats?.chart || [];
    return chart
      .filter((e) => !isAdded(e.track))
      .slice(0, 8)
      .map((e) => e.track);
  }

  function row(t, i) {
    rememberTrack(t);
    const done = isAdded(t);
    return html`<div class="result ${done ? 'is-added' : ''}" data-row="${i}">
      <button type="button" class="track-cover-btn" data-action="play" data-key="${t.key}" aria-label="Play a preview of ${t.title}">${cover(t, { size: 46 })}<span class="play-overlay">${icon('play', { size: 18 })}</span></button>
      <div class="track-main">
        <div class="track-title">${t.title}</div>
        <div class="track-sub">${t.artist}${t.album ? ` · ${t.album}` : ''}${t.duration ? ` · ${formatDuration(t.duration)}` : ''}</div>
      </div>
      ${done
        ? html`<span class="chip chip-live" style="padding-left:9px">Added</span>`
        : html`<button type="button" class="btn btn-sm btn-primary" data-add="${i}">${icon('plus', { size: 16 })}Add</button>`}
    </div>
    ${done && !toPlaylist && added.has(t.key) ? noteEditor(t) : ''}`;
  }

  function noteEditor(t) {
    const mine = state.me?.songs?.find((s) => s.key === t.key);
    if (!mine) return '';
    return html`<form class="row" style="--gap:8px;padding:0 8px 10px 66px" data-note="${t.key}">
      <input class="input" style="min-height:40px;font-size:14px;padding:8px 12px" name="note" maxlength="${LIMITS.note}" placeholder="Why do you love it? (optional)" value="${mine.note || ''}" aria-label="Your note about ${t.title}">
      <button class="btn btn-sm" type="submit">Save</button>
    </form>`;
  }

  function draw() {
    const term = input.value.trim();
    if (!term) {
      const sugg = suggestions();
      setHTML(
        resultsEl,
        sugg.length
          ? html`<div class="eyebrow mt-1" style="margin-bottom:6px">${icon('flame', { size: 14 })}Popular in your class</div><div class="search-results">${sugg.map((t, i) => row(t, i))}</div>`
          : html`<p class="faint small center" style="padding:16px">Type to search millions of songs.</p>`,
      );
      results = sugg;
      return;
    }
    if (searching && !results.length) {
      setHTML(resultsEl, html`<div class="stack" style="--gap:8px">${[1, 2, 3, 4].map(() => html`<div class="skeleton" style="height:58px"></div>`)}</div>`);
      return;
    }
    if (errorText) {
      setHTML(resultsEl, html`<div class="banner">${icon('cloud-off', { size: 18 })}<span>${errorText}</span></div>`);
      return;
    }
    if (!results.length) {
      setHTML(resultsEl, html`<p class="faint small center" style="padding:16px">No songs found for “${term}”. Try another spelling - or add it by hand below.</p>`);
      return;
    }
    setHTML(resultsEl, html`<div class="search-results">${results.map((t, i) => row(t, i))}</div>`);
  }

  const runSearch = debounce(async () => {
    const term = input.value.trim();
    if (!term) {
      searching = false;
      draw();
      return;
    }
    lastTerm = term;
    searching = true;
    errorText = '';
    results = [];
    draw();
    try {
      const found = await searchSongs(term, { limit: 20 });
      if (lastTerm !== term) return;
      results = found.map((t) => ({ ...t, key: trackKey(t.title, t.artist) }));
    } catch (err) {
      if (lastTerm !== term) return;
      errorText = err instanceof SearchError ? err.message : 'Search failed. Please try again.';
    } finally {
      if (lastTerm === term) {
        searching = false;
        draw();
      }
    }
  }, 350);

  input.addEventListener('input', () => {
    searching = Boolean(input.value.trim());
    if (!input.value.trim()) results = [];
    runSearch();
    if (!input.value.trim()) draw();
  });

  async function add(t) {
    try {
      if (toPlaylist) await addToMixtape(playlistId, t);
      else await addSong(t);
      added.add(t.key);
      draw();
      toast(toPlaylist ? `Added “${t.title}”` : `“${t.title}” is now in your songs`, { type: 'success' });
      if (!toPlaylist) modal.body.querySelector(`[data-note="${CSS.escape(t.key)}"] input`)?.focus();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  }

  modal.body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (btn) {
      const t = results[Number(btn.dataset.add)];
      if (t) {
        btn.classList.add('is-loading');
        add(t);
      }
    }
  });

  modal.body.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (form.matches('[data-note]')) {
      const key = form.dataset.note;
      await updateSongNote(key, form.note.value).then(
        () => toast('Note saved', { type: 'success' }),
        (err) => toast(err.message, { type: 'error' }),
      );
      return;
    }
    if (form.matches('[data-manual]')) {
      const title = form.title.value.trim();
      const artist = form.artist.value.trim();
      if (!title || !artist) return;
      const t = { title, artist, source: 'manual', key: trackKey(title, artist) };
      await add(t);
      form.reset();
      if (!toPlaylist) {
        results = [t, ...results.filter((r) => r.key !== t.key)];
        draw();
      }
    }
  });

  draw();
  return modal;
}

// ---------------------------------------------------------------------------
// Log listening time (for everybody - especially private members)
// ---------------------------------------------------------------------------
export function openLogTime() {
  let minutes = 30;
  let day = dateKey();
  const days = [0, 1, 2, 3].map((n) => {
    const d = new Date(Date.now() - n * DAY);
    return { key: dateKey(d), label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long' }) };
  });
  const presets = [15, 30, 45, 60, 90, 120, 180];
  const connected = state.me?.provider === 'spotify' || state.me?.provider === 'apple';
  const modal = openModal({
    title: 'Log listening time',
    body: html`<div class="stack" style="--gap:18px">
      <p class="muted">How long did you listen to music? It counts for the class challenges.</p>
      ${connected ? html`<div class="banner is-info">${icon('info', { size: 18 })}<span>Your ${state.me.provider === 'spotify' ? 'Spotify' : 'Apple Music'} plays are counted automatically when you sync. Only add extra time here (e.g. radio or a concert).</span></div>` : ''}
      <div class="field">
        <span class="label">Day</span>
        <div class="segmented" role="group" aria-label="Day" style="flex-wrap:wrap;border-radius:18px">${days.map((d) => html`<button type="button" data-day="${d.key}" class="${d.key === day ? 'is-active' : ''}" aria-pressed="${d.key === day}">${d.label}</button>`)}</div>
      </div>
      <div class="field">
        <span class="label">Time</span>
        <div class="row wrap" style="--gap:8px">${presets.map((p) => html`<button type="button" class="btn btn-sm ${p === minutes ? 'btn-white' : ''}" data-min="${p}">${formatMinutes(p)}</button>`)}</div>
        <label class="row mt-1" style="--gap:10px"><input class="input" type="number" inputmode="numeric" min="1" max="600" value="${minutes}" style="max-width:120px" data-custom aria-label="Minutes"><span class="muted">minutes</span></label>
      </div>
    </div>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="button" class="btn btn-primary" data-save>${icon('timer', { size: 18 })}Log time</button>`,
  });
  const custom = modal.el.querySelector('[data-custom]');
  modal.el.addEventListener('click', async (e) => {
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) {
      day = dayBtn.dataset.day;
      modal.el.querySelectorAll('[data-day]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.day === day);
        b.setAttribute('aria-pressed', String(b.dataset.day === day));
      });
    }
    const minBtn = e.target.closest('[data-min]');
    if (minBtn) {
      minutes = Number(minBtn.dataset.min);
      custom.value = minutes;
      modal.el.querySelectorAll('[data-min]').forEach((b) => b.classList.toggle('btn-white', Number(b.dataset.min) === minutes));
    }
    if (e.target.closest('[data-save]')) {
      const value = Number(custom.value);
      if (!Number.isFinite(value) || value < 1) {
        toast('Please enter the minutes you listened.', { type: 'error' });
        return;
      }
      modal.close();
      try {
        await logMinutes(Math.min(600, value), day);
        toast(`+${formatMinutes(Math.min(600, value))} for your class!`, { type: 'success', iconName: 'headphones' });
      } catch (err) {
        toast(err.message, { type: 'error' });
      }
    }
  });
  custom.addEventListener('input', () => {
    minutes = Number(custom.value) || 0;
    modal.el.querySelectorAll('[data-min]').forEach((b) => b.classList.toggle('btn-white', Number(b.dataset.min) === minutes));
  });
}

// ---------------------------------------------------------------------------
// Song menu: listen links, preview, add, who likes it
// ---------------------------------------------------------------------------
export function openSongMenu(track, entry = null) {
  rememberTrack(track);
  const links = listenLinks(entry?.track || track);
  const members = state.stats?.membersById;
  const listeners = entry ? [...entry.listeners].map((id) => members?.get(id)).filter(Boolean) : [];
  const notes = (entry?.adds || []).filter((a) => a.note).slice(0, 3);
  const mine = hasSong(track.key);
  const mixtapes = (state.me?.playlists || []).filter((p) => p.source === 'spazify');
  const modal = openModal({
    title: track.title,
    body: html`<div class="stack" style="--gap:18px">
      <div class="row" style="--gap:16px">
        ${cover(entry?.track || track, { size: 92 })}
        <div style="min-width:0">
          <div class="muted">${track.artist}</div>
          ${track.album ? html`<div class="faint small">${track.album}</div>` : ''}
          <button type="button" class="btn btn-sm btn-white mt-2" data-action="play" data-key="${track.key}">${icon('play', { size: 16 })}Play preview</button>
        </div>
      </div>
      ${entry ? html`<div class="row wrap small muted" style="--gap:14px">
        <span><strong class="tabular" style="color:var(--text)">#${entry.rank}</strong> in the class charts</span>
        <span>${entry.listeners.size} ${entry.listeners.size === 1 ? 'listener' : 'listeners'}</span>
        <span>${entry.likedBy.size} ${entry.likedBy.size === 1 ? 'heart' : 'hearts'}</span>
      </div>` : ''}
      ${listeners.length ? html`<div class="row" style="--gap:10px">${avatarStack(listeners, { max: 8, size: 30 })}<span class="small faint">listen to this</span></div>` : ''}
      ${notes.length ? html`<div class="stack" style="--gap:8px">${notes.map((n) => {
        const who = members?.get(n.memberId);
        return html`<div class="quote-card" style="padding:14px"><blockquote style="font-size:14.5px">${n.note}</blockquote><div class="row small faint" style="--gap:8px">${avatar(who, { size: 22 })}${who?.name || 'Someone'}</div></div>`;
      })}</div>` : ''}
      <div class="field">
        <span class="label">Listen on</span>
        <div class="grid grid-2" style="gap:8px">
          ${links.map((l) => html`<a class="btn btn-sm" href="${safeUrl(l.url)}" target="_blank" rel="noopener noreferrer">${l.id === 'youtube' ? icon('play', { size: 16 }) : brandIcon(l.id, { size: 16 })}${l.label}</a>`)}
        </div>
      </div>
      ${state.me
        ? html`<div class="row wrap" style="--gap:8px">
            ${mine
              ? html`<button type="button" class="btn btn-sm btn-ghost" data-remove-mine>${icon('trash-2', { size: 16 })}Remove from my songs</button>`
              : html`<button type="button" class="btn btn-sm btn-primary" data-add-mine>${icon('plus', { size: 16 })}Add to my songs</button>`}
            ${mixtapes.length ? html`<select class="select" style="min-height:36px;width:auto;padding:4px 12px;font-size:14px;border-radius:999px" data-mixtape aria-label="Add to a mixtape"><option value="">Add to a mixtape…</option>${mixtapes.map((p) => html`<option value="${p.id}">${p.emoji || '🎶'} ${p.name}</option>`)}</select>` : ''}
          </div>`
        : ''}
    </div>`,
  });
  modal.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add-mine]')) {
      modal.close();
      addSong(track).then(
        () => toast(`“${track.title}” is now in your songs`, { type: 'success' }),
        (err) => toast(err.message, { type: 'error' }),
      );
    }
    if (e.target.closest('[data-remove-mine]')) {
      modal.close();
      removeSong(track.key).then(
        () => toast('Removed from your songs'),
        (err) => toast(err.message, { type: 'error' }),
      );
    }
  });
  modal.el.querySelector('[data-mixtape]')?.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) return;
    const p = mixtapes.find((x) => x.id === id);
    try {
      await addToMixtape(id, entry?.track || track);
      toast(`Added to “${p?.name}”`, { type: 'success' });
      modal.close();
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  });
}

// ---------------------------------------------------------------------------
// Share the class (code + QR + link)
// ---------------------------------------------------------------------------
export function openShareClass() {
  const cls = state.data?.class;
  if (!cls) return;
  const link = classLink(cls.code);
  const demo = isDemo();
  openModal({
    title: 'Invite your classmates',
    body: html`<div class="share-box">
      <p class="muted">Scan the QR code or enter the class code on ${location.host || 'the website'}.</p>
      ${qrSvg(link, { size: 220, label: `QR code for joining ${cls.name}` })}
      <div>
        <div class="eyebrow" style="justify-content:center">Class code</div>
        <div class="big-code mt-1">${cls.code}</div>
      </div>
      ${demo ? html`<div class="banner is-info" style="text-align:left">${icon('info', { size: 18 })}<span>This is the demo class - it only exists on your device. Create your own class to invite real classmates.</span></div>` : ''}
      <div class="row wrap" style="justify-content:center;--gap:8px">
        <button type="button" class="btn btn-primary" data-action="copy" data-copy="${link}">${icon('link', { size: 18 })}Copy invite link</button>
        <button type="button" class="btn" data-action="copy" data-copy="${cls.code}">${icon('copy', { size: 18 })}Copy code</button>
      </div>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// Personal key (use your profile on another device)
// ---------------------------------------------------------------------------
export function openPersonalKey() {
  const key = personalKey();
  const url = new URL('./', window.location.href);
  url.search = '';
  url.hash = `#/key/${encodeURIComponent(key)}`;
  openModal({
    title: 'Your personal key',
    body: html`<div class="share-box">
      <p class="muted">With this key you can use your profile on another device (e.g. your phone). Keep it secret - whoever has it can change your songs.</p>
      ${qrSvg(url.href, { size: 200, label: 'QR code with your personal key' })}
      <div class="key-box">${key}</div>
      <button type="button" class="btn btn-primary" data-action="copy" data-copy="${key}">${icon('copy', { size: 18 })}Copy key</button>
    </div>`,
  });
}

// ---------------------------------------------------------------------------
// Create a challenge
// ---------------------------------------------------------------------------
export function openCreateChallenge() {
  let type = 'minutes';
  const tpl = () => CHALLENGE_TEMPLATES.find((t) => t.type === type);
  const today = new Date();
  const inDays = (n) => dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n));
  const modal = openModal({
    title: 'New group challenge',
    wide: true,
    body: html`<form class="stack" style="--gap:18px" data-form id="challenge-form">
      <div class="field">
        <span class="label">What should your class do together?</span>
        <div class="grid grid-2" style="gap:10px" role="radiogroup" aria-label="Challenge type">
          ${CHALLENGE_TEMPLATES.map((t) => html`<label class="check-card">
            <input type="radio" name="type" value="${t.type}" ${t.type === type ? 'checked' : ''}>
            <span style="font-size:24px">${t.emoji}</span>
            <span style="min-width:0"><strong style="display:block">${t.label}</strong><span class="small faint">${t.help}</span></span>
          </label>`)}
        </div>
      </div>
      <div class="grid grid-2" style="gap:14px">
        <label class="field"><span class="label">Title</span><input class="input" name="title" required maxlength="60" value="${tpl().title}"></label>
        <label class="field"><span class="label">Emoji</span><input class="input" name="emoji" maxlength="8" value="${tpl().emoji}"></label>
      </div>
      <label class="field"><span class="label">Description</span><textarea class="textarea" name="description" maxlength="200">${tpl().description}</textarea></label>
      <div class="grid grid-2" style="gap:14px">
        <label class="field"><span class="label">Goal (<span data-unit>${CHALLENGE_UNITS[type].unit === 'h' ? 'hours' : CHALLENGE_UNITS[type].unit}</span>)</span><input class="input" type="number" name="goal" min="1" max="100000" required value="${tpl().goal}"></label>
        <label class="field"><span class="label">Ends on</span><input class="input" type="date" name="end" required min="${inDays(1)}" max="${inDays(366)}" value="${inDays(tpl().days)}"></label>
      </div>
    </form>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="challenge-form" class="btn btn-primary">${icon('trophy', { size: 18 })}Start challenge</button>`,
  });
  const form = modal.el.querySelector('form');
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'type') return;
    type = e.target.value;
    const t = tpl();
    form.title.value = t.title;
    form.emoji.value = t.emoji;
    form.description.value = t.description;
    form.goal.value = t.goal;
    form.end.value = inDays(t.days);
    modal.el.querySelector('[data-unit]').textContent = CHALLENGE_UNITS[type].unit === 'h' ? 'hours' : CHALLENGE_UNITS[type].unit;
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.el.querySelector('button[type="submit"]');
    btn.classList.add('is-loading');
    const [y, m, d] = form.end.value.split('-').map(Number);
    try {
      await createChallenge({
        type,
        title: form.title.value,
        emoji: form.emoji.value,
        description: form.description.value,
        goal: Number(form.goal.value),
        startAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
        endAt: new Date(y, m - 1, d, 23, 59, 59).getTime(),
      });
      modal.close();
      toast('Challenge started - let’s go! 🚀', { type: 'success' });
    } catch (err) {
      btn.classList.remove('is-loading');
      toast(err.message, { type: 'error' });
    }
  });
}

// ---------------------------------------------------------------------------
// Create a mixtape (a playlist made inside the app)
// ---------------------------------------------------------------------------
export function openCreateMixtape(onCreated) {
  let emoji = MIX_EMOJIS[0];
  let color = HUES[0];
  const modal = openModal({
    title: 'New mixtape',
    body: html`<form class="stack" style="--gap:16px" id="mixtape-form">
      <p class="muted small">A mixtape is a playlist you build right here - no music app needed.</p>
      <label class="field"><span class="label">Name</span><input class="input" name="name" required maxlength="80" placeholder="e.g. Songs for the class trip"></label>
      <label class="field"><span class="label">Description <span class="faint">(optional)</span></span><textarea class="textarea" name="description" maxlength="300" placeholder="What is this mixtape about?"></textarea></label>
      <div class="field"><span class="label">Emoji</span><div class="emoji-grid">${MIX_EMOJIS.map((e) => html`<button type="button" data-emoji="${e}" class="${e === emoji ? 'is-active' : ''}" aria-label="${e}">${e}</button>`)}</div></div>
      <div class="field"><span class="label">Colour</span><div class="color-row">${HUES.map((h) => html`<button type="button" data-hue="${h}" class="${h === color ? 'is-active' : ''}" style="--h:${h}" aria-label="Colour ${h}"></button>`)}</div></div>
    </form>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="mixtape-form" class="btn btn-primary">${icon('list-plus', { size: 18 })}Create mixtape</button>`,
    initialFocus: 'input[name="name"]',
  });
  modal.el.addEventListener('click', (e) => {
    const eb = e.target.closest('[data-emoji]');
    if (eb) {
      emoji = eb.dataset.emoji;
      modal.el.querySelectorAll('[data-emoji]').forEach((b) => b.classList.toggle('is-active', b === eb));
    }
    const hb = e.target.closest('[data-hue]');
    if (hb) {
      color = Number(hb.dataset.hue);
      modal.el.querySelectorAll('[data-hue]').forEach((b) => b.classList.toggle('is-active', b === hb));
    }
  });
  modal.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    try {
      const id = await createMixtape({ name: form.name.value.trim(), description: form.description.value.trim(), emoji, color });
      modal.close();
      toast('Mixtape created - now add some songs!', { type: 'success' });
      onCreated?.(id);
    } catch (err) {
      toast(err.message, { type: 'error' });
    }
  });
}

// ---------------------------------------------------------------------------
// Profile (name + avatar)
// ---------------------------------------------------------------------------
export function avatarPicker(current) {
  return html`<div class="stack" style="--gap:14px">
    <div class="field"><span class="label">Avatar</span><div class="emoji-grid" data-emoji-grid>${EMOJIS.map((e) => html`<button type="button" data-emoji="${e}" class="${e === current.emoji ? 'is-active' : ''}" aria-label="${e}">${e}</button>`)}</div></div>
    <div class="field"><span class="label">Colour</span><div class="color-row">${HUES.map((h) => html`<button type="button" data-hue="${h}" class="${h === current.color ? 'is-active' : ''}" style="--h:${h}" aria-label="Colour ${h}"></button>`)}</div></div>
  </div>`;
}

export function bindAvatarPicker(root, current, onChange) {
  root.addEventListener('click', (e) => {
    const eb = e.target.closest('[data-emoji]');
    if (eb && root.contains(eb)) {
      current.emoji = eb.dataset.emoji;
      root.querySelectorAll('[data-emoji]').forEach((b) => b.classList.toggle('is-active', b === eb));
      onChange?.(current);
    }
    const hb = e.target.closest('[data-hue]');
    if (hb && root.contains(hb)) {
      current.color = Number(hb.dataset.hue);
      root.querySelectorAll('[data-hue]').forEach((b) => b.classList.toggle('is-active', b === hb));
      onChange?.(current);
    }
  });
}

export function openEditProfile() {
  const me = state.me;
  if (!me) return;
  const current = { ...me.avatar };
  const modal = openModal({
    title: 'Edit profile',
    body: html`<form class="stack" style="--gap:18px" id="profile-form">
      <div class="row" style="--gap:14px"><span data-preview>${avatar({ avatar: current }, { size: 64 })}</span>
        <label class="field" style="flex:1"><span class="label">Name or nickname</span><input class="input" name="name" required maxlength="32" value="${me.name}"></label>
      </div>
      <div data-picker>${avatarPicker(current)}</div>
    </form>`,
    foot: html`<button type="button" class="btn btn-ghost" data-close>Cancel</button><button type="submit" form="profile-form" class="btn btn-primary">Save</button>`,
  });
  bindAvatarPicker(modal.el.querySelector('[data-picker]'), current, (a) => setHTML(modal.el.querySelector('[data-preview]'), avatar({ avatar: a }, { size: 64 })));
  modal.el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    if (!name) return;
    modal.close();
    updateProfile({ name, avatar: current }).then(
      () => toast('Profile saved', { type: 'success' }),
      (err) => toast(err.message, { type: 'error' }),
    );
  });
}

export function nowPlayingHint() {
  return html`${eq()}`;
}

