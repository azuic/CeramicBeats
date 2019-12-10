const DRUM_CLASSES = [
    'Stoneware',
    'Porcelain',
    'Terracotta',
    'Pottery',
    'Ceramic'
]

const TIME_HUMANIZATION = 0.01;

let Tone = mm.Player.tone;

let sampleBaseUrl = 'https://d1tutlfztia4ba.cloudfront.net/sounds';

let reverb = new Tone.Convolver(`${sampleBaseUrl}/10.wav`).toMaster();
reverb.wet.value = 0.35;

let snarePanner = new Tone.Panner().connect(reverb);
new Tone.LFO(0.13, -0.25, 0.25).connect(snarePanner.pan).start();

let drumKit = [
new Tone.Players({
  high: `${sampleBaseUrl}/1.wav`,
  med: `${sampleBaseUrl}/1.wav`,
  low: `${sampleBaseUrl}/1.wav` }).
toMaster(),
new Tone.Players({
  high: `${sampleBaseUrl}/2.wav`,
  med: `${sampleBaseUrl}/2.wav`,
  low: `${sampleBaseUrl}/2.wav` }).
connect(snarePanner),
new Tone.Players({
  high: `${sampleBaseUrl}/3.wav`,
  med: `${sampleBaseUrl}/3.wav`,
  low: `${sampleBaseUrl}/3.wav` }).
connect(new Tone.Panner(-0.5).connect(reverb)),
new Tone.Players({
  high: `${sampleBaseUrl}/4.wav`,
  med: `${sampleBaseUrl}/4.wav`,
  low: `${sampleBaseUrl}/4.wav` }).
connect(new Tone.Panner(-0.5).connect(reverb)),
new Tone.Players({
  high: `${sampleBaseUrl}/5.wav`,
  med: `${sampleBaseUrl}/5.wav`,
  low: `${sampleBaseUrl}/5.wav` }).
connect(new Tone.Panner(-0.4).connect(reverb)),
new Tone.Players({
  high: `${sampleBaseUrl}/6.wav`,
  med: `${sampleBaseUrl}/6.wav`,
  low: `${sampleBaseUrl}/6.wav` }).
connect(reverb),
new Tone.Players({
  high: `${sampleBaseUrl}/7.wav`,
  med: `${sampleBaseUrl}/7.wav`,
  low: `${sampleBaseUrl}/7.wav` }).
connect(new Tone.Panner(0.4).connect(reverb)),
new Tone.Players({
  high: `${sampleBaseUrl}/8.wav`,
  med: `${sampleBaseUrl}/8.wav`,
  low: `${sampleBaseUrl}/8.wav` }).
connect(new Tone.Panner(0.5).connect(reverb)),
new Tone.Players({
  high: `${sampleBaseUrl}/9.wav`,
  med: `${sampleBaseUrl}/9.wav`,
  low: `${sampleBaseUrl}/9.wav` }).
connect(new Tone.Panner(0.5).connect(reverb))];

let midiDrums = [36, 38, 42, 46, 41, 43, 45, 49, 51];
let reverseMidiMapping = new Map([
[36, 0],
[35, 0],
[38, 1],
[27, 1],
[28, 1],
[31, 1],
[32, 1],
[33, 1],
[34, 1],
[37, 1],
[39, 1],
[40, 1],
[56, 1],
[65, 1],
[66, 1],
[75, 1],
[85, 1],
[42, 2],
[44, 2],
[54, 2],
[68, 2],
[69, 2],
[70, 2],
[71, 2],
[73, 2],
[78, 2],
[80, 2],
[46, 3],
[67, 3],
[72, 3],
[74, 3],
[79, 3],
[81, 3],
[45, 4],
[29, 4],
[41, 4],
[61, 4],
[64, 4],
[84, 4],
[48, 5],
[47, 5],
[60, 5],
[63, 5],
[77, 5],
[86, 5],
[87, 5],
[50, 6],
[30, 6],
[43, 6],
[62, 6],
[76, 6],
[83, 6],
[49, 7],
[55, 7],
[57, 7],
[58, 7],
[51, 8],
[52, 8],
[53, 8],
[59, 8],
[82, 8]]);


let temperature = 1.0;

let outputs = {
  internal: {
    play: (drumIdx, velocity, time) => {
      drumKit[drumIdx].get(velocity).start(time);
    } } };



let rnn = new mm.MusicRNN(
'https://storage.googleapis.com/download.magenta.tensorflow.org/tfjs_checkpoints/music_rnn/drum_kit_rnn');

Promise.all([
rnn.initialize(),
new Promise(res => Tone.Buffer.on('load', res))]).
then(([vars]) => {
  let state = {
    patternLength: 11,
    seedLength: 4,
    swing: 0.45,
    pattern: [[0], [], [2]].concat(_.times(11, i => [])),
    tempo: 120 };

  let stepEls = [],
  hasBeenStarted = false,
  oneEighth = Tone.Time('8n').toSeconds(),
  activeOutput = 'internal',
  midiClockSender = null,
  midiClockStartSent = false,
  activeClockInput = 'none',
  currentSchedulerId,
  stepCounter;

  function generatePattern(seed, length) {
    let seedSeq = toNoteSequence(seed);
    return rnn.
    continueSequence(seedSeq, length, temperature).
    then(r => seed.concat(fromNoteSequence(r, length)));
  }

  function getStepVelocity(step) {
    if (step % 4 === 0) {
      return 'high';
    } else if (step % 2 === 0) {
      return 'med';
    } else {
      return 'low';
    }
  }

  function humanizeTime(time) {
    return time - TIME_HUMANIZATION / 2 + Math.random() * TIME_HUMANIZATION;
  }

  function tick(time = Tone.now() - Tone.context.lookAhead) {
    if (_.isNumber(stepCounter) && state.pattern) {
      stepCounter++;
      if (midiClockSender) midiClockSender(time, stepCounter);

      let stepIdx = stepCounter % state.pattern.length;
      let isSwung = stepIdx % 2 !== 0;
      if (isSwung) {
        time += (state.swing - 0.5) * oneEighth;
      }
      let velocity = getStepVelocity(stepIdx);
      let drums = state.pattern[stepIdx];
      drums.forEach(d => {
        let humanizedTime = stepIdx === 0 ? time : humanizeTime(time);
        outputs[activeOutput].play(d, velocity, humanizedTime);
        visualizePlay(humanizedTime, stepIdx, d);
      });
    }
  }

  function startPattern() {
    stepCounter = -1;
    midiClockStartSent = false;
    updatePlayPauseIcons();
  }

  function stopPattern() {
    stepCounter = null;
    updatePlayPauseIcons();
  }

  function visualizePlay(time, stepIdx, drumIdx) {
    Tone.Draw.schedule(() => {
      if (!stepEls[stepIdx]) return;
      let animTime = oneEighth * 4 * 1000;
      let cellEl = stepEls[stepIdx].cellEls[drumIdx];
      if (cellEl.classList.contains('on')) {
        let baseColor = stepIdx < state.seedLength ? '#FFAC00' : '#4C57FF';
        cellEl.animate(
        [
        {
          transform: 'translateZ(-100px)',
          backgroundColor: '#fad1df' },

        {
          transform: 'translateZ(50px)',
          offset: 0.7 },

        { transform: 'translateZ(0)', backgroundColor: baseColor }],

        { duration: animTime, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });

      }
    }, time);
  }

  const tiles=[['315034', '308376', '5740', '453211', '473404'],
    ['315827', '308295', '6007', '450142', '450377'],
    ['307695', '310358', '20755', '448267', '558314'],
    ['668', '307862', '348', '452835', '452450'],
    ['313193', '308550', '20744', '450361', '558281'],
    ['313187', '309302', '8826', '449748', '559124'],
    ['5983', '308521', '2707', '449762', '559089'],
    ['670', '314680', '16001', '447245', '554918'],
    ['501265', '308438', '19000', '449801', '474781'],
    ['3467', '310550', '14209', '449048', '558256'],
    ['307580', '308294', '6106', '454004', '558265'],
    ['314637', '310449', '8042', '449744', '447271']];

  function renderPattern(regenerating = false) {
    console.log(state.pattern.length);
    let seqEl = document.querySelector('.sequencer .steps');
    while (stepEls.length > state.pattern.length) {
      console.log(state.pattern.length);
      let { stepEl, gutterEl } = stepEls.pop();
      stepEl.remove();
      if (gutterEl) gutterEl.remove();
    }
    for (let stepIdx = 0; stepIdx < state.pattern.length; stepIdx++) {
      console.log(state.pattern.length);
      let step = state.pattern[stepIdx];
      let stepEl, gutterEl, cellEls,currentTiles;
      if (stepEls[stepIdx]) {
        stepEl = stepEls[stepIdx].stepEl;
        gutterEl = stepEls[stepIdx].gutterEl;
        cellEls = stepEls[stepIdx].cellEls;

      } else {
        stepEl = document.createElement('div');
        stepEl.classList.add('step');
        stepEl.dataset.stepIdx = stepIdx;
        seqEl.appendChild(stepEl);
        cellEls = [];
        // currentTiles=[];
      }

      stepEl.style.flex = stepIdx % 2 === 0 ? state.swing : 1 - state.swing;

      if (!gutterEl && stepIdx < state.pattern.length - 1) {
        gutterEl = document.createElement('div');
        gutterEl.classList.add('gutter');
        seqEl.insertBefore(gutterEl, stepEl.nextSibling);
      } else if (gutterEl && stepIdx >= state.pattern.length) {
        gutterEl.remove();
        gutterEl = null;
      }
      currentTiles = tiles[stepIdx];
      if (gutterEl && stepIdx === state.seedLength - 1) {
        gutterEl.classList.add('seed-marker');
      } else if (gutterEl) {
        gutterEl.classList.remove('seed-marker');
      }
      console.log(currentTiles);
      if (! currentTiles){
        currentTiles=["315034", "308376", "5740", "453211", "473404"];
      }
      for (let cellIdx = 0; cellIdx < DRUM_CLASSES.length; cellIdx++) {
        let cellEl;
        if (cellEls[cellIdx]) {
          cellEl = cellEls[cellIdx];
        } else {
          cellEl = document.createElement('div');
          cellEl.classList.add('cell');
          cellEl.classList.add(_.kebabCase(DRUM_CLASSES[cellIdx]));
          cellEl.dataset.stepIdx = stepIdx;
          cellEl.dataset.cellIdx = cellIdx;
          cellEl.style.backgroundImage=`url(https://d1tutlfztia4ba.cloudfront.net/crops/${currentTiles[cellIdx]}.png)`;
          cellEl.style.backgroundSize='cover';
          cellEl.style.backgroundRepeat='no repeat';
          stepEl.appendChild(cellEl);
          cellEls[cellIdx] = cellEl;
        }
        if (step.indexOf(cellIdx) >= 0) {
          cellEl.classList.add('on');
        } else {
          cellEl.classList.remove('on');
        }
      }
      stepEls[stepIdx] = { stepEl, gutterEl, cellEls };

      let stagger = stepIdx * (300 / (state.patternLength - state.seedLength));
      setTimeout(() => {
        if (stepIdx < state.seedLength) {
          stepEl.classList.add('seed');
        } else {
          stepEl.classList.remove('seed');
          if (regenerating) {
            stepEl.classList.add('regenerating');
          } else {
            stepEl.classList.remove('regenerating');
          }
        }
      }, stagger);
    }

    setTimeout(repositionRegenerateButton, 0);
  }

  function repositionRegenerateButton() {
    let regenButton = document.querySelector('.regenerate');
    let sequencerEl = document.querySelector('.sequencer');
    let seedMarkerEl = document.querySelector('.gutter.seed-marker');
    let regenLeft =
    sequencerEl.offsetLeft +
    seedMarkerEl.offsetLeft +
    seedMarkerEl.offsetWidth / 2 -
    regenButton.offsetWidth / 2;
    let regenTop =
    sequencerEl.offsetTop +
    seedMarkerEl.offsetTop +
    seedMarkerEl.offsetHeight / 2 -
    regenButton.offsetHeight / 2;
    regenButton.style.left = `${regenLeft}px`;
    regenButton.style.top = `${regenTop}px`;
    regenButton.style.visibility = 'visible';
  }

  function regenerate() {
    let seed = _.take(state.pattern, state.seedLength);
    renderPattern(true);
    return generatePattern(seed, state.patternLength - seed.length).then(
    result => {
      state.pattern = result;
      onPatternUpdated();
    });

  }

  function onPatternUpdated() {
    stopPattern();
    renderPattern();
  }

  function toggleStep(cellEl) {
    if (state.pattern && cellEl.classList.contains('cell')) {
      let stepIdx = +cellEl.dataset.stepIdx;
      let cellIdx = +cellEl.dataset.cellIdx;
      let isOn = cellEl.classList.contains('on');
      if (isOn) {
        _.pull(state.pattern[stepIdx], cellIdx);
        cellEl.classList.remove('on');
      } else {
        state.pattern[stepIdx].push(cellIdx);
        cellEl.classList.add('on');
      }
    }
  }

  function toNoteSequence(pattern) {
    return mm.sequences.quantizeNoteSequence(
    {
      ticksPerQuarter: 220,
      totalTime: pattern.length / 2,
      timeSignatures: [
      {
        time: 0,
        numerator: 4,
        denominator: 4 }],


      tempos: [
      {
        time: 0,
        qpm: 120 }],


      notes: _.flatMap(pattern, (step, index) =>
      step.map(d => ({
        pitch: midiDrums[d],
        startTime: index * 0.5,
        endTime: (index + 1) * 0.5 }))) },



    1);

  }

  function fromNoteSequence(seq, patternLength) {
    let res = _.times(patternLength, () => []);
    for (let { pitch, quantizedStartStep } of seq.notes) {
      res[quantizedStartStep].push(reverseMidiMapping.get(pitch));
    }
    return res;
  }


  function updatePlayPauseIcons() {
    if (_.isNumber(stepCounter)) {
      document.querySelector('.playpause .pause-icon').style.display = null;
      document.querySelector('.playpause .play-icon').style.display = 'none';
    } else {
      document.querySelector('.playpause .play-icon').style.display = null;
      document.querySelector('.playpause .pause-icon').style.display = 'none';
    }
  }

  WebMidi.enable(err => {
    if (err) {
      console.error('WebMidi could not be enabled', err);
      return;
    }
    document.
    querySelectorAll('.webmidi-enabled').
    forEach(e => e.style.display = 'block');

  document.querySelector('.app').addEventListener('click', event => {
    if (event.target.classList.contains('cell')) {
      toggleStep(event.target);
    }
  });
  document.querySelector('.regenerate').addEventListener('click', event => {
    event.preventDefault();
    event.currentTarget.classList.remove('pulse');
    document.querySelector('.playpause').classList.remove('pulse');
    regenerate().then(() => {
      if (!hasBeenStarted) {
        Tone.context.resume();
        Tone.Transport.start();
        hasBeenStarted = true;
      }
      if (Tone.Transport.state === 'started') {
        setTimeout(startPattern, 0);
      }
    });
  });
  document.querySelector('.playpause').addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('.playpause').classList.remove('pulse');
    if (_.isNumber(stepCounter)) {
      stopPattern();
      Tone.Transport.pause();
    } else {
      Tone.context.resume();
      Tone.Transport.start();
      startPattern();
      hasBeenStarted = true;
    }
  });

  let draggingSeedMarker = false;
  document.querySelector('.app').addEventListener('mousedown', evt => {
    let el = evt.target;
    if (
    el.classList.contains('gutter') &&
    el.classList.contains('seed-marker'))
    {
      draggingSeedMarker = true;
      evt.preventDefault();
    }
  });
  document.querySelector('.app').addEventListener('mouseup', () => {
    draggingSeedMarker = false;
  });
  document.querySelector('.app').addEventListener('mouseover', evt => {
    if (draggingSeedMarker) {
      let el = evt.target;
      while (el) {
        if (el.classList.contains('step')) {
          let stepIdx = +el.dataset.stepIdx;
          if (stepIdx > 0) {
            state.seedLength = stepIdx;
            renderPattern();
          }
          break;
        }
        el = el.parentElement;
      }
    }
  });
  // document.
  // querySelector('#swing').
  // addEventListener('input', evt => setSwing(+evt.target.value));
  // document.
  // querySelector('#temperature').
  // addEventListener('input', evt => temperature = +evt.target.value);
  document.querySelector('#tempo').addEventListener('input', evt => {
    Tone.Transport.bpm.value = state.tempo = +evt.target.value;
    oneEighth = Tone.Time('8n').toSeconds();
  });

  $('#pattern-length').
  on('change', evt => setPatternLength(+evt.target.value)).
  formSelect();

  window.addEventListener('resize', repositionRegenerateButton);

  renderPattern();

  // document.querySelector('.progress').remove();
  document.querySelector('.app').style.display = null;
});})