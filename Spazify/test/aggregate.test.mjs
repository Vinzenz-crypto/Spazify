import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeClass, buildSongChart, challengeProgress, POINTS, rankMovement, tasteMatch } from '../public/js/lib/aggregate.js';
import { buildDemoClass } from '../public/js/lib/demo.js';
import { trackKey } from '../public/js/lib/normalize.js';
import { cleanMemberInput } from '../public/js/lib/model.js';

const t = (title, artist, extra = {}) => ({ key: trackKey(title, artist), title, artist, ...extra });
const DAY = 86400000;

test('chart points: top songs, plays, added songs and hearts', () => {
  const members = [
    { id: 'a', topTracks: [t('Golden', 'HUNTR/X', { plays: 3 }), t('APT.', 'ROSÉ & Bruno Mars')], songs: [], likes: [] },
    { id: 'b', topTracks: [], songs: [t('APT', 'ROSÉ, Bruno Mars', { addedAt: 1 })], likes: [trackKey('Golden', 'HUNTR/X')] },
  ];
  const chart = buildSongChart(members);
  const golden = chart.find((e) => e.track.title === 'Golden');
  const apt = chart.find((e) => e.track.title.startsWith('APT'));
  assert.equal(golden.score, POINTS.topTrack(1) + 3 * POINTS.play + POINTS.like);
  assert.equal(apt.score, POINTS.topTrack(2) + POINTS.added, 'the same song from two sources counts once');
  assert.equal(apt.listeners.size, 2);
  assert.equal(chart[0].track.title, 'APT.', 'two classmates beat one (49 vs 41 points)');
  assert.equal(chart.length, 2);
});

test('challenge progress for every type', () => {
  const now = Date.UTC(2026, 10, 9, 12);
  const start = now - 5 * DAY;
  const end = now + 5 * DAY;
  const day = (offset) => new Date(now + offset * DAY);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const members = [
    { id: 'a', joinedAt: start, listening: { [key(day(0))]: { s: 60, m: 30 }, [key(day(-20))]: { s: 600, m: 0 } }, songs: [t('A', 'X', { addedAt: now })], topTracks: [t('B', 'Y')] },
    { id: 'b', joinedAt: start + 1, listening: { [key(day(-1))]: { s: 0, m: 30 } }, songs: [t('C', 'X', { addedAt: start - DAY })], topTracks: [] },
  ];
  const minutes = challengeProgress({ type: 'minutes', goal: 2, startAt: start, endAt: end }, members, now);
  assert.equal(minutes.value, 2, '120 minutes inside the range = 2 hours');
  assert.equal(minutes.status, 'completed');
  assert.equal(minutes.contributors[0].memberId, 'a');
  const songs = challengeProgress({ type: 'songs', goal: 5, startAt: start, endAt: end }, members, now);
  assert.equal(songs.value, 1, 'songs added before the start do not count');
  assert.equal(songs.status, 'active');
  const artists = challengeProgress({ type: 'artists', goal: 2, startAt: start, endAt: end }, members, now);
  assert.equal(artists.value, 2);
  const people = challengeProgress({ type: 'members', goal: 3, startAt: start, endAt: now - DAY }, members, now);
  assert.equal(people.value, 2);
  assert.equal(people.status, 'ended');
});

test('rank movement markers', () => {
  const chart = [{ key: 'a', rank: 1 }, { key: 'b', rank: 2 }, { key: 'c', rank: 3 }];
  const moves = rankMovement(chart, { a: 2, b: 2 });
  assert.deepEqual(moves.get('a'), { type: 'up', by: 1 });
  assert.deepEqual(moves.get('b'), { type: 'same' });
  assert.deepEqual(moves.get('c'), { type: 'new' });
});

test('taste match', () => {
  const a = { topTracks: [t('Golden', 'HUNTR/X'), t('Espresso', 'Sabrina Carpenter')], songs: [] };
  const b = { topTracks: [], songs: [t('Manchild', 'Sabrina Carpenter'), t('Golden', 'HUNTR/X')] };
  const c = { topTracks: [t('Roller', 'Apache 207')], songs: [] };
  assert.ok(tasteMatch(a, b) > 50);
  assert.equal(tasteMatch(a, c), 0);
});

test('demo class is complete and passes validation', () => {
  const now = Date.now();
  const demo = buildDemoClass(now);
  const stats = analyzeClass(demo, { now });
  assert.equal(stats.totals.members, 25);
  assert.ok(stats.chart.length >= 50);
  assert.ok(stats.challenges.some((c) => c.status === 'completed'));
  assert.ok(stats.challenges.some((c) => c.status === 'active'));
  for (const m of demo.members) {
    const clean = cleanMemberInput(m, now);
    assert.equal(clean.name, m.name);
    assert.equal(clean.topTracks.length, m.topTracks.length, `${m.name}: top tracks survive validation`);
  }
});
