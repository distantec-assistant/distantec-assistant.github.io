"""Build the one-file preview from checked-in sources, with no dependencies."""

import argparse
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUTPUT = ROOT / 'index.html'


def read(name):
    return (SRC / name).read_text(encoding='utf-8').strip()


def rendered():
    page = read('page.html')
    css = read('style.css')
    art = read('art.svg')
    ElementTree.fromstring(art)  # The hand-drawn symbol sheet must be well-formed SVG.
    script = '\n'.join(("(() => {", "'use strict';", read('engine.cjs'), read('app.js'), '})();'))
    for marker, content, closing in (
        ('/*__STYLE__*/', css, '</style'),
        ('<!--__ART__-->', art, '</html'),
        ('/*__JAVASCRIPT__*/', script, '</script'),
    ):
        if page.count(marker) != 1 or closing in content.lower():
            raise ValueError(f'Invalid inline slot: {marker}')
        page = page.replace(marker, f'\n{content}\n')
    return (page + '\n').encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare index.html byte-for-byte without writing')
    args = parser.parse_args()
    content = rendered()
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != content:
            parser.exit(1, 'index.html is missing or stale; run python build.py\n')
        print(f'OK: index.html is reproducible ({len(content)} bytes)')
    else:
        OUTPUT.write_bytes(content)
        print(f'Built index.html ({len(content)} bytes)')


if __name__ == '__main__':
    main()
