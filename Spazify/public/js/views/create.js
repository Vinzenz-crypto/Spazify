import { html } from '../lib/html.js';
import { icon } from '../lib/icons.js';
import { state, createClass } from '../store.js';
import { startJoinForNewClass } from './join.js';
import { toast } from '../ui/overlays.js';

const CLASS_EMOJIS = ['🇬🇧', '🎧', '🎸', '🏫', '📚', '⭐', '🦁', '🌍', '🚀', '🎤', '🔥', '💜'];

export const createView = {
  title: () => 'Create a class',
  render() {
    return html`<div class="join-wrap">
      <div class="card join-card">
        <h1 tabindex="-1">Create a class</h1>
        <p class="muted mt-1">You get a code that your classmates can use to join. Perfect for teachers - or for the student who organises everything.</p>
        ${!state.apiAvailable
          ? html`<div class="banner mt-3">${icon('cloud-off', { size: 18 })}<span>Sharing is not available on this copy of the website, so the class will only exist on this device. (Deploy the site from Git on Netlify to share it - see “Site setup”.)</span></div>`
          : ''}
        <form class="stack mt-3" style="--gap:18px" data-create>
          <label class="field"><span class="label">Class name</span>
            <input class="input" name="name" required maxlength="48" placeholder="e.g. English 10b" autocomplete="off"></label>
          <div class="field"><span class="label">Class emoji</span>
            <div class="emoji-grid" role="radiogroup" aria-label="Class emoji">${CLASS_EMOJIS.map((e, i) => html`<button type="button" data-emoji="${e}" class="${i === 0 ? 'is-active' : ''}" aria-label="${e}" aria-pressed="${i === 0}">${e}</button>`)}</div>
          </div>
          <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('sparkles', { size: 18 })}Create class</button>
        </form>
        <p class="small faint mt-3">The class starts with four group challenges. You can delete them or add your own later.</p>
      </div>
      <p class="center mt-3"><a class="link" href="#/join">I already have a class code</a></p>
    </div>`;
  },
  mount(el) {
    let emoji = CLASS_EMOJIS[0];
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-emoji]');
      if (!b) return;
      emoji = b.dataset.emoji;
      el.querySelectorAll('[data-emoji]').forEach((x) => {
        x.classList.toggle('is-active', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
    el.querySelector('[data-create]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.classList.add('is-loading');
      try {
        const res = await createClass({ name: e.target.name.value, emoji });
        startJoinForNewClass(res.class, res.kind);
        location.hash = `#/join`;
      } catch (err) {
        btn.classList.remove('is-loading');
        toast(err.message, { type: 'error' });
      }
    });
    setTimeout(() => el.querySelector('input[name="name"]')?.focus({ preventScroll: true }), 50);
  },
};
