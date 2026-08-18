# Ceramic Beats Co.

A step sequencer built out of The Met's open collection. Nine tracks, one per
material the museum's catalogue names, and every tile you strike is a real
object of that material — cropped from its photograph, with the sound of that
body being struck.

**Live:** [ceramic-beats.vercel.app](https://ceramic-beats.vercel.app) ·
[azuic.github.io/CeramicBeats](https://azuic.github.io/CeramicBeats/)

## The nine

Terracotta, porcelain, earthenware, ceramic, faience, clay, pottery, stoneware,
fritware — the materials the collection actually names, in count order, so the
board reads top to bottom roughly as the museum does.

What separates them acoustically is what separates them physically: firing
temperature and porosity decide how long a body rings. Unfired clay is dead,
low-fired terracotta and earthenware thud, stoneware is dense enough to clunk,
and the vitrified bodies — porcelain, faience, fritware — ring like the glass
they very nearly are. The nine samples span 236Hz to 6219Hz in brightness and
55ms to 239ms in ring.

## Using it

| | |
|---|---|
| click a pad | set or clear a step, and hear it |
| drag across pads | paint a run — the drag repeats whatever the first pad became |
| space | play / pause |
| hover a pad | the object's title, date and culture |
| ⌥-click a pad | open that object at The Met |
| the circle in a row label | mute the track |
| Reshuffle | draw a different set of objects for every row |
| Save Beat | copy a link that *is* the beat |

Save Beat packs the whole arrangement — grid, tempo, mutes, and each row's crop
rotation — into 30 bytes in the URL fragment, so a saved beat needs no server
and no storage.

## Running it

There is no build step. It is a static site: serve the directory.

```
python3 -m http.server 8199
```

## How it is put together

```
index.html          the shell; icons inlined, no icon font
index.css           hand-written at the design's values, no CSS framework
js/materials.js     the nine tracks: accent and surface pattern
js/tiles.js         crop addressing against the packed sheet
js/audio.js         the kiln — buffers, per-hit voices, the clock
js/pattern.js       grid, mutes, presets, and the URL codec
js/ui.js            the board: built once, then only classes toggle
js/app.js           wiring
tiles/              crops.webp (745KB) + tiles.json, built by the pipeline
sounds/             nine strikes, built by the pipeline
pipeline/           the two generators, both one-shot
Tone.js             vendored (v13), for the transport and scheduling
```

Everything is relative-path, which is why the same tree serves correctly from a
domain root on Vercel and from a project subpath on GitHub Pages.

### pipeline/crops.py

Builds the tile art. Requires **Pillow**, and reads its source from
[the-met-ceramics-lookbook](https://github.com/azuic/the-met-ceramics-lookbook)
— that project's `data/` holds a 44,354-object atlas across 101 webp sheets
(75MB). The path is hardcoded at the top of the script as
`~/Claude/the-met-ceramics-lookbook`; change `LOOKBOOK` if it lives elsewhere.

```
python3 pipeline/crops.py
```

It picks 32 objects per material and repacks just those into one 16-wide sheet,
so the sequencer ships 745KB instead of 75MB. Picks sweep each material's glaze
family and hue order, so a row reads left to right as a sweep through that
material's colour range rather than a scatter; each colour band is chosen from
three candidates by a legibility score, which keeps blank photographer's-sweep
crops off the board. A row shows a contiguous run of 16 of its 32, rotated —
contiguous on purpose, and Reshuffle turns the rotation.

### pipeline/sounds.py

Builds the nine strikes from ElevenLabs. Requires **ffmpeg** and an API key,
in the environment or in `.env.local` (gitignored):

```
ELEVEN_LABS_KEY=sk_...          # ELEVENLABS_API_KEY also works
```

```
python3 pipeline/sounds.py                 # all nine
python3 pipeline/sounds.py terracotta      # just one
python3 pipeline/sounds.py --dry           # print the prompts, call nothing
python3 pipeline/sounds.py --process       # re-run the trimming over cached mp3s
```

Output is committed, so the key is only needed to regenerate — the site never
calls the API.

Generated audio is not usable as a drum sample as it arrives, and most of this
script is the gap:

- **Ask for more than you keep.** Requesting the half-second you actually want
  returns ambience with no event in it, peaking around -47dB. It needs room to
  place the hit, so the script always buys two seconds and trims back.
- **Find the onset against the clip's own peak.** Clips come back anywhere from
  -1dB to -47dB, so a fixed silence gate is "silence" in one file and "the hit"
  in the next; the ones it gets wrong start up to a quarter-second late, which
  in a sequencer means the hit lands after its own beat.
- **Expect several hits.** "One single strike" comes back as a bouncing pebble,
  or a row of four taps. Taking the first thing above a gate catches a quiet
  bounce; taking the global peak skips a good opening hit for a later one. The
  rule that works: the first event within 6dB of the loudest, then walk back to
  the foot of its attack.
- **Cut on samples, not by seeking.** ffmpeg's `-ss` lands on a frame boundary,
  which on a sharp transient shaves the attack clean off.
- **Prompt positively.** Short physical descriptions naming the object and the
  striker land. Prompts stuffed with negatives — "no ring, no buzz, no hum, no
  echo" — reliably returned two seconds of quiet wash with nothing in them.

## A note on the layout

The design is a mosaic wall, and a tiled wall changes pattern between registers
rather than running one grain everywhere. Four motifs, defined as tokens in
`:root`: a zellige star lattice on the page, brick in running bond as the header
and footer courses, tesserae in the board, and nothing behind the controls.
Scale follows visibility — the board's background is seen almost entirely
through the 8px channels between pads, so a large motif is sliced into fragments
there and only works on open ground.

---

Images and object data from
[The Met's open access collection](https://www.metmuseum.org/art/collection).
