"""Browser regressions for the static lab. No production writes or paid APIs.

Run: python3 tsifrograd-lab/test-browser.py
Optional: LAB_BASE_URL=https://games.distantec.app and LAB_CHROME=/path/to/chrome
The default starts a temporary loopback-only HTTP server and closes it on exit.
"""
from __future__ import annotations
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('LAB_QA_OUT', '/root/.hermes/cache/scratch/tsifrograd-qa'))
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'tsifrograd-lab-v1'
ORIGINAL = '{"done":{"4":1},"gn":{},"pl":{"4":2},"route":"30","familySentinel":"must-stay-exact"}'
checks: list[dict] = []
errors: list[str] = []
failed: list[dict] = []

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

server = None
base = os.environ.get('LAB_BASE_URL')
if not base:
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_address[1]}'
url = base.rstrip('/') + '/tsifrograd-lab/'

def record(name, **data):
    checks.append({'name': name, 'ok': True, **data})

def overflow(page):
    return page.evaluate('({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})')

def state(page):
    return page.locator('#game').evaluate('(e)=>({...e.dataset})')

def open_game(page, kind):
    if not page.locator('#home').is_visible():
        page.locator('#game [data-action="home"]').first.click()
    page.locator(f'[data-action="start"][data-kind="{kind}"]').click()
    assert page.locator('#game').is_visible()
    assert state(page)['kind'] == kind

def fill_parts(page, kind):
    target = int(state(page)['target'])
    for value in ([10, 1] if kind == 'orders' else [10, 5, 2, 1]):
        while int(state(page)['current']) + value <= target:
            page.locator(f'#board [data-action="add"][data-value="{value}"]').click()
    assert int(state(page)['current']) == target
    assert state(page)['phase'] == 'playing', 'must not auto-submit'

def solve(page, kind):
    if kind == 'sharing':
        while True:
            piles = [int(x) for x in state(page)['current'].split(',')]
            if piles[0] == piles[1]:
                break
            old_sum = sum(piles)
            page.locator(f'[data-action="transfer"][data-from="{int(piles[1] > piles[0])}"]').click()
            now = [int(x) for x in state(page)['current'].split(',')]
            assert sum(now) == old_sum
    else:
        fill_parts(page, kind)
    page.locator('#check').click()
    assert state(page)['phase'] == 'won'
    assert page.locator('#reward').is_visible()

def attach(page):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: failed.append({'status': response.status, 'url': response.url}) if response.status >= 400 else None)
    page.on('requestfailed', lambda request: failed.append({'failure': request.failure, 'url': request.url}) if request.failure != 'net::ERR_ABORTED' else None)

def fixture_context(browser, **options):
    context = browser.new_context(**options)
    context.add_init_script(f"if(!sessionStorage.getItem('lab-fixture')){{localStorage.setItem('tsifrograd-v1',{json.dumps(ORIGINAL)});sessionStorage.setItem('lab-fixture','1')}}")
    page = context.new_page()
    attach(page)
    page.goto(url, wait_until='networkidle')
    assert page.title() == 'Цифроград — новые приключения'
    assert page.locator('[data-action="start"]').count() == 3
    return context, page

try:
    with sync_playwright() as p:
        chrome = os.environ.get('LAB_CHROME')
        if not chrome:
            candidates = sorted(Path('/root/.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'), reverse=True)
            chrome = str(candidates[0]) if candidates else p.chromium.executable_path
        browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox'])
        context, page = fixture_context(browser, viewport={'width': 1024, 'height': 768}, reduced_motion='reduce')
        page.locator('#sound').click()  # Deterministic silent gameplay pass.
        page.screenshot(path=str(OUT / 'home-tablet.png'), full_page=True)
        open_game(page, 'orders')
        page.screenshot(path=str(OUT / 'orders-tablet.png'), full_page=True)
        page.locator('#check').click()
        assert state(page)['phase'] == 'playing'
        assert page.locator('#feedback').inner_text()
        target = int(state(page)['target'])
        while int(state(page)['current']) <= target:
            page.locator('[data-action="add"][data-value="10"]').click()
        page.locator('#check').click()
        assert state(page)['phase'] == 'playing'
        assert 'больше' in page.locator('#feedback').inner_text()
        while page.locator('#board [data-action="remove"]').count():
            page.locator('#board [data-action="remove"]').first.click()
        assert state(page)['current'] == '0'
        solve(page, 'orders')
        saved = json.loads(page.evaluate(f'localStorage.getItem({json.dumps(KEY)})'))
        assert saved['counts']['orders'] == 1
        page.locator('#check').dispatch_event('click')  # No double award, even a duplicated event.
        assert json.loads(page.evaluate(f'localStorage.getItem({json.dumps(KEY)})'))['counts']['orders'] == 1
        assert page.locator('#board button:not([disabled])').count() == 0
        page.locator('#next').click()
        assert int(state(page)['target']) != target
        record('orders: too few, too many, remove, exact manual submission, single award, replay', target=target)
        open_game(page, 'sharing')
        initial = [int(x) for x in state(page)['current'].split(',')]
        assert initial[0] != initial[1] and sum(initial) <= 30
        page.screenshot(path=str(OUT / 'sharing-tablet.png'), full_page=True)
        page.locator('#check').click()
        assert state(page)['phase'] == 'playing'
        for _ in range(initial[0]):
            page.locator('[data-action="transfer"][data-from="0"]').click()
        assert page.locator('[data-action="transfer"][data-from="0"]').is_disabled()
        assert sum(int(x) for x in state(page)['current'].split(',')) == sum(initial)
        page.locator('[data-action="reset"]').click()
        assert [int(x) for x in state(page)['current'].split(',')] == initial
        solve(page, 'sharing')
        record('sharing: conservation, empty pile, wrong answer, reset and equal distribution', initial=initial)
        open_game(page, 'bridge')
        page.screenshot(path=str(OUT / 'bridge-tablet.png'), full_page=True)
        page.locator('#check').click()
        assert state(page)['phase'] == 'playing'
        target = int(state(page)['target'])
        while int(state(page)['current']) <= target:
            page.locator('[data-action="add"][data-value="10"]').click()
        page.locator('#check').click()
        assert state(page)['phase'] == 'playing' and 'длиннее' in page.locator('#feedback').inner_text()
        page.locator('#board [data-action="remove"]').first.click()
        page.locator('[data-action="reset"]').click()
        assert state(page)['current'] == '0'
        solve(page, 'bridge')
        assert page.locator('.crossing-train').evaluate("e=>getComputedStyle(e).transitionDuration") == '0s'
        page.screenshot(path=str(OUT / 'bridge-win-tablet.png'), full_page=True)
        record('bridge: short, overlong, remove, reset, solvable and reduced motion', target=target)
        assert page.evaluate("localStorage.getItem('tsifrograd-v1')") == ORIGINAL
        page.reload(wait_until='networkidle')
        assert json.loads(page.evaluate(f'localStorage.getItem({json.dumps(KEY)})'))['counts'] == {'orders': 1, 'sharing': 1, 'bridge': 1}
        assert page.locator('#sound').get_attribute('aria-pressed') == 'true'
        assert page.evaluate("localStorage.getItem('tsifrograd-v1')") == ORIGINAL
        record('save/reload: lab scores and mute persist; original save remains byte-for-byte unchanged')
        context.close()
        context, page = fixture_context(browser, viewport={'width': 1024, 'height': 768})
        page.locator('#sound').click()
        page.locator('[data-action="journey"]').click()
        for index, kind in enumerate(['orders', 'sharing', 'bridge']):
            assert state(page)['kind'] == kind
            assert f'{index + 1} из 3' in page.locator('#game-kicker').text_content()
            solve(page, kind)
            page.locator('#next').click()
        assert page.locator('#home').is_visible()
        record('mixed journey: all three games, correct ordering, completion and return home')
        context.close()
        for name, width, height, touch in [('phone', 390, 844, True), ('small-phone', 320, 740, True), ('phone-landscape', 844, 390, True), ('tablet', 768, 1024, True), ('desktop', 1440, 900, False)]:
            context, page = fixture_context(browser, viewport={'width': width, 'height': height}, has_touch=touch, is_mobile=touch)
            page.locator('#sound').click()
            sizes = overflow(page)
            assert sizes['document'] <= sizes['viewport'] + 1, (name, 'home', sizes)
            page.screenshot(path=str(OUT / f'home-{name}.png'), full_page=True)
            for kind in ['orders', 'sharing', 'bridge']:
                open_game(page, kind)
                sizes = overflow(page)
                assert sizes['document'] <= sizes['viewport'] + 1, (name, kind, sizes)
                small_buttons = page.locator('#game button:visible:not([disabled])').evaluate_all("els=>els.filter(e=>{const r=e.getBoundingClientRect();return r.width<43||r.height<43}).map(e=>({label:e.getAttribute('aria-label')||e.innerText,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))")
                assert not small_buttons, (name, kind, small_buttons)
                if kind == 'orders':
                    action = page.locator('[data-action="add"][data-value="1"]')
                    action.tap() if touch else action.click()
                    assert state(page)['current'] == '1'
                page.screenshot(path=str(OUT / f'{kind}-{name}.png'), full_page=True)
            record('responsive layout and usable controls: ' + name, viewport=[width, height], touch_emulation=touch)
            context.close()
        for raw in ['{', 'null', '[]', '{"counts":{"orders":-5,"sharing":"9","bridge":null},"sound":"bad"}']:
            context = browser.new_context(viewport={'width': 390, 'height': 844})
            context.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(raw)})')
            page = context.new_page(); attach(page); page.goto(url, wait_until='networkidle')
            assert page.locator('[data-action="start"]').count() == 3
            open_game(page, 'orders'); assert state(page)['round'] == '0'
            context.close()
        record('corrupt, null, array and malformed-field saves recover without crashing')
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked storage fixture')}})")
        page = context.new_page(); attach(page); page.goto(url, wait_until='networkidle')
        page.locator('#sound').click(); open_game(page, 'orders'); solve(page, 'orders')
        assert 'Сохранение недоступно' in page.locator('#save-note').inner_text()
        record('blocked storage: game remains playable and limitation is visible')
        context.close()
        # Real network/decode request, not a claim that a human heard the speaker.
        context, page = fixture_context(browser, viewport={'width': 390, 'height': 844})
        open_game(page, 'orders')
        with page.expect_response(lambda response: '/tsifrograd/audio/c_1.mp3' in response.url) as response:
            page.locator('[data-action="add"][data-value="1"]').click()
        assert response.value.status == 200
        page.locator('#sound').click()
        assert page.locator('#sound').get_attribute('aria-pressed') == 'true'
        page.locator('#game [data-action="home"]').first.click()
        record('recorded-number asset returns 200; mute and interrupted navigation work; audible quality not asserted')
        context.close()
        context, page = fixture_context(browser, viewport={'width': 1024, 'height': 768})
        page.locator('#sound').click()
        page.locator('[data-action="start"][data-kind="orders"]').focus()
        page.keyboard.press('Enter')
        page.locator('[data-action="add"][data-value="10"]').focus()
        page.keyboard.press('Enter')
        assert state(page)['current'] == '10'
        assert page.locator('[data-action="add"][data-value="10"]').evaluate('e=>e===document.activeElement')
        record('keyboard: open a game, add a piece and retain focus after rerender')
        context.close()
        browser.close()
    assert not errors, errors
    assert not failed, failed
    report = {'base_url': url, 'checks': checks, 'page_errors': errors, 'failed_resources': failed, 'limitations': ['Chromium desktop/touch emulation, not a physical child/device playtest', 'Russian device voice availability and audible quality require listening on the target device']}
    (OUT / 'browser-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'result': 'PASS', 'checks': len(checks), 'page_errors': errors, 'failed_resources': failed, 'evidence': str(OUT)}, ensure_ascii=False, indent=2))
finally:
    if server:
        server.shutdown()
