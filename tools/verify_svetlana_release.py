"""Read back a complete published Svetlana release; no synthesis calls."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BANKS = ('bukvograd', 'tsifrograd', 'tsifrograd-lab')

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='https://games.distantec.app')
    parser.add_argument('--previous', required=True, help='Commit before the voice migration')
    parser.add_argument('--wait-seconds', type=int, default=180)
    args = parser.parse_args()
    head = git('rev-parse', 'HEAD')
    base = args.base_url.rstrip('/')
    output = Path(os.environ.get('SV_QA_OUT', '/root/.hermes/cache/scratch/svetlana-migration'))
    output.mkdir(parents=True, exist_ok=True)
    origin = git('remote', 'get-url', 'origin')
    match = re.fullmatch(r'(?:git@github\.com:|https://github\.com/)([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?', origin)
    if not match:
        raise SystemExit('Unexpected GitHub origin format')
    remote = subprocess.check_output(['git', 'ls-remote', f'https://github.com/{match[1]}/{match[2]}.git', 'refs/heads/main'], text=True, timeout=40).split()[0]
    if remote != head:
        raise SystemExit('Remote main does not match local release')
    old_paths = [bank + '/audio/' for bank in BANKS]
    if git('diff', '--name-only', args.previous, 'HEAD', '--', *old_paths):
        raise SystemExit('An original Julia bank changed')
    for path in ['index.html', 'CNAME', 'maze/index.html']:
        if git('diff', '--name-only', args.previous, 'HEAD', '--', path):
            raise SystemExit('Unrelated page changed: ' + path)
    entries = []
    for path in ['index.html', 'CNAME', 'maze/index.html', 'bukvograd/index.html', 'tsifrograd/index.html', 'tsifrograd-lab/index.html', 'tsifrograd-lab/app.mjs', 'tsifrograd-lab/narration.mjs']:
        data = (ROOT / path).read_bytes()
        entries.append({'path': path, 'sha256': digest(data), 'bytes': len(data), 'group': 'runtime'})
    banks = {}
    for bank in BANKS:
        manifest_path = ROOT / bank / 'audio-svetlana/manifest.json'
        manifest = json.loads(manifest_path.read_text())
        if manifest.get('complete') is not True or manifest.get('voice') != 'ru-RU-SvetlanaNeural':
            raise SystemExit('Incomplete or wrong voice bank: ' + bank)
        banks[bank] = len(manifest['clips'])
        for identifier, clip in manifest['clips'].items():
            if not re.fullmatch(r'[a-z0-9_]+', identifier):
                raise SystemExit('Unsafe clip identifier')
            path = bank + '/audio-svetlana/' + identifier + '.mp3'
            local = (ROOT / path).read_bytes()
            if digest(local) != clip['sha256'] or len(local) != clip['bytes']:
                raise SystemExit('Local recording differs from manifest: ' + path)
            entries.append({'path': path, 'sha256': clip['sha256'], 'bytes': clip['bytes'], 'group': 'svetlana'})
        rel = bank + '/audio-svetlana/manifest.json'
        raw = manifest_path.read_bytes()
        entries.append({'path': rel, 'sha256': digest(raw), 'bytes': len(raw), 'group': 'manifest'})
    for path in ['bukvograd/audio/name_o.mp3', 'bukvograd/audio/snd_y.mp3', 'bukvograd/audio/w_zamok.mp3', 'tsifrograd/audio/c_1.mp3', 'tsifrograd/audio/c_30.mp3', 'tsifrograd/audio/ph_p1.mp3', 'tsifrograd-lab/audio/ph_orders_start.mp3']:
        raw = (ROOT / path).read_bytes()
        entries.append({'path': path, 'sha256': digest(raw), 'bytes': len(raw), 'group': 'legacy_sample'})
    def read(entry):
        request = urllib.request.Request(base + '/' + entry['path'] + '?release=' + head, headers={'User-Agent': 'Sage-GameDev-release-readback'})
        with urllib.request.urlopen(request, timeout=20) as response:
            data = response.read(entry['bytes'] + 1)
            if response.status != 200 or len(data) != entry['bytes'] or digest(data) != entry['sha256']:
                raise ValueError('Published bytes differ')
            return {**entry, 'status': response.status, 'content_type': response.headers.get('Content-Type', '')}
    index = next(e for e in entries if e['path'] == 'bukvograd/index.html')
    deadline = time.monotonic() + args.wait_seconds
    while True:
        try:
            read(index)
            break
        except (ValueError, OSError, urllib.error.URLError):
            if time.monotonic() >= deadline:
                raise SystemExit('Pages deployment was not confirmed within the wait window')
            print('Waiting for Pages to serve the new voice release', flush=True)
            time.sleep(10)
    def verify(entry):
        for attempt in range(2):
            try:
                return read(entry)
            except (ValueError, OSError, urllib.error.URLError) as error:
                if attempt:
                    return {'path': entry['path'], 'group': entry['group'], 'error_type': type(error).__name__}
                time.sleep(2)
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(verify, entry) for entry in entries]
        for future in as_completed(futures):
            results.append(future.result())
            if len(results) % 100 == 0:
                print(json.dumps({'verified_requests_completed': len(results), 'target_requests': len(entries)}), flush=True)
    failures = [r for r in results if 'error_type' in r]
    report = {'result': 'FAIL' if failures else 'PASS', 'commit': head, 'remote_main': remote, 'base_url': base, 'bank_counts': banks, 'target_files': len(entries), 'verified_files': len(results)-len(failures), 'failures': failures, 'entries': sorted(results, key=lambda r:r['path']), 'scope': 'Every new recording, manifests/runtime, original-bank git immutability and explicit legacy HTTP samples; not human listening'}
    (output / 'release-http-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({key: report[key] for key in ['result', 'commit', 'bank_counts', 'target_files', 'verified_files', 'failures']}, ensure_ascii=False, indent=2))
    if failures or len(results) != len(entries):
        raise SystemExit(1)

if __name__ == '__main__':
    main()
