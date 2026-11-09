// The demo class: 25 made-up classmates with realistic listening data. It is
// generated the same way every time (seeded random numbers), so the site always
// has something beautiful to show - even without any setup or internet.
import { trackKey } from './normalize.js';
import { DAY, dateKey, seededRandom } from './util.js';
import { buildSongChart, challengeProgress } from './aggregate.js';

// title, artist, genre, length (seconds), year, popularity (1-10)
const SONGS = [
  ['Golden', 'HUNTR/X, EJAE, Audrey Nuna & REI AMI', 'K-Pop', 194, 2025, 10],
  ['APT.', 'ROSÉ & Bruno Mars', 'K-Pop', 170, 2024, 9],
  ['The Fate of Ophelia', 'Taylor Swift', 'Pop', 226, 2025, 9],
  ['BIRDS OF A FEATHER', 'Billie Eilish', 'Alternative', 210, 2024, 9],
  ['Manchild', 'Sabrina Carpenter', 'Pop', 213, 2025, 8],
  ['Ordinary', 'Alex Warren', 'Pop', 186, 2025, 8],
  ['Die With A Smile', 'Lady Gaga & Bruno Mars', 'Pop', 251, 2024, 8],
  ['Espresso', 'Sabrina Carpenter', 'Pop', 175, 2024, 7],
  ['Soda Pop', 'Saja Boys', 'K-Pop', 150, 2025, 7],
  ['back to friends', 'sombr', 'Alternative', 199, 2024, 7],
  ['luther', 'Kendrick Lamar & SZA', 'Hip-Hop', 177, 2024, 7],
  ['Blinding Lights', 'The Weeknd', 'R&B', 200, 2019, 7],
  ['Messy', 'Lola Young', 'Alternative', 284, 2024, 6],
  ['Abracadabra', 'Lady Gaga', 'Pop', 223, 2025, 6],
  ['Not Like Us', 'Kendrick Lamar', 'Hip-Hop', 274, 2024, 6],
  ['Pink Pony Club', 'Chappell Roan', 'Pop', 258, 2020, 6],
  ['Good Luck, Babe!', 'Chappell Roan', 'Pop', 218, 2024, 6],
  ['Anxiety', 'Doechii', 'Hip-Hop', 244, 2025, 6],
  ['Beautiful Things', 'Benson Boone', 'Pop', 180, 2024, 6],
  ['WILDFLOWER', 'Billie Eilish', 'Alternative', 261, 2024, 6],
  ['Mr. Brightside', 'The Killers', 'Rock', 222, 2004, 6],
  ['Cruel Summer', 'Taylor Swift', 'Pop', 178, 2019, 6],
  ['Timeless', 'The Weeknd & Playboi Carti', 'Hip-Hop', 256, 2024, 5],
  ['Sapphire', 'Ed Sheeran', 'Pop', 179, 2025, 5],
  ['undressed', 'sombr', 'Alternative', 202, 2025, 5],
  ['Just Keep Watching', 'Tate McRae', 'Pop', 169, 2025, 5],
  ['Sports car', 'Tate McRae', 'Pop', 174, 2025, 5],
  ['Lose Control', 'Teddy Swims', 'R&B', 210, 2023, 5],
  ['Too Sweet', 'Hozier', 'Alternative', 251, 2024, 5],
  ['Stargazing', 'Myles Smith', 'Pop', 172, 2024, 5],
  ['Gabriela', 'KATSEYE', 'Pop', 197, 2025, 5],
  ['Love Me Not', 'Ravyn Lenae', 'R&B', 213, 2024, 5],
  ['As It Was', 'Harry Styles', 'Pop', 167, 2022, 5],
  ['Sweater Weather', 'The Neighbourhood', 'Alternative', 240, 2012, 5],
  ['Bohemian Rhapsody', 'Queen', 'Rock', 355, 1975, 5],
  ['Komet', 'Udo Lindenberg & Apache 207', 'Deutschpop', 232, 2023, 5],
  ['Daisies', 'Justin Bieber', 'Pop', 176, 2025, 4],
  ['DtMF', 'Bad Bunny', 'Latin', 237, 2025, 4],
  ['Running Up That Hill (A Deal with God)', 'Kate Bush', 'Rock', 298, 1985, 4],
  ['Flowers', 'Miley Cyrus', 'Pop', 200, 2023, 4],
  ['Houdini', 'Dua Lipa', 'Dance', 185, 2023, 4],
  ['Training Season', 'Dua Lipa', 'Dance', 209, 2024, 4],
  ['Levitating', 'Dua Lipa', 'Dance', 203, 2020, 4],
  ['Viva La Vida', 'Coldplay', 'Rock', 242, 2008, 4],
  ['Heat Waves', 'Glass Animals', 'Alternative', 238, 2020, 4],
  ['end of beginning', 'Djo', 'Alternative', 159, 2022, 4],
  ['Snooze', 'SZA', 'R&B', 201, 2022, 4],
  ['Saturn', 'SZA', 'R&B', 186, 2024, 4],
  ['Roller', 'Apache 207', 'Deutschrap', 170, 2019, 4],
  ['Without Me', 'Eminem', 'Hip-Hop', 290, 2002, 4],
  ['Dynamite', 'BTS', 'K-Pop', 199, 2020, 4],
  ['Supernova', 'aespa', 'K-Pop', 178, 2024, 4],
  ['greedy', 'Tate McRae', 'Pop', 131, 2023, 3],
  ['Seven Nation Army', 'The White Stripes', 'Rock', 232, 2003, 3],
  ['Shape of You', 'Ed Sheeran', 'Pop', 233, 2017, 3],
  ['Paint The Town Red', 'Doja Cat', 'Hip-Hop', 231, 2023, 3],
  ['Pretty Little Baby', 'Connie Francis', 'Oldies', 137, 1962, 3],
  ['Fix You', 'Coldplay', 'Rock', 295, 2005, 3],
  ['Lovin On Me', 'Jack Harlow', 'Hip-Hop', 138, 2023, 3],
  ['Kill Bill', 'SZA', 'R&B', 153, 2022, 3],
].map(([title, artist, genre, seconds, year, pop]) => ({
  key: trackKey(title, artist),
  title,
  artist,
  genre,
  duration: seconds * 1000,
  year,
  pop,
  source: 'demo',
}));

// name, avatar emoji, avatar hue, how they joined, favourite genres
const PEOPLE = [
  ['Ms Becker', '🍎', 145, 'private', { Rock: 2, Oldies: 2, Pop: 1 }, 'owner'],
  ['Mia', '🦊', 18, 'spotify', { 'K-Pop': 3, Pop: 2 }],
  ['Leon', '🐯', 35, 'spotify', { 'Hip-Hop': 3, Deutschrap: 2 }],
  ['Emma', '🦄', 300, 'apple', { Pop: 3, Alternative: 1 }],
  ['Noah', '🐳', 205, 'private', { Rock: 3, Alternative: 2 }],
  ['Hannah', '🌙', 250, 'spotify', { Alternative: 3, 'R&B': 1 }],
  ['Ben', '🎸', 0, 'amazon', { Rock: 3, Pop: 1 }],
  ['Lina', '🌈', 330, 'private', { Pop: 2, 'K-Pop': 2 }],
  ['Finn', '🚀', 220, 'spotify', { Dance: 2, Pop: 2 }],
  ['Sophie', '🍓', 350, 'apple', { Pop: 3, 'R&B': 1 }],
  ['Elias', '🦉', 40, 'spotify', { 'Hip-Hop': 2, 'R&B': 2 }],
  ['Lea', '🐼', 160, 'private', { Alternative: 2, Pop: 2 }],
  ['Paul', '⚡', 55, 'amazon', { Rock: 2, 'Hip-Hop': 1 }],
  ['Clara', '🌸', 320, 'spotify', { Pop: 3, Alternative: 2 }],
  ['Jonas', '🎧', 190, 'private', { Deutschrap: 2, 'Hip-Hop': 2 }],
  ['Marie', '🍩', 15, 'apple', { 'K-Pop': 2, Pop: 2 }],
  ['Luca', '🐙', 275, 'spotify', { Latin: 3, Dance: 2 }],
  ['Ella', '🦋', 285, 'private', { Alternative: 2, Oldies: 1 }],
  ['Felix', '🔥', 10, 'spotify', { 'Hip-Hop': 3 }],
  ['Nora', '🍀', 130, 'amazon', { Pop: 2, Deutschpop: 2 }],
  ['Anton', '🐢', 95, 'private', { Rock: 2, Oldies: 1 }],
  ['Zoe', '💜', 270, 'spotify', { 'K-Pop': 4 }],
  ['Samir', '👾', 230, 'apple', { 'Hip-Hop': 2, 'R&B': 2 }],
  ['Aylin', '🌵', 145, 'private', { 'R&B': 2, Pop: 2 }],
  ['Mats', '🍕', 25, 'spotify', { Rock: 1, Dance: 1, Pop: 1 }],
];

const NOTES = [
  'This song gets me through every Monday morning.',
  'The chorus has been stuck in my head for a week. Help!',
  'Perfect for the long bus ride home.',
  "My older sister showed me this one and now I can't stop.",
  'Pure summer vibes, even in November.',
  'Listen with good headphones - the bass is amazing.',
  'The lyrics are actually really deep if you listen closely.',
  'We danced to this on the class trip!',
  'Best song for studying (no, really).',
  'A throwback that never gets old.',
  'Instant good mood, guaranteed.',
  'The music video is a masterpiece.',
  'I sing this in the shower every single day.',
  'This one reminds me of our holiday in Italy.',
  'It sounds even better live - I saw them last summer!',
  'My go-to song before a football match.',
  'Calm, cosy and perfect for rainy days.',
  'I could listen to this on repeat for hours.',
  'The beat drop is everything.',
  'This song taught me so many new English words.',
  'Underrated! More people need to hear this.',
  'My grandma loves this song too, believe it or not.',
  'Turn it up when you need energy for homework.',
  'The guitar solo gives me goosebumps every time.',
];

const PLAYLISTS = [
  { owner: 'Leon', name: 'Gym Hype', emoji: '💪', color: 20, source: 'spotify', genres: ['Hip-Hop', 'Deutschrap', 'Dance'], size: 14, description: 'No skips. Only energy.' },
  { owner: 'Hannah', name: 'Study Session', emoji: '📚', color: 200, source: 'spotify', genres: ['Alternative', 'R&B'], size: 12, description: 'Calm songs for homework and exam season.' },
  { owner: 'Mia', name: 'Class Trip 2026', emoji: '🚌', color: 330, source: 'spazify', genres: null, size: 16, description: 'Everything we sang on the bus to London. Sing along!' },
  { owner: 'Lina', name: 'Rainy Day Vibes', emoji: '🌧️', color: 230, source: 'spazify', genres: ['Alternative', 'Pop', 'R&B'], size: 10, description: 'Blanket, tea and these songs.' },
  { owner: 'Felix', name: 'Throwbacks', emoji: '📼', color: 45, source: 'spotify', genres: ['Rock', 'Oldies', 'Hip-Hop'], size: 12, description: 'Songs that are older than us (and still slap).', maxYear: 2012 },
  { owner: 'Sophie', name: 'Car Karaoke', emoji: '🎤', color: 300, source: 'apple', genres: ['Pop'], size: 12, description: 'Windows down, volume up.' },
  { owner: 'Elias', name: 'Late Night Drive', emoji: '🌃', color: 260, source: 'spotify', genres: ['R&B', 'Hip-Hop'], size: 11, description: 'For when the city lights are on.' },
  { owner: 'Zoe', name: 'K-Pop Starter Pack', emoji: '💜', color: 280, source: 'spotify', genres: ['K-Pop'], size: 6, description: 'New to K-Pop? Start here!' },
  { owner: 'Ms Becker', name: 'English Class Favourites', emoji: '🇬🇧', color: 210, source: 'spazify', genres: ['Rock', 'Alternative', 'Pop'], size: 10, description: 'Songs we talked about in class - great lyrics and lots of new vocabulary.' },
];

function weightedOrder(items, weightFn, rand) {
  return items
    .map((item) => ({ item, k: Math.pow(rand(), 1 / Math.max(0.0001, weightFn(item))) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.item);
}

function demoTrack(song, extra = {}) {
  const { pop, ...track } = song;
  return { ...track, ...extra };
}

export const DEMO_CLASS_INFO = { code: 'DEMO', name: 'English 10b', emoji: '🇬🇧' };

export function buildDemoClass(now = Date.now()) {
  const rand = seededRandom('spazify-demo-2026');
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const members = PEOPLE.map(([name, emoji, color, provider, tastes, role], index) => {
    // Separate random streams, so the charts look the same at any time of day.
    const taste = seededRandom(`taste-${name}`);
    const time = seededRandom(`time-${name}`);
    const id = `demo_${name.toLowerCase().replace(/[^a-z]/g, '')}`;
    const isTeacher = role === 'owner';
    const joinedAt = isTeacher ? now - 24 * DAY : now - Math.round((2 + time() * 21) * DAY) - Math.round(time() * 8) * 3600000;
    const weight = (s) => s.pop * (1 + (tastes[s.genre] || 0) * 1.6);
    const order = weightedOrder(SONGS, weight, taste);
    const connected = provider === 'spotify' || provider === 'apple';

    const topCount = provider === 'spotify' ? 18 + Math.floor(taste() * 8) : provider === 'apple' ? 12 + Math.floor(taste() * 8) : 0;
    const topTracks = order.slice(0, topCount).map((s, i) => demoTrack(s, { source: 'demo', plays: Math.max(0, Math.round((10 - i / 2) * taste())) }));

    const addCount = connected ? Math.floor(taste() * 3) : 4 + Math.floor(taste() * 5);
    const addPool = connected ? order.slice(topCount, topCount + 12) : order.slice(0, 14);
    const songs = addPool.slice(0, addCount).map((s) => {
      const addedAt = Math.min(now - 3600000, joinedAt + Math.round(time() * (now - joinedAt)));
      return demoTrack(s, { note: taste() < 0.75 ? NOTES[Math.floor(taste() * NOTES.length)] : '', addedAt });
    });

    const likes = weightedOrder(SONGS, (s) => s.pop * s.pop, taste)
      .slice(0, 3 + Math.floor(taste() * 10))
      .map((s) => s.key);
    const rand = time;

    // Listening time for the last 40 days.
    const activity = isTeacher ? 0.35 : 0.45 + rand() * 0.55;
    const listening = {};
    for (let d = 39; d >= 0; d--) {
      const day = new Date(startOfToday - d * DAY);
      if (day.getTime() < startOfToday - Math.ceil((now - joinedAt) / DAY) * DAY) continue;
      if (rand() > activity * 0.95) continue;
      const weekend = day.getDay() === 0 || day.getDay() === 6;
      let minutes = Math.round(20 + rand() * 130 * activity + (weekend ? 30 + rand() * 50 : 0));
      if (d === 0) minutes = Math.round(minutes * (0.25 + (today.getHours() / 24) * 0.75));
      if (minutes < 5) continue;
      listening[dateKey(day)] = connected ? { s: minutes, m: rand() < 0.15 ? 15 : 0 } : { s: 0, m: Math.round(minutes / 5) * 5 };
    }

    return {
      id,
      name,
      avatar: { emoji, color },
      provider,
      role: isTeacher ? 'owner' : 'member',
      joinedAt,
      updatedAt: now - Math.round(rand() * 2 * DAY),
      lastSyncAt: connected ? now - Math.round((0.2 + rand() * 20) * 3600000) : null,
      topTracks,
      songs,
      likes,
      listening,
      shareListening: true,
      playlists: [],
      _order: order,
      _index: index,
    };
  });

  const byName = new Map(members.map((m) => [m.name, m]));
  for (const p of PLAYLISTS) {
    const owner = byName.get(p.owner);
    if (!owner) continue;
    let pool = owner._order;
    if (p.genres) pool = pool.filter((s) => p.genres.includes(s.genre));
    if (p.maxYear) pool = pool.filter((s) => s.year <= p.maxYear);
    const tracks = pool.slice(0, p.size).map((s) => demoTrack(s));
    const createdAt = Math.min(now - 2 * 3600000, owner.joinedAt + Math.round(rand() * (now - owner.joinedAt) * 0.8));
    owner.playlists.push({
      id: `pl_${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: p.name,
      description: p.description,
      emoji: p.emoji,
      color: p.color,
      source: p.source,
      tracks,
      trackCount: tracks.length,
      createdAt,
      updatedAt: createdAt,
    });
  }
  members.forEach((m) => {
    delete m._order;
    delete m._index;
  });

  // Challenges - goals are picked so the demo always shows nice progress.
  const started = startOfToday - 18 * DAY;
  const teacherId = members[0].id;
  const rawChallenges = [
    { id: 'demo_marathon', title: 'Class Marathon', emoji: '🎧', type: 'minutes', description: 'Listen to music together for a whole month. Every minute counts!', startAt: started, endAt: started + 30 * DAY - 1, createdBy: teacherId, createdAt: started },
    { id: 'demo_mixtape', title: 'Mixtape Mania', emoji: '💿', type: 'songs', description: 'Everybody adds the songs they love. Can we collect them all?', startAt: started, endAt: started + 30 * DAY - 1, createdBy: teacherId, createdAt: started + 1 },
    { id: 'demo_artists', title: 'Artist Explorers', emoji: '🌍', type: 'artists', description: 'Discover as many different artists as possible.', startAt: started, endAt: started + 30 * DAY - 1, createdBy: members[1].id, createdAt: started + 2 * DAY },
    { id: 'demo_fullhouse', title: 'Full House', emoji: '🙋', type: 'members', goal: 26, description: 'Get everybody on board - one more person and we are complete!', startAt: started, endAt: startOfToday + 5 * DAY, createdBy: teacherId, createdAt: started + 3 },
  ];
  const tentative = rawChallenges.map((c) => ({ ...c, goal: c.goal || 1 }));
  const goals = {
    demo_marathon: (v) => Math.max(10, Math.ceil((v / 0.82) / 25) * 25),
    demo_mixtape: (v) => Math.max(5, Math.floor(v / 10) * 10),
    demo_artists: (v) => v + 7,
  };
  const challenges = tentative.map((c) => {
    if (!goals[c.id]) return c;
    const progress = challengeProgress(c, members, now);
    return { ...c, goal: goals[c.id](Math.round(progress.value)) };
  });

  // "Last week" chart positions so the charts can show ▲ ▼ and NEW.
  const chart = buildSongChart(members);
  const prevRand = seededRandom(`prev-${dateKey(today)}`);
  const recent = now - 3 * DAY;
  const isNew = (e) => e.topRanks.length === 0 && e.adds.every((a) => a.addedAt > recent);
  const previous = chart
    .filter((e) => !isNew(e))
    .map((e) => ({ key: e.key, v: e.rank + (prevRand() - 0.5) * 6 }))
    .sort((a, b) => a.v - b.v);
  const prevRanks = {};
  previous.forEach((p, i) => {
    prevRanks[p.key] = i + 1;
  });

  return {
    class: { ...DEMO_CLASS_INFO, createdAt: started },
    members,
    challenges,
    prevRanks,
    demo: true,
    serverTime: now,
  };
}
