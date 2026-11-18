#!/usr/bin/env python3
"""Costruisce docs/index.html (l'app in un solo file) da src/, content/ e assets/.
Uso: python3 tools/build.py   (serve Node.js per l'elenco delle basi)"""
import json, base64, os, subprocess
from pathlib import Path
R = Path(__file__).resolve().parent.parent
b64 = lambda p: base64.b64encode(p.read_bytes()).decode()
polly = json.loads((R/'assets/img/polly.json').read_text())
assets = {k: 'data:image/webp;base64,' + b64(R/f'assets/img/{k}.webp') for k in ['logo', 'logo_sm', 'avatar_polly']}
for f in sorted((R/'assets/icons').glob('*.svg')):
    assets['nav_' + f.stem] = 'data:image/svg+xml;base64,' + b64(f)
(R/'build').mkdir(exist_ok=True)
with open(R/'build/basi.json', 'w') as out:
    subprocess.run(['node', str(R/'tools/basi.js')], stdout=out, check=True)
basemap = (R/'build/basemap.json').read_text()
content = ''.join((R/'content'/f).read_text() + '\n' for f in sorted(os.listdir(R/'content')) if f.endswith('.js'))
html = ((R/'src/template.html').read_text()
        .replace('/*__CONTENT__*/', content)
        .replace('/*__SRC_NOTATION__*/', (R/'src/notation.js').read_text())
        .replace('/*__SRC_AUDIO__*/', (R/'src/audio.js').read_text())
        .replace('__BASEMAP__', basemap)
        .replace('__POLLY__', json.dumps(polly))
        .replace('__ASSETS__', json.dumps(assets)))
(R/'docs/index.html').write_text(html)
missing = [v['file'] for v in json.loads(basemap).values() if not (R/'docs/basi'/v['file'].replace('.wav', '.mp3')).exists()]
print(f"docs/index.html scritto ({len(html)//1024} KB)." + (f" Basi mancanti in docs/basi: {sorted(set(missing))}" if missing else " Tutte le basi presenti."))
