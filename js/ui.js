/* ui.js — the board, drawn and driven.
 *
 * The DOM is built once and then only ever has classes toggled on it: 144 pads
 * are cheap to keep around and expensive to rebuild, and the playhead touches
 * nine of them every sixteenth note. */

const View = (() => {

  const S = {
    pads: [],        // [track][step]
    cols: [],        // [step] -> pads in that column
    rows: [],
    dots: [],
    lit: -1,
    paint: null,     // the value a drag is painting, while the mouse is down
    hooks: {},
    toastTimer: 0,
  };

  const el = id => document.getElementById(id);

  function build() {
    const track = el('playheadTrack');
    for (let s = 0; s < Pattern.steps; s++) {
      const dot = document.createElement('div');
      dot.className = 'playhead-dot' + (s % 4 === 0 ? ' beat' : '');
      track.appendChild(dot);
      S.dots.push(dot);
      S.cols.push([]);
    }

    const grid = el('sequencerGrid');
    Materials.list.forEach((m, t) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.setProperty('--accent', m.accent);
      row.style.setProperty('--accent-soft', Materials.soft(m.accent));
      row.style.setProperty('--pattern', m.pattern);
      row.style.setProperty('--pattern-size', m.patternSize);

      const label = document.createElement('div');
      label.className = 'label';
      label.innerHTML =
        '<span class="label-name">' + m.name + '</span>' +
        '<span class="label-count">' + Tiles.count(m.name) + '</span>';

      const mute = document.createElement('button');
      mute.className = 'label-mute';
      mute.title = 'Mute ' + m.name;
      mute.setAttribute('aria-label', 'Mute ' + m.name);
      mute.addEventListener('click', () => {
        Pattern.toggleMute(t);
        row.classList.toggle('muted', Pattern.muted(t));
      });
      label.appendChild(mute);
      row.appendChild(label);

      const pads = document.createElement('div');
      pads.className = 'pads';
      S.pads[t] = [];
      for (let s = 0; s < Pattern.steps; s++) {
        const pad = document.createElement('button');
        // Every other group of four is shaded, which is what makes the bar
        // countable without a ruler above it.
        pad.className = 'pad' + (Math.floor(s / 4) % 2 ? ' offbeat' : '');
        pad.dataset.t = t;
        pad.dataset.s = s;
        pad.innerHTML = '<span class="pad-face"></span><span class="step-highlight"></span>';
        pads.appendChild(pad);
        S.pads[t][s] = pad;
        S.cols[s].push(pad);
      }
      row.appendChild(pads);
      grid.appendChild(row);
      S.rows[t] = row;
    });

    wirePads(grid);
    wireTooltip(grid);
  }

  // ── striking pads ───────────────────────────────────────────────────────

  function padAt(e) {
    const node = e.target.closest ? e.target.closest('.pad') : null;
    return node && node.dataset.t !== undefined ? node : null;
  }

  function wirePads(grid) {
    // A drag paints whatever the first pad became, so pulling across a row
    // fills it and pulling back across a filled row empties it.
    grid.addEventListener('pointerdown', e => {
      const pad = padAt(e);
      if (!pad || e.button !== 0) return;
      const t = +pad.dataset.t, s = +pad.dataset.s;

      if (e.altKey) {
        const entry = Tiles.at(Materials.names[t], s, Pattern.offset(t));
        if (entry) window.open(Tiles.metUrl(entry.id), '_blank', 'noopener');
        return;
      }
      e.preventDefault();
      // Touch implicitly captures the pointer to the pad it started on, which
      // would send every later event to that one pad and kill the drag.
      if (pad.hasPointerCapture && pad.hasPointerCapture(e.pointerId)) {
        pad.releasePointerCapture(e.pointerId);
      }
      S.paint = Pattern.get(t, s) ? 0 : 1;
      applyPad(t, s, S.paint, true);
    });

    // Hit-testing the point rather than listening for pointerover means the
    // drag also survives leaving the board and coming back.
    window.addEventListener('pointermove', e => {
      if (S.paint === null) return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const pad = under && under.closest ? under.closest('.pad') : null;
      if (!pad || pad.dataset.t === undefined) return;
      const t = +pad.dataset.t, s = +pad.dataset.s;
      if (Pattern.get(t, s) === S.paint) return;
      applyPad(t, s, S.paint, true);
    });

    window.addEventListener('pointerup', () => { S.paint = null; });
    window.addEventListener('pointercancel', () => { S.paint = null; });
  }

  function applyPad(t, s, on, audition) {
    Pattern.set(t, s, on);
    paint(t, s);
    if (on && audition && S.hooks.tap) S.hooks.tap(t);
    if (S.hooks.changed) S.hooks.changed();
  }

  function paint(t, s) {
    const pad = S.pads[t][s];
    const on = !!Pattern.get(t, s);
    pad.classList.toggle('on', on);
    const entry = Tiles.at(Materials.names[t], s, Pattern.offset(t));
    pad.style.setProperty('--crop-pos', entry ? Tiles.position(entry.slot) : '0% 0%');
  }

  function paintAll() {
    for (let t = 0; t < Pattern.tracks; t++) {
      S.rows[t].classList.toggle('muted', Pattern.muted(t));
      for (let s = 0; s < Pattern.steps; s++) paint(t, s);
    }
    setCount();
  }

  // ── the playhead ────────────────────────────────────────────────────────

  function light(step) {
    if (S.lit === step) return;
    if (S.lit >= 0) {
      for (const pad of S.cols[S.lit]) pad.classList.remove('playing-col', 'struck');
      S.dots[S.lit].classList.remove('active');
    }
    for (const pad of S.cols[step]) {
      pad.classList.add('playing-col');
      if (pad.classList.contains('on')) pad.classList.add('struck');
    }
    S.dots[step].classList.add('active');
    S.lit = step;
  }

  function unlight() {
    if (S.lit < 0) return;
    for (const pad of S.cols[S.lit]) pad.classList.remove('playing-col', 'struck');
    S.dots[S.lit].classList.remove('active');
    S.lit = -1;
  }

  // ── chrome ──────────────────────────────────────────────────────────────

  function setPlaying(on) {
    el('playBtn').classList.toggle('playing', on);
    el('playIcon').setAttribute('href', on ? '#i-pause' : '#i-play');
    el('playBtn').setAttribute('aria-label', on ? 'Pause' : 'Play');
  }

  function setBpm(bpm) {
    el('bpmDisplay').textContent = bpm;
    el('bpmSlider').value = bpm;
  }

  function setCount() {
    const n = Pattern.total();
    el('selectedCount').textContent = n === 1 ? '1 tile set' : n + ' tiles set';
  }

  function setReady(ready) {
    el('engineDot').classList.toggle('ready', ready);
    el('engineLabel').textContent = ready ? 'Audio engine ready' : 'Audio engine loading';
  }

  function toast(message) {
    const node = el('toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
  }

  // ── the catalogue card ──────────────────────────────────────────────────

  function wireTooltip(grid) {
    const tip = el('tooltip');
    let current = null;

    grid.addEventListener('pointermove', e => {
      const pad = padAt(e);
      if (!pad) return hide();
      const t = +pad.dataset.t, s = +pad.dataset.s;
      const entry = Tiles.at(Materials.names[t], s, Pattern.offset(t));
      if (!entry) return hide();

      if (current !== entry) {
        current = entry;
        const facts = [entry.date, entry.culture].filter(Boolean).join(' · ');
        tip.innerHTML =
          '<b></b><span></span><em>' + Materials.names[t] + ' · ⌥-click to open at The Met</em>';
        tip.querySelector('b').textContent = entry.title || 'Untitled';
        tip.querySelector('span').textContent = facts;
        tip.hidden = false;
      }
      // Flip to the other side of the cursor near the edges so the card never
      // walks off the viewport.
      const w = tip.offsetWidth, h = tip.offsetHeight;
      const x = e.clientX + 14 + w > window.innerWidth ? e.clientX - 14 - w : e.clientX + 14;
      const y = e.clientY - 8 - h < 0 ? e.clientY + 18 : e.clientY - 8 - h;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    });

    grid.addEventListener('pointerleave', hide);

    function hide() {
      current = null;
      tip.hidden = true;
    }
  }

  // ── presets ─────────────────────────────────────────────────────────────

  function buildPresets(onPick) {
    const menu = el('presetMenu');
    const button = el('presetBtn');
    Pattern.presets.forEach(p => {
      const item = document.createElement('button');
      item.innerHTML = '<span></span><small></small>';
      item.querySelector('span').textContent = p.name;
      item.querySelector('small').textContent = p.note + ' · ' + p.bpm + ' bpm';
      item.addEventListener('click', () => { close(); onPick(p); });
      menu.appendChild(item);
    });

    button.addEventListener('click', e => {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });
    document.addEventListener('click', e => {
      if (!menu.hidden && !menu.contains(e.target)) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });

    function open() { menu.hidden = false; button.setAttribute('aria-expanded', 'true'); }
    function close() { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  }

  return {
    build, paint, paintAll, light, unlight,
    setPlaying, setBpm, setCount, setReady, toast, buildPresets,
    set hooks(h) { S.hooks = h; },
  };
})();
