#!/usr/bin/env python3
"""sounds.py — nine strikes, one per material, from ElevenLabs.

The nine bodies really do sound different, and the prompts lean on the reason:
firing temperature and porosity decide how long a pot rings. Unfired clay is
dead, low-fired terracotta and earthenware thud, stoneware is dense enough to
clunk, and the vitrified bodies — porcelain, faience, fritware — ring like
glass because that is very nearly what they are. Track order runs from the
deadest to the brightest so the board reads top to bottom as a kiln.

Generated audio is unusable as-is for a step sequencer: it arrives with a
variable lead-in, and a drum hit that starts 80ms after its own downbeat is
just late. Every sample is therefore trimmed to its own attack, capped, faded
and peak-normalised before it lands in sounds/.

  ELEVENLABS_API_KEY=sk_... python3 pipeline/sounds.py
  python3 pipeline/sounds.py --dry          # print the prompts, call nothing
  python3 pipeline/sounds.py terracotta     # regenerate one material
"""

import array
import json
import math
import os
import subprocess
import sys
import wave
import urllib.error
import urllib.request

API = 'https://api.elevenlabs.io/v1/sound-generation'
RATE = 44100
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RAW = os.path.join(ROOT, 'pipeline', 'raw')
OUT = os.path.join(ROOT, 'sounds')

# name -> (prompt, seconds asked of the model, seconds kept after trimming)
STRIKES = {
    'clay': (
        'One single slap on a large lump of wet unfired clay with a flat palm. '
        'A dead, muffled, low thud with absolutely no ring and no resonance. '
        'Very short. Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        0.5, 0.5),
    'terracotta': (
        'One single dull knock on a thick unglazed terracotta flowerpot with a soft '
        'wooden mallet, starting at the very first instant of the recording. A '
        'completely dead, dry, muted low thud that stops almost instantly. No ring, '
        'no buzz, no rattle, no metallic tail, no echo. Recorded loud and close in a '
        'dry studio, one hit only, then silence. No music, no reverb, no room tone.',
        0.6, 0.3),
    'earthenware': (
        'One single loud knuckle rap on a porous unglazed earthenware jug, starting '
        'at the very first instant of the recording. A hollow mid-pitched knock with '
        'a soft woody body that rings quietly for about a quarter of a second before '
        'dying. Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        0.6, 0.55),
    'pottery': (
        'One single hard knock on a large empty clay pot with the knuckles, starting '
        'at the very first instant of the recording. A short, dry, low-pitched hollow '
        'thump that decays fast and is completely silent within half a second. Tight '
        'and damped, not resonant, no long tail, no rumble. Recorded loud and close '
        'in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone, no background hiss.',
        0.9, 0.55),
    'stoneware': (
        # Long prompts stuffed with negatives ("no ring, no buzz, no hum...")
        # reliably came back as two seconds of quiet wash with no event in
        # them. Short, positive, physical descriptions are what land.
        'A hammer strikes a large granite block once. One short, dry, hard stone '
        'knock, close-miked, then silence.',
        0.9, 0.3),
    'ceramic': (
        'One single sharp tap on a thick glazed ceramic dinner plate with a hard '
        'plastic pick, starting at the very first instant of the recording. A clean, '
        'bright, high-pitched ceramic click with a short glassy ring that fades '
        'within a third of a second. Recorded loud and close in a dry studio, one '
        'hit only, then silence. No music, no reverb, no room tone, no background '
        'hiss.',
        0.7, 0.4),
    'faience': (
        'One single soft muted tap on a small glazed Egyptian faience bead, starting '
        'at the very first instant of the recording. A short, soft, warm, rounded '
        'click. Gentle and dull rather than sharp. No piercing high frequencies, no '
        'metallic ring, no whistle, no hiss. Recorded loud and close in a dry studio, '
        'one hit only, then silence. No music, no reverb, no room tone.',
        0.5, 0.25),
    'fritware': (
        'One single tap on a thin flat fritware tile with a small metal rod. A very '
        'high, brittle, glassy ping, thin and sharp, with a quick shimmering decay. '
        'Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        0.8, 0.7),
    'porcelain': (
        'One single light tap on the rim of a thin white porcelain teacup with a '
        'metal spoon. A bright glassy ping with a clear bell-like ring that decays '
        'smoothly. Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        1.2, 1.1),
}

ORDER = ['terracotta', 'porcelain', 'earthenware', 'ceramic', 'faience',
         'clay', 'pottery', 'stoneware', 'fritware']


# Asking the model for the length we actually want back returns near-silence:
# at 0.5-0.6s it renders ambience rather than placing an event, and the clip
# comes back peaking around -47dB with no strike in it. It needs room to put
# the hit somewhere. So we always buy a couple of seconds and let the trimmer
# find the attack and cut it back to the length the sequencer wants.
MIN_ASK = 2.0


MAX_PROMPT = 450   # the API rejects anything longer


def generate(name, key):
    prompt, seconds, _ = STRIKES[name]
    if len(prompt) > MAX_PROMPT:
        raise ValueError('prompt is %d chars, limit is %d' % (len(prompt), MAX_PROMPT))
    body = json.dumps({
        'text': prompt,
        'duration_seconds': max(seconds, MIN_ASK),
        # High influence: the prompts are descriptions of a physical event, not
        # moods, and letting the model wander produces musical hits instead.
        'prompt_influence': 0.75,
    }).encode()
    req = urllib.request.Request(
        API + '?output_format=mp3_44100_128',
        data=body,
        headers={'xi-api-key': key, 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=180) as res:
        return res.read()


def decode(path):
    """Raw mono float samples, for deciding where the hit actually starts."""
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1',
                        '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True)
    a = array.array('f')
    a.frombytes(p.stdout[:len(p.stdout) // 4 * 4])
    return a


def onset(samples):
    """The sample index where the strike we want begins.

    An absolute silence gate cannot do this job: clips come back anywhere from
    -1dB to -47dB peak, so a fixed -50dB threshold is 'silence' in one file and
    'the hit' in the next, and the ones it guesses wrong start up to a quarter
    second late — which in a sequencer means the hit lands after its own beat.
    Everything here is measured against the clip's own peak instead.

    The model also likes to answer 'one single strike' with several: a bouncing
    object, or a row of four taps. Taking the first thing above a low gate
    catches a quiet bounce; taking the global peak can skip a perfectly good
    opening hit in favour of a later one. So: the first event that gets within
    6dB of the loudest, then walk back to the foot of its attack.
    """
    hop = int(RATE * 0.002)
    env = []
    for i in range(0, len(samples) - hop, hop):
        s = 0.0
        for v in samples[i:i + hop]:
            s += v * v
        env.append((s / hop) ** 0.5)
    if not env:
        return 0, 0.0
    peak = max(env)
    if peak <= 0:
        return 0, 0.0

    top = next((k for k, v in enumerate(env) if v >= peak * 0.5), 0)
    gate = peak * 0.2
    while top > 0 and env[top - 1] >= gate:
        top -= 1
    # Back off a few milliseconds so the attack transient is not clipped off.
    return max(0, top * hop - int(0.005 * RATE)), peak


def process(name):
    """Trim to the attack, cap, fade, peak-normalise. Mono 44.1k 16-bit WAV.

    Cutting is done on the decoded samples rather than by seeking the mp3:
    ffmpeg's fast seek lands on a frame boundary, which on a sharp transient
    is enough to shave the attack clean off and leave the hit sounding like
    a different, quieter instrument.
    """
    src = os.path.join(RAW, name + '.mp3')
    keep = STRIKES[name][2]
    dst = os.path.join(OUT, name + '.wav')

    x = decode(src)
    if not len(x):
        return 'no audio decoded'

    start, _ = onset(x)
    seg = x[start:start + int(keep * RATE)]
    if not len(seg):
        return 'empty after trim'

    pk = max(abs(v) for v in seg)
    if pk <= 0:
        return 'silent after trim'
    gain = (10 ** (-1.0 / 20)) / pk          # leave 1dB of headroom

    fade_in = int(0.003 * RATE)
    fade_out = min(int(0.04 * RATE), len(seg) // 4)
    out = array.array('h')
    n = len(seg)
    for i, v in enumerate(seg):
        g = gain
        if i < fade_in:
            g *= i / fade_in
        tail = n - i
        if tail < fade_out:
            g *= tail / fade_out
        out.append(int(max(-1.0, min(1.0, v * g)) * 32767))

    with wave.open(dst, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(out.tobytes())

    db = 20 * math.log10(gain)
    # A generation with no event in it is not silent, it is a quiet wash, and
    # normalising it just makes the wash loud. Large make-up gain is the tell.
    flag = '  <-- near-silent source, regenerate' if db > 25 else ''
    return 'ok  %5.2fs  cut@%5.0fms  %+5.1f dB  %d KB%s' % (
        n / RATE, start / RATE * 1000, db, os.path.getsize(dst) / 1024, flag)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    dry = '--dry' in sys.argv
    only_process = '--process' in sys.argv
    names = args or ORDER
    for n in names:
        if n not in STRIKES:
            sys.exit('unknown material: ' + n)

    if dry:
        for n in names:
            print('\n== %s (%.2fs)\n%s' % (n, STRIKES[n][1], STRIKES[n][0]))
        return

    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    # Either spelling, from the environment or from .env.local — the Vercel
    # project happens to use the second one.
    names_for_key = ('ELEVENLABS_API_KEY', 'ELEVEN_LABS_KEY')
    key = next((os.environ[k].strip() for k in names_for_key if os.environ.get(k)), '')
    env = os.path.join(ROOT, '.env.local')
    if not key and os.path.exists(env):
        for line in open(env):
            if line.strip().startswith(names_for_key):
                key = line.split('=', 1)[1].strip().strip('"\'')
    if not key and not only_process:
        sys.exit('set ELEVENLABS_API_KEY (or pass --process to re-run ffmpeg '
                 'over pipeline/raw/*.mp3)')

    for n in names:
        if not only_process:
            try:
                audio = generate(n, key)
            except urllib.error.HTTPError as e:
                print('%-12s HTTP %s %s' % (n, e.code, e.read()[:300].decode('utf8', 'replace')))
                continue
            except Exception as e:
                print('%-12s %s' % (n, e))
                continue
            with open(os.path.join(RAW, n + '.mp3'), 'wb') as f:
                f.write(audio)
        print('%-12s %s' % (n, process(n)))


if __name__ == '__main__':
    main()
