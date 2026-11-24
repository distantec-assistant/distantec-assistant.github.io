"""Playwright acceptance of the standalone artifact and its catalog entry."""
import argparse
from contextlib import contextmanager
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
from threading import Thread

from playwright.sync_api import expect, sync_playwright


BASE = Path(__file__).resolve().parent.parent
WHITE = 'rgb(255, 255, 255)'
RED = 'rgb(244, 102, 104)'
BLUE = 'rgb(102, 172, 239)'
KEY = 'raskraska-v1'
OLD = {name: f'opaque {name} ∞' for name in (
    'bukvograd-v1', 'tsifrograd-v1', 'tsifrograd-lab-v1',
    'tsifrograd-lab-v2', 'tsifrograd-2-v1',
)}
NAMES = ['Воздушный шар', 'Лесной домик', 'Ракета и планеты', 'Подводный мир']
COUNTS = [5, 8, 11, 15]
FIRST_SHEETS = ['balloon','house','rocket','sea']
LEVELS = ['easy','middle','many','detail']
REGION = '#drawing [data-area]'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextmanager
def serve(root):
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=root)) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}'
        finally:
            server.shutdown()
            thread.join()


def chromium_path(pw):
    expected = Path(pw.chromium.executable_path)
    if expected.is_file():
        return str(expected)
    root = Path.home() / '.cache/ms-playwright'
    paths = list(root.glob('chromium-*/chrome-linux64/chrome'))
    paths += list(root.glob('chromium-*/chrome-linux/chrome'))
    if paths:
        return str(max(paths, key=lambda p: int(p.parents[1].name.removeprefix('chromium-'))))
    raise SystemExit('Ожидается установленный Playwright Chromium; браузер не найден.')


def track(page, allowed):
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
    page.on('response', lambda res: errors.append(f'{res.status} {res.url}') if res.status >= 400 else None)
    page.on('requestfailed', lambda req: errors.append(f'{req.failure} {req.url}'))
    page.on('request', lambda req: errors.append(f'Unexpected request {req.url}')
            if not (req.url.startswith(allowed) or req.url.startswith('data:')) else None)
    return errors


def go(page, url):
    response = page.goto(url, wait_until='load')
    assert response and response.ok, f'Игра не загружена: HTTP {response.status if response else "?"} {url}'
    expect(page.locator('#drawing')).to_be_visible()


def layout(page, *, palette=False):
    data = page.evaluate('''() => ({width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth, height: innerHeight,
      tools: [...document.querySelectorAll('#paints button, #eraser, #undo')].map(b => {
        const r = b.getBoundingClientRect(); return [r.width, r.height, r.bottom];
      })})''')
    assert data['scroll'] <= data['width'], data
    assert len(data['tools']) == 10 and all(w >= 44 and h >= 44 for w, h, _ in data['tools']), data
    if palette:
        assert max(b for _, _, b in data['tools']) <= data['height'], data


def fill_colors(page):
    return page.locator(REGION).evaluate_all('(nodes) => nodes.map(n => getComputedStyle(n).fill)')


def coordinates(page, area=None):
    svg = page.locator('#drawing')
    svg.scroll_into_view_if_needed()
    return svg.evaluate('''(svg, index) => {
      const n = index === null ? null : svg.querySelectorAll('[data-area]')[index];
      const point = svg.createSVGPoint();
      point.x = n ? Number(n.dataset.x) : 5;
      point.y = n ? Number(n.dataset.y) : 5;
      const {x,y} = point.matrixTransform(svg.getScreenCTM());
      const hit = document.elementFromPoint(x,y)?.closest('[data-area]')?.dataset.area || null;
      return {x,y,target:n?.dataset.area || null,hit};
    }''', area)


def apply_at(page, index=None, *, touch=False):
    point = coordinates(page, index)
    assert point['target'] == point['hit'], point
    if touch:
        page.touchscreen.tap(point['x'], point['y'])
    else:
        page.mouse.click(point['x'], point['y'])


def choose(page, name, *, touch=False):
    button = page.get_by_role('button', name=name, exact=True)
    button.tap() if touch else button.click()
    expect(button).to_have_attribute('aria-pressed', 'true')


def switch(page, scene_index, *, touch=False):
    if page.locator('#levels button').count():
        level = page.locator(f'#levels button[data-level="{LEVELS[scene_index]}"]')
        level.tap() if touch else level.click()
        button = page.locator(f'#sheets button[data-scene="{FIRST_SHEETS[scene_index]}"]')
    else:
        button = page.locator('#sheets button').nth(scene_index)
    button.tap() if touch else button.click()
    expect(button).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#scene-title')).to_have_text(NAMES[scene_index])
    expect(page.locator(REGION)).to_have_count(COUNTS[scene_index])
    page.locator('.paper').scroll_into_view_if_needed()


def exercise(browser, url, out, viewport, *, touch=False, catalog=False, sweep=False):
    with browser.new_context(viewport=viewport, has_touch=touch, is_mobile=touch,
                             device_scale_factor=1, reduced_motion='reduce' if sweep else 'no-preference') as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        if catalog:
            assert page.goto(url + '/').ok
            card = page.get_by_role('link', name=re.compile('Цветная мастерская'))
            expect(card).to_have_count(1)
            expect(card).to_have_attribute('href', '/raskraska/')
            expect(card.locator('img')).to_be_visible()
            assert card.locator('img').evaluate('async img => { await img.decode(); return img.naturalWidth; }') == 800
            page.evaluate('(entries) => { for (const [k,v] of Object.entries(entries)) localStorage.setItem(k,v); }', OLD)
            page.add_init_script('''(() => { window.storageReads=[]; window.storageWrites=[];
                for (const [method, log] of [['getItem',storageReads], ['setItem',storageWrites]]) {
                    const native = Storage.prototype[method];
                    Storage.prototype[method] = function(key, ...args) { log.push(String(key)); return native.call(this,key,...args); };
                }
              })()''')
            card.tap() if touch else card.click()
            expect(page).to_have_url(url + '/raskraska/')
        else:
            go(page, url + '/raskraska/index.html')
        layout(page, palette=viewport['height'] >= 640)
        if touch:
            tap_overlay = page.locator(REGION).first.evaluate('(el) => getComputedStyle(el).webkitTapHighlightColor')
            assert tap_overlay == 'rgba(0, 0, 0, 0)', f'Нативная подсветка перекрывает рисунок: {tap_overlay}'
        assert fill_colors(page) == [WHITE]*COUNTS[0]
        page.screenshot(path=str(out / ('phone-fresh.png' if touch else 'desktop-fresh.png')))
        apply_at(page, 0, touch=touch)
        assert fill_colors(page) == [WHITE]*COUNTS[0], 'До выбора краски рисунок не меняется'
        choose(page, 'Красный', touch=touch)
        apply_at(page, 0, touch=touch)
        assert fill_colors(page) == [RED] + [WHITE]*4
        apply_at(page, touch=touch)
        assert fill_colors(page) == [RED] + [WHITE]*4, 'Фон не закрашивается'
        choose(page, 'Голубой', touch=touch)
        apply_at(page, 0, touch=touch)
        assert fill_colors(page)[0] == BLUE
        choose(page, 'Ластик', touch=touch)
        apply_at(page, 0, touch=touch)
        assert fill_colors(page) == [WHITE]*5
        undo = page.get_by_role('button', name='Отменить')
        undo.tap() if touch else undo.click()
        assert fill_colors(page)[0] == BLUE
        choose(page, 'Красный', touch=touch)
        if not touch:
            page.locator(REGION).nth(1).focus()
            page.keyboard.press('Enter')
            page.locator(REGION).nth(2).focus()
            page.keyboard.press('Space')
            assert fill_colors(page)[:3] == [BLUE, RED, RED]
        switch(page, 3, touch=touch)
        assert fill_colors(page) == [WHITE]*15
        choose(page, 'Красный', touch=touch)
        apply_at(page, 0, touch=touch)
        page.reload()
        expect(page.locator('#scene-title')).to_have_text(NAMES[3])
        assert fill_colors(page) == [RED] + [WHITE]*14
        switch(page, 0, touch=touch)
        assert fill_colors(page)[0] == BLUE
        if catalog:
            reads, writes = page.evaluate('() => [window.storageReads, window.storageWrites]')
            assert set(reads) == set(writes) == {KEY}, (reads, writes)
            for name, value in OLD.items():
                assert page.evaluate('(key) => localStorage.getItem(key)', name) == value
        if sweep:
            for number, count in enumerate(COUNTS):
                switch(page, number, touch=touch)
                choose(page, 'Красный', touch=touch)
                for index in range(count):
                    apply_at(page, index, touch=touch)
                    assert fill_colors(page)[index] == RED
                expect(page.locator('#progress')).to_contain_text('Готово')
                expect(page.locator('#scene-title')).to_have_text(NAMES[number])
                assert fill_colors(page) == [RED] * count
                choose(page, 'Ластик', touch=touch)
                apply_at(page, count-1, touch=touch)
                assert fill_colors(page)[-1] == WHITE
                expect(page.locator('#progress')).not_to_contain_text('Готово')
                layout(page)
        assert not errors, errors


def fallback(browser, root, url):
    with browser.new_context(viewport={'width': 768, 'height': 900}) as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        go(page, url + '/raskraska/')
        page.evaluate('(key) => localStorage.setItem(key, "{invalid json")', KEY)
        page.reload()
        assert fill_colors(page) == [WHITE]*5
        page.evaluate('(key) => localStorage.setItem(key, JSON.stringify({version:1, scene:"other-game", pictures:{balloon:{unknown:"red"}}}))', KEY)
        page.reload()
        assert fill_colors(page) == [WHITE]*5
        assert not errors, errors
    with browser.new_context(offline=True, viewport={'width': 800, 'height': 750}) as cx:
        page = cx.new_page()
        errors = track(page, 'file://')
        page.add_init_script('''(() => { for(const method of ['getItem','setItem'])
            Storage.prototype[method] = function() { throw new Error('storage unavailable'); }; })()''')
        page.goto((root / 'raskraska/index.html').as_uri())
        expect(page.get_by_role('link', name='К играм')).to_have_count(0)
        choose(page, 'Красный')
        apply_at(page, 0)
        assert fill_colors(page)[0] == RED
        choose(page, 'Ластик')
        apply_at(page, 0)
        assert fill_colors(page)[0] == WHITE
        assert not errors, errors


def render_evidence(browser, url, out):
    with browser.new_context(viewport={'width':390, 'height':844}, has_touch=True, is_mobile=True,
                             device_scale_factor=1) as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        go(page, url + '/raskraska/')
        layout(page, palette=True)
        sheet = page.locator('.paper')
        for number in range(len(NAMES)):
            switch(page, number, touch=True)
            sheet.screenshot(path=str(out / f'sheet-{number+1}.png'))
        switch(page, 0, touch=True)
        for index, color in ((0, 'yellow'), (2, 'pink'), (4, 'brown')):
            page.locator(f'button[data-color="{color}"]').tap()
            apply_at(page, index, touch=True)
        page.evaluate('() => window.scrollTo(0, 0)')
        page.screenshot(path=str(out / 'studio-preview.png'), full_page=True)
        assert not errors, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=BASE, help='Alternative static staging root')
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--core-only', action='store_true', help='Skip the catalog assertion; for isolated UI checks')
    args = parser.parse_args()
    args.root = args.root.resolve()
    args.out.mkdir(parents=True, exist_ok=False)
    artifact = args.root / 'raskraska/index.html'
    before = sha256(artifact.read_bytes()).hexdigest() if artifact.is_file() else None
    with serve(args.root) as url, sync_playwright() as pw:
        path = chromium_path(pw)
        browser = pw.chromium.launch(executable_path=path, args=['--no-sandbox'])
        try:
            exercise(browser, url, args.out, {'width':1280,'height':960}, catalog=not args.core_only)
            print('PASS: desktop, paint/repaint/erase/undo, keyboard, switch/reload', flush=True)
            exercise(browser, url, args.out, {'width':320,'height':640}, touch=True,
                     catalog=not args.core_only, sweep=True)
            print('PASS: narrow touch emulation, four original sheets / 39 fill points, completion editable', flush=True)
            with browser.new_context(viewport={'width':1024,'height':650}, has_touch=True, is_mobile=True) as cx:
                page=cx.new_page()
                errors=track(page, url + '/')
                go(page, url + '/raskraska/')
                layout(page, palette=True)
                choose(page, 'Красный', touch=True)
                apply_at(page, 1, touch=True)
                assert fill_colors(page)[1] == RED and not errors, errors
                page.screenshot(path=str(args.out / 'tablet.png'))
            print('PASS: landscape tablet and real Chromium event', flush=True)
            fallback(browser, args.root, url)
            print('PASS: damaged/blocked storage and standalone file in offline browser', flush=True)
            render_evidence(browser, url, args.out)
            print('PASS: 390px layout, all four rendered sheets and an in-progress screenshot', flush=True)
            assert sha256(artifact.read_bytes()).hexdigest() == before
            report = {'result':'PASS', 'browser':browser.version, 'artifact_sha256':before,
                      'areas_per_sheet':COUNTS, 'tested_viewports':['1280x960','320x640','1024x650','390x844'],
                      'catalog_verified':not args.core_only, 'other_saves_preserved':not args.core_only,
                      'offline_file_verified':True}
            (args.out / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
            print(json.dumps(report, ensure_ascii=False), flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
