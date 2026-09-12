# Ceramic Beats Co.

A step sequencer made out of The Met's open collection. There are nine tracks,
one for each material the museum's catalogue names. Every tile you strike is a
real object of that material, cropped from its photograph, and it sounds like
that body being hit.

**Live:** [ceramic-beats.vercel.app](https://ceramic-beats.vercel.app) ·
[azuic.github.io/CeramicBeats](https://azuic.github.io/CeramicBeats/)

## The nine

Terracotta, porcelain, earthenware, ceramic, faience, clay, pottery, stoneware,
fritware. These are the materials the collection actually names, listed in count
order, so the board reads top to bottom roughly the way the museum does.

They sound different for the same reason they are different: firing temperature
and porosity govern how long a body rings. Unfired clay is dead. Low-fired
terracotta and earthenware thud. Stoneware is dense enough to clunk. The
vitrified bodies (porcelain, faience, fritware) ring like the glass they very
nearly are. Across the nine samples, brightness runs from 236Hz to 6219Hz and
ring from 55ms to 239ms.

## Using it

| | |
|---|---|
| click a pad | set or clear a step, and hear it |
| drag across pads | paint a run; the drag repeats whatever the first pad became |
| space | play / pause |
| hover a pad | the object's title, date and culture |
| ⌥-click a pad | open that object at The Met |
| the circle in a row label | mute the track |
| Reshuffle | draw a different set of objects for every row |
| the name under the tiles | click it and type to name the beat |
| Save Beat | copy a link that *is* the beat |

Save Beat packs the whole arrangement into 30 bytes in the URL fragment: the
grid, the tempo, the mutes, and each row's crop rotation. The beat's name rides
beside it, so whoever opens the link sees the card as it was named. A saved
beat needs no server and no storage.

A preset lends the beat its name until the beat stops being that preset: the
first change to the grid turns "kiln floor" into "kiln floor variation", and
from there the name is yours to set.

## Running it

No build step. It is a static site, so serve the directory.

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

Every path in the app is relative. That is why the same tree serves correctly
from a domain root on Vercel and from a project subpath on GitHub Pages.

### pipeline/crops.py

Builds the tile art. Needs **Pillow**. It reads its source from
[the-met-ceramics-lookbook](https://github.com/azuic/the-met-ceramics-lookbook),
whose `data/` holds a 44,354-object atlas spread across 101 webp sheets (75MB).
That location is hardcoded near the top of the script as
`~/Claude/the-met-ceramics-lookbook`, so edit `LOOKBOOK` if it lives elsewhere.

```
python3 pipeline/crops.py
```

It picks 32 objects per material and repacks only those into a single 16-wide
sheet, which is how the sequencer ships 745KB instead of 75MB. The picks sweep
each material's glaze family and hue order, so a row reads left to right as a
pass through that material's colour range rather than a scatter. Within every
colour band three candidates compete on a legibility score, and that is what
keeps blank photographer's-sweep crops off the board. A row shows 16 of its 32
as a contiguous run, rotated. Contiguous is the point, and Reshuffle turns the
rotation.

### pipeline/sounds.py

Builds the nine strikes from ElevenLabs. Needs **ffmpeg** and an API key, either
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

The output is committed, so a key is only needed to regenerate. The site itself
never calls the API.

Generated audio does not arrive usable as a drum sample, and most of this script
is the gap between the two:

- **Ask for more than you keep.** Request the half-second you actually want and
  you get ambience with no event in it, peaking near -47dB. The model needs room
  to place the hit, so the script always buys two seconds and trims back.
- **Find the onset against the clip's own peak.** Clips come back anywhere from
  -1dB to -47dB, so a fixed silence gate reads as "silence" in one file and as
  "the hit" in the next. The files it misjudges start up to a quarter-second
  late, and in a sequencer that means the hit lands after its own beat.
- **Expect several hits.** Ask for "one single strike" and you may get a
  bouncing pebble, or a row of four taps. Take the first thing above a gate and
  you catch a quiet bounce; take the global peak and you skip a perfectly good
  opening hit in favour of a later one. What works: the first event within 6dB
  of the loudest, then walk back to the foot of its attack.
- **Cut on samples, not by seeking.** ffmpeg's `-ss` lands on a frame boundary.
  On a sharp transient that shaves the attack clean off.
- **Prompt positively.** Short physical descriptions naming the object and the
  striker land well. Prompts stuffed with negatives ("no ring, no buzz, no hum,
  no echo") reliably came back as two seconds of quiet wash with nothing in them.

## A note on the layout

The page is a glaze manufacturer's sample card, edge to edge: card stock with a
grid of glass tiles glued to it, the sample's name set large underneath, the
small print, and the maker's mark in the corner. Each tile is drawn as glass
over the object's crop — a hairline rim, a raked band of light down the top and
left edges where the bevel catches the room, and a shade gathering in the
opposite corner. An unstruck tile is the same glass over blank bisque, so the
card reads as a full sheet of samples with most of them still unglazed. A tile
is as large as the width allows unless the height allows less, so the sheet
fills the card without the card having to scroll.

Everything around the card borrows the printed-ephemera language of
[the-met-ceramics-lookbook](https://github.com/azuic/the-met-ceramics-lookbook),
which this is the companion piece to: the same paper and card stock, the same
ink and stamp red, and the same three faces (Bodoni Moda for the name and the
mark, Libre Baskerville for the catalogue values, IBM Plex Mono for the small
print). The row labels are lines off the lookbook's catalogue panel, dot and
count included; the controls are its keycaps; the status reads off a receipt
stub set slightly off-square. The two are meant to sit side by side as a pair,
not as the same page twice.

---

Images and object data from
[The Met's open access collection](https://www.metmuseum.org/art/collection).
