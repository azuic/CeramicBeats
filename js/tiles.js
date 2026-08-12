/* tiles.js — the crops.
 *
 * pipeline/crops.py pulls 32 objects per material out of the lookbook's atlas
 * and repacks them into one 16-wide sheet, so the whole tile set is a single
 * 750KB request instead of the atlas's 75MB. A pad addresses its crop by slot
 * number, as a percentage background-position: that keeps the sprite maths
 * resolution-independent, which matters because the pad size is whatever the
 * board's width divides into sixteen.
 *
 * A row shows a contiguous run of 16 of its material's 32, rotated by an
 * offset. Contiguous is deliberate — the pack is ordered by glaze family and
 * hue, so a row reads left to right as a sweep through that material's colour
 * range rather than a scatter. Reshuffling turns the rotation. */

const Tiles = (() => {

  const S = { ready: false, cols: 16, rows: 1, perMaterial: 32, data: null };

  async function load() {
    try {
      const res = await fetch('tiles/tiles.json');
      if (!res.ok) throw new Error('tiles.json ' + res.status);
      S.data = await res.json();
    } catch (e) {
      console.warn('tiles: no crop pack — run pipeline/crops.py', e);
      return false;
    }
    const total = S.data.materials.length * S.data.perMaterial;
    S.cols = S.data.cols;
    S.rows = Math.ceil(total / S.cols);
    S.perMaterial = S.data.perMaterial;
    S.ready = true;

    const root = document.documentElement.style;
    root.setProperty('--crops', 'url("tiles/crops.webp")');
    root.setProperty('--sheet-w', S.cols * 100 + '%');
    root.setProperty('--sheet-h', S.rows * 100 + '%');
    return true;
  }

  /* The catalogue's own count for a material, used in the row label. */
  function count(name) {
    const n = S.ready && S.data.counts[name];
    return n ? n.toLocaleString('en-US') : '';
  }

  function entries(name) {
    return (S.ready && S.data.tiles[name]) || [];
  }

  /* Which of the material's 32 objects sits at this step, given the row's
   * current rotation. */
  function at(name, step, offset) {
    const list = entries(name);
    if (!list.length) return null;
    return list[(offset + step) % list.length];
  }

  /* Percentage sprite addressing: with N columns the k-th column sits at
   * k/(N-1) of the way across a background sized N x 100%. */
  function position(slot) {
    if (!S.ready) return '0% 0%';
    const c = slot % S.cols, r = Math.floor(slot / S.cols);
    const x = S.cols > 1 ? (c / (S.cols - 1)) * 100 : 0;
    const y = S.rows > 1 ? (r / (S.rows - 1)) * 100 : 0;
    return x.toFixed(4) + '% ' + y.toFixed(4) + '%';
  }

  function metUrl(id) {
    return 'https://www.metmuseum.org/art/collection/search/' + id;
  }

  return { load, count, entries, at, position, metUrl, state: S };
})();
