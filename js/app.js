/* app.js — wiring.
 *
 * Load the crops, build the board, hand the transport a callback, and connect
 * the seven controls in the header to the three modules that already know how
 * to do the work. */

(async () => {

  await Tiles.load();

  // A shared link wins over the default beat; otherwise open on something
  // playable, because an empty grid teaches nobody what the thing does.
  const params = new URLSearchParams(location.hash.slice(1));
  const link = params.get('b');
  const shared = !!(link && Pattern.decode(link));
  if (!shared) {
    Pattern.apply(Pattern.presets[0]);
    Pattern.reshuffle(Tiles.state.perMaterial);
  }

  View.build();

  // ── the name ────────────────────────────────────────────────────────────
  //
  // A preset lends the beat its name until the beat stops being that preset:
  // the first change to the grid turns "kiln floor" into "kiln floor
  // variation", once, and from there the name is the user's to set. A name
  // typed onto the card is never touched again.

  let nameIsPreset = false;

  function namePreset(preset) {
    View.setName(preset.name);
    nameIsPreset = true;
  }

  if (shared) {
    View.setName(params.get('n') || 'shared beat');
  } else {
    namePreset(Pattern.presets[0]);
  }

  View.wireName(() => { nameIsPreset = false; });

  View.hooks = {
    tap: t => { if (!Kiln.playing && !Pattern.muted(t)) Kiln.tap(t); },
    changed: () => {
      View.setCount();
      if (nameIsPreset) {
        View.setName(View.getName() + ' variation');
        nameIsPreset = false;
      }
    },
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
    View.setName('untitled');
    nameIsPreset = false;
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
    namePreset(preset);
    View.toast(preset.name);
  });

  // The name rides in the link beside the beat, so whoever opens it sees the
  // card as it was named.
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const name = View.getName();
    const hash = '#b=' + Pattern.encode() +
      (name === 'untitled' ? '' : '&n=' + encodeURIComponent(name));
    const url = location.origin + location.pathname + hash;
    history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(url);
      View.toast('Link to this beat copied');
    } catch (e) {
      View.toast('Beat saved to the address bar');
    }
  });

  // ── about ───────────────────────────────────────────────────────────────

  const aboutBtn = document.getElementById('aboutBtn');
  const aboutPanel = document.getElementById('aboutPanel');

  function closeAbout() {
    aboutPanel.hidden = true;
    aboutBtn.setAttribute('aria-expanded', 'false');
  }

  aboutBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = aboutPanel.hidden;
    aboutPanel.hidden = !open;
    aboutBtn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (!aboutPanel.hidden && !aboutPanel.contains(e.target)) closeAbout();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAbout();
  });

  // ── the strike sheet ─────────────────────────────────────────────────────

  // The sheet is its own page. It is only fetched the first time it is opened,
  // and #strikes in the URL opens it on arrival, so it can be linked to.
  const strikesModal = document.getElementById('strikesModal');
  const strikesFrame = strikesModal.querySelector('.modal-frame');
  const strikesBtn = document.getElementById('strikesBtn');

  function openStrikes() {
    if (!strikesFrame.getAttribute('src')) strikesFrame.src = 'strikes.html';
    closeAbout();
    strikesModal.hidden = false;
    document.getElementById('strikesClose').focus();
  }
  function closeStrikes() {
    if (strikesModal.hidden) return;
    strikesModal.hidden = true;
    strikesBtn.focus();
  }

  strikesBtn.addEventListener('click', e => { e.stopPropagation(); openStrikes(); });
  document.getElementById('strikesClose').addEventListener('click', closeStrikes);
  strikesModal.addEventListener('click', e => { if (e.target === strikesModal) closeStrikes(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStrikes(); });
  if (location.hash === '#strikes') openStrikes();

  // ── keys ────────────────────────────────────────────────────────────────

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    if (!strikesModal.hidden) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  });

  // The first gesture anywhere is enough to open the audio context, so the
  // very first pad click makes a sound rather than silently arming it.
  document.addEventListener('pointerdown', () => Kiln.unlock(), { once: true });

})();
