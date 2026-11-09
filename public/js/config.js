// ─────────────────────────────────────────────────────────────────────────────
//  Spazify settings - change the name or the texts of the site here.
// ─────────────────────────────────────────────────────────────────────────────
export const CONFIG = {
  appName: 'Spazify',
  tagline: 'Your class. Your soundtrack.',

  // Spotify "Client ID" from https://developer.spotify.com/dashboard
  // The recommended way is the Netlify environment variable SPOTIFY_CLIENT_ID
  // (see README). You only need to paste it here if your site has no server
  // functions (e.g. a drag & drop deploy).
  spotifyClientId: '',

  // The demo class works without any setup and is perfect for presentations.
  demoCode: 'DEMO',

  // How often the dashboard refreshes the class data (milliseconds).
  refreshInterval: 45000,

  // Shown in the footer.
  projectNote: 'An English class project',
};
