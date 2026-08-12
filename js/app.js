/* app.js — wiring.
 *
 * Load the crops, build the board, hand the transport a callback, and connect
 * the seven controls in the header to the three modules that already know how
 * to do the work. */

(async () => {

  await Tiles.load();

  // A shared link wins over the default beat; otherwise open on something
  // playable, because an empty grid teaches nobody what the thing does.
  const link = new URLSearchParams(location.hash.slice(1)).get('b');
  if (!link || !Pattern.decode(link)) {
    Pattern.apply(Pattern.presets[0]);
    Pattern.reshuffle(Tiles.state.perMaterial);
  }

  View.build();
  View.hooks = {
    tap: t => { if (!Kiln.playing && !Pattern.muted(t)) Kiln.tap(t); },
    changed: View.setCount,
  };
  View.paintAll();
  View.setBpm(Pattern.bpm);

  Kiln.load(() => View.setReady(true));
  Kiln.setBpm(Pattern.bpm);

  /* Sound is scheduled ahead on the audio clock; the board is repainted on the
   * frame that clock actually lands on, which is what Tone.Draw is for. */
  Kiln.onStep = (time, step) => {
    for (let t = 0; t < Pattern.tracks; t++) {
      if (!Pattern.get(t, step) || Pattern.muted(t)) continue;
      Kiln.strike(t, time, 0.55 + Math.random() * 0.45);
    }
    Kiln.draw(() => View.light(step), time);
  };

  // ── transport ───────────────────────────────────────────────────────────

  const playBtn = document.getElementById('playBtn');

  function togglePlay() {
    if (Kiln.playing) {
      Kiln.pause();
      View.setPlaying(false);
    } else {
      Kiln.play();
      View.setPlaying(true);
    }
  }

  playBtn.addEventListener('click', togglePlay);

  document.getElementById('stopBtn').addEventListener('click', () => {
    Kiln.stop();
    View.setPlaying(false);
    // The last lit column is drawn a frame or two behind the audio clock, so
    // clearing it immediately can lose a race with a draw already scheduled.
    setTimeout(View.unlight, 80);
  });

  const slider = document.getElementById('bpmSlider');
  slider.addEventListener('input', e => {
    Pattern.bpm = +e.target.value;
    Kiln.setBpm(Pattern.bpm);
    View.setBpm(Pattern.bpm);
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    Pattern.clear();
    View.paintAll();
  });

  // ── the header's right hand ─────────────────────────────────────────────

  document.getElementById('shuffleBtn').addEventListener('click', () => {
    Pattern.reshuffle(Tiles.state.perMaterial);
    View.paintAll();
    View.toast('Drew a new set of objects');
  });

  View.buildPresets(preset => {
    Pattern.apply(preset);
    Pattern.reshuffle(Tiles.state.perMaterial);
    Kiln.setBpm(Pattern.bpm);
    View.paintAll();
    View.setBpm(Pattern.bpm);
    View.toast(preset.name);
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const hash = '#b=' + Pattern.encode();
    const url = location.origin + location.pathname + hash;
    history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(url);
      View.toast('Link to this beat copied');
    } catch (e) {
      View.toast('Beat saved to the address bar');
    }
  });

  // ── keys ────────────────────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  });

  // The first gesture anywhere is enough to open the audio context, so the
  // very first pad click makes a sound rather than silently arming it.
  document.addEventListener('pointerdown', () => Kiln.unlock(), { once: true });

})();
