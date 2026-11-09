import { CONFIG } from '../config.js';
import { html } from '../lib/html.js';
import { icon, brandIcon } from '../lib/icons.js';
import { buildDemoClass } from '../lib/demo.js';
import { analyzeClass } from '../lib/aggregate.js';
import { formatNumber } from '../lib/util.js';
import { trackRow, likeButton } from '../ui/components.js';

let demoStats = null;
function demo() {
  if (!demoStats) demoStats = analyzeClass(buildDemoClass(Date.now()), { now: Date.now() });
  return demoStats;
}

export const landingView = {
  title: () => `${CONFIG.appName} - ${CONFIG.tagline}`,
  render() {
    const s = demo();
    const top = s.chart.slice(0, 5);
    const hours = Math.round(s.totals.minutesMonth / 60);
    const newest = s.activity.find((a) => a.type === 'add');
    const newestMember = newest ? s.membersById.get(newest.memberId) : null;
    return html`
      <div class="landing">
        <section class="hero">
          <div>
            <span class="chip">${icon('sparkles', { size: 14 })}${CONFIG.projectNote}</span>
            <h1 class="display">What does your class <span class="gradient-text">listen to?</span></h1>
            <p class="lead">Connect Spotify or Apple Music - or join privately without any account. Discover your class charts, share playlists and reach listening goals together.</p>
            <div class="hero-cta">
              <a class="btn btn-primary btn-lg" href="#/join">Join your class ${icon('arrow-right', { size: 18 })}</a>
              <a class="btn btn-lg" href="#/demo">${icon('play', { size: 18 })}Try the demo</a>
            </div>
            <div class="hero-providers">
              <span>Works with</span>
              ${brandIcon('spotify', { size: 22 })}${brandIcon('apple', { size: 22 })}${brandIcon('amazon', { size: 22 })}
              <span>- or totally private ${icon('lock', { size: 14 })}</span>
            </div>
          </div>
          <div class="hero-visual" aria-hidden="true" inert>
            <div class="mock mock-chart">
              <div class="row" style="margin-bottom:10px">
                <div>
                  <div class="eyebrow">${icon('chart-column', { size: 13 })}Class top 5</div>
                  <div class="card-title mt-1">English 10b</div>
                </div>
                <span class="chip chip-live" style="margin-left:auto">Live</span>
              </div>
              <div class="track-list">
                ${top.map((e) => trackRow(e.track, { rank: e.rank, sub: e.track.artist, size: 42, right: likeButton(e, false) }))}
              </div>
            </div>
            <div class="mock mock-chip mock-1"><span class="icon-bubble">${icon('headphones', { size: 18 })}</span><div><div class="big">${formatNumber(hours)} hours</div><div class="faint small">listened together this month</div></div></div>
            <div class="mock mock-chip mock-2"><span style="font-size:24px">🏆</span><div><div>Challenge completed!</div><div class="faint small">Mixtape Mania · 100%</div></div></div>
            ${newest
              ? html`<div class="mock mock-chip mock-3"><span style="font-size:22px">${newestMember?.avatar?.emoji || '🎧'}</span><div><div>${newestMember?.name || 'Mia'} added a song</div><div class="faint small truncate" style="max-width:200px">${newest.track.title} · ${newest.track.artist}</div></div></div>`
              : ''}
          </div>
        </section>

        <section class="feature-grid" aria-label="Features">
          ${[
            ['chart-column', 'Class charts', 'The songs your class can’t stop playing - live, with movers ▲▼ and new entries.'],
            ['list-music', 'Shared playlists', 'Show your favourite playlists or build mixtapes together - with a preview for every song.'],
            ['trophy', 'Group challenges', 'Listen 50 hours together, collect 30 favourites or discover 25 artists - as a team.'],
            ['shield-check', 'Privacy first', 'Join without any music account. You decide what you share and can delete it any time.'],
          ].map(([ic, title, text]) => html`<article class="card feature"><span class="icon-bubble">${icon(ic, { size: 22 })}</span><h3>${title}</h3><p>${text}</p></article>`)}
        </section>

        <section class="landing-section" id="how">
          <span class="eyebrow">How it works</span>
          <h2>Three steps to your class soundtrack</h2>
          <div class="steps">
            <article class="card step"><h3>Enter your class code</h3><p>Your teacher or a classmate creates the class and shares a six-letter code - or a QR code on the projector.</p></article>
            <article class="card step"><h3>Connect or stay private</h3><p>Log in with Spotify or Apple Music to share your top songs automatically - or simply pick your favourite songs by hand.</p></article>
            <article class="card step"><h3>Explore together</h3><p>See what is trending in your class, give hearts, build mixtapes and complete challenges as a team.</p></article>
          </div>
        </section>

        <section class="landing-section" id="privacy">
          <span class="eyebrow">${icon('shield-check', { size: 14 })}Your data, your choice</span>
          <h2>Share your music - not your private life</h2>
          <div class="privacy-split">
            <div class="card">
              <h3 class="card-title" style="margin-bottom:16px">What your class can see</h3>
              <ul class="privacy-list">
                <li>${icon('check', { size: 18 })}<span>Your top songs (if you connect) or the songs you add yourself</span></li>
                <li>${icon('check', { size: 18 })}<span>Only the playlists you pick</span></li>
                <li>${icon('check', { size: 18 })}<span>Your listening time - and you can switch that off</span></li>
                <li>${icon('check', { size: 18 })}<span>A nickname and an emoji - no real name needed</span></li>
              </ul>
            </div>
            <div class="card">
              <h3 class="card-title" style="margin-bottom:16px">What we never see</h3>
              <ul class="privacy-list">
                <li class="no">${icon('x', { size: 18 })}<span>Your password - you log in on Spotify’s or Apple’s own page</span></li>
                <li class="no">${icon('x', { size: 18 })}<span>Your email address or profile picture</span></li>
                <li class="no">${icon('x', { size: 18 })}<span>Anything you didn’t choose to share</span></li>
                <li class="no">${icon('x', { size: 18 })}<span>Ads or trackers - even the fonts are hosted on this site</span></li>
              </ul>
            </div>
          </div>
        </section>

        <section class="cta-band">
          <h2>Ready to find your class anthem?</h2>
          <p>It takes less than a minute. No account needed.</p>
          <div class="row wrap" style="justify-content:center;--gap:10px">
            <a class="btn btn-white btn-lg" href="#/join">Join your class ${icon('arrow-right', { size: 18 })}</a>
            <a class="btn btn-lg" style="--btn-bg:rgba(0,0,0,.25);--btn-border:rgba(255,255,255,.35);color:#fff" href="#/create">${icon('plus', { size: 18 })}Create a class</a>
          </div>
        </section>
      </div>
    `;
  },
};
