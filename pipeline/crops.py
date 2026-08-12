#!/usr/bin/env python3
"""crops.py — pull the sequencer's tile art out of the lookbook's atlas.

The lookbook packs 44,354 Met ceramics as 96px crops across 101 webp sheets,
in the same order as grid.bin. This sequencer only ever shows a few hundred of
them, so shipping the whole 75MB atlas would be absurd: instead we pick a fixed
set per material and repack just those into one small sheet.

Selection runs across the material's objects in family/hue/lightness order and
samples evenly, so a single row of the grid reads as a spread of that
material's colour range rather than sixteen near-identical buff pots.

Writes:
  tiles/crops.webp   one sheet, COLS x N tiles of 96px
  tiles/tiles.json   material -> [{i, id, title, date, culture} ...]
"""

import json
import os
import struct
import sys

from PIL import Image, ImageStat

LOOKBOOK = os.path.expanduser('~/Claude/the-met-ceramics-lookbook')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tiles')

# The nine materials the catalogue actually names, in count order. The tenth
# bucket the lookbook carries ("other/unspecified") is a leftover, not a
# material, so it gets no track.
MATERIALS = ['terracotta', 'porcelain', 'earthenware', 'ceramic', 'faience',
             'clay', 'pottery', 'stoneware', 'fritware']

PER_MATERIAL = 32   # two full sets of 16 steps, so shuffling means something
CANDIDATES = 3      # tries per colour band, scored for legibility
COLS = 16


def column(buf, layout, name, n, width=1):
    spec = layout[name]
    fmt = {'Uint8': 'B', 'Uint16': 'H', 'Uint32': 'I', 'Int16': 'h'}[spec['type']]
    size = struct.calcsize(fmt)
    off = spec['offset']
    return struct.unpack_from('<%d%s' % (n * width, fmt), buf, off)


def main():
    meta = json.load(open(os.path.join(LOOKBOOK, 'data/meta.json')))
    atlas = json.load(open(os.path.join(LOOKBOOK, 'data/atlas.json')))
    buf = open(os.path.join(LOOKBOOK, 'data/grid.bin'), 'rb').read()

    n = meta['count']
    L = meta['layout']
    ids = column(buf, L, 'id', n)
    mat = column(buf, L, 'mat', n)
    fam = column(buf, L, 'fam', n)
    rgb = column(buf, L, 'rgb', n, 3)
    qL = column(buf, L, 'L', n)
    qh = column(buf, L, 'h', n)

    mat_names = [m['name'] for m in meta['materials']]

    # Each tile gets one band of the material's colour range, and CANDIDATES
    # tries per band. A crop that is mostly the photographer's white sweep, or
    # a black-backed archival plate, carries no surface at all once it is
    # 40px on screen, so the band's most legible candidate wins it.
    bands = {}
    for name in MATERIALS:
        m = mat_names.index(name)
        idx = [i for i in range(n) if mat[i] == m]
        idx.sort(key=lambda i: (fam[i], qh[i], qL[i]))
        if len(idx) < PER_MATERIAL * CANDIDATES:
            sys.exit('material %s has only %d objects' % (name, len(idx)))
        step = len(idx) / PER_MATERIAL
        bands[name] = [
            [idx[min(len(idx) - 1, int((k + (c + 0.5) / CANDIDATES) * step))]
             for c in range(CANDIDATES)]
            for k in range(PER_MATERIAL)
        ]

    # Catalogue text, loaded a shard at a time and only for what we picked.
    shard_size = meta['shard']
    shards = {}

    def detail(i):
        s = i // shard_size
        if s not in shards:
            path = os.path.join(LOOKBOOK, 'data/detail', '%03d.json' % s)
            shards[s] = json.load(open(path)) if os.path.exists(path) else []
        rows = shards[s]
        k = i % shard_size
        return rows[k] if k < len(rows) else None

    total = len(MATERIALS) * PER_MATERIAL
    tile = atlas['tile']
    rows = (total + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * tile, rows * tile), (229, 224, 216))

    # One decode per atlas sheet, in sheet order: a candidate set of ~900 crops
    # is scattered over most of the 101 sheets, and each one costs 12MB decoded,
    # so holding them all at once is far more memory than holding the crops.
    wanted = sorted({i for name in MATERIALS for band in bands[name] for i in band})
    crops = {}
    for i in wanted:
        s = i // atlas['perSheet']
        if crops.get('_sheet') != s:
            crops['_sheet'] = s
            page = Image.open(
                os.path.join(LOOKBOOK, 'data/atlas', '%03d.webp' % s)).convert('RGB')
        k = i % atlas['perSheet']
        x, y = (k % atlas['cols']) * tile, (k // atlas['cols']) * tile
        crops[i] = page.crop((x, y, x + tile, y + tile))
    crops.pop('_sheet', None)

    def legibility(im):
        """How much of the crop is actually object rather than backdrop."""
        g = im.convert('L')
        hist = g.histogram()
        px = g.width * g.height
        blank = sum(hist[243:]) + sum(hist[:12])
        spread = ImageStat.Stat(g).stddev[0]
        return (1 - blank / px) + min(spread, 60) / 120

    picked = {}
    for name in MATERIALS:
        picked[name] = [max(band, key=lambda i: legibility(crops[i]))
                        for band in bands[name]]

    manifest = {}
    slot = 0
    for name in MATERIALS:
        entries = []
        for i in picked[name]:
            sheet.paste(crops[i], ((slot % COLS) * tile, (slot // COLS) * tile))
            d = detail(i) or ['', '', '', '', '', '', '']
            k = i * 3
            entries.append({
                'slot': slot,
                'id': ids[i],
                'title': d[0],
                'date': d[2],
                'culture': d[3] or d[4],
                'rgb': '#%02x%02x%02x' % (rgb[k], rgb[k + 1], rgb[k + 2]),
            })
            slot += 1
        manifest[name] = entries

    os.makedirs(OUT, exist_ok=True)
    sheet.save(os.path.join(OUT, 'crops.webp'), quality=88, method=6)
    json.dump({
        'tile': tile,
        'cols': COLS,
        'perMaterial': PER_MATERIAL,
        'materials': MATERIALS,
        'counts': {m['name']: m['count'] for m in meta['materials']},
        'tiles': manifest,
    }, open(os.path.join(OUT, 'tiles.json'), 'w'), separators=(',', ':'))

    size = os.path.getsize(os.path.join(OUT, 'crops.webp'))
    print('wrote %d crops, %dx%d sheet, %.1f KB'
          % (total, sheet.width, sheet.height, size / 1024))


if __name__ == '__main__':
    main()
