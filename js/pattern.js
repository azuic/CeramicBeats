/* pattern.js — what is on the board, and how it travels.
 *
 * State is nine tracks of sixteen steps plus the tempo, the mutes and each
 * row's crop rotation. All of it fits in thirty bytes, which is what "Save
 * Beat" leans on: the whole arrangement rides in the URL fragment, so a saved
 * beat needs no server and no storage — the link is the beat. */

const Pattern = (() => {

  const TRACKS = 9, STEPS = 16;

  const S = {
    grid: Array.from({ length: TRACKS }, () => new Uint8Array(STEPS)),
    mute: new Uint8Array(TRACKS),
    offset: new Uint8Array(TRACKS),
    bpm: 120,
  };

  /* Rows are written in track order — terracotta, porcelain, earthenware,
   * ceramic, faience, clay, pottery, stoneware, fritware — so a preset reads
   * as the score it is. */
  const PRESETS = [
    {
      name: 'Kiln Floor', note: 'Four on the floor, in fired clay', bpm: 118,
      rows: [
        '1000000010000000',
        '0000000000000000',
        '0000000000100000',
        '0000000000000000',
        '0010001000100010',
        '1000100010001000',
        '0000000000000000',
        '0000100000001000',
        '1010101010101010',
      ],
    },
    {
      name: 'Amphora', note: 'A three-three-two lean, Greek and Roman', bpm: 96,
      rows: [
        '0010010000100100',
        '0000000000001000',
        '0000100000001000',
        '0000000000000000',
        '0101010101010101',
        '1000000010000000',
        '0000000100000001',
        '0000100000001000',
        '0000000000000000',
      ],
    },
    {
      name: "Potter's Wheel", note: 'Rolling sixteenths, no let-up', bpm: 140,
      rows: [
        '0001000000010000',
        '0000000000000000',
        '0000000000000000',
        '0000000010000000',
        '0010001000100010',
        '1000001000100000',
        '0000000000000000',
        '0000100000001000',
        '1111111111111111',
      ],
    },
    {
      name: 'Glaze Drift', note: 'Sparse and slow, mostly porcelain', bpm: 76,
      rows: [
        '0000000000000000',
        '1000000000100000',
        '0000000000000000',
        '0000000000000000',
        '0000100000000010',
        '1000000000000000',
        '0000001000000000',
        '0000000000001000',
        '0010000010000000',
      ],
    },
    {
      name: 'Frit & Faience', note: 'Bright bodies, Islamic wing', bpm: 128,
      rows: [
        '0000000000100000',
        '0000100000001000',
        '0010000000000010',
        '0000000000000000',
        '0001001000010010',
        '1000000010000000',
        '0000000000000000',
        '0000000000000000',
        '1010101010101010',
      ],
    },
  ];

  function get(t, s) { return S.grid[t][s]; }
  function toggle(t, s) { return (S.grid[t][s] = S.grid[t][s] ? 0 : 1); }
  function set(t, s, on) { S.grid[t][s] = on ? 1 : 0; }
  function muted(t) { return !!S.mute[t]; }
  function toggleMute(t) { return (S.mute[t] = S.mute[t] ? 0 : 1); }

  function clear() {
    for (const row of S.grid) row.fill(0);
  }

  function total() {
    let n = 0;
    for (const row of S.grid) for (const v of row) n += v;
    return n;
  }

  function apply(preset) {
    clear();
    preset.rows.forEach((row, t) => {
      for (let s = 0; s < STEPS; s++) S.grid[t][s] = row[s] === '1' ? 1 : 0;
    });
    S.bpm = preset.bpm;
    S.mute.fill(0);
  }

  /* Reshuffle turns each row's rotation to a fresh place in its material's
   * pack. Rows are turned independently: turning them together would keep the
   * board's colour relationships fixed, which is the one thing a shuffle is
   * for. */
  function reshuffle(perMaterial) {
    const n = perMaterial || 32;
    for (let t = 0; t < TRACKS; t++) S.offset[t] = Math.floor(Math.random() * n);
  }

  // ── the link ───────────────────────────────────────────────────────────
  //
  // [0]      bpm - 60
  // [1..9]   crop rotation per track
  // [10..27] the grid, one bit per step, track-major
  // [28..29] mute mask

  function encode() {
    const b = new Uint8Array(30);
    b[0] = Math.max(0, Math.min(255, S.bpm - 60));
    for (let t = 0; t < TRACKS; t++) b[1 + t] = S.offset[t];
    for (let t = 0; t < TRACKS; t++) {
      for (let s = 0; s < STEPS; s++) {
        if (!S.grid[t][s]) continue;
        const bit = t * STEPS + s;
        b[10 + (bit >> 3)] |= 1 << (bit & 7);
      }
    }
    let mask = 0;
    for (let t = 0; t < TRACKS; t++) if (S.mute[t]) mask |= 1 << t;
    b[28] = mask & 255;
    b[29] = (mask >> 8) & 255;

    let bin = '';
    for (const v of b) bin += String.fromCharCode(v);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function decode(text) {
    let bin;
    try {
      bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (e) {
      return false;
    }
    if (bin.length < 30) return false;
    const b = new Uint8Array(30);
    for (let i = 0; i < 30; i++) b[i] = bin.charCodeAt(i);

    S.bpm = Math.max(60, Math.min(200, b[0] + 60));
    for (let t = 0; t < TRACKS; t++) S.offset[t] = b[1 + t] % 32;
    for (let t = 0; t < TRACKS; t++) {
      for (let s = 0; s < STEPS; s++) {
        const bit = t * STEPS + s;
        S.grid[t][s] = (b[10 + (bit >> 3)] >> (bit & 7)) & 1;
      }
    }
    const mask = b[28] | (b[29] << 8);
    for (let t = 0; t < TRACKS; t++) S.mute[t] = (mask >> t) & 1;
    return true;
  }

  return {
    state: S, presets: PRESETS, tracks: TRACKS, steps: STEPS,
    get, set, toggle, muted, toggleMute, clear, total, apply, reshuffle,
    encode, decode,
    get bpm() { return S.bpm; },
    set bpm(v) { S.bpm = v; },
    offset(t) { return S.offset[t]; },
  };
})();
