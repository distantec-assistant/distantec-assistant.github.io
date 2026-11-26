"""Real Chromium acceptance of the playable build, including its offline file."""
import argparse
from contextlib import contextmanager
from functools import partial
from hashlib import sha256
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

APP = Path(__file__).resolve().parents[1]
KEY = 'uzory-2-v1'
OLD = {k:'opaque '+k for k in ('uzory-v1','pary-v1','raskraska-v1','maze-v2','bukvograd-v1','tsifrograd-v1','tsifrograd-2-v1')}
ORIGINAL_LAMPS = ['red','green','red','green','red','green']


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextmanager
def serve():
    with ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=APP.parent)) as server:
        thread = Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/uzory-2/'
        finally:
            server.shutdown()
            thread.join()


def attach(page, allowed):
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda msg:errors.append(msg.text) if msg.type == 'error' else None)
    page.on('response',lambda r:errors.append(f'{r.status}: {r.url}') if r.status >= 400 else None)
    page.on('requestfailed',lambda r:errors.append(f'{r.failure}: {r.url}')
            if not r.url.startswith('data:') else None)
    page.on('request',lambda r:errors.append(f'Unexpected network request: {r.url}')
            if not r.url.startswith((allowed,'data:')) else None)
    page.add_init_script('''(() => {
      window.played=[];
      document.addEventListener('playing', event => {
        if(event.target.id==='narrator') window.played.push(event.target.dataset.clip);
      },true);
      Object.defineProperty(window,'speechSynthesis',{get(){throw Error('Unexpected speechSynthesis')}});
    })()''')
    return errors


def chromium(pw):
    default = Path(pw.chromium.executable_path)
    if default.is_file():
        return str(default)
    root = Path.home()/'.cache/ms-playwright'
    paths = list(root.glob('chromium-*/chrome-linux64/chrome')) + list(root.glob('chromium-*/chrome-linux/chrome'))
    assert paths, 'No installed Chromium'
    return str(max(paths,key=lambda p:int(p.parents[1].name.removeprefix('chromium-'))))


def act(page, selector, touch=False):
    target=page.locator(selector)
    target.tap() if touch else target.click()


def mode(page, name):
    expect(page.locator('#view')).to_have_attribute('data-mode',name)


def geometry(page, *, board=False):
    result=page.evaluate('''() => ({w:document.documentElement.clientWidth,
      sw:document.documentElement.scrollWidth, targets:[...document.querySelectorAll('button')].filter(b=>b.checkVisibility())
        .map(b=>{const r=b.getBoundingClientRect();return [b.id||b.dataset.paint||b.dataset.slot,r.width,r.height]})})''')
    assert result['w'] == result['sw'], result
    assert all(w>=44 and h>=44 for _,w,h in result['targets']), result
    if board:
        loc=page.locator('#check')
        expect(loc).to_be_in_viewport()
        expect(page.locator('#paint-tray [data-paint="green"]')).to_be_in_viewport()


def colors(page, selector):
    return page.locator(selector).evaluate_all('nodes=>nodes.map(a=>a.dataset.lamp)')


def screens(browser, url, out, viewport, *, touch=False, voice=False):
    with browser.new_context(viewport=viewport, has_touch=touch,is_mobile=touch,
                             reduced_motion='reduce' if touch else 'no-preference') as ctx:
        page=ctx.new_page()
        errors=attach(page,url)
        response=page.goto(url,wait_until='load')
        assert response and response.ok
        mode(page,'home')
        tag='phone' if touch else 'desktop'
        geometry(page)
        page.screenshot(path=str(out/f'{tag}-home.png'))
        page.evaluate('(old) => { for(const [k,v] of Object.entries(old)) localStorage.setItem(k,v); }',OLD)
        page.add_init_script('''(() => {
          window.reads=[];window.writes=[];
          for (const [method, seen] of [['getItem',reads],['setItem',writes]]) {
            const native=Storage.prototype[method];
            Storage.prototype[method]=function(key,...args){seen.push(String(key));return native.call(this,key,...args)};
          }
        })()''')
        page.reload()
        if voice:
            page.locator('#start-lesson').focus()
            page.keyboard.press('Enter')
            page.wait_for_function("window.played.includes('ph_what')")
        else:
            act(page,'#start-lesson',touch)
        mode(page,'next')
        expect(page.locator('#question [data-lamp="blank"]')).to_have_count(1)
        act(page,'#help',touch)
        expect(page.locator('#question')).to_have_attribute('data-hint','true')
        n=None
        if voice:
            page.wait_for_function("window.played.includes('ph_hint')")
            act(page,'#sound',touch)
            expect(page.locator('#sound')).to_have_attribute('aria-pressed','false')
            assert page.locator('#narrator').evaluate('a=>a.paused')
            n=page.evaluate('window.played.length')
        act(page,'#paint-tray [data-paint="sun"]',touch)
        expect(page.locator('#question [data-lamp="blank"]')).to_have_count(1)
        expect(page.locator('#notice')).to_contain_text('Попробуй')
        act(page,'#paint-tray [data-paint="blue"]',touch)
        expect(page.locator('#next-step')).to_be_visible()
        expect(page.locator('#question [data-lamp="blank"]')).to_have_count(0)
        if n is not None:
            assert page.evaluate('window.played.length') == n
        act(page,'#next-step',touch)
        mode(page,'build')
        page.evaluate('() => window.scrollTo(0,0)')
        geometry(page,board=True)
        expect(page.locator('#learner [data-lamp="blank"]')).to_have_count(6)
        act(page,'#check',touch)
        expect(page.locator('#notice')).to_contain_text('пусто')
        arranged=[*ORIGINAL_LAMPS]
        arranged[1]='red'
        for lamp in arranged:
            act(page,f'#paint-tray [data-paint="{lamp}"]',touch)
        assert colors(page,'#learner [data-slot]') == arranged
        expect(page.locator('#free-after')).to_have_count(0)
        act(page,'#check',touch)
        expect(page.locator('#learner [data-slot="1"]')).to_have_attribute('aria-pressed','true')
        assert page.locator('#sample [data-reference="true"]').count() == 1
        expect(page.locator('#sample .piece').nth(1)).to_have_attribute('data-reference','true')
        expect(page.locator('#notice')).to_contain_text('Поменяй')
        assert colors(page,'#learner [data-slot]') == arranged
        page.screenshot(path=str(out/f'{tag}-build.png'))
        act(page,'#paint-tray [data-paint="green"]',touch)
        # Select another filled location, swap it twice, then formally check.
        act(page,'#learner [data-slot="5"]',touch)
        act(page,'#paint-tray [data-paint="red"]',touch)
        assert colors(page,'#learner [data-slot]') == ORIGINAL_LAMPS[:-1]+['red']
        act(page,'#learner [data-slot="5"]',touch)
        act(page,'#paint-tray [data-paint="green"]',touch)
        act(page,'#check',touch)
        expect(page.locator('#free-after')).to_be_visible()
        assert colors(page,'#learner [data-slot]') == ORIGINAL_LAMPS
        expect(page.locator('#sample [data-reference="true"]')).to_have_count(0)
        page.screenshot(path=str(out/f'{tag}-lit.png'))
        act(page,'#free-after',touch)
        mode(page,'free')
        geometry(page)
        expect(page.locator('#repeat .unit')).to_have_count(0)
        for lamp in ['sun','blue','red','green','red']:
            act(page,f'#paint-tray [data-paint="{lamp}"]',touch)
        expect(page.locator('#repeat .unit')).to_have_count(3)
        assert colors(page,'#repeat .unit [data-lamp]') == ['sun','blue','red','green']*3
        act(page,'#unit-edit [data-slot="0"]',touch)
        act(page,'#paint-tray [data-paint="green"]',touch)
        act(page,'#unit-edit [data-slot="1"]',touch)
        act(page,'#free-delete',touch)
        assert colors(page,'#repeat .unit [data-lamp]') == ['green','red','green']*3
        page.screenshot(path=str(out/f'{tag}-free.png'))
        read, written=page.evaluate('() => [window.reads,window.writes]')
        assert set(read) == set(written) == {KEY}, (read,written)
        assert page.evaluate('(ks)=>Object.fromEntries(ks.map(k=>[k,localStorage.getItem(k)]))',list(OLD)) == OLD
        raw=page.evaluate('(key) => localStorage.getItem(key)',KEY)
        saved=json.loads(raw)
        assert saved['guided'] and saved['built'] and saved['block'] == ['green','red','green']
        page.reload()
        mode(page,'home')
        if voice:
            expect(page.locator('#sound')).to_have_attribute('aria-pressed','false')
        expect(page.locator('#done-stamp')).to_be_visible()
        act(page,'#start-free',touch)
        assert colors(page,'#repeat .unit [data-lamp]') == ['green','red','green']*3
        assert not errors, errors
        return tag


def offline(browser, file):
    with browser.new_context(offline=True,viewport={'width':1024,'height':630}) as ctx:
        page=ctx.new_page()
        errors=attach(page,'file://')
        page.add_init_script('''(() => {
          Storage.prototype.getItem = Storage.prototype.setItem = () => { throw Error('storage blocked'); };
        })()''')
        page.goto(file.as_uri())
        mode(page,'home')
        expect(page.locator('#store-note')).to_be_visible()
        decoded=page.evaluate('''async () => {
          const bank=JSON.parse(document.querySelector('#voices').textContent), ac=new AudioContext();
          try {
            return await Promise.all(Object.entries(bank).map(async ([id,src])=>{
              const b=Uint8Array.from(atob(src.split(',')[1]),c=>c.charCodeAt(0));
              const pcm=await ac.decodeAudioData(b.buffer); return [id,pcm.duration];
            }));
          } finally { await ac.close(); }
        }''')
        assert len(decoded)==5 and all(t>0 for _,t in decoded), decoded
        act(page,'#start-free')
        mode(page,'free')
        act(page,'#paint-tray [data-paint="sun"]')
        act(page,'#paint-tray [data-paint="blue"]')
        assert colors(page,'#repeat .unit [data-lamp]') == ['sun','blue']*3
        act(page,'#back-home')
        act(page,'#start-lesson')
        page.wait_for_function("window.played.includes('ph_what')")
        act(page,'#paint-tray [data-paint="sun"]')
        page.wait_for_function("window.played.includes('ph_again')")
        act(page,'#paint-tray [data-paint="blue"]')
        act(page,'#next-step')
        page.wait_for_function("window.played.includes('ph_intro')")
        for lamp in ORIGINAL_LAMPS:
            act(page,f'#paint-tray [data-paint="{lamp}"]')
        before_win=page.evaluate("window.played.filter(clip=>clip==='ph_done').length")
        act(page,'#check')
        expect(page.locator('#free-after')).to_be_visible()
        page.wait_for_function("n=>window.played.filter(clip=>clip==='ph_done').length>n",arg=before_win)
        act(page,'#back-home')
        assert page.locator('#narrator').evaluate('a=>a.paused')
        geometry(page)
        assert not errors, errors
        return dict(decoded)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',required=True,type=Path)
    parser.add_argument('--file',type=Path,default=APP/'index.html')
    args=parser.parse_args()
    args.out.mkdir(parents=True,exist_ok=False)
    file=args.file.resolve()
    before=sha256(file.read_bytes()).hexdigest() if file.exists() else None
    with serve() as url, sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=chromium(pw),args=['--no-sandbox'])
        try:
            variants=[screens(browser,url,args.out,{'width':1280,'height':900},voice=True),
                      screens(browser,url,args.out,{'width':320,'height':640},touch=True)]
            decoded=offline(browser,file)
            assert sha256(file.read_bytes()).hexdigest()==sha256((APP/'index.html').read_bytes()).hexdigest()==before
            result={'result':'PASS','chrome':browser.version,'artifact_sha256':before,'full_scenarios':variants,
                    'prior_saves_preserved':list(OLD),'offline_at_1024x630':True,'mp3_decoded':decoded}
            (args.out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
            print(json.dumps(result,ensure_ascii=False))
        finally:
            browser.close()


if __name__=='__main__':
    main()
