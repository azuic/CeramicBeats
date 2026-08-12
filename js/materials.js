/* materials.js — the nine tracks.
 *
 * These are the materials the Met's own catalogue names, in the order and with
 * the counts the collection reports, so a row of the sequencer is a row of the
 * catalogue: terracotta is the loudest thing in the museum by sheer count, and
 * fritware is the rarest of the nine.
 *
 * Each carries an accent (used for the label rule, the mute dot and the ring
 * around a struck tile) and a surface — a CSS pattern laid over the object at
 * low opacity when the tile is struck, standing in for the glaze. */

const Materials = (() => {

  const LIST = [
    {
      name: 'terracotta',
      accent: '#bc6a48',
      /* burnished cross-hatch */
      pattern: 'linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.3) 48%, rgba(255,255,255,0.3) 52%, transparent 52%),' +
               'linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.3) 48%, rgba(255,255,255,0.3) 52%, transparent 52%)',
      patternSize: '16px 16px',
    },
    {
      name: 'porcelain',
      accent: '#7a8fb8',
      /* pooled glaze eyes */
      pattern: 'radial-gradient(circle at center, rgba(255,255,255,0.75) 20%, transparent 21%)',
      patternSize: '22px 22px',
    },
    {
      name: 'earthenware',
      accent: '#c4735a',
      /* open, porous body */
      pattern: 'radial-gradient(circle, rgba(0,0,0,0.18) 2px, transparent 2.5px)',
      patternSize: '8px 8px',
    },
    {
      name: 'ceramic',
      accent: '#a08b72',
      /* throwing rings */
      pattern: 'repeating-radial-gradient(circle at 0 0, transparent 0, rgba(255,255,255,0.14) 4px, transparent 8px)',
      patternSize: '20px 20px',
    },
    {
      name: 'faience',
      accent: '#2a9da3',
      /* quartz-body checker */
      pattern: 'conic-gradient(rgba(255,255,255,0.24) 90deg, transparent 90deg 180deg, rgba(255,255,255,0.24) 180deg 270deg, transparent 270deg)',
      patternSize: '16px 16px',
    },
    {
      name: 'clay',
      accent: '#b08d2e',
      /* thumbed diagonals */
      pattern: 'linear-gradient(135deg, rgba(255,255,255,0.12) 25%, transparent 25%),' +
               'linear-gradient(225deg, rgba(255,255,255,0.12) 25%, transparent 25%)',
      patternSize: '12px 12px',
    },
    {
      name: 'pottery',
      accent: '#7f9183',
      /* coil courses */
      pattern: 'linear-gradient(0deg, rgba(255,255,255,0.26) 1px, transparent 1px)',
      patternSize: '100% 6px',
    },
    {
      name: 'stoneware',
      accent: '#6e6a62',
      /* salt-glaze speckle */
      pattern: 'radial-gradient(circle at 30% 30%, rgba(0,0,0,0.22) 1.2px, transparent 1.6px),' +
               'radial-gradient(circle at 70% 65%, rgba(255,255,255,0.32) 1px, transparent 1.4px)',
      patternSize: '10px 10px',
    },
    {
      name: 'fritware',
      accent: '#4a5ea8',
      /* lattice under a clear alkaline glaze */
      pattern: 'linear-gradient(rgba(255,255,255,0.26) 1px, transparent 1px),' +
               'linear-gradient(90deg, rgba(255,255,255,0.26) 1px, transparent 1px)',
      patternSize: '12px 12px',
    },
  ];

  const names = LIST.map(m => m.name);

  /* The accent at 55%, for the ring that reads as the glaze edge of a struck
   * tile — a full-strength rule there fights the object underneath. */
  function soft(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',0.55)';
  }

  return { list: LIST, names, count: LIST.length, soft };
})();
