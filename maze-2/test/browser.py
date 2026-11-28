"""Exercise the actual standalone campaign in Chromium. No product functions drive the UI."""
import argparse
from collections import deque
from contextlib import contextmanager
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
from threading import Thread

from playwright.sync_api import expect, sync_playwright

APP = Path(__file__).resolve().parents[1]
KEY = 'maze-mail-2-v1'
PROTECTED = {k: 'independent:' + k for k in ('maze-v2', 'raskraska-v1', 'uzory-v1', 'uzory-2-v1', 'pary-v1', 'pary-2-v1', 'bukvograd-v1', 'bukvograd-2-v1', 'tsifrograd-v1', 'tsifrograd-2-v1', 'tsifrograd-lab-v1', 'tsifrograd-lab-v2')}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextmanager
def site(external):
    if external:
        yield external.rstrip('/') + '/'
        return
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=APP.parent)) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/'
        finally:
            server.shutdown()
            thread.join()


def chrome(pw):
    default = Path(pw.chromium.executable_path)
    if default.is_file():
        return str(default)
    root = Path.home() / '.cache/ms-playwright'
    options = [*root.glob('chromium-*/chrome-linux64/chrome'), *root.glob('chromium-*/chrome-linux/chrome')]
    return str(max(options, key=lambda p: int(p.parents[1].name.split('-')[-1])))


def watch(p, origin):
    faults = []
    p.on('pageerror', lambda e: faults.append(str(e)))
    p.on('requestfailed', lambda r: faults.append(f'{r.failure} {r.url}'))
    p.on('console', lambda m: faults.append(m.text) if m.type == 'error' else None)
    p.on('request', lambda r: faults.append('external: ' + r.url) if not r.url.startswith((origin, 'data:')) else None)
    p.on('response', lambda r: faults.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    return faults


def act(p, selector, kind='mouse'):
    el = p.locator(selector).first
    expect(el).to_be_visible()
    if kind == 'key':
        el.focus()
        p.keyboard.press('Enter')
    elif kind == 'tap':
        el.tap(timeout=4500)
    else:
        el.click(timeout=4500)


def at(p, where):
    expect(p.locator('#view')).to_have_attribute('data-at', where)
    expect(p.locator('#view')).to_have_attribute('data-moving', 'false')


def get_save(p):
    return p.evaluate('(k)=>localStorage.getItem(k)', KEY)


def destinations(p):
    return p.locator('button[data-to]:visible').evaluate_all('els=>[...new Set(els.map(e=>e.dataset.to))]')


def choice(p, to, kind='mouse', check=False):
    # The same route may also have a labelled control under a crowded map. Prefer the map.
    selectors = [f'.trail[data-to="{to}"]:visible', f'button[data-to="{to}"]:visible']
    for sel in selectors:
        el = p.locator(sel).first
        if not el.count():
            continue
        el.scroll_into_view_if_needed()
        geom = el.evaluate('''e=>{const a=e.getBoundingClientRect(), x=(a.left+a.right)/2, y=(a.top+a.bottom)/2;
          return {width:a.width,height:a.height,hit:e.contains(document.elementFromPoint(x,y))};}''')
        if check:
            assert geom['width'] >= 43.99 and geom['height'] >= 43.99, (to, geom)
            assert geom['hit'], ('obscured enabled control', to, geom)
        act(p, sel, kind)
        return
    raise AssertionError(('missing choice', to, destinations(p)))


def walk(p, to, kind='mouse', check=False):
    choice(p, to, kind, check)
    at(p, to)


def graph(map_):
    adj = {k: [] for k in map_['places']}
    for a, b, *_ in map_['trails']:
        adj[a].append(b)
        adj[b].append(a)
    return adj


def path(adj, start, end):
    q = deque([(start, [])]); seen = {start}
    while q:
        node, route = q.popleft()
        if node == end:
            return route
        for n in adj[node]:
            if n not in seen:
                seen.add(n); q.append((n, route + [n]))
    raise AssertionError(('unreachable', start, end))


def win(p, m, kind, captured=None):
    adj = graph(m); pos = m['start']; n = 0
    at(p, pos)
    goals = [o['at'] for o in m.get('objectives', [])] + [m['goal']]
    for goal_index, goal in enumerate(goals):
        for dest in path(adj, pos, goal):
            assert sorted(destinations(p)) == sorted(adj[pos]), (m['id'], pos, destinations(p), adj[pos])
            expect(p.locator('#delivered')).to_have_count(0)
            walk(p, dest, kind, True); pos = dest; n += 1
        if goal_index < len(goals)-1:
            expect(p.locator('#delivered')).to_have_count(0)
            if captured:
                captured()
    expect(p.locator('#delivered')).to_be_visible()
    assert not destinations(p)
    return n


def open_story(p, m, kind='mouse'):
    act(p, f'[data-chapter="{m["chapter"]}"]', kind)
    act(p, f'[data-story="{m["id"]}"]', kind)
    at(p, m['start'])


def safe_width(p):
    assert p.evaluate('()=>document.documentElement.clientWidth===document.documentElement.scrollWidth')


def atlas(p, maps, kind):
    assert p.locator('button[data-chapter]').count() == 4, 'four accessible chapters required'
    for i in range(1, 5):
        act(p, f'button[data-chapter="{i}"]', kind)
        actual = p.locator('button[data-story]').evaluate_all('els=>els.map(e=>e.dataset.story)')
        assert actual == [m['id'] for m in maps if m['chapter'] == i], (i, actual)
        safe_width(p)


def campaign(browser, origin, maps, out, touch):
    kind = 'tap' if touch else 'key'; name = 'phone' if touch else 'desktop'
    with browser.new_context(viewport={'width':320 if touch else 1280,'height':640 if touch else 870}, has_touch=touch, is_mobile=touch, reduced_motion='reduce') as cx:
        p = cx.new_page(); errors = watch(p, origin)
        res = p.goto(origin); assert res and res.ok
        link = p.locator('a[href="/maze-2/"]'); expect(link).to_contain_text('24 доставки')
        with p.expect_response(lambda r: r.url == origin+'maze-2/' and r.request.resource_type == 'document') as navigation:
            act(p, 'a[href="/maze-2/"]', kind)
        assert navigation.value.ok and navigation.value.body() == (APP/'index.html').read_bytes()
        assert get_save(p) is None
        p.evaluate('items=>Object.entries(items).forEach(([k,v])=>localStorage.setItem(k,v))',PROTECTED)
        atlas(p, maps, kind)
        act(p, '[data-chapter="1"]', kind)
        p.screenshot(path=str(out/f'{name}-atlas.png'), full_page=True)
        act(p, '[data-story="meadow"]', kind)
        record = []
        for i, m in enumerate(maps):
            if i:
                act(p, '#next-story', kind)
            at(p, m['start']); safe_width(p)
            expect(p.locator('#view')).to_have_attribute('data-planning', 'false')
            if i in (2, 13, 23):
                act(p, '#hint', kind)
                at(p, m['start'])
                p.screenshot(path=str(out/f'{name}-route-{i+1}.png'), full_page=True)
            count = win(p, m, kind)
            done=json.loads(get_save(p))['done']
            assert done == {x['id']:True for x in maps[:i+1]}, (i+1,done)
            record.append({'route':m['id'],'actual_moves':count})
        p.screenshot(path=str(out/f'{name}-finish.png'), full_page=True)
        act(p, '#home', kind)
        p.reload(); saved = get_save(p)
        expect(p.locator('#album-count')).to_contain_text('24')
        for i in range(1,5):
            act(p,f'[data-chapter="{i}"]',kind)
            expect(p.locator('[data-story].done')).to_have_count(6)
        open_story(p,maps[0],kind); win(p,maps[0],kind)
        assert json.loads(get_save(p)) == json.loads(saved)
        assert p.evaluate('keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(PROTECTED)) == PROTECTED
        assert not errors, errors
        return {'input':kind,'routes':record,'reload_count':24,'external_errors':errors}


def tutorial(p, out, kind):
    act(p, '[data-story="coast"]', kind); at(p,'start')
    expect(p.locator('#view')).to_have_attribute('data-planning','false')
    walk(p,'birches',kind); walk(p,'start',kind)
    act(p,'#start-plan',kind)
    expect(p.locator('#walk-plan')).to_be_disabled()
    choice(p,'birches',kind); at(p,'start'); choice(p,'bench',kind); at(p,'start')
    expect(p.locator('#walk-plan')).to_be_enabled()
    act(p,'#undo-plan',kind); choice(p,'arch',kind); at(p,'start')
    p.screenshot(path=str(out/'optional-plan.png'),full_page=True)
    act(p,'#cancel-plan',kind); at(p,'start')
    assert get_save(p) is None
    act(p,'#start-plan',kind); choice(p,'birches',kind); choice(p,'arch',kind)
    p.evaluate('''()=>{window.arrivals=[]; new MutationObserver(()=>arrivals.push(document.querySelector('#view').dataset.at)).observe(document.querySelector('#view'),{attributes:true,attributeFilter:['data-at']});}''')
    act(p,'#walk-plan',kind); at(p,'arch')
    assert 'birches' in p.evaluate('window.arrivals')
    walk(p,'dock',kind); act(p,'#start-plan',kind); choice(p,'finish',kind)
    act(p,'#walk-plan',kind); at(p,'finish'); expect(p.locator('#delivered')).to_be_visible()


def special(browser, origin, maps, out, prior):
    url=origin+'maze-2/'
    with browser.new_context(viewport={'width':320,'height':640},has_touch=True,is_mobile=True) as cx:
        p=cx.new_page(); faults=watch(p,origin); p.goto(url)
        tutorial(p,out,'tap')
        act(p,'#home'); open_story(p,maps[1]);
        for v in ('fork','bridge','finish'): walk(p,v)
        expect(p.locator('#delivered')).to_have_count(0)
        for v in ('bridge','fork','lilies','fork','bridge','finish'): walk(p,v)
        expect(p.locator('#delivered')).to_be_visible()
        assert not faults, faults
    if prior:
        with browser.new_context(reduced_motion='reduce') as cx:
            p=cx.new_page(); faults=watch(p,origin)
            p.route(url,lambda r:r.fulfill(path=str(prior),content_type='text/html')); response=p.goto(url)
            assert response and response.body()==prior.read_bytes()
            for i,m in enumerate(maps[:3]):
                act(p,f'[data-story="{m["id"]}"]'); at(p,m['start'])
                if i==2: act(p,'#cancel-plan')
                win(p,m,'mouse'); act(p,'#home')
            old=get_save(p); p.unroute(url); res=p.reload(); assert res and res.body()==(APP/'index.html').read_bytes()
            expect(p.locator('[data-story].done')).to_have_count(3); assert get_save(p)==old
            b=cx.new_page(); b.goto(url)
            open_story(p,maps[3]); win(p,maps[3],'mouse')
            b.wait_for_function('([k,id])=>JSON.parse(localStorage.getItem(k)).done[id]===true',arg=[KEY,maps[3]['id']]); open_story(b,maps[4]); win(b,maps[4],'mouse')
            p.reload(); assert json.loads(get_save(p))=={'v':1,'done':{m['id']:True for m in maps[:5]}}
            assert not faults, faults
    with browser.new_context(offline=True,viewport={'width':1024,'height':630}) as cx:
        p=cx.new_page(); faults=watch(p,'file://')
        p.add_init_script("for (const k of ['getItem','setItem']) Storage.prototype[k]=()=>{throw Error('disabled for test');};")
        p.goto((APP/'index.html').as_uri()); expect(p.locator('#store-note')).to_be_visible()
        open_story(p,maps[2]); act(p,'#start-plan'); choice(p,'birches'); choice(p,'bench'); act(p,'#walk-plan')
        act(p,'#home'); open_story(p,maps[0]); p.wait_for_timeout(1050); at(p,'start'); win(p,maps[0],'mouse')
        assert not faults, faults
    return {'plan_cancel_edit_execution':True,'early_delivery_blocked':True,'prior_writer_upgrade_and_serialized_two_tabs': bool(prior),'offline_blocked_storage':True}


def main():
    ap=argparse.ArgumentParser(description=__doc__); ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--origin',help='Live catalog origin (default serves this checkout on loopback)'); ap.add_argument('--prior',type=Path)
    args=ap.parse_args(); args.out.mkdir(parents=True,exist_ok=False)
    maps=json.loads(subprocess.check_output(['node','-p',"JSON.stringify(require('./src/model.cjs').MAPS)"],cwd=APP))
    assert len(maps)==24 and len({m['id'] for m in maps})==24, '24 distinct deliveries required'
    before=sha256((APP/'index.html').read_bytes()).hexdigest()
    with sync_playwright() as pw, site(args.origin) as origin:
        browser=pw.chromium.launch(executable_path=chrome(pw),args=['--no-sandbox'])
        try:
            checks=[campaign(browser,origin,maps,args.out,touch) for touch in (True,False)]
            extra=special(browser,origin,maps,args.out,args.prior)
            assert before==sha256((APP/'index.html').read_bytes()).hexdigest()
            result={'result':'PASS','artifact_sha256':before,'origin':origin,'chromium':browser.version,'devices':checks,'other_saves':list(PROTECTED),**extra}
            (args.out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
            print('PASS',origin,before,[(s['input'],len(s['routes'])) for s in checks],extra)
        finally:
            browser.close()


if __name__=='__main__':
    main()
