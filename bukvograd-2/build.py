#!/usr/bin/env python3
"""Inline the game, drawings and exact, pinned Julia recordings; no downloads."""
import argparse
import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
ORIGINAL = ROOT.parent / 'bukvograd'


def build():
    def read(name):
        return (SRC / name).read_text(encoding='utf-8').strip()

    reference = json.loads((ORIGINAL / 'src/clips.json').read_text(encoding='utf-8'))
    bank = {}
    for clip_id, clip in json.loads(read('voice.json')).items():
        if not re.fullmatch(r'[a-z_]+', clip_id) or reference.get(clip_id) != clip['text']:
            raise ValueError(f'Неверный ID или текст записи: {clip_id}')
        raw = (ORIGINAL / 'audio' / f'{clip_id}.mp3').read_bytes()
        if not raw or hashlib.sha256(raw).hexdigest() != clip['sha256']:
            raise ValueError(f'Запись изменилась: {clip_id}')
        bank[clip_id] = 'data:audio/mpeg;base64,' + base64.b64encode(raw).decode('ascii')

    parts = {'CSS': read('style.css'), 'VOICE': json.dumps(bank, separators=(',', ':')),
             'JS': '\n\n'.join(read(name) for name in ('model.js', 'player.js', 'game.js'))}
    parts.update({f'ART_{name.upper()}': read(f'art/{name}.svg') for name in ('dom', 'som', 'mak', 'rak')})
    template = read('page.html')
    if sorted(re.findall(r'@@([A-Z_]+)@@', template)) != sorted(parts):
        raise ValueError('Неверные маркеры шаблона')
    return (re.sub(r'@@([A-Z_]+)@@', lambda m: parts[m[1]], template) + '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='сверить байты, не менять index.html')
    args = parser.parse_args()
    result = build()
    target = ROOT / 'index.html'
    if args.check:
        if not target.is_file() or target.read_bytes() != result:
            parser.exit(1, 'index.html не совпадает со сборкой\n')
    else:
        target.write_bytes(result)
    print(f'index.html: {len(result)} bytes, sha256 {hashlib.sha256(result).hexdigest()}')


if __name__ == '__main__':
    main()
