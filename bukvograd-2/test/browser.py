#!/usr/bin/env python3
"""Play the exact, copied HTML in offline Chromium, including its real MP3 playback."""
import argparse
import base64
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WORDS = {'dom': 'ДОМ', 'som': 'СОМ', 'mak': 'МАК', 'rak': 'РАК'}
OLD_KEY = 'bukvograd-v1'
NEW_KEY = 'bukvograd-2-v1'
OLD_SAVE = ' {"old":[1,{"ключ":"не менять"}]}\n'
MEDIA_TRACE = """() => {
  window.mediaTrace = [];
  for (const event of ['loadeddata', 'playing', 'pause', 'ended', 'emptied', 'error']) {
    window.addEventListener(event, e => {
      const a = e.target;
      if (a.id !== 'voice') return;
      const bank = JSON.parse(document.getElementById('voice-bank').textContent);
      const id = Object.keys(bank).find(id => bank[id] === (a.currentSrc || a.getAttribute('src'))) ?? null;
      window.mediaTrace.push({event, id, t: performance.now(), time: a.currentTime,
        duration: Number.isFinite(a.duration) ? a.duration : null, ready: a.readyState, paused: a.paused});
    }, true);
  }
}"""


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def browser_executable(p, given):
    default = Path(p.chromium.executable_path)
    if given:
        assert given.is_file(), given
        return given.resolve()
    if default.is_file():
        return default
    cached = (x for x in default.parents[2].glob('chromium-*') if x.name.split('-')[-1].isdigit())
    for directory in sorted(cached, key=lambda x: int(x.name.split('-')[-1]), reverse=True):
        executable = directory / 'chrome-linux64/chrome'
        if executable.is_file():
            return executable
    for name in ('google-chrome', 'chromium', 'chromium-browser'):
        found = shutil.which(name)
        if found and not found.startswith('/snap/'):
            return Path(found)
    raise RuntimeError('Installed Chromium not found; pass --chromium')


def media_events(page):
    return page.evaluate('window.mediaTrace')


def cursor(page):
    return page.evaluate('window.mediaTrace.length')


def playing(page, start, clip_id):
    page.wait_for_function("([n, id]) => mediaTrace.slice(n).some(e => e.event === 'playing' && e.id === id)",
                           arg=[start, clip_id])
    elapsed = page.wait_for_function("""id => {
        const a = document.querySelector('#voice');
        const bank = JSON.parse(document.querySelector('#voice-bank').textContent);
        return a.currentSrc === bank[id] && !a.paused && a.currentTime > .02 && a.currentTime;
    }""", arg=clip_id).json_value()
    recent = media_events(page)[start:]
    event = next(e for e in recent if e['event'] == 'playing' and e['id'] == clip_id)
    assert event['duration'] > 0 and event['ready'] >= 2 and not event['paused']
    assert any(e['event'] == 'loadeddata' and e['id'] == clip_id and e['ready'] >= 2 for e in recent), recent
    assert 0 < elapsed < event['duration'], (elapsed, event)
    return event


def stopped(page):
    # Chromium may retain the last currentSrc string even in NETWORK_EMPTY.
    page.wait_for_function("""() => {
        const a = document.querySelector('#voice');
        return a.paused && !a.hasAttribute('src') && a.currentTime === 0 &&
            a.networkState === HTMLMediaElement.NETWORK_EMPTY && a.readyState === HTMLMediaElement.HAVE_NOTHING;
    }""")


def layout(page, *selectors):
    result = page.evaluate("""selectors => {
        const positions = selectors.flatMap(s => [...document.querySelectorAll(s)].map(el => {
            const r = el.getBoundingClientRect();
            return [s, r.left, r.top, r.right, r.bottom, r.width, r.height];
        }));
        return {positions, client: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth, w: innerWidth, h: innerHeight};
    }""", selectors)
    assert result['scroll'] == result['w'] == result['client'], result
    assert result['positions'], selectors
    for s, left, top, right, bottom, width, height in result['positions']:
        assert 0 <= left < right <= result['w'] and 0 <= top < bottom <= result['h'], (s, result)
        assert min(width, height) >= 44, (s, result)
    return result


def read_bank(page):
    bank = json.loads(page.locator('#voice-bank').text_content())
    old = ROOT.parent / 'bukvograd'
    manifest = json.loads((ROOT / 'src/voice.json').read_text(encoding='utf-8'))
    transcript = json.loads((old / 'src/clips.json').read_text(encoding='utf-8'))
    assert bank.keys() == manifest.keys() == {'ph_listen', 'w_dom', 'w_som', 'w_mak', 'w_rak'}
    result = {}
    for clip, url in bank.items():
        prefix, data = url.split(',', 1)
        raw = base64.b64decode(data, validate=True)
        assert prefix == 'data:audio/mpeg;base64' and raw == (old / 'audio' / f'{clip}.mp3').read_bytes(), clip
        assert sha(raw) == manifest[clip]['sha256'] and transcript[clip] == manifest[clip]['text'], clip
        result[clip] = {**manifest[clip], 'bytes': len(raw)}
    assert page.evaluate("""() => {
        const bank = JSON.parse(document.querySelector('#voice-bank').textContent);
        const wrong = ['w_dom.mp3', 'w_dom ', 'W_DOM', 'w_luk', '../w_dom', 'snd_d', '__proto__', 'constructor'];
        // These even have valid bytes; their IDs must still be rejected before touching the media.
        const withAliases = {...bank, ...Object.fromEntries(wrong.map(id => [id, bank.w_dom]))};
        const a = document.createElement('audio');
        const voice = createVoice(a, withAliases, Bukvograd.isClipId, () => {}, () => {});
        return wrong.every(id => !voice.play(['w_dom', id]) && !a.hasAttribute('src')) &&
            !voice.play(Array(1)) && !a.hasAttribute('src');
    }""")
    return result


def choice(page, id):
    return page.locator(f'[data-choice="{id}"]')


def assert_unrevealed(page):
    text = page.locator('#listen-screen').inner_text()
    assert not re.search(r'\b(?:ДОМ|СОМ|МАК|РАК)\b', text, flags=re.I), text
    assert not page.locator('#listen-next').is_visible()
    assert page.locator('.picture .art > svg').count() == 3
    assert page.locator('.picture').evaluate_all("els => els.every((b, i) => b.getAttribute('aria-label') === `Картинка ${i+1}`)")


def check_word(page, id, goal=None):
    assert page.locator('#word-first').inner_text() + page.locator('#word-tail').inner_text() == WORDS[id]
    assert page.locator('#bench-art').get_attribute('data-picture') == id
    if goal:
        assert page.locator('#goal-art').is_visible()
        assert page.locator('#goal-art').get_attribute('data-picture') == goal
    else:
        assert page.locator('#bench-again').is_visible()
        assert not page.locator('#goal-art').is_visible()


def touch_route(page, out):
    tap = lambda selector: page.locator(selector).tap()
    shot = lambda name: page.screenshot(path=out / name, animations='disabled')
    page.evaluate('([key, value]) => localStorage.setItem(key, value)', [OLD_KEY, OLD_SAVE])
    assert page.locator('audio').count() == 1
    assert page.locator('meta[name="robots"]').get_attribute('content') == 'noindex,nofollow'
    stopped(page)
    layout(page, '#start-listen', '#start-bench', '#sound')
    shot('01-phone-start.png')
    n = cursor(page)
    tap('#start-listen')
    assert not page.locator('#sample').is_visible()
    assert_unrevealed(page)
    intro = playing(page, n, 'ph_listen')
    dom = playing(page, n, 'w_dom')
    assert intro['t'] < dom['t']
    assert any(e['id'] == 'ph_listen' and e['event'] == 'ended' and intro['t'] <= e['t'] < dom['t'] for e in media_events(page))
    layout(page, '#hear', '#listen-mode', '.picture')
    shot('02-phone-listening.png')

    n = cursor(page)
    tap('#hear')
    first = playing(page, n, 'w_dom')
    n = cursor(page)
    tap('#hear')
    repeat = playing(page, n, 'w_dom')
    assert repeat['time'] < .15
    assert not any(e['event'] == 'ended' and first['t'] < e['t'] < repeat['t'] for e in media_events(page)), media_events(page)
    assert any(e['event'] == 'emptied' for e in media_events(page)[n:]), media_events(page)[n:]
    choice(page, 'mak').tap()
    assert choice(page, 'mak').get_attribute('data-missed') is not None
    assert 'Попробуй ещё' in page.locator('#listen-feedback').inner_text()
    assert_unrevealed(page)
    tap('#listen-mode')
    stopped(page)
    assert page.locator('#sample-art').get_attribute('data-picture') == 'dom'
    assert page.locator('#sample-art svg').evaluate('(s, other) => s.outerHTML === document.querySelector(other).outerHTML', '[data-choice="dom"] svg')
    assert_unrevealed(page)
    layout(page, '#sample-art', '#listen-mode', '.picture')
    shot('03-phone-visual-retry.png')

    n = cursor(page)
    tap('#listen-mode')
    playing(page, n, 'w_dom')
    tap('#sound')
    stopped(page)
    assert page.locator('#sound').get_attribute('aria-pressed') == 'false'
    assert page.locator('#sample').is_visible()
    n = cursor(page)
    choice(page, 'dom').tap()
    assert page.locator('#listen-feedback strong').inner_text() == 'ДОМ'
    assert page.locator('#listen-next').is_visible()
    shot('04-phone-found.png')
    tap('#listen-next')
    assert_unrevealed(page)
    stopped(page)
    assert page.locator('#sample-art').get_attribute('data-picture') == 'som'
    assert not any(e['event'] == 'playing' for e in media_events(page)[n:])

    n = cursor(page)
    tap('#sound')
    playing(page, n, 'w_som')
    for id, next_id in (('som', 'mak'), ('mak', 'rak'), ('rak', None)):
        assert_unrevealed(page)
        choice(page, id).tap()
        assert page.locator('#listen-feedback strong').inner_text() == WORDS[id]
        n = cursor(page)
        tap('#listen-next')
        if next_id:
            playing(page, n, f'w_{next_id}')
    assert page.locator('#finish-screen').is_visible()
    stopped(page)
    n = cursor(page)
    tap('#finish-bench')
    playing(page, n, 'w_dom')
    check_word(page, 'dom', 'som')

    for index, (pair, left, right) in enumerate((('om', 'dom', 'som'), ('ak', 'mak', 'rak'))):
        if index:
            n = cursor(page)
            tap(f'[data-pair="{pair}"]')
            playing(page, n, f'w_{left}')
        check_word(page, left, right)
        page.evaluate("""() => {
            window.tailBefore = document.querySelector('#word-tail');
            window.tailMutations = 0;
            new MutationObserver(() => { window.tailMutations++ }).observe(window.tailBefore, {subtree: true, childList: true, characterData: true});
        }""")
        scene = page.locator('#bench-art svg').evaluate('(s) => s.outerHTML')
        n = cursor(page)
        tap(f'[data-letter="{WORDS[right][0]}"]')
        replacement = playing(page, n, f'w_{right}')
        assert not any(e['event'] == 'ended' and e['id'] == f'w_{left}' and e['t'] < replacement['t'] for e in media_events(page)[n:])
        check_word(page, right, left)
        assert scene != page.locator('#bench-art svg').evaluate('(s) => s.outerHTML')
        layout(page, '#bench-art', '#word-line', '.letter-key', '#bench-hear', '#goal-art')
        if not index:
            shot('05-phone-transformed.png')
        n = cursor(page)
        tap(f'[data-letter="{WORDS[left][0]}"]')
        playing(page, n, f'w_{left}')
        check_word(page, left)
        assert page.evaluate("tailBefore === document.querySelector('#word-tail') && tailMutations === 0")
        n = cursor(page)
        tap(f'[data-letter="{WORDS[right][0]}"]')
        playing(page, n, f'w_{right}')
        check_word(page, right)
        n = cursor(page)
        tap('#bench-again')
        playing(page, n, f'w_{left}')
        check_word(page, left, right)

    tap('#go-home')
    stopped(page)
    assert page.locator('#home-screen').is_visible()
    assert 'Картинки собраны' in page.locator('#home-progress').inner_text()
    assert 'ОМ, АК' in page.locator('#home-progress').inner_text()
    assert page.evaluate('Object.keys(localStorage).sort()') == [NEW_KEY, OLD_KEY]
    assert page.evaluate('key => localStorage.getItem(key)', OLD_KEY) == OLD_SAVE
    tap('#sound')
    assert json.loads(page.evaluate('key => localStorage.getItem(key)', NEW_KEY)) == {
        'muted': True, 'visual': False, 'listened': True, 'solved': ['om', 'ak']}
    trace = media_events(page)
    page.reload()
    assert page.locator('#sound').get_attribute('aria-pressed') == 'false'
    assert 'Картинки собраны' in page.locator('#home-progress').inner_text()
    tap('#start-listen')
    assert page.locator('#sample').is_visible()
    stopped(page)
    assert page.evaluate('key => localStorage.getItem(key)', OLD_KEY) == OLD_SAVE
    return trace


def tablet_route(page, out):
    page.keyboard.press('Tab')
    assert page.locator('#sound').evaluate('(s) => s === document.activeElement')
    page.keyboard.press('Tab')
    page.keyboard.press('Tab')
    assert page.locator('#start-bench').evaluate('(s) => s === document.activeElement')
    n = cursor(page)
    page.keyboard.press('Enter')
    playing(page, n, 'w_dom')
    page.locator('[data-pair="ak"]').press('Enter')
    check_word(page, 'mak', 'rak')
    n = cursor(page)
    page.locator('[data-letter="Р"]').press('Space')
    playing(page, n, 'w_rak')
    check_word(page, 'rak', 'mak')
    layout(page, '#bench-art', '#word-line', '.letter-key', '#bench-hear', '#goal-art', '[data-pair]')
    page.screenshot(path=out / '06-tablet-transformed.png', animations='disabled')
    n = cursor(page)
    page.locator('#bench-hear').press('Enter')
    playing(page, n, 'w_rak')
    page.locator('#go-home').press('Enter')
    stopped(page)
    n = cursor(page)
    page.locator('#start-listen').tap()
    intro = playing(page, n, 'ph_listen')
    page.locator('#go-home').tap()
    stopped(page)
    # Let the cancelled prompt's original lifetime pass: its queued word must not start.
    page.wait_for_timeout((intro['duration'] + .1) * 1000)
    assert not any(e['event'] == 'playing' and e['id'] != 'ph_listen' for e in media_events(page)[n:])
    stopped(page)
    return media_events(page)


def failure_route(page, _out):
    page.locator('#start-listen').click()
    page.locator('#sample').wait_for(state='visible')
    assert_unrevealed(page)
    assert 'Нет звука?' in page.locator('#listen-instruction').inner_text()
    for id in WORDS:
        assert page.locator('#sample-art').get_attribute('data-picture') == id
        choice(page, id).click()
        page.locator('#listen-next').click()
    page.locator('#finish-bench').click()
    page.locator('[data-letter="С"]').click()
    check_word(page, 'som', 'dom')
    page.locator('[data-letter="Д"]').click()
    check_word(page, 'dom')
    page.locator('#go-home').click()
    assert 'Картинки собраны' in page.locator('#home-progress').inner_text()
    assert 'ОМ' in page.locator('#home-progress').inner_text()
    stopped(page)


def svg_files():
    for id in WORDS:
        svg = ET.parse(ROOT / 'src/art' / f'{id}.svg').getroot()
        assert svg.attrib['viewBox'] == '0 0 240 164'
        for el in svg.iter():
            assert el.tag.split('}')[-1] in {'svg', 'g', 'rect', 'circle', 'ellipse', 'path'}
            assert all(not (k.startswith('on') or k in ('id', 'style') or 'href' in k or 'url(' in v)
                       for k, v in el.attrib.items())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--chromium', type=Path)
    args = parser.parse_args()
    out = args.out.resolve()
    assert not out.is_relative_to(ROOT), 'evidence must be outside the game directory'
    out.mkdir(parents=True, exist_ok=True)
    raw = (ROOT / 'index.html').read_bytes()
    svg_files()
    audit = {'artifact_sha256': sha(raw), 'artifact_bytes': len(raw), 'routes': {}}
    with tempfile.TemporaryDirectory(prefix='exact-', dir=out) as isolated, sync_playwright() as p:
        file = Path(isolated) / 'index.html'
        file.write_bytes(raw)
        assert list(file.parent.iterdir()) == [file]
        url = file.as_uri()
        exe = browser_executable(p, args.chromium)
        browser = p.chromium.launch(executable_path=str(exe), args=[
            '--disable-background-networking', '--disable-component-update', '--disable-sync',
            '--host-resolver-rules=MAP * ~NOTFOUND', '--no-pings'])
        audit['chromium'] = {'version': browser.version, 'executable': str(exe)}
        try:
            for name, width, height, run in (
                ('touch-320', 320, 640, touch_route), ('keyboard-tablet', 1024, 768, tablet_route),
                ('audio-and-storage-unavailable', 360, 640, failure_route),
            ):
                errors, failures, requests = [], [], []
                touch = name == 'touch-320'
                context = browser.new_context(offline=True, viewport={'width': width, 'height': height},
                                              is_mobile=touch, has_touch=run is not failure_route, locale='ru-RU')
                context.route(re.compile(r'^https?://'), lambda route: route.abort('internetdisconnected'))
                context.add_init_script(f'({MEDIA_TRACE})();')
                if run is failure_route:
                    context.add_init_script("""
                      HTMLMediaElement.prototype.play = function () {
                        return Promise.reject(new DOMException('test: audio unavailable', 'NotSupportedError'));
                      };
                      Storage.prototype.getItem = Storage.prototype.setItem = function () {
                        throw new DOMException('test: storage unavailable', 'SecurityError');
                      };
                    """)
                page = context.new_page()
                page.set_default_timeout(3500)
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
                page.on('request', lambda req: requests.append(req.url) if not req.url.startswith('data:') else None)
                page.on('requestfailed', lambda req: failures.append([req.url, req.failure]))
                try:
                    response = page.goto(url)
                    assert response is not None and response.ok and response.body() == raw
                    if touch:
                        audit['voice'] = read_bank(page)
                    trace = run(page, out)
                    assert not errors and not failures and set(requests) == {url}, (errors, failures, requests)
                    if trace is not None:
                        assert not any(e['event'] == 'error' for e in trace), trace
                    audit['routes'][name] = {'viewport': [width, height], 'offline': True, 'exact_response': True,
                                             'document_requests': len(requests), 'native_media_events': trace or []}
                    print(f'{name}: PASS', flush=True)
                finally:
                    context.close()
        finally:
            browser.close()
        assert file.read_bytes() == raw
    assert (ROOT / 'index.html').read_bytes() == raw
    (out / 'browser.json').write_text(json.dumps(audit, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"offline exact {audit['artifact_sha256']} | Chromium {audit['chromium']['version']}")


if __name__ == '__main__':
    main()
