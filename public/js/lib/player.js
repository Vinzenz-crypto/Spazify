// One shared audio element for 30-second song previews.
import { findPreview } from './music.js';

const audio = new Audio();
audio.preload = 'none';
const SILENT = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQIAAACAgA==';
let unlocked = false;
let current = null; // { key, track, loading, error }
const listeners = new Set();

function emit() {
  const state = getPlayerState();
  listeners.forEach((fn) => fn(state));
}

export function onPlayerChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getPlayerState() {
  return {
    current,
    playing: Boolean(current) && !audio.paused && !current.loading,
    time: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : 30,
  };
}

export function isPlaying(key) {
  return current?.key === key && !audio.paused;
}

// iOS only allows sound after a tap - so we "unlock" audio on the first tap.
function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    audio.src = SILENT;
    const p = audio.play();
    if (p) p.catch(() => {});
  } catch {
    /* ignore */
  }
}

export async function togglePreview(track) {
  if (!track) return;
  if (current?.key === track.key && !current.error) {
    if (current.loading) return;
    if (audio.paused) await audio.play().catch(() => {});
    else audio.pause();
    emit();
    return;
  }
  unlock();
  current = { key: track.key, track, loading: true, error: null };
  emit();
  const url = await findPreview(track);
  if (current?.key !== track.key) return; // something else was pressed meanwhile
  if (!url) {
    current = { ...current, loading: false, error: 'No preview available for this song.' };
    audio.pause();
    emit();
    return;
  }
  audio.src = url;
  try {
    await audio.play();
    current = { ...current, loading: false };
  } catch {
    current = { ...current, loading: false, error: 'The preview could not be played.' };
  }
  emit();
}

export function stopPreview() {
  audio.pause();
  current = null;
  emit();
}

export function seekPreview(fraction) {
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Math.min(1, Math.max(0, fraction));
}

['play', 'pause', 'ended', 'timeupdate', 'loadedmetadata'].forEach((ev) =>
  audio.addEventListener(ev, () => {
    if (ev === 'ended' && current) audio.currentTime = 0;
    emit();
  }),
);
audio.addEventListener('error', () => {
  if (current && audio.src && !audio.src.startsWith('data:')) {
    current = { ...current, loading: false, error: 'The preview could not be loaded.' };
    emit();
  }
});
