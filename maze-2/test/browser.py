"""Play the three deliveries in Chromium, including actual taps, animation and file offline."""
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
KEY = 'maze-mail-2-v1'
OLD = {k: 'opaque ' + k for k in ('maze-v2','raskraska-v1','uzory-v1','uzory-2-v1','pary-v1','bukvograd-v1','tsifrograd-2-v1')}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


@contextmanager
def serve():
    with ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,directory=APP.parent)) as server:
        thread = Thread(target=server.serve_forever,daemon=True)
        thread.start()
        try:
            yield f'http://127.0.0.1:{server.server_port}/maze-2/'
        finally:
            server.shutdown()
            thread.join()


def chromium(pw):
    expected = Path(pw.chromium.executable_path)
    if expected.is_file():
        return str(expected)
    root = Path.home()/'.cache/ms-playwright'
    choices = [*root.glob('chromium-*/chrome-linux64/chrome'), *root.glob('chromium-*/chrome-linux/chrome')]
    assert choices, 'Installed Playwright Chromium not found'
    return str(max(choices,key=lambda p:int(p.parents[1].name.removeprefix('chromium-'))))


def observe(page, allowed):
    issues=[]
    page.on('pageerror',lambda e:issues.append(str(e)))
    page.on('console',lambda m:issues.append(m.text) if m.type=='error' else None)
    page.on('response',lambda r:issues.append(f'{r.status} {r.url}') if r.status>=400 else None)
    page.on('requestfailed',lambda r:issues.append(f'{r.failure} {r.url}'))
    page.on('request',lambda r:issues.append(f'Unexpected {r.url}') if not r.url.startswith((allowed,'data:')) else None)
    return issues


def act(page, selector, touch=False):
    button=page.locator(selector)
    button.tap() if touch else button.click()


def at(page, where):
    expect(page.locator('#view')).to_have_attribute('data-at',where)
    expect(page.locator('#view')).to_have_attribute('data-moving','false')


def geometry(page, with_map=False):
    dims=page.evaluate('''() => ({w:document.documentElement.clientWidth, sw:document.documentElement.scrollWidth,
      targets:[...document.querySelectorAll('button')].filter(n=>n.checkVisibility()).map(n=>{
        const r=n.getBoundingClientRect();return {id:n.id||n.dataset.to||n.dataset.story,w:r.width,h:r.height};
      })})''')
    assert dims['w']==dims['sw'] and all(x['w']>=44 and x['h']>=44 for x in dims['targets']), dims
    if with_map and page.locator('.trail').count():
        expect(page.locator('#board')).to_be_in_viewport()
        overlaps=page.locator('.trail').evaluate_all('''nodes => nodes.flatMap((el,i) => {
           const a=el.getBoundingClientRect();
           if(document.elementFromPoint((a.left+a.right)/2,(a.top+a.bottom)/2)?.closest('.trail')!==el) return [el.dataset.to];
           return nodes.slice(i+1).map(n=>n.getBoundingClientRect()).filter(b=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom).map(()=>el.dataset.to);
         })''')
        assert not overlaps, overlaps


def travel(page,to,touch):
    geometry(page,True)
    act(page,f'.trail[data-to="{to}"]',touch)


def choose(page,story,touch=False):
    act(page,f'[data-story="{story}"]',touch)
    at(page,'start')


def win(page):
    expect(page.locator('#delivered')).to_be_visible()
    expect(page.locator('.trail')).to_have_count(0)


def note(page,name):
    expect(page.locator('#notice')).to_contain_text(name)


def play(browser,url,out,*,touch):
    size={'width':320,'height':640} if touch else {'width':1280,'height':870}
    kind='phone' if touch else 'desktop'
    with browser.new_context(viewport=size,has_touch=touch,is_mobile=touch,
                             reduced_motion='reduce' if touch else 'no-preference') as cx:
        page=cx.new_page()
        issues=observe(page,url)
        response=page.goto(url,wait_until='load')
        assert response and response.ok
        expect(page.locator('#view')).to_have_attribute('data-mode','home')
        geometry(page)
        assert page.locator('[data-story]').count()==3
        expect(page.locator('#screen-title')).to_have_text('У зайчика новая почта!')
        assert page.locator('.cover-art').evaluate('''svg=>{
            const a=svg.getBoundingClientRect(),b=svg.querySelector('.object g').getBoundingClientRect();
            return b.width>12&&b.left>=a.left&&b.right<=a.right&&b.bottom<=a.bottom;
          }'''), 'Letter is clipped on the cover'
        page.screenshot(path=str(out/f'{kind}-home.png'))
        page.evaluate('''({old,key})=>{for(const [k,v] of Object.entries(old)) localStorage.setItem(k,v);localStorage.setItem(key,'{bad json');}''',{'old':OLD,'key':KEY})
        page.add_init_script('''(() => {window.reads=[];window.writes=[];
            for(const [method,log] of [['getItem',reads],['setItem',writes]]){const native=Storage.prototype[method];
              Storage.prototype[method]=function(key,...args){log.push(String(key));return native.call(this,key,...args);};}
          })()''')
        page.reload()
        expect(page.locator('[data-story].done')).to_have_count(0)
        if not touch:
            page.locator('[data-story="meadow"]').focus()
            page.keyboard.press('Enter')
            at(page,'start')
        else:
            choose(page,'meadow',touch)
        expect(page.locator('.trail')).to_have_count(1)
        assert page.locator('.trail[data-to="finish"]').count()==0
        for dest in ('fork','grove','nest'):
            travel(page,dest,touch)
            at(page,dest)
        expect(page.locator('#delivered')).to_have_count(0)
        expect(page.locator('.trail')).to_have_count(1)
        for dest in ('grove','fork','hill','finish'):
            travel(page,dest,touch)
            at(page,dest)
        win(page)
        assert page.locator('#map-svg').evaluate('''svg=>{
          const h=svg.querySelector('#courier').getBoundingClientRect();
          const p=svg.querySelector('[data-recipient] g')?.getBoundingClientRect();
          return !!p&&(p.bottom<=h.top||p.right<=h.left||p.left>=h.right);
        }'''), 'Recipient and courier must be visible separately'
        page.screenshot(path=str(out/f'{kind}-delivered.png'))
        act(page,'#home',touch)
        expect(page.locator('[data-story="meadow"]')).to_have_class('mission done')
        choose(page,'stream',touch)
        for dest in ('fork','bridge','finish'):
            travel(page,dest,touch)
            at(page,dest)
        expect(page.locator('#delivered')).to_have_count(0)
        note(page,'за маркой')
        expect(page.locator('#view')).to_have_attribute('data-stamped','false')
        for dest in ('bridge','fork','lilies'):
            travel(page,dest,touch)
            at(page,dest)
        expect(page.locator('#view')).to_have_attribute('data-stamped','true')
        page.screenshot(path=str(out/f'{kind}-stamp.png'))
        for dest in ('fork','bridge','finish'):
            travel(page,dest,touch)
            at(page,dest)
        win(page)

        act(page,'#home',touch)
        choose(page,'coast',touch)
        expect(page.locator('#view')).to_have_attribute('data-planning','true')
        expect(page.locator('#walk-plan')).to_be_disabled()
        travel(page,'birches',touch)
        at(page,'start')
        expect(page.locator('#view')).to_have_attribute('data-endpoint','birches')
        expect(page.locator('#walk-plan')).to_be_disabled()
        travel(page,'bench',touch)
        at(page,'start')
        expect(page.locator('#view')).to_have_attribute('data-endpoint','bench')
        expect(page.locator('.preview-route')).to_have_count(2)
        act(page,'#undo-plan',touch)
        expect(page.locator('#view')).to_have_attribute('data-endpoint','birches')
        travel(page,'arch',touch)
        expect(page.locator('#view')).to_have_attribute('data-endpoint','arch')
        expect(page.locator('#walk-plan')).to_be_enabled()
        page.screenshot(path=str(out/f'{kind}-plan.png'))
        act(page,'#cancel-plan',touch)
        at(page,'start')
        expect(page.locator('#view')).to_have_attribute('data-planning','false')
        expect(page.locator('.preview-route')).to_have_count(0)
        act(page,'#start-plan',touch)
        travel(page,'birches',touch)
        travel(page,'arch',touch)
        page.evaluate('''() => {const host=document.querySelector('#view');window.arrivals=[];
          new MutationObserver(()=>window.arrivals.push(host.dataset.at)).observe(host,{attributes:true,attributeFilter:['data-at']});}''')
        act(page,'#walk-plan',touch)
        at(page,'arch')
        assert 'birches' in page.evaluate('window.arrivals')
        expect(page.locator('#view')).to_have_attribute('data-planning','false')
        travel(page,'dock',touch)
        at(page,'dock')
        act(page,'#start-plan',touch)
        travel(page,'finish',touch)
        at(page,'dock')
        expect(page.locator('#walk-plan')).to_be_enabled()
        act(page,'#walk-plan',touch)
        at(page,'finish')
        win(page)
        snapshot=page.evaluate('() => [window.reads,window.writes]')
        assert [set(x) for x in snapshot]==[{KEY},{KEY}], snapshot
        assert page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(OLD))==OLD
        save=json.loads(page.evaluate('(k)=>localStorage.getItem(k)',KEY))
        assert save=={'v':1,'done':dict(meadow=True,stream=True,coast=True)}
        page.reload()
        expect(page.locator('[data-story].done')).to_have_count(3)
        assert not issues, issues
    return kind


def offline(browser,file,out):
    with browser.new_context(offline=True,viewport={'width':1024,'height':630}) as cx:
        page=cx.new_page()
        issues=observe(page,'file://')
        page.add_init_script("""(() => {for(const k of ['getItem','setItem']) Storage.prototype[k]=()=>{throw Error('blocked');};})()""")
        page.goto(file.as_uri(),wait_until='load')
        expect(page.locator('#store-note')).to_be_visible()
        choose(page,'coast')
        travel(page,'birches',False)
        travel(page,'bench',False)
        act(page,'#walk-plan')
        expect(page.locator('#view')).to_have_attribute('data-moving','true')
        act(page,'#home')
        choose(page,'meadow')
        # The canceled second half must not arrive in another story.
        page.locator('#view').evaluate('() => new Promise(resolve=>setTimeout(resolve,950))')
        at(page,'start')
        for dest in ('fork','hill','finish'):
            travel(page,dest,False)
            at(page,dest)
        win(page)
        page.screenshot(path=str(out/'tablet-offline.png'))
        assert not issues, issues


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--out',type=Path,required=True)
    cli.add_argument('--file',type=Path,default=APP/'index.html')
    args=cli.parse_args(); args.out.mkdir(parents=True,exist_ok=False)
    file=args.file.resolve()
    before=sha256(file.read_bytes()).hexdigest() if file.is_file() else None
    with serve() as url,sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=chromium(pw),args=['--no-sandbox'])
        try:
            variants=[play(browser,url,args.out,touch=False),play(browser,url,args.out,touch=True)]
            offline(browser,file,args.out)
            assert sha256(file.read_bytes()).hexdigest()==sha256((APP/'index.html').read_bytes()).hexdigest()==before
            result=dict(result='PASS',artifact_sha256=before,chromium=browser.version,
                        complete_routes=variants,all_stories=3,plan_edit_cancel_and_run=True,
                        save_keys_preserved=list(OLD),offline_1024x630=True)
            (args.out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
            print(json.dumps(result,ensure_ascii=False))
        finally:
            browser.close()


if __name__=='__main__':
    main()
