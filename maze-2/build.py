"""Assemble the static standalone Maze 2 HTML; no runtime dependencies."""
import argparse
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
OUT = ROOT / 'index.html'


def render():
    text = (SRC/'page.html').read_text(encoding='utf-8')
    for name, filename, closing in [('CSS','style.css','</style'),('MODEL','model.cjs','</script'),
                                    ('ART','art.js','</script'),('APP','app.js','</script')]:
        marker = f'/* MAIL_{name} */'
        part = (SRC/filename).read_text(encoding='utf-8').rstrip()
        if text.count(marker)!=1 or closing in part.lower():
            raise ValueError(f'Unexpected template/source markup: {filename}')
        text = text.replace(marker,part)
    return text.encode('utf-8')


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--check',action='store_true')
    args = cli.parse_args()
    data = render()
    if args.check:
        if not OUT.is_file() or OUT.read_bytes()!=data:
            cli.exit(1,'Generated HTML mismatch. Run build.py.\n')
    else:
        OUT.write_bytes(data)
    print(f'{"PASS" if args.check else "Built"}: {OUT} ({len(data)} bytes, sha256 {sha256(data).hexdigest()})')


if __name__=='__main__':
    main()
