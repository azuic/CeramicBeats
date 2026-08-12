/* audio.js — the kiln: nine struck materials and the clock that strikes them.
 *
 * Each hit gets its own BufferSource and its own gain node rather than being
 * retriggered on a shared player, because a sixteenth-note hi-hat pattern
 * overlaps itself constantly and a shared player would cut its own tail. The
 * nodes are disposed on ended, so the churn is bounded by the decay length.
 *
 * Velocity and playback rate are jittered a little on every hit. Nine samples
 * played back identically sixteen times a bar stop sounding like struck pots
 * within two bars — the variation is what keeps it sounding like a hand. */

const Kiln = (() => {

  const S = {
    ready: false,
    buffers: null,
    trims: [],
    master: null,
    seq: null,
    playing: false,
    onStep: null,
  };

  /* A quiet balance pass over the generated samples, in dB. The strike sounds
   * are peak-normalised in the pipeline, which flattens exactly the difference
   * that makes a dull material dull, so a little of it is put back here. */
  const TRIM = {
    terracotta: -1, porcelain: -4, earthenware: -1.5, ceramic: -3,
    faience: -4, clay: 0, pottery: -2, stoneware: -1, fritware: -5,
  };

  /* How far each material's pitch is allowed to wander per hit. A dense,
   * ringing body has a definite pitch and must not warble; a dead one is all
   * transient and can take much more. */
  const WANDER = {
    terracotta: 0.05, porcelain: 0.015, earthenware: 0.05, ceramic: 0.03,
    faience: 0.025, clay: 0.07, pottery: 0.05, stoneware: 0.035, fritware: 0.02,
  };

  function load(onReady) {
    S.master = new Tone.Volume(-3).toMaster();

    const urls = {};
    for (const m of Materials.list) urls[m.name] = 'sounds/' + m.name + '.wav';

    for (const m of Materials.list) {
      S.trims[Materials.names.indexOf(m.name)] =
        new Tone.Volume(TRIM[m.name] || 0).connect(S.master);
    }

    const done = () => {
      if (S.ready) return;
      S.ready = true;
      if (onReady) onReady();
    };
    S.buffers = new Tone.Buffers(urls, done);
    // A missing or unplayable sample must not leave the transport dead: come up
    // anyway and let the tracks that did load play.
    setTimeout(done, 6000);

    S.seq = new Tone.Sequence((time, step) => {
      if (S.onStep) S.onStep(time, step);
    }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], '16n');
    S.seq.start(0);
  }

  /* The browser will not make a sound until a gesture says so. */
  function unlock() {
    if (Tone.context.state !== 'running') Tone.context.resume();
    if (Tone.start) Tone.start();
  }

  function strike(track, time, velocity) {
    if (!S.buffers) return;
    const name = Materials.names[track];
    let buffer;
    try {
      buffer = S.buffers.get(name);
    } catch (e) {
      return;
    }
    if (!buffer || !buffer.loaded) return;

    const wander = WANDER[name] || 0.03;
    const src = new Tone.BufferSource(buffer);
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * wander;

    const gain = new Tone.Gain(velocity === undefined ? 1 : velocity);
    src.connect(gain);
    gain.connect(S.trims[track] || S.master);

    src.onended = () => { src.dispose(); gain.dispose(); };
    src.start(time === undefined ? Tone.context.currentTime : time);
  }

  /* An audition tap, for clicking a pad while the transport is stopped. */
  function tap(track) {
    unlock();
    strike(track, undefined, 0.9);
  }

  function play() {
    unlock();
    Tone.Transport.start();
    S.playing = true;
  }

  function pause() {
    Tone.Transport.pause();
    S.playing = false;
  }

  function stop() {
    Tone.Transport.stop();
    S.playing = false;
  }

  function setBpm(bpm) { Tone.Transport.bpm.value = bpm; }

  function draw(fn, time) { Tone.Draw.schedule(fn, time); }

  return {
    load, unlock, strike, tap, play, pause, stop, setBpm, draw,
    get playing() { return S.playing; },
    get ready() { return S.ready; },
    set onStep(fn) { S.onStep = fn; },
  };
})();
