"""Build one HTML file from the authored static coloring-game sources."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUTPUT = ROOT / 'index.html'
LEVELS = (
    (1, 'easy', 'Легко', 'balloon', '01-easy.json'),
    (1, 'middle', 'Посложнее', 'house', '02-middle.json'),
    (1, 'many', 'Много деталей', 'rocket', '03-many.json'),
    (1, 'detail', 'Самые подробные', 'sea', '04-detail.json'),
    (2, 'journey', 'В дороге', None, '05-journey.json'),
    (2, 'nature', 'Природа', None, '06-nature.json'),
    (2, 'town', 'Большой город', None, '07-town.json'),
    (2, 'fairy', 'Сказки', None, '08-fairy.json'),
)
ID = re.compile(r'[a-z][a-z0-9-]*')
PATH = re.compile(r'[Mm][MmLlHhVvCcSsQqTtAaZzEe0-9.,+\s-]+')
COLORS = set('red orange yellow green blue purple pink brown'.split())


def read_list(path):
    rows = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(rows, list) or not rows:
        raise ValueError(f'Expected a nonempty list: {path}')
    return rows


def validate_scene(scene):
    if not isinstance(scene, dict) or set(scene) != {'id', 'title', 'areas', 'details'}:
        raise ValueError('Invalid scene fields')
    name = scene['id']
    if not isinstance(name, str) or not ID.fullmatch(name) or not isinstance(scene['title'], str) or not scene['title'].strip():
        raise ValueError(f'Invalid scene title or ID: {name!r}')
    if not isinstance(scene['areas'], list) or not scene['areas'] or not isinstance(scene['details'], list):
        raise ValueError(f'Missing arrays in {name}')
    seen = set()
    for area in scene['areas']:
        if not isinstance(area, dict) or set(area) != {'id', 'label', 'd', 'at', 'color'}:
            raise ValueError(f'Invalid area fields in {name}')
        aid, d, at = area['id'], area['d'], area['at']
        if (not isinstance(aid, str) or not ID.fullmatch(aid) or aid in seen
                or not isinstance(area['label'], str) or not area['label'].strip()):
            raise ValueError(f'Invalid or duplicate area in {name}: {aid!r}')
        seen.add(aid)
        if (not isinstance(area['color'], str) or area['color'] not in COLORS
                or not isinstance(d, str) or not PATH.fullmatch(d) or not d.rstrip().lower().endswith('z')
                or not isinstance(at, list) or len(at) != 2
                or not all(type(n) in (float, int) and 0 < n < limit for n, limit in zip(at, (480, 360)))):
            raise ValueError(f'Invalid path, color or anchor in {name}/{aid}')
    for d in scene['details']:
        if not isinstance(d, str) or not PATH.fullmatch(d) or 'z' in d.lower():
            raise ValueError(f'Expected open decorative path in {name}')


def load_album(source):
    original = read_list(source / 'scenes.json')
    for scene in original:
        validate_scene(scene)
    old = {scene['id']: scene for scene in original}
    required = {first for _, _, _, first, _ in LEVELS if first is not None}
    if len(original) != len(required) or set(old) != required:
        raise ValueError('Initial sheets must remain in scenes.json')
    levels, scenes, ids = [], [], set()
    previous = 0
    for album, lid, label, first, file in LEVELS:
        group = ([old[first]] if first is not None else []) + read_list(source / 'album' / file)
        if len(group) != 5:
            raise ValueError(f'Expected five sheets in group {lid}, got {len(group)}')
        levels.append({'id': lid, 'title': label, 'album': album, 'sheets': []})
        for scene in group:
            validate_scene(scene)
            sid, size = scene['id'], len(scene['areas'])
            if sid in ids or size < previous:
                raise ValueError(f'Duplicate or out-of-order sheet: {sid}')
            levels[-1]['sheets'].append(sid)
            scenes.append(scene)
            ids.add(sid)
            previous = size
    return {'levels': levels, 'scenes': scenes}


def render(source=SRC):
    template = (source / 'page.html').read_text(encoding='utf-8')
    album = load_album(source)
    pieces = {
        '/* STUDIO_CSS */': (source / 'style.css').read_text(encoding='utf-8').rstrip(),
        '/* STUDIO_SCENES */': json.dumps(album, ensure_ascii=False, separators=(',', ':'), allow_nan=False).replace('<', '\\u003c'),
        '/* STUDIO_JS */': (source / 'app.js').read_text(encoding='utf-8').rstrip(),
    }
    for token, content in pieces.items():
        if template.count(token) != 1:
            raise ValueError(f'Exactly one placeholder required: {token}')
        template = template.replace(token, content)
    return template.encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify without rewriting the generated page')
    args = parser.parse_args()
    bundle = render()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != bundle:
            parser.exit(1, f'Generated page has drift: {OUTPUT}\n')
        print(f'PASS: {OUTPUT} ({len(bundle)} bytes)')
    else:
        OUTPUT.write_bytes(bundle)
        print(f'Built: {OUTPUT} ({len(bundle)} bytes)')


if __name__ == '__main__':
    main()
