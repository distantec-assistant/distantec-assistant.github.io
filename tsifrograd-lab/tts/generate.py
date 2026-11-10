"""Generate only missing/changed Julia v3 recordings; never put keys in argv.

YANDEX_API_KEY must be supplied by a protected environment or a secret manager.
All synthesis happens offline at build time, not in the child's browser.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
ENDPOINT = 'https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis'
MAX_RESPONSE = 12 * 1024 * 1024

class SynthesisError(Exception):
    """Sanitized error: contains no headers, request object or response body."""

def payload_for(config, clip):
    return {
        'text': clip['text'],
        'hints': [{'voice': config['voice']}, {'role': config['role']}, {'speed': clip['speed']}],
        'outputAudioSpec': {'containerAudio': {'containerAudioType': 'MP3'}},
        'loudnessNormalizationType': 'LUFS',
        'unsafeMode': False,
    }

def decode_response(raw):
    chunks = []
    try:
        for line in raw.splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            result = record.get('result', record)
            if 'error' in record:
                raise ValueError('provider error')
            data = result.get('audioChunk', {}).get('data')
            if data:
                chunks.append(base64.b64decode(data, validate=True))
    except (ValueError, TypeError, AttributeError):
        raise SynthesisError('Invalid synthesis response') from None
    audio = b''.join(chunks)
    if not audio:
        raise SynthesisError('Empty synthesis audio')
    return audio

def synthesize(key, payload):
    body = json.dumps(payload, ensure_ascii=False).encode()
    request = urllib.request.Request(ENDPOINT, data=body, method='POST', headers={
        'Authorization': 'Api-Key ' + key,
        'Content-Type': 'application/json',
        'User-Agent': 'Tsifrograd-audio-build/1',
    })
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            raw = response.read(MAX_RESPONSE + 1)
    except urllib.error.HTTPError as error:
        raise SynthesisError('SpeechKit HTTP ' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        # Do not automatically retry a billable request with an unknown outcome.
        raise SynthesisError('Synthesis transport failed; no automatic retry') from None
    if len(raw) > MAX_RESPONSE:
        raise SynthesisError('Synthesis response exceeds size limit')
    return decode_response(raw)

def run(key, only=None, max_requests=25):
    if not key or not isinstance(key, str):
        raise SynthesisError('YANDEX_API_KEY is required')
    config = json.loads((ROOT / 'tts/clips.json').read_text())
    out = ROOT / 'audio'
    out.mkdir(exist_ok=True)
    manifest_path = out / 'manifest.json'
    manifest = {'provider': config['provider'], 'apiVersion': config['apiVersion'], 'voice': config['voice'], 'role': config['role'], 'clips': {}}
    if manifest_path.exists():
        manifest['clips'] = json.loads(manifest_path.read_text()).get('clips', {})
    selected = config['clips'] if only is None else {only: config['clips'][only]}
    pending = []
    for clip_id, clip in selected.items():
        if not re.fullmatch(r'[a-z0-9_]+', clip_id):
            raise SynthesisError('Invalid clip identifier')
        payload = payload_for(config, clip)
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        path = out / (clip_id + '.mp3')
        prior = manifest['clips'].get(clip_id, {})
        if path.exists() and prior.get('request_sha256') == digest and prior.get('sha256') == hashlib.sha256(path.read_bytes()).hexdigest():
            continue
        pending.append((clip_id, clip, payload, digest, path))
    if not isinstance(max_requests, int) or max_requests < 0 or len(pending) > max_requests:
        raise SynthesisError('Request budget exceeded')
    print(json.dumps({'planned_requests': len(pending), 'voice': config['voice'], 'api': config['apiVersion']}, ensure_ascii=False), flush=True)
    for clip_id, clip, payload, digest, path in pending:
        audio = synthesize(key, payload)
        temp = path.with_suffix('.part.mp3')
        try:
            temp.write_bytes(audio)
            p = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels', '-of', 'json', str(temp)], capture_output=True, text=True, timeout=20)
            if p.returncode:
                raise SynthesisError('Invalid generated MP3: ' + clip_id)
            info = json.loads(p.stdout)
            duration = float(info['format']['duration'])
            if not 0.1 <= duration <= 45:
                raise SynthesisError('Unexpected audio duration: ' + clip_id)
            check = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(temp), '-f', 'null', '-'], capture_output=True, timeout=20)
            if check.returncode:
                raise SynthesisError('Audio decode failed: ' + clip_id)
            temp.replace(path)
            manifest['clips'][clip_id] = {**clip, 'request_sha256': digest, 'sha256': hashlib.sha256(audio).hexdigest(), 'bytes': len(audio), 'duration_seconds': duration}
            # Checkpoint after every completed response so a later failure is resumable.
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps({'clip': clip_id, 'status': 'created', 'duration_seconds': duration}, ensure_ascii=False), flush=True)
        finally:
            temp.unlink(missing_ok=True)
    return {'created': len(pending), 'reused': len(selected) - len(pending), 'voice': config['voice']}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only')
    parser.add_argument('--max-requests', type=int, default=25)
    args = parser.parse_args()
    try:
        print(json.dumps(run(os.environ.get('YANDEX_API_KEY'), args.only, args.max_requests), ensure_ascii=False))
    except SynthesisError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
