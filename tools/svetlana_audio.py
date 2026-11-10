"""Build complete, isolated Svetlana banks for the three learning games.

No credentials or paid APIs. Old audio/ stays unchanged. Work is checkpointed
outside git, requests are sequential and throttled, and failures stop the build.
"""
from __future__ import annotations
import argparse
import array
import asyncio
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

VOICE = 'ru-RU-SvetlanaNeural'
BANKS = ('bukvograd', 'tsifrograd', 'tsifrograd-lab')
VOWELS = 'аеёиоуыэюяАЕЁИОУЫЭЮЯ'
ROOT = Path(__file__).resolve().parents[1]
TRIM_REVISION = 1


def normalize_text(raw, *, clip_id=''):
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError('Empty speech source')
    text = raw.replace('[[ɨ]]', 'Ы')
    if '[[' in text or ']]' in text or re.search(r'\+(?![' + VOWELS + '])', text):
        raise ValueError('Unsupported pronunciation markup')
    if clip_id == 'snd_o':
        return 'О-о-о! О-о-о! О-о-о!'
    def word(match):
        value = match.group()
        count = sum(c in VOWELS for c in value)
        def stress(m):
            vowel = m.group(1)
            return vowel + ('\u0301' if count > 1 and vowel not in 'ёЁ' else '')
        return re.sub(r'\+([' + VOWELS + '])', stress, value)
    text = re.sub(r'[А-Яа-яЁё+]+', word, text).strip()
    if '+' in text:
        raise ValueError('Unconverted stress marker')
    one = re.fullmatch(r'([' + VOWELS + r'])[\s.!?]*', text)
    if one:
        char = one.group(1).upper()
        return 'О-о-о!' if char == 'О' else char + '.'
    return text


def collect_specs(root=ROOT):
    root = Path(root)
    bg = json.loads((root / 'bukvograd/src/clips.json').read_text())
    tg = json.loads((root / 'tsifrograd/src/clips.json').read_text())
    old_tg = {p.stem for p in (root / 'tsifrograd/audio').glob('*.mp3')}
    for key in old_tg - set(tg):
        if key not in bg:
            raise ValueError('Missing reused source: ' + key)
        tg[key] = bg[key]
    lab = json.loads((root / 'tsifrograd-lab/tts/clips.json').read_text())['clips']
    rows = []
    for bank, source in [('bukvograd', bg), ('tsifrograd', tg), ('tsifrograd-lab', lab)]:
        existing = {p.stem for p in (root / bank / 'audio').glob('*.mp3')}
        if not existing.issubset(source):
            raise ValueError('Missing source for an existing recording: ' + bank)
        for clip_id, value in sorted(source.items()):
            if not re.fullmatch(r'[a-z0-9_]+', clip_id):
                raise ValueError('Unsafe clip identifier')
            text = value['text'] if isinstance(value, dict) else value
            speed = value.get('speed', 1) if isinstance(value, dict) else (.95 if bank == 'tsifrograd' and clip_id.startswith('c_') else 1)
            if not isinstance(speed, (int, float)) or not .8 <= speed <= 1.2:
                raise ValueError('Unsupported speed')
            rows.append({'bank': bank, 'id': clip_id, 'source_text': text, 'text': normalize_text(text, clip_id=clip_id), 'rate': f'{round((speed-1)*100):+d}%', 'pitch': '+0Hz'})
    return rows


def cache_key(spec):
    payload = {'voice': VOICE, 'text': spec['text'], 'rate': spec['rate'], 'pitch': spec['pitch'], 'volume': '+0%', 'boundary': 'WordBoundary', 'trim_revision': TRIM_REVISION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def trim_bounds(words, duration):
    if not words:
        return 0, duration
    for word in words:
        if not all(isinstance(word.get(k), (int, float)) and math.isfinite(word[k]) and word[k] >= 0 for k in ['start', 'duration']):
            raise ValueError('Invalid word timings')
    start = max(0, min(w['start'] for w in words) - .08)
    end = min(duration, max(w['start'] + w['duration'] for w in words) + .16)
    if end - start < .1:
        raise ValueError('Invalid trimmed duration')
    return round(start, 8), round(end, 8)


def cache_entry(cache, key):
    path, meta = cache / (key + '.mp3'), cache / (key + '.json')
    if not path.is_file() or not meta.is_file():
        return None
    try:
        value = json.loads(meta.read_text())
        if value['request_sha256'] != key or value['voice'] != VOICE:
            return None
        if value['bytes'] != path.stat().st_size or value['sha256'] != hashlib.sha256(path.read_bytes()).hexdigest():
            return None
        if not .1 <= value['duration_seconds'] <= 120:
            return None
        return value
    except (OSError, ValueError, KeyError, TypeError):
        return None


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.part')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def verify_audio(path):
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(path)], capture_output=True, text=True, timeout=20)
    if probe.returncode:
        raise ValueError('Invalid MP3 container')
    duration = float(json.loads(probe.stdout)['format']['duration'])
    if not .1 <= duration <= 120:
        raise ValueError('Unexpected duration')
    decoded = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 's16le', '-ar', '24000', '-ac', '1', '-'], capture_output=True, timeout=25)
    if decoded.returncode or not decoded.stdout:
        raise ValueError('MP3 decode failed')
    samples = array.array('h'); samples.frombytes(decoded.stdout)
    if max(map(abs, samples), default=0) < 200:
        raise ValueError('Silent recording')
    active = 0
    for i in range(0, len(samples), 480):
        chunk = samples[i:i+480]
        if chunk and math.sqrt(sum(float(v)*v for v in chunk) / len(chunk)) > 120:
            active += .02
    if active < .06:
        raise ValueError('No usable speech region')
    return duration, round(active, 4)


async def generate_one(spec, cache, key):
    import edge_tts
    raw = cache / (key + '.raw.mp3')
    temp = cache / (key + '.part.mp3')
    words = []
    try:
        async def download():
            communication = edge_tts.Communicate(spec['text'], VOICE, rate=spec['rate'], pitch=spec['pitch'], boundary='WordBoundary')
            with raw.open('wb') as f:
                size = 0
                async for chunk in communication.stream():
                    if chunk['type'] == 'audio':
                        data = chunk.get('data')
                        if not isinstance(data, bytes) or not data:
                            raise ValueError('Invalid audio chunk')
                        size += len(data)
                        if size > 3 * 1024 * 1024:
                            raise ValueError('Speech response exceeds budget')
                        f.write(data)
                    elif chunk['type'] == 'WordBoundary':
                        text, offset, duration = chunk.get('text'), chunk.get('offset'), chunk.get('duration')
                        if not isinstance(text, str) or not isinstance(offset, (int, float)) or not isinstance(duration, (int, float)):
                            raise ValueError('Invalid timing chunk')
                        words.append({'text': text, 'start': offset/1e7, 'duration': duration/1e7})
        for attempt in range(2):
            try:
                words.clear()
                await asyncio.wait_for(download(), timeout=55)
                break
            except Exception as error:
                status = getattr(error, 'status', None)
                retry = isinstance(error, (TimeoutError, ConnectionError)) or status in (429, 500, 502, 503, 504) or type(error).__name__ in ('ClientConnectionError', 'ServerDisconnectedError')
                if not attempt and retry:
                    print(json.dumps({'retry': type(error).__name__, 'status': status, 'wait_seconds': 20}), flush=True)
                    await asyncio.sleep(20)
                    continue
                raise RuntimeError('Synthesis stopped: ' + type(error).__name__ + (f' HTTP {status}' if isinstance(status, int) else '')) from None
        duration, _ = verify_audio(raw)
        start, end = trim_bounds(words, duration)
        process = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af', f'atrim=start={start}:end={end},asetpts=PTS-STARTPTS', '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', str(temp)], capture_output=True, timeout=25)
        if process.returncode:
            raise ValueError('Trim/encode failed')
        duration, active = verify_audio(temp)
        audio = temp.read_bytes()
        result = {'request_sha256': key, 'voice': VOICE, 'text': spec['text'], 'rate': spec['rate'], 'pitch': spec['pitch'], 'duration_seconds': duration, 'active_seconds': active, 'bytes': len(audio), 'sha256': hashlib.sha256(audio).hexdigest(), 'word_timings': words, 'trim': {'start_seconds': start, 'end_seconds': end, 'revision': TRIM_REVISION}}
        temp.replace(cache / (key + '.mp3'))
        write_json(cache / (key + '.json'), result)
        return result
    finally:
        raw.unlink(missing_ok=True); temp.unlink(missing_ok=True)


async def build(root, cache, max_new=700, interval=1.1, plan_only=False):
    rows = collect_specs(root)
    groups = {}
    for row in rows:
        groups.setdefault(cache_key(row), []).append(row)
    present = {key: cache_entry(cache, key) for key in groups}
    pending = sum(value is None for value in present.values())
    summary = {'voice': VOICE, 'target_files': len(rows), 'unique_requests': len(groups), 'cached_unique': len(groups)-pending, 'new_requests': pending, 'banks': {bank: sum(r['bank']==bank for r in rows) for bank in BANKS}}
    print(json.dumps(summary, ensure_ascii=False), flush=True)
    if plan_only:
        return summary
    if not isinstance(max_new, int) or max_new < pending:
        raise ValueError('New request budget exceeded')
    if not math.isfinite(interval) or interval < 1:
        raise ValueError('Request interval must be at least one second')
    cache.mkdir(parents=True, exist_ok=True)
    manifests = {bank: {'schema': 1, 'provider': 'edge-tts', 'voice': VOICE, 'bank': bank, 'complete': False, 'clips': {}} for bank in BANKS}
    for bank in BANKS:
        (root / bank / 'audio-svetlana').mkdir(exist_ok=True)
    def checkpoint(complete=False):
        for bank in BANKS:
            manifests[bank]['complete'] = complete
            write_json(root / bank / 'audio-svetlana/manifest.json', manifests[bank])
    checkpoint()
    started = 0.; generated = 0
    for index, (key, specs) in enumerate(groups.items(), 1):
        info = present[key]
        if info is None:
            await asyncio.sleep(max(0, interval - (time.monotonic()-started)))
            started = time.monotonic()
            info = await generate_one(specs[0], cache, key)
            generated += 1
        for spec in specs:
            destination = root / spec['bank'] / 'audio-svetlana' / (spec['id'] + '.mp3')
            shutil.copyfile(cache / (key + '.mp3'), destination)
            manifests[spec['bank']]['clips'][spec['id']] = {'source_text': spec['source_text'], **info}
        if index % 10 == 0 or index == len(groups):
            print(json.dumps({'ready_unique': index, 'of_unique': len(groups), 'generated': generated, 'ready_files': sum(len(m['clips']) for m in manifests.values()), 'bank_progress': {b: len(m['clips']) for b,m in manifests.items()}}, ensure_ascii=False), flush=True)
            checkpoint()
    for bank in BANKS:
        expected = {r['id'] for r in rows if r['bank']==bank}
        assert set(manifests[bank]['clips']) == expected
        assert {p.stem for p in (root/bank/'audio-svetlana').glob('*.mp3')} == expected
    checkpoint(True)
    result = {**summary, 'result': 'PASS', 'generated': generated, 'banks_complete': True}
    write_json(cache / 'last-build.json', result)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--cache-dir', type=Path, default=Path.home()/'.cache/gamedev-svetlana')
    parser.add_argument('--max-new', type=int, default=700)
    parser.add_argument('--interval', type=float, default=1.1)
    parser.add_argument('--plan-only', action='store_true')
    args = parser.parse_args()
    try:
        result = asyncio.run(build(args.root, args.cache_dir, args.max_new, args.interval, args.plan_only))
        print(json.dumps(result, ensure_ascii=False), flush=True)
    except Exception as error:
        print('Build stopped: ' + str(error), flush=True)
        raise SystemExit(1) from None
