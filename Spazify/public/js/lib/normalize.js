// Shared between the browser and the server function (keep it free of DOM / Node APIs).
// Builds a stable key for a song so that the same song coming from Spotify,
// Apple Music or a manual search is counted as ONE song in the class charts.

const NOISE_IN_BRACKETS = /\s*[([][^)\]]*\b(feat\.?|ft\.?|with|remaster(ed)?|version|edit|mix|live|from|sped up|slowed|acoustic|mono|stereo|bonus|deluxe|explicit|clean)\b[^)\]]*[)\]]/gi;
const NOISE_AFTER_DASH = /\s+-\s+.*\b(remaster(ed)?|version|edit|mix|live|mono|stereo|acoustic|sped up|slowed)\b.*$/i;

export function normText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function cleanTitle(title) {
  return String(title ?? '')
    .replace(NOISE_IN_BRACKETS, '')
    .replace(NOISE_AFTER_DASH, '')
    .trim();
}

export function primaryArtist(artist) {
  const full = String(artist ?? '').trim();
  const first = full
    .replace(/\s+x\s+/gi, ', ')
    .split(/\s*(?:,|;|&|\bfeat\.?(?=\s)|\bft\.?(?=\s)|\bwith\b)\s*/i)[0];
  return first.trim() || full;
}

export function trackKey(title, artist) {
  const t = normText(cleanTitle(title));
  const a = normText(primaryArtist(artist));
  return `${t}|${a}`.slice(0, 200);
}

export function artistKey(artist) {
  return normText(primaryArtist(artist)).slice(0, 120);
}
