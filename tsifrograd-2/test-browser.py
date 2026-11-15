"""Integrated v2 browser acceptance; static files, private profiles, no installs.

  python tsifrograd-2/test-browser.py
  LAB_BASE_URL=https://games.distantec.app LAB_QA_OUT=/path/to/evidence python ...

Every invocation creates a fresh child evidence directory (including on RED).
Only this module and test-voice.py are test-owned. Importing this file is inert.
"""
from __future__ import annotations

import contextlib
import datetime as dt
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
import traceback
import uuid
from urllib.parse import urljoin, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT.parent / 'verification/tsifrograd-2-release/qa'
KEY = 'tsifrograd-2-v1'
KINDS = ('load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge')
ADVANCED = {'orders', 'sharing', 'bridge'}
CORE = set(KINDS) - ADVANCED
# Deliberately opaque, including broken JSON: never migrate/normalise these strings.
OLD = {
    'tsifrograd-v1': ' {"route":"30","familySentinel":"keep exact \\u0451","done":{"4":1}}\n',
    'bukvograd-v1': '{not-json: "opaque family alphabet"}\n',
    'tsifrograd-lab-v1': ' {"version":1,"counts":{"orders":71},"sound":false,"sentinel":"old lab"} ',
    'tsifrograd-lab-v2': ' {"version":2,"stage":5,"sound":false,"counts":{},"sessions":{},"sentinel":"keep the preview exact"} ',
}
RANGES = {1: (1, 5), 2: (1, 10), 3: (11, 20), 4: (11, 20), 5: (21, 30)}
REQUIRED = {
    1: {'load', 'find', 'count'},
    2: {'load', 'find', 'count', 'long'},
    3: {'load', 'count', 'missing', 'neighbors', 'long'},
    4: {'count', 'missing', 'neighbors', 'long'} | ADVANCED,
    5: {'load', 'count', 'missing', 'neighbors', 'long'} | ADVANCED,
}


def fresh_progress(stage=1, counts=None, sound=False, sessions=None):
    value = {
        'version': 2, 'stage': stage, 'sound': sound,
        'counts': {str(s): dict.fromkeys(KINDS, 0) for s in range(1, 6)},
        'sessions': {str(s): 0 for s in range(1, 6)},
    }
    for s, kinds in (counts or {}).items():
        value['counts'][str(s)].update(kinds)
    value['sessions'].update({str(k): v for k, v in (sessions or {}).items()})
    return value


def source_manifest():
    # Runtime-only inputs, never PLAN/DESIGN or other writers' test files.
    return {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted((ROOT / 'tsifrograd-2').rglob('*'))
        if p.is_file() and p.suffix in {'.mjs', '.html', '.css', '.svg', '.mp3'}
        and '.test.' not in p.name and 'audio-svetlana' not in p.parts
    }


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class Site:
    def __enter__(self):
        self.server = None
        self.thread = None
        base = os.environ.get('LAB_BASE_URL')
        if not base:
            self.server = http.server.ThreadingHTTPServer(
                ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
            self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
            self.thread.start()
            base = f'http://127.0.0.1:{self.server.server_port}'
        self.base = base.rstrip('/') + '/'
        self.url = urljoin(self.base, 'tsifrograd-2/')
        return self

    def __exit__(self, *_exc):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            if self.thread:
                self.thread.join(timeout=5)


class Evidence:
    def __init__(self, name, env):
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        self.out = Path(os.environ.get(env, str(DEFAULT_OUT))) / f'{name}-{stamp}-{uuid.uuid4().hex[:8]}'
        self.out.mkdir(parents=True, exist_ok=False)
        self.name = name
        self.rows = []
        self.before = source_manifest()
        self.started = time.monotonic()
        self.meta = {}
        print(f'EVIDENCE={self.out}', flush=True)

    def event(self, **event):
        with (self.out / 'events.jsonl').open('a', encoding='utf-8') as f:
            f.write(json.dumps(event, ensure_ascii=False, default=str) + '\n')

    def case(self, name, fn):
        start = time.monotonic()
        try:
            detail = fn()
            row = {'name': name, 'status': 'PASS', 'detail': detail}
        except Exception as exc:
            row = {'name': name, 'status': 'FAIL', 'error': str(exc),
                   'traceback': traceback.format_exc()}
        row['seconds'] = round(time.monotonic() - start, 3)
        self.rows.append(row)
        self.event(**row)
        print(f'{row["status"]}: {name}' + (f' — {row["error"]}' if 'error' in row else ''), flush=True)
        return row['status'] == 'PASS'

    def blocked(self, names, reason):
        for name in names:
            row = {'name': name, 'status': 'BLOCKED', 'reason': reason}
            self.rows.append(row)
            self.event(**row)
        print(f'BLOCKED: {len(names)} groups — {reason}', flush=True)

    def finish(self):
        after = source_manifest()
        counts = {s: sum(row['status'] == s for row in self.rows) for s in ('PASS', 'FAIL', 'BLOCKED')}
        drift = sorted(k for k in set(self.before) | set(after) if self.before.get(k) != after.get(k))
        result = 'PASS' if not counts['FAIL'] and not counts['BLOCKED'] and not drift else 'RED'
        report = {
            'result': result, 'suite': self.name, 'counts': counts, 'checks': self.rows,
            'seconds': round(time.monotonic() - self.started, 3),
            'runtime_manifest_before': self.before, 'runtime_manifest_after': after,
            'test_manifest': {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                              for p in [ROOT / 'tsifrograd-2/test-browser.py', ROOT / 'tsifrograd-2/test-voice.py']},
            'runtime_changed_during_run': drift, **self.meta,
            'limitations': ['Chromium automation/touch emulation, not physical touch or child playtesting',
                            'Real WebAudio execution is not human listening or pronunciation acceptance',
                            'RED against in-progress files is not an integration approval'],
        }
        (self.out / f'{self.name}-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        summary = {'result': result, **counts, 'runtime_drift': drift, 'evidence': str(self.out)}
        (self.out / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)
        return 0 if result == 'PASS' else 1


def chrome_path(playwright):
    override = os.environ.get('LAB_CHROME')
    if override:
        assert Path(override).is_file(), f'LAB_CHROME is not a file: {override}'
        return override
    candidates = list(Path('/root/.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'))
    # Numeric order; no /snap/bin/chromium, downloads, or default missing revision.
    candidates.sort(key=lambda p: int(p.parents[1].name.split('-')[-1]), reverse=True)
    path = str(candidates[0]) if candidates else playwright.chromium.executable_path
    assert Path(path).is_file(), 'No installed Chromium; set LAB_CHROME (do not install implicitly)'
    return path


def storage_script(raw=None, denied=False):
    return '''(() => {
      const store = window.localStorage;
      const nativeSet = Storage.prototype.setItem;
      const nativeGet = Storage.prototype.getItem;
      const nativeRemove = Storage.prototype.removeItem;
      const nativeClear = Storage.prototype.clear;
      const old = OLD_VALUES;
      if (!sessionStorage.getItem('__v2_qa_seeded')) {
        for (const [key,value] of Object.entries(old)) nativeSet.call(store,key,value);
        if (INITIAL_RAW !== null) nativeSet.call(store,NEW_KEY,INITIAL_RAW);
        sessionStorage.setItem('__v2_qa_seeded','yes');
      }
      const emit = (op,key,value) => {
        const event = {op,key,value};
        window.__qaRuntimeWrites.push(event);
        window.__qaStorageEvent(event);
      };
      window.__qaRuntimeWrites = [];
      Storage.prototype.setItem = function(key,value) {
        if (this === store) emit('setItem',String(key),String(value));
        return nativeSet.call(this,key,value);
      };
      Storage.prototype.removeItem = function(key) {
        if (this === store) emit('removeItem',String(key),null);
        return nativeRemove.call(this,key);
      };
      Storage.prototype.clear = function() {
        if (this === store) emit('clear',null,null);
        return nativeClear.call(this);
      };
      // Only fixture code calls this: real Storage, never application state.
      window.__qaSetFixture = raw => nativeSet.call(store,NEW_KEY,raw);
      window.__qaOldValues = () => Object.fromEntries(Object.keys(old).map(k=>[k,nativeGet.call(store,k)]));
      if (DENIED) Object.defineProperty(window,'localStorage', {
        configurable:true, get(){throw new DOMException('QA denied storage','SecurityError')}
      });
    })()'''.replace('OLD_VALUES', json.dumps(OLD)).replace('INITIAL_RAW', json.dumps(raw)).replace('NEW_KEY', json.dumps(KEY)).replace('DENIED', json.dumps(denied))


class Session:
    def __init__(self, browser, site, evidence, *, fixture=None, raw=None, denied=False,
                 viewport=None, touch=False, motion='reduce', init=None, routes=None):
        self.site, self.evidence, self.denied = site, evidence, denied
        self.writes, self.errors, self.console, self.resources, self.requests = [], [], [], [], []
        self.expected_failures = []
        self.context = browser.new_context(viewport=viewport or {'width': 1024, 'height': 768},
                                           has_touch=touch, is_mobile=touch, reduced_motion=motion)
        self.context.set_default_timeout(5000)
        self.context.set_default_navigation_timeout(20000)
        self.context.expose_binding('__qaStorageEvent', lambda _source, event: self.writes.append(event))
        initial = json.dumps(fixture, ensure_ascii=False) if fixture is not None else raw
        self.context.add_init_script(storage_script(initial, denied))
        if init:
            self.context.add_init_script(init)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda exc: self.errors.append(str(exc)))
        self.page.on('console', lambda msg: self.console.append({'text': msg.text, 'location': msg.location}) if msg.type == 'error' else None)
        self.page.on('request', lambda req: self.requests.append({'url': req.url, 'method': req.method, 'type': req.resource_type}))
        self.page.on('response', lambda res: self.resources.append({'url': res.url, 'status': res.status}) if res.status >= 400 else None)
        self.page.on('requestfailed', lambda req: self.resources.append({'url': req.url, 'failure': req.failure}) if req.failure != 'net::ERR_ABORTED' else None)
        if routes:
            routes(self)

    def goto(self, query=''):
        self.page.goto(self.site.url + query, wait_until='networkidle')
        return self.page

    def screenshot(self, name):
        name = re.sub(r'[^A-Za-z0-9_.-]', '-', name)
        path = self.evidence.out / f'{name}-{uuid.uuid4().hex[:6]}.png'
        self.page.screenshot(path=str(path), full_page=True, timeout=10000)
        return str(path)

    def verify(self):
        if self.page.is_closed():
            raise AssertionError('page unexpectedly closed before isolation verification')
        assert self.page.evaluate('window.__qaOldValues()') == OLD, 'old opaque saves changed'
        # Flush the asynchronous exposed-binding messages before inspecting the Python log.
        self.page.evaluate('Promise.resolve()')
        bad = [w for w in self.writes if w['op'] != 'setItem' or w['key'] != KEY]
        assert not bad, f'non-v2 runtime storage writes: {bad}'
        assert not self.errors, self.errors
        expected = set(self.expected_failures)
        unexpected = [r for r in self.resources if r['url'] not in expected]
        console = [c for c in self.console if not any(u in c['location'].get('url', '') or u in c['text'] for u in expected)]
        assert not unexpected, f'unexpected resources: {unexpected}'
        assert not console, f'unexpected console errors: {console}'
        origin = urlparse(self.site.url)
        external = [r for r in self.requests if urlparse(r['url']).scheme in {'http', 'https'}
                    and urlparse(r['url']).netloc != origin.netloc]
        assert not external, f'external runtime requests: {external}'
        forbidden = [r for r in self.requests if 'audio-svetlana' in r['url'] or r['method'] != 'GET']
        assert not forbidden, f'non-static/non-Julia runtime requests: {forbidden}'

    def close(self):
        try:
            old_after = self.page.evaluate('window.__qaOldValues()')
        except Exception as exc:
            old_after = {'unavailable': str(exc)}
        self.evidence.event(session={'old_values_before': OLD, 'old_values_after': old_after,
                                    'writes': self.writes, 'page_errors': self.errors,
                                    'console_errors': self.console, 'resource_errors': self.resources,
                                    'expected_injected_failures': self.expected_failures,
                                    'requests': self.requests})
        try:
            # Close real contexts explicitly before disposing the browser page.
            self.page.evaluate("async()=>{for(const c of (window.__qaAudioContexts||[]))if(c.state!=='closed')await c.close()}")
        except Exception:
            pass
        self.context.close()


@contextlib.contextmanager
def session(browser, site, evidence, **options):
    s = Session(browser, site, evidence, **options)
    try:
        yield s
        s.verify()
    except Exception:
        try:
            s.screenshot('failure')
        except Exception:
            pass
        # Isolation must still be checked when the gameplay assertion failed.
        try:
            s.verify()
        except Exception as exc:
            evidence.event(isolation_failure=str(exc))
        raise
    finally:
        s.close()


def state(page):
    return page.locator('#game').evaluate('e=>({...e.dataset})')


def save(page):
    return json.loads(page.evaluate('(key)=>localStorage.getItem(key)', KEY))


def sound_on(page):
    label = page.locator('#sound').get_attribute('aria-label') or ''
    assert re.search('(?:Включить|Выключить) звук', label, re.I), ('ambiguous sound control', label)
    return bool(re.search('Выключить звук', label, re.I))


def mute(page):
    # aria-pressed may describe sound-enabled or mute-enabled; the action label
    # and persisted boolean are unambiguous and do not assume either convention.
    if sound_on(page):
        page.locator('#sound').click()
    assert not sound_on(page)


def home(page):
    if not page.locator('#home').is_visible():
        page.locator('#game button[data-action="home"]:visible').first.click()
    assert page.locator('#home').is_visible()


def select_stage(page, stage):
    home(page)
    button = page.locator(f'button[data-action="stage"][data-stage="{stage}"]')
    assert button.is_enabled(), f'stage {stage} locked'
    button.click()
    assert page.locator('#home').get_attribute('data-stage') == str(stage)


def open_game(page, stage, kind):
    select_stage(page, stage)
    page.locator(f'button[data-action="start"][data-kind="{kind}"]:visible').click()
    value = state(page)
    assert value['stage'] == str(stage) and value['kind'] == kind, value
    assert value['phase'] == 'playing' and page.locator('#game').is_visible(), value
    return value


def pure_task(page):
    value = state(page)
    task = page.evaluate('''async ([stage,kind,round])=>{
      const m=await import('./journey.mjs');return m.createTask(stage,kind,round);
    }''', [int(value['stage']), value['kind'], int(value['round'])])
    assert task['kind'] == value['kind'] and str(task['target']) == value['target'], (task, value)
    assert int(task['stageId']) == int(value['stage']), (task, value)
    return task


def check_progress_shape(value):
    assert value['version'] == 2 and value['stage'] in range(1, 6), value
    assert type(value['sound']) is bool, value
    assert set(value['counts']) == set(map(str, range(1, 6))), value
    assert set(value['sessions']) == set(map(str, range(1, 6))), value
    for row in value['counts'].values():
        assert set(row) == set(KINDS), row
        assert all(type(n) is int and 0 <= n <= 1_000_000 for n in row.values()), row
    assert all(type(n) is int and 0 <= n <= 1_000_000 for n in value['sessions'].values()), value


def missing_values(task):
    solution, holes = task['solution'], task['holes']
    if isinstance(solution, dict):
        return [int(solution[str(i)]) for i in holes]
    assert isinstance(solution, list) and solution, task
    return [int(n) for n in solution] if len(solution) == len(holes) else [int(solution[i]) for i in holes]


def fill_parts(page, manual):
    target = int(state(page)['target'])
    for _ in range(80):
        value = state(page)
        if value['phase'] == 'won':
            assert not manual, 'advanced auto-ended at correct total'
            return
        current = int(value['current'])
        if current == target:
            break
        options = page.locator('#board button[data-action="add"]:visible').evaluate_all('els=>els.filter(e=>!e.disabled).map(e=>Number(e.dataset.value))')
        usable = [v for v in options if 0 < v <= target - current]
        assert usable, (current, target, options)
        page.locator(f'#board button[data-action="add"][data-value="{max(usable)}"]:visible').click()
    assert int(state(page)['current']) == target, state(page)
    if manual:
        assert state(page)['phase'] == 'playing', 'correct advanced total must wait for Check'


def solve(page, task=None):
    value = state(page)
    kind = value['kind']
    task = task or pure_task(page)
    if kind in {'load', 'orders', 'bridge'}:
        fill_parts(page, kind in ADVANCED)
    elif kind == 'sharing':
        total = sum(map(int, value['current'].split(',')))
        for _ in range(45):
            piles = list(map(int, state(page)['current'].split(',')))
            if piles[0] == piles[1]:
                break
            origin = int(piles[1] > piles[0])
            page.locator(f'#board button[data-action="transfer"][data-from="{origin}"]').click()
            after = list(map(int, state(page)['current'].split(',')))
            assert sum(after) == total and min(after) >= 0, (piles, after)
        assert list(map(int, state(page)['current'].split(','))) == [task['target']] * 2
        assert state(page)['phase'] == 'playing', 'equal plates must wait for Check'
    elif kind == 'missing':
        for answer in missing_values(task):
            choice = page.locator(f'#board button[data-action="pick"][data-value="{answer}"]:visible')
            if choice.count() and choice.is_enabled():
                choice.click()
    elif kind == 'long':
        for _ in range(45):
            if state(page)['phase'] == 'won':
                break
            buttons = page.locator('#board button[data-action="tick"]:visible:not([disabled])')
            assert buttons.count(), 'long must expose usable tick controls'
            indices = buttons.evaluate_all('es=>es.map(e=>({index:e.dataset.index,value:e.dataset.value}))')
            cursor = int(state(page)['current'])
            candidates = [i for i, data in enumerate(indices)
                          if data.get('index') == str(cursor) or data.get('value') == str(cursor + 1)]
            if len(indices) == 1:
                buttons.click()
            else:
                assert candidates, (cursor, indices)
                buttons.nth(candidates[0]).click()
    else:
        page.locator(f'#board button[data-action="pick"][data-value="{task["target"]}"]:visible').click()
    if kind in ADVANCED:
        assert page.locator('#check').is_visible()
        page.locator('#check').click()
    else:
        assert task['autoFinish'] is True, task
        assert page.locator('#check').is_hidden(), 'guided core must not need Check'
    assert state(page)['phase'] == 'won', state(page)
    assert page.locator('#reward').is_visible() and page.locator('#next').is_visible()


def single_award(page, before, stage, kind):
    after = save(page)
    expected = json.loads(json.dumps(before))
    expected['counts'][str(stage)][kind] = min(1_000_000, expected['counts'][str(stage)][kind] + 1)
    assert after == expected, (before, after, expected)
    snapshot = state(page)
    assert page.locator('#board button:visible:not([disabled])').count() == 0
    for selector in ['#check', '#game button[data-action="reset"]', '#board button']:
        buttons = page.locator(selector)
        if buttons.count():
            buttons.first.dispatch_event('click')
    assert state(page) == snapshot, 'won task changed after duplicate event'
    assert save(page) == after, 'duplicate award'


def geometry(page):
    metrics = page.evaluate('''()=>{
      const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
      const controls=[...document.querySelectorAll('button,a[href],summary,input,[role=button]')].filter(visible);
      const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,70)}};
      const small=controls.filter(e=>e.getBoundingClientRect().width<47.9||e.getBoundingClientRect().height<47.9).map(rect);
      const overlaps=[];
      for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
        const a=controls[i],b=controls[j];if(a.contains(b)||b.contains(a))continue;
        const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();
        if(Math.min(x.right,y.right)-Math.max(x.left,y.left)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>1)overlaps.push([rect(a),rect(b)]);
      }
      const critical=[];
      for(const [a,b] of [['#task-icon','#task-number'],['#task-text','#task-number'],['.order-customer','.customer-bubble'],['.bridge-foreman','.bridge-meter'],['.cargo-friend','.cargo-total'],['.find-friend','.mystery-ticket'],['.find-friend','.listen-button']]){
        const x=document.querySelector(a),y=document.querySelector(b);if(!x||!y||!visible(x)||!visible(y))continue;
        const r=x.getBoundingClientRect(),s=y.getBoundingClientRect();
        if(Math.min(r.right,s.right)-Math.max(r.left,s.left)>2&&Math.min(r.bottom,s.bottom)-Math.max(r.top,s.top)>2)critical.push({selectors:[a,b],rects:[rect(x),rect(y)]});
      }
      return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,small,overlaps,critical};
    }''')
    assert metrics['scroll'] <= metrics['client'], metrics
    assert metrics['body'] <= metrics['client'], metrics
    assert not metrics['small'], metrics
    assert not metrics['overlaps'], metrics
    assert not metrics['critical'], metrics
    return metrics


def browser_cases(browser, site, ev):
    def shell():
        with session(browser, site, ev) as s:
            page = s.goto()
            assert page.locator('[data-build="tsifrograd-2.0-v1"]').count() == 1, 'v2 build marker missing'
            scripts = page.locator('script[type="module"][src]').evaluate_all('es=>es.map(e=>e.getAttribute("src"))')
            assert any(re.search(r'(?:app|runtime)\.mjs\?v=5(?:&|$)', x) for x in scripts), scripts
            assert page.locator('#home').get_attribute('data-stage') == '1', 'default must be easy stage 1 despite opaque route=30'
            assert page.locator('#start-journey[data-action="journey"]').is_visible()
            stages = page.locator('button[data-action="stage"]').evaluate_all('es=>es.map(e=>({stage:e.dataset.stage,disabled:e.disabled}))')
            assert sorted(x['stage'] for x in stages) == list('12345') and not any(x['disabled'] for x in stages), stages
            for selector in ['#board', '#sound', '#check', '#reward', '#next', '#feedback', '#voice-note', '#save-note']:
                assert page.locator(selector).count() == 1, selector
            s.screenshot('home-default-tablet')
            return {'scripts': scripts, 'stages': stages}
    ready = ev.case('v2 shell / default stage / five unlocked explicit stages', shell)

    def isolation_probe():
        with session(browser, site, ev) as s:
            page = s.goto()
            mute(page)  # Must really persist a runtime setting using only the new key.
            assert s.writes and all(w['key'] == KEY for w in s.writes), s.writes
            check_progress_shape(save(page))
            return {'runtime_writes': s.writes, 'old_before_after': OLD}
    ev.case('real Storage.setItem instrumentation / opaque legacy saves', isolation_probe)

    def invalid_route():
        with session(browser, site, ev) as s:
            page = s.goto('?stage=1&game=bridge')
            if page.locator('#game').is_visible():
                value = state(page)
                assert value['kind'] not in ADVANCED and value.get('stage') == '1', value
            else:
                assert page.locator('#home').get_attribute('data-stage') == '1'
            return {'advanced_opened': False}
    ev.case('invalid stage=1&game=bridge never opens advanced', invalid_route)

    pending = []
    def add(name, fn):
        pending.append((name, fn))

    def stage_gating(stage):
        with session(browser, site, ev, fixture=fresh_progress()) as s:
            page = s.goto(); select_stage(page, stage)
            buttons = page.locator('button[data-action="start"]:visible')
            kinds = set(buttons.evaluate_all('es=>es.map(e=>e.dataset.kind)'))
            assert REQUIRED[stage] <= kinds <= set(KINDS), (stage, kinds)
            if stage < 4:
                assert not kinds & ADVANCED, (stage, kinds)
            if stage == 1:
                assert kinds == REQUIRED[stage], kinds
            if stage == 2:
                assert kinds == REQUIRED[stage], kinds
            if stage in (3, 4, 5):
                assert kinds == REQUIRED[stage], kinds
            assert all(buttons.nth(i).is_enabled() for i in range(buttons.count()))
            for kind in sorted(kinds):
                open_game(page, stage, kind)
                value = state(page); task = pure_task(page)
                target = int(value['target'])
                lo, hi = RANGES[stage]
                if kind == 'sharing':
                    lo, hi = (3, 5) if stage == 4 else (6, 15)
                elif kind == 'bridge' and stage == 4:
                    lo, hi = 11, 15
                assert lo <= target <= hi, value
                assert task['autoFinish'] == (kind not in ADVANCED), task
                assert page.locator('#check').is_visible() == (kind in ADVANCED)
                if kind == 'bridge':
                    pieces = set(page.locator('#board [data-action="add"]').evaluate_all('es=>es.map(e=>Number(e.dataset.value))'))
                    assert pieces == ({1, 2, 5} if stage == 4 else {1, 2, 5, 10}), pieces
                home(page)
            return {'stage': stage, 'available': sorted(kinds)}
    for stage in range(1, 6):
        add(f'stage {stage}: all eligible starts, ranges, explicit selection, check gating', functools.partial(stage_gating, stage))

    def core_game(kind, stage, round_):
        with session(browser, site, ev, fixture=fresh_progress(stage, {stage: {kind: round_}})) as s:
            page = s.goto(); open_game(page, stage, kind)
            task = pure_task(page); before = save(page)
            initial = state(page)
            if kind in {'find', 'count', 'neighbors', 'missing'}:
                options = page.locator('#board button[data-action="pick"]:visible')
                values = list(map(int, options.evaluate_all('es=>es.map(e=>e.dataset.value)')))
                correct = set(missing_values(task)) if kind == 'missing' else {task['target']}
                wrong = next((n for n in values if n not in correct), None)
                assert wrong is not None, (kind, values, correct)
                if stage in (1, 2):
                    assert len(values) == (2 if stage == 1 else 3), values
                assert not options.evaluate_all('es=>es.some(e=>e.hasAttribute("data-correct")||e.getAttribute("aria-checked")==="true"||e.classList.contains("correct"))'), 'preselected answer leak'
                if kind in {'find', 'count'}:
                    for selector in ['#task-number', '#task-text']:
                        field = page.locator(selector)
                        if field.count() and field.is_visible():
                            assert not re.search(rf'(?<!\d){task["target"]}(?!\d)', field.inner_text()), (kind, 'answer leaked', field.inner_text())
                page.locator(f'#board button[data-action="pick"][data-value="{wrong}"]').click()
                assert state(page)['phase'] == 'playing' and page.locator('#feedback').inner_text().strip()
                assert save(page) == before, 'wrong answer awarded progress'
            elif kind == 'load':
                buttons = page.locator('#board button[data-action="add"]:visible')
                choices = buttons.evaluate_all('es=>es.map(e=>Number(e.dataset.value))')
                value = min(n for n in choices if n < task['target'])
                page.locator(f'#board button[data-action="add"][data-value="{value}"]').click()
                assert state(page)['phase'] == 'playing'
            elif kind == 'long':
                ticks = page.locator('#board button[data-action="tick"]:visible')
                if ticks.count() == 1 and task['target'] > 1:
                    ticks.click()
                    assert state(page)['phase'] == 'playing' and state(page)['current'] == '1', 'long counter did not advance through a real click'
                elif ticks.count() > 1:
                    indices = ticks.evaluate_all('es=>es.map(e=>e.dataset.index)')
                    wrong = next((i for i, n in enumerate(indices) if n is not None and int(n) > int(initial['current'])), None)
                    if wrong is not None:
                        ticks.nth(wrong).click()
                        assert state(page)['phase'] == 'playing' and state(page)['current'] == initial['current']
            page.locator('#game button[data-action="reset"]').click()
            assert state(page)['round'] == initial['round'] and state(page)['phase'] == 'playing'
            assert state(page)['current'] == initial['current'], (initial, state(page))
            assert save(page) == before
            s.screenshot(f'{kind}-stage{stage}-playing')
            solve(page, task); single_award(page, before, stage, kind)
            s.screenshot(f'{kind}-stage{stage}-won')
            page.locator('#next').click()
            assert state(page)['stage'] == str(stage) and state(page)['kind'] == kind
            assert int(state(page)['round']) == round_ + 1 and state(page)['phase'] == 'playing'
            home(page)
            assert page.locator('#home').get_attribute('data-stage') == str(stage)
            return {'target': task['target'], 'round': round_, 'wrong_correct_reset_next_home': True}
    for kind, stage, round_ in [('load', 1, 4), ('load', 5, 9), ('find', 1, 4), ('find', 2, 9),
                               ('count', 1, 4), ('count', 2, 9), ('count', 5, 9),
                               ('neighbors', 3, 9), ('missing', 3, 9), ('long', 3, 0), ('long', 5, 9)]:
        add(f'{kind} stage{stage} round{round_}: start → wrong/partial → reset → fix → win / duplicate / next / home', functools.partial(core_game, kind, stage, round_))

    def advanced(kind, stage, round_, target):
        with session(browser, site, ev, fixture=fresh_progress(stage, {stage: {kind: round_}})) as s:
            page = s.goto(); open_game(page, stage, kind)
            task = pure_task(page); initial = state(page); before = save(page)
            assert int(initial['target']) == target, (initial, target)
            page.locator('#check').click()
            assert state(page)['phase'] == 'playing' and page.locator('#feedback').inner_text().strip()
            if kind == 'sharing':
                piles = list(map(int, initial['current'].split(','))); total = sum(piles)
                assert piles[0] != piles[1] and total == 2 * target
                for _ in range(piles[0]):
                    page.locator('#board button[data-action="transfer"][data-from="0"]').click()
                    now = list(map(int, state(page)['current'].split(',')))
                    assert sum(now) == total and min(now) >= 0
                empty = page.locator('#board button[data-action="transfer"][data-from="0"]')
                assert empty.is_disabled()
                empty.dispatch_event('click')
                assert state(page)['current'] == f'0,{total}'
                s.screenshot(f'sharing-stage{stage}-empty-plate')
                page.locator('#check').click(); assert state(page)['phase'] == 'playing'
            else:
                # Cross the correct target without auto-ending, cap at 40, then remove.
                for _ in range(45):
                    current = int(state(page)['current'])
                    if current == 40:
                        break
                    options = page.locator('#board button[data-action="add"]:visible').evaluate_all('es=>es.filter(e=>!e.disabled).map(e=>Number(e.dataset.value))')
                    usable = [n for n in options if 0 < n <= 40 - current]
                    assert usable, (current, options)
                    page.locator(f'#board button[data-action="add"][data-value="{max(usable)}"]').click()
                    assert state(page)['phase'] == 'playing'
                assert int(state(page)['current']) == 40
                for button in page.locator('#board button[data-action="add"]').all():
                    button.dispatch_event('click')
                assert state(page)['current'] == '40' and state(page)['phase'] == 'playing'
                page.locator('#check').click(); assert state(page)['phase'] == 'playing'
                s.screenshot(f'{kind}-stage{stage}-overfill40')
                page.locator('#board button[data-action="remove"]').first.click()
                assert int(state(page)['current']) < 40
                while page.locator('#board button[data-action="remove"]').count():
                    page.locator('#board button[data-action="remove"]').first.click()
                assert state(page)['current'] == '0'
            assert save(page) == before
            page.locator('#game button[data-action="reset"]').click()
            assert state(page)['current'] == initial['current'] and state(page)['round'] == initial['round']
            solve(page, task); single_award(page, before, stage, kind)
            s.screenshot(f'{kind}-stage{stage}-won')
            page.locator('#next').click()
            assert state(page)['stage'] == str(stage) and state(page)['kind'] == kind
            assert int(state(page)['round']) == round_ + 1
            home(page)
            return {'target': target, 'stage': stage, 'round': round_, 'cap_or_conservation': True}
    for stage, kind, round_, target in [(4, 'orders', 9, 20), (4, 'bridge', 4, 15), (4, 'sharing', 2, 5),
                                         (5, 'orders', 9, 30), (5, 'bridge', 9, 30), (5, 'sharing', 9, 15)]:
        add(f'{kind} stage{stage} upper target {target}: wrong / 40 cap or empty plate / remove / manual win', functools.partial(advanced, kind, stage, round_, target))

    def two_holes(round_):
        with session(browser, site, ev, fixture=fresh_progress(5, {5: {'missing': round_}})) as s:
            page = s.goto(); open_game(page, 5, 'missing'); task = pure_task(page)
            answers = missing_values(task)
            assert len(task['holes']) == len(answers) == 2, task
            sequence = task['sequence']
            assert sum(n is None for n in sequence) == 2, task
            visible = [n for n in sequence if n is not None]
            assert all((b < a if round_ >= 5 else b > a) for a, b in zip(visible, visible[1:])), task
            before = save(page)
            page.locator(f'#board button[data-action="pick"][data-value="{answers[0]}"]').click()
            assert state(page)['phase'] == 'playing' and page.locator('#reward').is_hidden(), 'one of two holes wrongly wins'
            assert save(page) == before
            s.screenshot(f'missing-twoholes-round{round_}-partial')
            page.locator(f'#board button[data-action="pick"][data-value="{answers[1]}"]').click()
            assert state(page)['phase'] == 'won'
            single_award(page, before, 5, 'missing')
            return {'round': round_, 'sequence': sequence, 'solutions': answers}
    for round_ in (3, 5):
        add(f'stage5 missing round{round_}: two holes, partial not win, ascending/reverse', functools.partial(two_holes, round_))

    def journey(stage):
        with session(browser, site, ev, fixture=fresh_progress(stage)) as s:
            page = s.goto(); select_stage(page, stage)
            before = save(page)
            plan = page.evaluate('async s=>(await import("./journey.mjs")).planJourney(s,0)', stage)
            planned = [x if isinstance(x, str) else x['kind'] for x in plan]
            assert len(planned) == 2 and 'long' not in planned, planned
            if stage == 1:
                assert planned[0] == 'load' and planned[1] in {'find', 'count'}, planned
            elif stage == 2:
                assert planned[0] in {'load', 'find'} and planned[1] == 'count', planned
            elif stage == 3:
                assert planned[0] == 'load' and planned[1] in {'count', 'missing', 'neighbors'}, planned
            else:
                assert sum(k in ADVANCED for k in planned) == 1 and sum(k in CORE for k in planned) == 1, planned
            page.locator('#start-journey').click()
            actual = []
            for step in range(2):
                value = state(page)
                assert value['stage'] == str(stage) and value['kind'] == planned[step], value
                actual.append(value['kind']); solve(page)
                page.locator('#next').click()
            assert page.locator('#home').is_visible(), 'journey must end after exactly two tasks'
            after = save(page); expected = json.loads(json.dumps(before))
            for kind in actual:
                expected['counts'][str(stage)][kind] += 1
            expected['sessions'][str(stage)] += 1
            assert after == expected, (after, expected)
            assert page.locator('#home').get_attribute('data-stage') == str(stage), 'auto-harder stage'
            return {'plan': planned, 'actual': actual, 'tasks': 2}
    for stage in range(1, 6):
        add(f'stage{stage} journey: exactly two tasks, category mix, sessions, no auto-harder', functools.partial(journey, stage))

    def persisted():
        with session(browser, site, ev, fixture=fresh_progress(3, {3: {'count': 9}})) as s:
            page = s.goto(); open_game(page, 3, 'count'); task = pure_task(page)
            assert task['target'] == 20
            before = save(page); solve(page, task); single_award(page, before, 3, 'count')
            saved = save(page); check_progress_shape(saved)
            page.reload(wait_until='networkidle')
            assert save(page) == saved
            assert page.locator('#home').get_attribute('data-stage') == '3'
            assert not sound_on(page)
            return {'persisted': saved}
    add('stage3 maximum20 / valid v2 progress reload / sound / opaque saves', persisted)

    def corrupt(raw):
        with session(browser, site, ev, raw=raw) as s:
            page = s.goto(); mute(page)
            expected_stage = page.evaluate('async raw=>(await import("./progress.mjs")).parseProgress(raw).stage', raw)
            assert page.locator('#home').get_attribute('data-stage') == str(expected_stage)
            assert page.locator('#save-note').is_visible()
            note = page.locator('#save-note').inner_text()
            assert re.search('не удалось|поврежд|недоступ|сброш|ошиб|не прочит|не сохран', note, re.I), note
            open_game(page, 1, 'count'); solve(page)
            check_progress_shape(save(page))
            return {'input': raw, 'warning': note}
    for index, raw in enumerate(['{', 'null', '[]', '{"version":2,"stage":99,"sound":"bad","counts":{"1":{"load":-5}},"sessions":null}']):
        add(f'corrupt save {index}: recover, visible warning, playable, new-key-only', functools.partial(corrupt, raw))

    def denied():
        with session(browser, site, ev, denied=True) as s:
            page = s.goto(); mute(page); open_game(page, 1, 'count'); solve(page)
            note = page.locator('#save-note').inner_text()
            assert page.locator('#save-note').is_visible() and re.search('недоступ|не сохран|не удалось', note, re.I), note
            return {'warning': note}
    add('storage SecurityError: visible warning and complete playable task', denied)

    def cap_progress():
        with session(browser, site, ev, fixture=fresh_progress(1, {1: {'count': 1_000_000}})) as s:
            page = s.goto(); open_game(page, 1, 'count'); before = save(page)
            solve(page); single_award(page, before, 1, 'count'); check_progress_shape(save(page))
            return {'count_stays': 1_000_000}
    add('progress counter saturation at 1e6 without duplicate award', cap_progress)

    def direct(stage, kind, legacy=False):
        with session(browser, site, ev, fixture=fresh_progress()) as s:
            query = f'?game={kind}' if legacy else f'?stage={stage}&game={kind}'
            page = s.goto(query); value = state(page)
            assert page.locator('#game').is_visible() and value['stage'] == str(stage) and value['kind'] == kind, value
            return {'query': query, 'state': value}
    for stage, kind in [(1, 'find'), (2, 'long'), (3, 'missing'), (4, 'sharing'), (5, 'bridge')]:
        add(f'direct query stage{stage}/{kind}', functools.partial(direct, stage, kind))
    for kind in sorted(ADVANCED):
        add(f'legacy ?game={kind} opens only stage4', functools.partial(direct, 4, kind, True))

    def keyboard():
        with session(browser, site, ev, fixture=fresh_progress()) as s:
            page = s.goto()
            page.locator('button[data-action="stage"][data-stage="4"]').focus(); page.keyboard.press('Enter')
            assert page.locator('#home').get_attribute('data-stage') == '4'
            page.locator('button[data-action="start"][data-kind="orders"]').focus(); page.keyboard.press('Space')
            action = '#board button[data-action="add"][data-value="1"]'
            page.locator(action).focus(); page.keyboard.press('Enter')
            assert state(page)['current'] == '1'
            assert page.locator(action).evaluate('e=>e===document.activeElement'), 'keyboard focus lost on rerender'
            page.locator('#game button[data-action="home"]:visible').first.focus(); page.keyboard.press('Enter')
            assert page.locator('#home').is_visible()
            return {'Enter': True, 'Space': True, 'rerender_focus': True}
    add('keyboard Enter / Space / focus retention / home', keyboard)

    def responsive(name, width, height, touch, motion):
        with session(browser, site, ev, fixture=fresh_progress(), viewport={'width': width, 'height': height}, touch=touch, motion=motion) as s:
            page = s.goto(); results = {'home': geometry(page)}
            for stage, kind in [(1, 'find'), (2, 'count'), (3, 'missing'), (4, 'sharing'), (5, 'orders'), (5, 'bridge')]:
                open_game(page, stage, kind)
                if kind == 'orders':
                    for _ in range(4):
                        control = page.locator('#board button[data-action="add"][data-value="10"]')
                        control.tap() if touch else control.click()
                    assert state(page)['current'] == '40'
                elif kind == 'sharing':
                    n = int(state(page)['current'].split(',')[0])
                    for _ in range(n):
                        page.locator('#board button[data-action="transfer"][data-from="0"]').click()
                elif kind == 'bridge':
                    solve(page)
                    if motion == 'reduce' and page.locator('.crossing-train').count():
                        duration = page.locator('.crossing-train').evaluate('e=>getComputedStyle(e).transitionDuration')
                        assert all(float(x.strip().removesuffix('s')) <= 0.01 for x in duration.split(',')), duration
                results[kind] = geometry(page)
                s.screenshot(f'{name}-{motion}-{kind}-meaningful')
            return {'viewport': [width, height], 'touch_emulated': touch, 'motion': motion, 'geometry': results}
    for name, width, height, touch in [('phone320', 320, 740, True), ('phone390', 390, 844, True),
                                      ('landscape', 844, 390, True), ('tablet768', 768, 1024, True),
                                      ('tablet1024', 1024, 768, True), ('desktop', 1440, 900, False)]:
        for motion in ('no-preference', 'reduce'):
            add(f'{name} {motion}: geometry ≤ viewport, ≥48px targets, no overlaps, meaningful scenes', functools.partial(responsive, name, width, height, touch, motion))

    if not ready:
        ev.blocked([name for name, _ in pending], 'v2 shell prerequisite absent; other writers are integrating; no green approval')
    else:
        for name, fn in pending:
            ev.case(name, fn)


def main():
    ev = Evidence('browser', 'LAB_QA_OUT')
    try:
        with Site() as site, sync_playwright() as p:
            chrome = chrome_path(p)
            ev.meta.update(base_url=site.url, chrome=chrome, local_runtime=not bool(os.environ.get('LAB_BASE_URL')))
            browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox'])
            try:
                browser_cases(browser, site, ev)
            finally:
                browser.close()
    except Exception as exc:
        ev.case('runner infrastructure', lambda: (_ for _ in ()).throw(exc))
    return ev.finish()


if __name__ == '__main__':
    sys.exit(main())
