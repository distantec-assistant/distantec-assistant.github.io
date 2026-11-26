"""Acceptance of both coloring albums on localhost or live Pages."""
import argparse
from contextlib import nullcontext
from hashlib import sha256
from pathlib import Path
import json
import re
from urllib.request import Request, urlopen

from playwright.sync_api import expect, sync_playwright

from test_browser import (BASE, KEY, OLD, REGION, WHITE, RED, BLUE,
    apply_at, choose, chromium_path, fill_colors, go, layout, serve, track)


LEVELS = (
    ('easy', 'Легко', (('balloon', 'Воздушный шар', 5), ('tulip', 'Цветок на лужайке', 6),
        ('sailboat', 'Парусник', 6), ('boots', 'Зонтик и сапожки', 7), ('chick', 'Цыплёнок', 7))),
    ('middle', 'Посложнее', (('house', 'Лесной домик', 8), ('car', 'Машинка', 8),
        ('kitten', 'Котёнок с клубком', 9), ('icecream', 'Мороженое', 9), ('robot', 'Робот', 10))),
    ('many', 'Много деталей', (('rocket', 'Ракета и планеты', 11), ('train', 'Паровозик', 12),
        ('dinosaur', 'Динозаврик', 13), ('bee', 'Пчёлка и цветы', 13), ('kite', 'Воздушный змей', 14))),
    ('detail', 'Самые подробные', (('sea', 'Подводный мир', 15), ('snail', 'Улитка в саду', 16),
        ('farm', 'На ферме', 17), ('castle', 'Замок над рекой', 18), ('fair', 'Парк аттракционов', 20))),
    ('journey', 'В дороге', (('bus', 'Автобус на остановке', 20), ('construction', 'Большая стройка', 20),
        ('harbor', 'Кораблик в порту', 21), ('airport', 'Самолёт в аэропорту', 21),
        ('mountain-tram', 'Горная канатная дорога', 22))),
    ('nature', 'Природа', (('woods-fox', 'Лисёнок в лесу', 22), ('pond', 'У пруда', 22),
        ('winter-forest', 'Зимний лес', 23), ('butterfly-garden', 'Сад бабочек', 23), ('waterfall', 'Водопад в горах', 24))),
    ('town', 'Большой город', (('bakery', 'Солнечная пекарня', 24), ('market', 'На рынке', 24),
        ('music', 'Музыка в парке', 25), ('museum', 'В музее', 25), ('library', 'Уютная библиотека', 26))),
    ('fairy', 'Сказки', (('gingerbread', 'Пряничный домик', 26), ('mushroom-village', 'Грибная деревня', 26),
        ('moon-ship', 'Лунное путешествие', 27), ('dragon', 'Дракончик и сокровища', 27),
        ('floating-island', 'Летающий остров', 28))),
)
RADII = [22, 19, 16, 15, 15, 15, 15, 15]
PURPLE = 'rgb(161, 128, 235)'
DIRECT = '/raskraska/?album=2#album-title'


def file_digest(path):
    return sha256(path.read_bytes()).hexdigest()


def artifact_digest(url):
    with urlopen(Request(url + '/raskraska/', headers={'Cache-Control': 'no-cache'}), timeout=20) as response:
        assert response.status == 200 and response.geturl() == url + '/raskraska/'
        return sha256(response.read()).hexdigest()


def assert_levels(page, album=1):
    choices = page.locator('#albums button')
    assert choices.count() == 2, f'На рабочей странице должно быть два альбома; найдено: {choices.count()}'
    expect(choices.nth(1)).to_contain_text('Новые рисунки')
    expect(choices.nth(album - 1)).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#albums button[aria-pressed="true"]')).to_have_count(1)
    controls = page.locator('#levels button:visible')
    levels = LEVELS[4*(album-1):4*album]
    expect(controls).to_have_count(4)
    assert controls.evaluate_all('nodes => nodes.map(n => n.dataset.level)') == [item[0] for item in levels]
    assert controls.locator('.level-name').all_text_contents() == [item[1] for item in levels]
    layout(page)


def select_level(page, level_index, *, touch):
    level, _, sheets = LEVELS[level_index]
    album = 1 + level_index // 4
    album_button = page.locator(f'#albums button[data-album="{album}"]')
    if album_button.get_attribute('aria-pressed') != 'true':
        album_button.tap() if touch else album_button.click()
    assert_levels(page, album)
    button = page.locator(f'#levels button[data-level="{level}"]')
    button.tap() if touch else button.click()
    expect(button).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#levels button[aria-pressed="true"]')).to_have_count(1)
    tile = page.locator('#sheets button')
    assert tile.evaluate_all('nodes => nodes.map(n => n.dataset.scene)') == [s[0] for s in sheets]
    assert tile.locator('.sheet-name').all_text_contents() == [s[1] for s in sheets]
    controls = page.locator('#levels button, #sheets button').evaluate_all(
        'nodes => nodes.filter(n=>!n.hidden).map(n => [n.getBoundingClientRect().width, n.getBoundingClientRect().height])')
    assert all(w >= 44 and h >= 44 for w, h in controls), controls


def select_sheet(page, item, *, touch):
    sid, title, count = item
    button = page.locator(f'#sheets button[data-scene="{sid}"]')
    button.tap() if touch else button.click()
    expect(page.locator('#scene-title')).to_have_text(title)
    expect(button).to_have_attribute('aria-pressed', 'true')
    expect(page.locator(REGION)).to_have_count(count)
    layout(page)


def scene_points(page, radius):
    """Geometry from the actual SVG, not guessed bounding-box centers."""
    drawing = page.locator('#drawing')
    drawing.scroll_into_view_if_needed()
    result = drawing.evaluate('''(svg, radius) => {
        const screen = svg.getScreenCTM();
        function coords(x, y) {
            const pt = svg.createSVGPoint(); pt.x = x; pt.y = y; return pt;
        }
        return [...svg.querySelectorAll('[data-area]')].map(path => {
            const center = coords(+path.dataset.x, +path.dataset.y);
            const miss = [];
            for (let i=-1; i<16; i++) {
                const angle = Math.PI*i/8;
                const r = i<0 ? 0 : radius;
                const pt = coords(center.x + r*Math.cos(angle), center.y + r*Math.sin(angle));
                const {x,y} = pt.matrixTransform(screen);
                if (!path.isPointInFill(pt) || document.elementFromPoint(x,y)?.closest('[data-area]') !== path) miss.push(i);
            }
            const {x,y} = center.matrixTransform(screen);
            return {id:path.dataset.area, x,y,miss};
        });
    }''', radius)
    assert all(not point['miss'] for point in result), (page.locator('#scene-title').text_content(), radius, result)
    return result


def catalog_open(page, url, touch):
    assert page.goto(url + '/', wait_until='load').ok
    card = page.get_by_role('link', name=re.compile('Цветная мастерская'))
    expect(card).to_have_count(1)
    expect(card).to_have_attribute('href', '/raskraska/')
    expect(card).to_contain_text('40 рисунков')
    image = card.locator('img')
    assert image.evaluate('async img => { await img.decode(); return img.naturalWidth; }') == 800
    page.evaluate('(old) => { for (const [k,v] of Object.entries(old)) localStorage.setItem(k,v); }', OLD)
    card.tap() if touch else card.click()
    expect(page).to_have_url(url + '/raskraska/')


def exercise(browser, url, out, *, exhaustive, catalog):
    counts = []
    entire_save = None
    with browser.new_context(viewport={'width':320,'height':640}, device_scale_factor=1,
                             has_touch=True, is_mobile=True, reduced_motion='reduce') as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        if catalog:
            catalog_open(page, url, touch=True)
        else:
            go(page, url + '/raskraska/')
        assert_levels(page)
        layout(page, palette=True)
        expect(page.locator('#levels button[data-level="easy"]')).to_have_attribute('aria-pressed', 'true')
        assert page.locator('#sheets button').count() == 5
        choose(page, 'Красный', touch=True)
        apply_at(page, 0, touch=True)
        saved = page.evaluate('(key) => localStorage.getItem(key)', KEY)
        select_level(page, 4, touch=True)
        expect(page.locator('#scene-title')).to_have_text('Воздушный шар')
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == saved
        assert fill_colors(page) == [RED] + [WHITE]*4
        choose(page, 'Ластик', touch=True)
        apply_at(page, 0, touch=True)
        assert fill_colors(page) == [WHITE]*5
        for i, (_group, _label, sheets) in enumerate(LEVELS):
            select_level(page, i, touch=True)
            page.locator('#sheets').screenshot(path=str(out / f'gallery-{i+1}.png'))
            for j, item in enumerate(sheets):
                select_sheet(page, item, touch=True)
                assert fill_colors(page) == [WHITE]*item[2], item
                if exhaustive:
                    # Original artwork was approved with a smaller minimum for its later scenes.
                    points = scene_points(page, min(RADII[i], 15) if j == 0 and i else RADII[i])
                    assert len(points) == item[2]
                    page.locator('.paper').screenshot(path=str(out / f'line-{item[0]}.png'))
                    choose(page, 'Фиолетовый', touch=True)
                    points = scene_points(page, 0)
                    for point in points:
                        page.touchscreen.tap(point['x'], point['y'])
                    assert fill_colors(page) == [PURPLE]*item[2], item
                    expect(page.locator('#progress')).to_contain_text('Готово')
                    badge = page.locator(f'#sheets [data-scene="{item[0]}"] .sheet-check')
                    expect(badge).to_be_visible()
                    choose(page, 'Голубой', touch=True)
                    apply_at(page, 0, touch=True)
                    assert fill_colors(page) == [BLUE] + [PURPLE]*(item[2]-1)
                    choose(page, 'Ластик', touch=True)
                    apply_at(page, item[2]-1, touch=True)
                    expect(page.locator('#progress')).not_to_contain_text('Готово')
                    expect(badge).to_be_hidden()
                    assert fill_colors(page)[-1] == WHITE
                    page.locator('#undo').tap()
                    assert fill_colors(page)[-1] == PURPLE
                    expect(badge).to_be_visible()
                    print(f'PASS: {item[0]} ({item[2]} областей)', flush=True)
                else:
                    choose(page, 'Красный', touch=True)
                    apply_at(page, 0, touch=True)
                    choose(page, 'Ластик', touch=True)
                    apply_at(page, 0, touch=True)
                    assert fill_colors(page) == [WHITE]*item[2], item
                counts.append(item[2])
        choose(page, 'Голубой', touch=True)
        apply_at(page, 0, touch=True)
        if exhaustive:
            entire_save = page.evaluate('(key)=>localStorage.getItem(key)', KEY)
            complete = json.loads(entire_save)
            assert set(complete['pictures']) == {sid for _, _, items in LEVELS for sid, _, _ in items}
            for _, _, items in LEVELS:
                for sid, _, count in items:
                    assert len(complete['pictures'][sid]) == count, sid
        page.reload()
        assert_levels(page, 2)
        expect(page.locator('#levels button[data-level="fairy"]')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#scene-title')).to_have_text(LEVELS[-1][2][-1][1])
        assert fill_colors(page)[0] == BLUE
        if entire_save is not None:
            assert page.evaluate('(key)=>localStorage.getItem(key)', KEY) == entire_save
            select_level(page, 0, touch=True)
            select_sheet(page, LEVELS[0][2][0], touch=True)
            assert fill_colors(page) == [BLUE]+[PURPLE]*4
            reread = json.loads(page.evaluate('(key)=>localStorage.getItem(key)', KEY))
            assert reread['pictures'] == json.loads(entire_save)['pictures'], 'Full save was dropped while being read'
        assert not errors, errors
        if catalog:
            for key, value in OLD.items():
                assert page.evaluate('(k) => localStorage.getItem(k)', key) == value
            page.get_by_role('link', name='К играм').tap()
            expect(page).to_have_url(url + '/')
            page.wait_for_load_state('load')
            assert not errors, errors
    return counts, len(entire_save) if entire_save is not None else None


def migration(browser, url, old_index):
    """Complete the actual previous public album, then upgrade on the same origin."""
    with browser.new_context(viewport={'width':1024,'height':768}) as cx:
        page = cx.new_page()
        target = url + '/raskraska/'
        page.route(target, lambda route: route.fulfill(path=old_index, content_type='text/html'))
        go(page, target)
        assert page.locator('#albums button').count() == 0 and page.locator('#levels button').count() == 4
        choose(page, 'Красный')
        for lid, _, items in LEVELS[:4]:
            page.locator(f'#levels button[data-level="{lid}"]').click()
            for sid, title, count in items:
                page.locator(f'#sheets button[data-scene="{sid}"]').click()
                expect(page.locator('#scene-title')).to_have_text(title)
                points = scene_points(page, 0)
                assert len(points) == count
                for point in points:
                    page.mouse.click(point['x'],point['y'])
                expect(page.locator('#progress')).to_contain_text('Готово')
        previous = page.evaluate('(key) => localStorage.getItem(key)', KEY)
        state = json.loads(previous)
        assert state['version'] == 1 and state['scene'] == 'fair' and len(state['pictures']) == 20
        for _, _, items in LEVELS[:4]:
            for sid, _, count in items:
                assert list(state['pictures'][sid].values()) == ['red']*count
        page.unroute(target)
        page.reload(wait_until='load')
        assert_levels(page)
        expect(page.locator('#levels button[data-level="detail"]')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#scene-title')).to_have_text('Парк аттракционов')
        assert fill_colors(page) == [RED]*20
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == previous
        for index in range(4):
            select_level(page, index, touch=False)
            expect(page.locator('#sheets .sheet-check:visible')).to_have_count(5)
        select_level(page, 4, touch=False)
        assert page.evaluate('(key) => localStorage.getItem(key)', KEY) == previous
        select_sheet(page, LEVELS[4][2][0], touch=False)
        assert fill_colors(page) == [WHITE]*20
        choose(page, 'Голубой')
        apply_at(page, 0)
        amended = json.loads(page.evaluate('(key) => localStorage.getItem(key)', KEY))
        assert all(amended['pictures'][sid] == picture for sid,picture in state['pictures'].items())
        assert amended['scene'] == 'bus' and list(amended['pictures']['bus'].values()) == ['blue']


def direct_link(browser, url, out):
    with browser.new_context(viewport={'width':390,'height':786},has_touch=True,is_mobile=True) as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        go(page, url + DIRECT)
        assert_levels(page, 2)
        expect(page.locator('#levels button[data-level="journey"]')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#scene-title')).to_have_text('Воздушный шар')
        assert page.evaluate('(key)=>localStorage.getItem(key)', KEY) is None
        expect(page.locator('#album-title')).to_be_in_viewport()
        page.screenshot(path=str(out/'new-album-entry.png'))
        select_sheet(page, LEVELS[4][2][0], touch=True)
        choose(page, 'Красный', touch=True)
        apply_at(page, 0, touch=True)
        assert fill_colors(page) == [RED] + [WHITE]*19 and not errors, errors


def showcase(browser, url, out, *, catalog):
    with browser.new_context(viewport={'width':1280,'height':960}, device_scale_factor=1) as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        if catalog:
            catalog_open(page, url, touch=False)
        else:
            go(page, url + '/raskraska/')
        assert_levels(page)
        preview = cx.new_page()
        try:
            preview.set_viewport_size({'width':360,'height':270})
            for i, (_group, _label, sheets) in enumerate(LEVELS):
                select_level(page, i, touch=False)
                for item in sheets:
                    # Render the exact colored SVG of the gallery at full art-study size.
                    svg = page.locator(f'#sheets [data-scene="{item[0]}"] .sheet-art svg').evaluate('s => s.outerHTML')
                    preview.set_content('<style>body{margin:0;background:#fbf4e8}svg{display:block;width:100%;height:100vh}'
                        '.preview-area{stroke:#48375c;stroke-width:3.8;stroke-linejoin:round;stroke-linecap:round}'
                        '.art-detail{stroke:#6f5a7c;stroke-width:2.7;stroke-linecap:round;fill:none}</style>' + svg)
                    preview.screenshot(path=str(out / f'color-{item[0]}.png'))
        finally:
            preview.close()
        assert not errors, errors
    with browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1,
                             has_touch=True, is_mobile=True) as cx:
        page = cx.new_page()
        errors = track(page, url + '/')
        go(page, url + '/raskraska/')
        select_level(page, 4, touch=True)
        select_sheet(page, LEVELS[4][2][0], touch=True)
        for index, key in [(0,'yellow'),(2,'blue'),(3,'red')]:
            page.locator(f'#paints [data-color="{key}"]').tap()
            apply_at(page, index, touch=True)
        page.evaluate('() => window.scrollTo(0,0)')
        page.screenshot(path=str(out / 'studio-mobile.png'), full_page=True)
        assert not errors, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=BASE)
    parser.add_argument('--base-url', help='Exact serving origin, for live checks')
    parser.add_argument('--legacy-index', type=Path)
    parser.add_argument('--skip-catalog', action='store_true', help='Fixture run only')
    parser.add_argument('--smoke', action='store_true', help='Test every sheet with one fill and erase; do not rerun full local geometry')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    artifact = args.root / 'raskraska/index.html'
    before = file_digest(artifact)
    server = nullcontext(args.base_url.rstrip('/')) if args.base_url else serve(args.root)
    with server as url, sync_playwright() as pw:
        assert artifact_digest(url) == before
        browser = pw.chromium.launch(executable_path=chromium_path(pw), args=['--no-sandbox'])
        try:
            counts, saved_size = exercise(browser, url, args.out, exhaustive=not args.smoke, catalog=not args.skip_catalog)
            direct_link(browser, url, args.out)
            if args.legacy_index:
                migration(browser, url, args.legacy_index)
            if not args.smoke:
                showcase(browser, url, args.out, catalog=not args.skip_catalog)
            else:
                with browser.new_context(viewport={'width':1280,'height':960}) as cx:
                    page = cx.new_page()
                    errors = track(page, url + '/')
                    if not args.skip_catalog:
                        catalog_open(page, url, touch=False)
                    else:
                        go(page, url + '/raskraska/')
                    assert_levels(page)
                    select_level(page, 7, touch=False)
                    select_sheet(page, LEVELS[7][2][-1], touch=False)
                    choose(page, 'Голубой')
                    apply_at(page, 0)
                    assert fill_colors(page)[0] == BLUE and not errors, errors
            assert artifact_digest(url) == file_digest(artifact) == before
            report = {'result':'PASS','origin':url,'browser':browser.version,'artifact_sha256':before,
                      'sheets':len(counts),'counts':counts,'total_areas':sum(counts),
                      'exhaustive_taps':not args.smoke, 'catalog_verified':not args.skip_catalog,
                      'direct_new_album_verified':True, 'full_save_chars':saved_size,
                      'prior_version_save_verified':bool(args.legacy_index),
                      'prior_saved_sheets_tested':20 if args.legacy_index else 0}
            (args.out / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
            print(json.dumps(report, ensure_ascii=False), flush=True)
        finally:
            browser.close()


if __name__ == '__main__':
    main()
