"""Bundle the prototype with its exact recorded prompts; no network is used."""
import argparse
from base64 import b64encode
from hashlib import sha256
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'src'
ORIGINAL = ROOT.parent / 'uzory'
FINAL = ROOT / 'index.html'
REUSE = {
    'ph_what':'Что д+альше?',
    'ph_intro':'Продолж+и уз+ор!',
    'ph_hint':'Смотр+и, уз+ор повтор+яется!',
    'ph_again':'Попр+обуй ещ+ё!',
    'ph_done':'Ур+а! Всё получ+илось!',
}


def render():
    manifest = json.loads((ORIGINAL/'src/clips.json').read_text(encoding='utf-8'))
    bank = {}
    for clip, text in REUSE.items():
        if manifest.get(clip) != text:
            raise ValueError(f'Original text changed: {clip}')
        raw = (ORIGINAL/'audio'/f'{clip}.mp3').read_bytes()
        if len(raw)<64 or (raw[:3]!=b'ID3' and (raw[0]!=255 or raw[1]&224!=224)):
            raise ValueError(f'Invalid MP3 header: {clip}')
        bank[clip] = 'data:audio/mpeg;base64,'+b64encode(raw).decode('ascii')
    html=(SOURCE/'page.html').read_text(encoding='utf-8')
    text_parts = {key:(SOURCE/file).read_text(encoding='utf-8').rstrip() for key,file in
                  [('CSS','style.css'),('MODEL','model.cjs'),('ART','art.js'),('APP','app.js')]}
    text_parts['VOICES'] = json.dumps(bank,separators=(',', ':')).replace('<','\\u003c')
    for key, content in text_parts.items():
        marker = f'/* PARTY_{key} */'
        if html.count(marker)!=1 or (key != 'CSS' and '</script' in content.lower()):
            raise ValueError(f'Invalid source for {marker}')
        html = html.replace(marker,content)
    return html.encode('utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args = parser.parse_args()
    bundle = render()
    if args.check:
        if not FINAL.is_file() or FINAL.read_bytes()!=bundle:
            parser.exit(1,'Generated HTML does not match sources\n')
    else:
        FINAL.write_bytes(bundle)
    print(f'{"PASS" if args.check else "Built"}: {FINAL} ({len(bundle)} bytes; sha256 {sha256(bundle).hexdigest()})')


if __name__=='__main__':
    main()
