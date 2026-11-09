import { CONFIG } from '../config.js';
import { html } from '../lib/html.js';
import { icon, brandIcon } from '../lib/icons.js';
import { POINTS } from '../lib/aggregate.js';
import { state } from '../store.js';
import { spotifyRedirectUri } from '../lib/spotify.js';

export const aboutView = {
  title: () => `About ${CONFIG.appName}`,
  render() {
    return html`<div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">${icon('info', { size: 14 })}About & privacy</span>
          <h1 class="mt-1">About ${CONFIG.appName}</h1>
          <p class="subtitle">${CONFIG.appName} shows what a school class is listening to - and turns music into something you share as a group.</p>
        </div>
      </header>
      <div class="prose">
        <h2>The idea</h2>
        <p>Everybody listens to music, but nobody knows what the rest of the class is listening to. ${CONFIG.appName} brings it together: the most popular songs of the class, shared playlists and group challenges - like listening to 50 hours of music together.</p>
        <p>You can join with <strong>Spotify</strong>, <strong>Apple Music</strong> or <strong>Amazon Music</strong> - or completely <strong>privately</strong>, without any music account. Private members simply add the songs they love by hand.</p>

        <h2>How the class charts work</h2>
        <ul>
          <li>A classmate’s #1 top song gets ${POINTS.topTrack(1)} points, #2 gets ${POINTS.topTrack(2)} points and so on.</li>
          <li>Every recent play adds ${POINTS.play} points (max. ${POINTS.maxPlays} plays per person).</li>
          <li>A song added by hand gets ${POINTS.added} points.</li>
          <li>Every heart from a classmate adds ${POINTS.like} points.</li>
        </ul>
        <p>The same song from Spotify, Apple Music or a manual search counts as one song, even if it is written a little differently (for example “Remastered” versions).</p>

        <h2>Privacy</h2>
        <ul>
          <li><strong>No passwords:</strong> you log in on Spotify’s or Apple’s own website. ${CONFIG.appName} never sees your password.</li>
          <li><strong>Your login stays on your device:</strong> the access key from Spotify is only stored in your browser and is never sent to our server.</li>
          <li><strong>Only what you choose:</strong> top songs, playlists you tick and your listening time (which you can switch off). No email address, no profile picture.</li>
          <li><strong>Nicknames are fine:</strong> you don’t have to use your real name.</li>
          <li><strong>Delete any time:</strong> “Leave class & delete my data” removes everything about you from the class.</li>
          <li><strong>No ads, no tracking:</strong> fonts and icons are stored on this website, so no requests go to Google. Song search, covers and 30-second previews come from Apple’s public iTunes catalogue.</li>
        </ul>

        <h2>Good to know</h2>
        <ul>
          <li>Spotify only allows up to 5 people per app while it is in “Development Mode”. Everybody else can join privately or with Apple/Amazon Music - and still be part of the charts.</li>
          <li>Amazon Music does not offer a public connection for other apps yet, so Amazon Music users add their favourite songs by hand.</li>
          <li>Listening time from Spotify is counted from your recently played songs each time you sync.</li>
        </ul>

        <h2>Credits</h2>
        <p>${CONFIG.projectNote}. Built with plain HTML, CSS and JavaScript, hosted on Netlify. Fonts: Inter and Bricolage Grotesque (SIL Open Font License). Icons: Lucide (ISC) and Simple Icons (CC0). QR codes: qrcode-generator (MIT). Spotify, Apple Music and Amazon Music are trademarks of their owners; this project is not affiliated with them.</p>
      </div>
      <div class="row wrap mt-4" style="--gap:10px">
        ${state.session ? html`<a class="btn btn-primary" href="#/home">${icon('house', { size: 18 })}Back to the class</a>` : html`<a class="btn btn-primary" href="#/join">Join your class ${icon('arrow-right', { size: 18 })}</a>`}
        <a class="btn" href="#/setup">${icon('settings', { size: 18 })}Site setup</a>
      </div>
    </div>`;
  },
};

export const setupView = {
  title: () => 'Site setup',
  render() {
    const cfg = state.config;
    const redirect = spotifyRedirectUri();
    const item = (status, title, text) => html`<div class="status-item"><span class="status-dot ${status}"></span><div style="min-width:0;flex:1"><strong>${title}</strong><div class="muted small mt-1">${text}</div></div></div>`;
    return html`<div class="page">
      <header class="page-header">
        <div>
          <span class="eyebrow">${icon('settings', { size: 14 })}For the project team</span>
          <h1 class="mt-1">Site setup</h1>
          <p class="subtitle">Check that everything is connected. Changes are made in the Netlify dashboard (Site configuration → Environment variables), then redeploy.</p>
        </div>
      </header>
      <div class="status-list" style="max-width:860px">
        ${item(
          state.apiAvailable ? 'ok' : 'off',
          state.apiAvailable ? 'Server functions & storage: connected' : 'Server functions: not available',
          state.apiAvailable
            ? html`Classes are stored with Netlify Blobs (${cfg.storage || 'server'}) and shared between all devices.`
            : html`The site runs in “this device only” mode. Deploy it on Netlify via <strong>Add new site → Import an existing project</strong> (Git) - drag & drop uploads don’t include server functions.`,
        )}
        ${item(
          cfg.spotifyClientId ? 'ok' : 'warn',
          cfg.spotifyClientId ? 'Spotify login: ready' : 'Spotify login: not set up',
          html`<ol style="margin:6px 0 0;padding-left:18px">
            <li>Open <a class="link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">developer.spotify.com/dashboard</a> and create an app (Web API).</li>
            <li>Add this Redirect URI: <code>${redirect}</code> <button type="button" class="btn btn-xs" data-action="copy" data-copy="${redirect}">${icon('copy', { size: 14 })}Copy</button></li>
            <li>Copy the Client ID into the Netlify environment variable <code>SPOTIFY_CLIENT_ID</code> and redeploy.</li>
            <li>In “User Management”, add the Spotify accounts (name + email) of the people who want to log in - max. 5 in Development Mode. The app owner needs Spotify Premium.</li>
          </ol>`,
        )}
        ${item(
          cfg.apple ? 'ok' : 'warn',
          cfg.apple ? 'Apple Music connection: ready' : 'Apple Music connection: optional',
          html`Needs an Apple Developer Program membership. Create a MusicKit key and set <code>APPLE_TEAM_ID</code>, <code>APPLE_KEY_ID</code> and <code>APPLE_PRIVATE_KEY</code> (content of the .p8 file). Without it, Apple Music users add songs by hand.`,
        )}
        ${item('warn', 'Amazon Music: songs by hand', html`Amazon’s Music API is invite-only, so Amazon Music users pick their favourite songs by hand. ${brandIcon('amazon', { size: 14 })}`)}
        ${item(
          'ok',
          'Song search & previews',
          'Uses Apple’s free iTunes Search API - no key needed. Covers and 30-second previews are cached by the server for everyone.',
        )}
      </div>
    </div>`;
  },
};
