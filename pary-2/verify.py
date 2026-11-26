"""Run build, model and browser checks; write a receipt for the exact verified HTML."""

import contextlib
import hashlib
import io
import json
import re
import runpy
import struct
import subprocess
import sys
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT.parents[1] / 'verification' / 'games-2' / 'pairs'
HTML = ROOT / 'index.html'


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(args, logfile):
    completed = subprocess.run(args, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               text=True, encoding='utf-8', timeout=30, check=False)
    output = f"$ {' '.join(args)}\n{completed.stdout}\nexit={completed.returncode}\n"
    logfile.write_text(output, encoding='utf-8')
    print(output, end='')
    if completed.returncode:
        raise RuntimeError(f"exit {completed.returncode}: {' '.join(args)}")
    return completed.stdout


def verify(work):
    artifact = sha256(HTML)
    run([sys.executable, 'build.py', '--check'], work / 'build-check.log')
    tap = run(['node', '--test', 'tests/engine.test.cjs'], work / 'node-test.log')
    counts = {name: int(n) for name, n in re.findall(r'^# (tests|pass|fail|skipped|cancelled) (\d+)$', tap, re.M)}
    if (not counts.get('tests') or counts.get('pass') != counts['tests'] or
            any(counts.get(k) != 0 for k in ('fail', 'skipped', 'cancelled'))):
        raise RuntimeError(f'Unexpected TAP summary: {counts}')
    browser_runner = runpy.run_path(str(ROOT / 'tests/browser.py'))['verify_browser']
    browser_log = io.StringIO()
    try:
        with contextlib.redirect_stdout(browser_log):
            browser = browser_runner(work)
    except Exception:
        browser_log.write(traceback.format_exc())
        raise
    finally:
        output = browser_log.getvalue()
        (work / 'browser-check.log').write_text(output, encoding='utf-8')
        print(output, end='')
    if sha256(HTML) != artifact:
        raise RuntimeError('index.html changed during verification')
    screenshots = []
    for name, size in [('phone-missing.png', (320, 640)), ('desktop-missing.png', (1366, 900)),
                       ('desktop-peek.png', (1366, 900))]:
        path = work / name
        png = path.read_bytes()
        if png[:8] != b'\x89PNG\r\n\x1a\n' or struct.unpack('>II', png[16:24]) != size:
            raise RuntimeError(f'Wrong render size or format: {name}')
        screenshots.append({'file': name, 'width': size[0], 'height': size[1], 'sha256': sha256(path)})
    return {
        'result': 'PASS',
        'artifact': 'pary-2/index.html',
        'artifact_sha256': artifact,
        'artifact_bytes': HTML.stat().st_size,
        'command': 'python -B verify.py',
        'workdir': str(ROOT),
        'checks_run': ['python build.py --check', 'node --test tests/engine.test.cjs',
                       'Python Playwright tests/browser.py (Chromium, invoked by verify.py)'],
        'node_test': counts,
        'browser': browser,
        'screenshots': screenshots,
        'verified_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
    }


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    result = EVIDENCE / 'result.json'
    result.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix='run-', dir=EVIDENCE) as temporary:
        work = Path(temporary)
        try:
            receipt = verify(work)
        except Exception as error:
            for log in work.glob('*.log'):
                log.replace(EVIDENCE / f'failed-{log.name}')
            receipt = {'result': 'FAIL', 'command': 'python -B verify.py', 'workdir': str(ROOT),
                       'error': str(error)}
            result.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
            raise
        for file in work.iterdir():
            file.replace(EVIDENCE / file.name)
        staged = work / 'result.json'
        staged.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        staged.replace(result)
    print(f"PASS: {receipt['artifact_sha256']} · {result}")


if __name__ == '__main__':
    main()
