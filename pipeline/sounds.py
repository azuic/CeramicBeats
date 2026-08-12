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
import os
import re
import subprocess
import sys
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
        'One single knock on a thick unglazed terracotta flowerpot struck with a '
        'wooden mallet. A dry, woody, mid-low thud that dies almost immediately, '
        'no bell tone. Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        0.6, 0.55),
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
        'One single hard strike on dense grey salt-glazed stoneware with a wooden '
        'stick. A stony, hard, deep clunk with a short dark ring underneath it. '
        'Close-miked in a dry studio, one hit only, then silence. '
        'No music, no reverb, no room tone.',
        0.9, 0.8),
    'ceramic': (
        'One single sharp tap on a thick glazed ceramic dinner plate with a hard '
        'plastic pick, starting at the very first instant of the recording. A clean, '
        'bright, high-pitched ceramic click with a short glassy ring that fades '
        'within a third of a second. Recorded loud and close in a dry studio, one '
        'hit only, then silence. No music, no reverb, no room tone, no background '
        'hiss.',
        0.7, 0.4),
    'faience': (
        'One single tick of a small glazed Egyptian faience amulet dropped once on '
        'a stone slab. A very short, bright, brittle high tick with a tiny glassy '
        'ping and almost no sustain. Close-miked in a dry studio, one hit only, '
        'then silence. No music, no reverb, no room tone.',
        0.5, 0.45),
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


def generate(name, key):
    prompt, seconds, _ = STRIKES[name]
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


def ffmpeg(args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y'] + args,
                          capture_output=True, text=True)


def peak_db(path):
    """The sample's loudest point, so it can be brought up without clipping."""
    p = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'volumedetect',
                        '-f', 'null', '-'], capture_output=True, text=True)
    m = re.search(r'max_volume:\s*(-?[\d.]+) dB', p.stderr)
    return float(m.group(1)) if m else 0.0


def decode(path):
    """Raw mono float samples, for deciding where the hit actually starts."""
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1',
                        '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True)
    a = array.array('f')
    a.frombytes(p.stdout[:len(p.stdout) // 4 * 4])
    return a


def onset(samples):
    """Where the strike begins, as a time in seconds.

    An absolute silence threshold cannot do this job: these clips come back
    anywhere from -1dB to -47dB peak, so a fixed -50dB gate is 'silence' in one
    file and 'the hit' in the next, and the ones it guesses wrong on start up
    to a quarter-second late — which in a step sequencer means the hit lands
    after its own beat. Measuring against each file's own peak is scale-free.
    """
    hop = int(RATE * 0.002)
    env = []
    for i in range(0, len(samples) - hop, hop):
        s = 0.0
        for v in samples[i:i + hop]:
            s += v * v
        env.append((s / hop) ** 0.5)
    if not env:
        return 0.0, 0.0
    peak = max(env)
    if peak <= 0:
        return 0.0, 0.0
    gate = peak * 0.2
    i = next((k for k, v in enumerate(env) if v >= gate), 0)
    # Back off a few milliseconds so the attack transient is not clipped off.
    return max(0.0, i * hop / RATE - 0.005), peak


def duration(path):
    p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'csv=p=0', path], capture_output=True, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def process(name):
    """Trim to the attack, cap the tail, fade, normalise. Mono 44.1k WAV."""
    src = os.path.join(RAW, name + '.mp3')
    keep = STRIKES[name][2]
    tmp = os.path.join(RAW, name + '.trim.wav')
    dst = os.path.join(OUT, name + '.wav')

    start, _ = onset(decode(src))
    r = ffmpeg(['-ss', '%f' % start, '-i', src, '-t', '%f' % keep,
                '-ac', '1', '-ar', str(RATE),
                '-af', 'afade=t=in:st=0:d=0.003', tmp])
    if r.returncode:
        return 'ffmpeg failed: ' + r.stderr.strip().splitlines()[-1]

    # The fade has to be anchored to what the trim actually left, not to the
    # cap we asked for: a hit that came back shorter than its cap would other-
    # wise get no fade at all and end on a hard cut, which clicks.
    dur = duration(tmp)
    fade = min(0.04, dur / 4)
    gain = -1.0 - peak_db(tmp)
    r = ffmpeg(['-i', tmp,
                '-af', 'volume=%.2fdB,afade=t=out:st=%f:d=%f' % (gain, max(dur - fade, 0), fade),
                '-ac', '1', '-ar', '44100', dst])
    os.remove(tmp)
    if r.returncode:
        return 'ffmpeg failed: ' + r.stderr.strip().splitlines()[-1]
    return 'ok  %5.2fs  cut@%4.0fms  %+5.1f dB  %d KB' % (
        dur, start * 1000, gain, os.path.getsize(dst) / 1024)


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
