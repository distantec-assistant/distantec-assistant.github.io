"""Exercise the exact single-file game with native Chromium input and real file://."""

import json
import os
from pathlib import Path
from urllib.parse import urldefrag

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / 'index.html').as_uri()
KEY = 'pary-2-v1'
PHONE = {'width': 320, 'height': 640}
DESKTOP = {'width': 1366, 'height': 900}


def chromium_path(playwright):
    default = Path(playwright.chromium.executable_path)
    if default.is_file() and os.access(default, os.X_OK):
        return default
    setting = os.environ.get('PLAYWRIGHT_BROWSERS_PATH')
    cache = Path(setting).expanduser() if setting and setting != '0' else default.parent.parent.parent
    builds = [p for p in cache.glob('chromium-*') if p.name.rsplit('-', 1)[1].isdigit()]
    for build in sorted(builds, key=lambda p: int(p.name.rsplit('-', 1)[1]), reverse=True):
        for path in sorted(build.glob('*/chrome')):
            if path.is_file() and os.access(path, os.X_OK):
                return path
    raise FileNotFoundError(f'No installed Chromium in {cache}; default: {default}')


class Run:
    def __init__(self, browser, *, phone=False, reduced=False):
        self.size = PHONE if phone else DESKTOP
        self.context = browser.new_context(
            viewport=self.size, device_scale_factor=1, offline=True,
            is_mobile=phone, has_touch=phone, reduced_motion='reduce' if reduced else 'no-preference',
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(3500)
        self.phone = phone
        self.unexpected = []
        self.documents = []
        self.page.on('pageerror', lambda error: self.unexpected.append(f'pageerror: {error}'))
        self.page.on('console', lambda msg: self.unexpected.append(f'{msg.type}: {msg.text}')
                     if msg.type in {'error', 'warning'} else None)
        self.page.on('requestfailed', lambda req: self.unexpected.append(f'{req.url}: {req.failure}'))
        self.page.on('response', lambda response: self.unexpected.append(f'{response.status}: {response.url}')
                     if response.status >= 400 else None)
        self.page.on('request', self.request)
        self.min_target = float('inf')

    def request(self, request):
        if urldefrag(request.url).url == GAME and request.resource_type == 'document':
            self.documents.append(request.url)
        else:
            self.unexpected.append(f'extra request: {request.resource_type} {request.url}')

    def open(self, suffix=''):
        page = self.page
        page.goto(GAME + suffix, wait_until='load')
        assert page.evaluate('() => location.protocol') == 'file:'
        assert page.evaluate('() => navigator.onLine') is False
        assert page.evaluate('() => [innerWidth, innerHeight]') == list(self.size.values())
        assert 'noindex' in page.locator('meta[name=robots]').get_attribute('content').split(',')
        expect(page.get_by_role('heading', name='Фотоальбом', exact=True)).to_be_visible()

    def hit(self, target):
        if self.phone:
            target.tap()
        else:
            target.click()

    def geometry(self):
        data = self.page.evaluate('''() => ({
          view: document.documentElement.clientWidth,
          width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
          targets: [...document.querySelectorAll('button, a[href]')].filter(el => el.getClientRects().length)
            .map(el => {
              const r = el.getBoundingClientRect();
              const x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
              return { name: el.getAttribute('aria-label') || el.textContent.trim(), w: r.width, h: r.height,
                left: r.left, right: r.right,
                hit: y < 0 || y >= innerHeight || el.contains(document.elementFromPoint(x, y)) };
            }),
        })''')
        assert data['width'] <= data['view'], data
        assert data['targets'], data
        for target in data['targets']:
            self.min_target = min(self.min_target, target['w'], target['h'])
            assert target['w'] >= 44 and target['h'] >= 44, target
            assert target['left'] >= 0 and target['right'] <= data['view'], target
            assert target['hit'], target

    def close(self):
        try:
            assert self.documents, 'No real document request'
            assert not self.unexpected, self.unexpected
        finally:
            self.context.close()


def album_count(page, count):
    expect(page.locator('[data-award][data-earned=true]')).to_have_count(count)
    expect(page.locator('[data-award]')).to_have_count(3)


def views(page, look):
    return page.locator(f'#board button[data-look={look}]')


def art_ids(grid):
    return grid.locator('svg.hero use').evaluate_all('(uses) => uses.map(el => el.getAttribute("href"))')


def unique_pairs(art):
    assert all(hero.startswith('#hero-') and art.count(hero) == 2 for hero in art), art
    return [[i for i, value in enumerate(art) if value == hero] for hero in dict.fromkeys(art)]


def solve_open(run, before):
    cards = run.page.locator('#board button')
    pairs = unique_pairs(art_ids(run.page.locator('#board')))
    assert len(pairs) == 2
    for position, pair in enumerate(pairs):
        for i in pair:
            run.hit(cards.nth(i))
        expect(views(run.page, 'found')).to_have_count((position + 1) * 2)
        if position == 0:
            album_count(run.page, before)


def people(page):
    return page.locator('#scene-people [role=img]').evaluate_all('(els) => els.map(el => el.getAttribute("aria-label"))')


def raw_progress(page):
    return page.evaluate('(key) => window.qaRead(key)', KEY)


def stored(page, stages):
    assert json.loads(raw_progress(page)) == {'version': 1, 'completed': stages}
    assert page.evaluate('() => window.qaRead("other-game-opaque")') == 'не переносить {"opaque":true}'


def storage_audit(context, *, raw=None, deny_write=False):
    context.add_init_script(f'''(() => {{
      const key = {json.dumps(KEY)}, raw = {json.dumps(raw)}, deny = {json.dumps(deny_write)};
      const shelf = window.localStorage, proto = Storage.prototype;
      const nativeGet = proto.getItem, nativeSet = proto.setItem;
      const foreign = "other-game-opaque";
      if (Reflect.apply(nativeGet, shelf, [foreign]) === null) {{
        Reflect.apply(nativeSet, shelf, [foreign, 'не переносить {{"opaque":true}}']);
        if (raw !== null) Reflect.apply(nativeSet, shelf, [key, raw]);
      }}
      window.qaRead = (key) => Reflect.apply(nativeGet, shelf, [key]);
      window.qaCalls = [];
      for (const name of ['getItem', 'setItem', 'removeItem', 'clear', 'key']) {{
        const method = proto[name];
        proto[name] = function (...args) {{
          window.qaCalls.push([name, args[0] ?? null]);
          if (deny && name === 'setItem') throw new DOMException('QA quota', 'QuotaExceededError');
          return Reflect.apply(method, this, args);
        }};
      }}
    }})()''')


def calls(page, n_writes):
    expected = [['getItem', KEY]] + [['getItem', KEY], ['setItem', KEY]] * n_writes
    assert page.evaluate('() => window.qaCalls') == expected


def phone_play(browser, evidence):
    run = Run(browser, phone=True)
    page = run.page
    storage_audit(run.context)
    page.clock.install()
    run.open()
    expect(page.get_by_role('heading', name='Найди одинаковых')).to_be_visible()
    run.geometry()
    cards = page.locator('#board button')
    expect(cards).to_have_count(4)
    expect(views(page, 'face')).to_have_count(4)
    first_art = art_ids(page.locator('#board'))
    wrong = next(i for i, art in enumerate(first_art) if art != first_art[0])
    run.hit(cards.nth(0))
    run.hit(cards.nth(0))
    expect(views(page, 'picked')).to_have_count(1)
    run.hit(cards.nth(wrong))
    expect(views(page, 'retry')).to_have_count(2)
    album_count(page, 0)
    calls(page, 0)
    run.hit(page.get_by_role('button', name='Сыграть ещё'))
    expect(views(page, 'face')).to_have_count(4)
    solve_open(run, 0)
    album_count(page, 1)
    stored(page, ['open'])
    # Replaying yields the same one photo and does not rewrite the save.
    run.hit(page.get_by_role('button', name='Сыграть ещё'))
    solve_open(run, 1)
    calls(page, 1)
    run.hit(page.get_by_role('link', name='Дальше'))

    expect(page.get_by_role('heading', name='Пары на память')).to_be_visible()
    expect(views(page, 'back')).to_have_count(6)
    assert all('закрыта' in name for name in cards.evaluate_all('(els) => els.map(el => el.getAttribute("aria-label"))'))
    run.geometry()
    run.hit(cards.first)
    picked_name = cards.first.get_attribute('aria-label')
    run.hit(page.get_by_role('button', name='Подсмотреть', exact=True))
    expect(page.locator('#board')).to_be_hidden()
    expect(page.locator('#peek-grid')).to_be_visible()
    expect(page.locator('#peek-grid button')).to_have_count(0)
    ordered = unique_pairs(art_ids(page.locator('#peek-grid')))
    assert len(ordered) == 3 and ordered[0][0] == 0
    run.geometry()
    run.hit(page.locator('#peek-grid > div').first)
    page.evaluate('() => document.querySelectorAll("#board button")[1].click()')
    album_count(page, 1)
    calls(page, 1)
    run.hit(page.get_by_role('button', name='Закрыть подсказку'))
    expect(views(page, 'picked')).to_have_count(1)
    expect(views(page, 'back')).to_have_count(5)
    expect(cards.first).to_have_attribute('aria-label', picked_name)
    run.hit(cards.nth(ordered[0][1]))
    expect(views(page, 'found')).to_have_count(2)
    album_count(page, 1)
    a, a2 = ordered[1]
    b, b2 = ordered[2]
    run.hit(cards.nth(a))
    run.hit(cards.nth(b))
    expect(views(page, 'retry')).to_have_count(2)
    # A synchronous burst includes duplicates of the wrong, picked and just-found cards.
    page.evaluate('''(moves) => {
      const buttons = document.querySelectorAll('#board button');
      for (const i of moves) buttons[i].click();
    }''', [b, a2, a2, a, a, b2, b, b])
    expect(views(page, 'found')).to_have_count(6)
    album_count(page, 2)
    calls(page, 2)
    stored(page, ['open', 'closed'])
    run.hit(page.get_by_role('link', name='Дальше'))

    expect(page.get_by_role('heading', name='Кто исчез с фотографии?')).to_be_visible()
    run.geometry()
    study = people(page)
    assert len(set(study)) == 3, study
    page.clock.fast_forward(60_000)
    expect(page.get_by_role('button', name='Я запомнил')).to_be_visible()
    assert people(page) == study
    expect(page.locator('#choices')).to_be_hidden()
    run.hit(page.get_by_role('button', name='Я запомнил'))
    later = people(page)
    assert len(later) == 2 and set(later) < set(study), later
    answer, = set(study) - set(later)
    choices = page.locator('#choices button')
    labels = choices.evaluate_all('(els) => els.map(el => el.getAttribute("aria-label"))')
    assert len(set(labels)) == 3 and answer in labels and len(set(later) & set(labels)) == 1, labels
    decoy, = set(labels) - set(study)
    run.geometry()
    if evidence:
        page.screenshot(path=evidence / 'phone-missing.png', animations='disabled')
    run.hit(page.get_by_role('button', name=decoy, exact=True))
    expect(page.get_by_role('status')).to_contain_text('Попробуй ещё')
    album_count(page, 2)
    run.hit(page.get_by_role('button', name='Показать первое фото'))
    expect(page.locator('#choices')).to_be_hidden()
    assert people(page) == study
    run.geometry()
    album_count(page, 2)
    calls(page, 2)
    run.hit(page.get_by_role('button', name='Вернуться к выбору'))
    assert people(page) == later
    expect(page.get_by_role('status')).to_contain_text('Попробуй ещё')
    run.hit(page.get_by_role('button', name=answer, exact=True))
    expect(page.get_by_role('status')).to_contain_text('Ты нашёл')
    album_count(page, 3)
    calls(page, 3)
    stored(page, ['open', 'closed', 'missing'])
    assert people(page) == study
    run.geometry()
    run.hit(page.get_by_role('button', name='Сыграть ещё'))
    expect(page.get_by_role('button', name='Я запомнил')).to_be_visible()
    album_count(page, 3)
    page.reload(wait_until='load')
    expect(page.get_by_role('heading', name='Кто исчез с фотографии?')).to_be_visible()
    expect(page.get_by_role('button', name='Я запомнил')).to_be_visible()
    expect(page.locator('#choices')).to_be_hidden()
    album_count(page, 3)
    calls(page, 0)
    stored(page, ['open', 'closed', 'missing'])
    run.close()
    return run.min_target, len(run.documents)


def keyboard_play(browser, evidence):
    run = Run(browser, reduced=True)
    page = run.page
    run.open('#missing')  # Direct entry without first-stage progress.
    album_count(page, 0)
    expect(page.get_by_role('link', name='Кто исчез?')).to_have_attribute('aria-current', 'step')
    expect(page.get_by_role('heading', name='Кто исчез с фотографии?')).to_be_visible()
    for name in ['Пары', 'На память', 'Кто исчез?']:
        page.keyboard.press('Tab')
        expect(page.get_by_role('link', name=name, exact=True)).to_be_focused()
    page.keyboard.press('Shift+Tab')
    closed_link = page.get_by_role('link', name='На память', exact=True)
    expect(closed_link).to_be_focused()
    assert closed_link.evaluate('el => getComputedStyle(el).outlineStyle') not in ('none', 'hidden')
    page.keyboard.press('Enter')
    expect(page.get_by_role('heading', name='Пары на память')).to_be_focused()
    page.keyboard.press('Tab')
    first = page.locator('#board button').first
    expect(first).to_be_focused()
    page.keyboard.press('Space')
    expect(first).to_have_attribute('data-look', 'picked')
    expect(first).to_be_focused()
    hint = page.get_by_role('button', name='Подсмотреть', exact=True)
    for _ in range(6):
        page.keyboard.press('Tab')
    expect(hint).to_be_focused()
    page.keyboard.press('Enter')
    close_hint = page.get_by_role('button', name='Закрыть подсказку')
    expect(close_hint).to_be_focused()
    expect(close_hint).to_have_attribute('aria-expanded', 'true')
    run.geometry()
    if evidence:
        page.screenshot(path=evidence / 'desktop-peek.png', animations='disabled')
    page.keyboard.press('Escape')
    expect(hint).to_be_focused()
    expect(hint).to_have_attribute('aria-expanded', 'false')
    expect(first).to_have_attribute('data-look', 'picked')
    expect(page.locator('#peek-grid')).to_be_hidden()
    # Navigate again and answer using native keyboard activation.
    missing_link = page.get_by_role('link', name='Кто исчез?', exact=True)
    missing_link.focus()
    page.keyboard.press('Enter')
    expect(page.get_by_role('heading', name='Кто исчез с фотографии?')).to_be_focused()
    page.keyboard.press('Tab')
    expect(page.get_by_role('button', name='Я запомнил')).to_be_focused()
    study = people(page)
    page.keyboard.press('Space')
    candidates = page.locator('#choices button')
    expect(candidates.first).to_be_focused()
    answer, = set(study) - set(people(page))
    original = page.get_by_role('button', name='Показать первое фото')
    original.focus()
    page.keyboard.press('Enter')
    expect(page.get_by_role('button', name='Вернуться к выбору')).to_be_focused()
    page.keyboard.press('Escape')
    expect(original).to_be_focused()
    album_count(page, 0)
    if evidence:
        # Show a representative keyboard focus state without revealing the correct candidate.
        candidates.first.focus()
        page.screenshot(path=evidence / 'desktop-missing.png', animations='disabled')
    page.get_by_role('button', name=answer, exact=True).focus()
    page.keyboard.press('Space')
    expect(page.get_by_role('button', name='Сыграть ещё')).to_be_focused()
    album_count(page, 1)
    run.geometry()
    run.close()


def storage_play(browser):
    for value in ('', '{"version":1,"completed":["closed","<img src=x onerror=alert(1)>"]}', '{broken'):
        run = Run(browser)
        storage_audit(run.context, raw=value)
        run.open()
        album_count(run.page, 0)
        solve_open(run, 0)
        album_count(run.page, 1)
        assert raw_progress(run.page) == value
        calls(run.page, 0)
        run.page.reload(wait_until='load')
        album_count(run.page, 0)
        assert raw_progress(run.page) == value
        run.close()

    run = Run(browser)
    run.context.add_init_script('''Object.defineProperty(window, 'localStorage', { get() {
      throw new DOMException('QA blocked', 'SecurityError');
    } });''')
    run.open('#open')
    solve_open(run, 0)
    album_count(run.page, 1)
    run.close()

    run = Run(browser)
    storage_audit(run.context, raw='{"version":1,"completed":["closed"]}', deny_write=True)
    run.open()
    album_count(run.page, 1)
    solve_open(run, 1)
    album_count(run.page, 2)
    run.hit(run.page.get_by_role('link', name='Кто исчез?'))
    expect(run.page.get_by_role('button', name='Я запомнил')).to_be_visible()
    study = people(run.page)
    run.hit(run.page.get_by_role('button', name='Я запомнил'))
    answer, = set(study) - set(people(run.page))
    run.hit(run.page.get_by_role('button', name=answer, exact=True))
    album_count(run.page, 3)
    calls(run.page, 1)
    stored(run.page, ['closed'])
    run.close()


def verify_browser(evidence=None):
    with sync_playwright() as playwright:
        path = chromium_path(playwright)
        browser = playwright.chromium.launch(executable_path=str(path), headless=True)
        try:
            print(f'Chromium {browser.version} at {path}', flush=True)
            minimum, documents = phone_play(browser, evidence)
            print('PASS: file:// offline, touch 320x640, all three games in order; replay, mismatch, peek, rapid input, reload', flush=True)
            keyboard_play(browser, evidence)
            print('PASS: desktop 1366x900, keyboard focus and controls, direct entry, Escape, reduced motion', flush=True)
            storage_play(browser)
            print('PASS: real file storage with foreign sentinel, empty/corrupt records, blocked getter and failing writer', flush=True)
            return {
                'chromium': browser.version,
                'executable': str(path),
                'protocol': 'file:',
                'offline': True,
                'phone': {**PHONE, 'min_target_side_css_px': minimum, 'document_requests': documents, 'native_touch': True},
                'desktop': {**DESKTOP, 'native_keyboard': True},
                'checks': [
                    'open: 2 visible pairs, wrong match, duplicate pick, reset and replay without duplicate award',
                    'closed: 3 concealed pairs, isolated peek, same first card on close; fast input and match recovery',
                    'missing: deliberate photo change, correction, original photo without award, repeat and persisted awards on reload',
                    'direct stages and sequential Next; Tab, Shift+Tab, Enter, Space, Escape and visible focus',
                    'real offline file navigation; no unexpected requests, console errors or page errors',
                    'only pary-2-v1; foreign record intact; corrupt/empty/denied storage works in memory',
                    'real narrow and desktop layout with no horizontal overflow, no blocked visible targets and min 44px',
                ],
            }
        finally:
            browser.close()


if __name__ == '__main__':
    verify_browser()
