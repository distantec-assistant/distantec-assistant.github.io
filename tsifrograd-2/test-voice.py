"""V2 Julia/WebAudio acceptance: observe native decode/start/stop, never fake audio.

  python tsifrograd-2/test-voice.py
  LAB_BASE_URL=https://games.distantec.app VOICE_QA_OUT=/path/to/evidence python ...

Fresh private contexts and fresh evidence paths; no synthesis, device TTS or keys.
The shared runner lives in test-browser.py; importing it does not run browser QA.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('tsifrograd_v2_browser_qa', Path(__file__).with_name('test-browser.py'))
assert SPEC is not None and SPEC.loader is not None
qa = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(qa)

# Observe native prototypes; window.AudioContext remains the actual native constructor.
# Fetch/Response observers return the real response/bytes. No PCM, decoded buffers,
# source nodes, timers or success results are fabricated by this instrumentation.
OBSERVER = r'''(() => {
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) throw new Error('Native WebAudio is required for this acceptance');
  window.__qaNativeAudioContext = Native;
  window.__qaAudioContexts = [];
  window.__qaAudioOwner = 'runtime';
  window.__qaAudio = {events:[],starts:0,stops:0,active:0,max:0,speechAccess:0,htmlAudioPlays:0};
  const stats=window.__qaAudio, rawURLs=new WeakMap(), bufferURLs=new WeakMap(), owners=new WeakMap();
  const context = c => {
    if(!owners.has(c)) { owners.set(c,window.__qaAudioOwner);window.__qaAudioContexts.push(c); }
    return owners.get(c);
  };
  const log=(type,data={})=>stats.events.push({type,at:performance.now(),...data});
  const nativeFetch=window.fetch;
  window.fetch=function(...args){
    const u=new URL(typeof args[0]==='string'||args[0] instanceof URL?args[0]:args[0].url,location.href).href;
    return Reflect.apply(nativeFetch,this,args).then(response=>{
      const read=response.arrayBuffer;
      response.arrayBuffer=function(...a){return Reflect.apply(read,this,a).then(bytes=>{rawURLs.set(bytes,u);return bytes})};
      return response;
    });
  };
  const decode=Native.prototype.decodeAudioData;
  Native.prototype.decodeAudioData=function(bytes,success,failure){
    const owner=context(this),url=rawURLs.get(bytes)||null;
    log('decode-request',{owner,url,bytes:bytes.byteLength});
    let settled=false;
    const good=buffer=>{
      if(!settled){settled=true;bufferURLs.set(buffer,url);log('decoded',{owner,url,duration:buffer.duration,channels:buffer.numberOfChannels,samples:buffer.length})}
      return buffer;
    };
    const bad=error=>{if(!settled){settled=true;log('decode-failed',{owner,url,error:String(error)})}};
    const p=Reflect.apply(decode,this,[bytes,
      typeof success==='function'?buffer=>success(good(buffer)):undefined,
      typeof failure==='function'?error=>{bad(error);failure(error)}:undefined]);
    if(p&&typeof p.then==='function')p.then(good,bad);
    return p;
  };
  const create=Native.prototype.createBufferSource;
  Native.prototype.createBufferSource=function(...args){
    const c=this,owner=context(c),source=Reflect.apply(create,c,args);
    const start=source.start,stop=source.stop,connect=source.connect;
    let playing=false,connected=false;
    const finish=()=>{if(playing){playing=false;if(owner==='runtime')stats.active--;log('ended',{owner,url:bufferURLs.get(source.buffer)||null})}};
    source.connect=function(...a){const result=Reflect.apply(connect,this,a);connected=true;return result};
    source.start=function(...a){
      const result=Reflect.apply(start,this,a);
      playing=true;
      if(owner==='runtime'){stats.starts++;stats.active++;stats.max=Math.max(stats.max,stats.active)}
      log('start',{owner,url:bufferURLs.get(source.buffer)||null,duration:source.buffer?.duration||0,
                   channels:source.buffer?.numberOfChannels||0,state:c.state,native:c instanceof Native,connected});
      return result;
    };
    source.stop=function(...a){
      const result=Reflect.apply(stop,this,a);
      if(owner==='runtime')stats.stops++;
      log('stop',{owner,url:bufferURLs.get(source.buffer)||null});finish();return result;
    };
    source.addEventListener('ended',finish);
    return source;
  };
  const resume=Native.prototype.resume;
  Native.prototype.resume=function(...a){const owner=context(this);log('resume',{owner});return Reflect.apply(resume,this,a)};
  const close=Native.prototype.close;
  Native.prototype.close=function(...a){log('close',{owner:context(this)});return Reflect.apply(close,this,a)};
  for(const name of ['speechSynthesis','SpeechSynthesisUtterance'])Object.defineProperty(window,name,{
    configurable:true,get(){stats.speechAccess++;throw new Error('System speech forbidden: '+name)}
  });
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...a){stats.htmlAudioPlays++;return Reflect.apply(play,this,a)};
})()'''


def stats(page):
    return page.evaluate('window.__qaAudio')


def cursor(page):
    return page.evaluate('window.__qaAudio.events.length')


def events(page, since=0, type_=None):
    result = page.evaluate('(n)=>window.__qaAudio.events.slice(n)', since)
    return [e for e in result if e.get('owner') == 'runtime' and (type_ is None or e['type'] == type_)]


def assert_native(page):
    value = stats(page)
    assert page.evaluate('(window.AudioContext||window.webkitAudioContext)===window.__qaNativeAudioContext'), 'AudioContext was replaced'
    assert value['speechAccess'] == 0, value
    assert value['htmlAudioPlays'] == 0, 'acceptance requires native WebAudio, not HTMLAudio fallback'
    assert value['max'] <= 1 and value['active'] >= 0, value
    starts = events(page, type_='start')
    assert all(e['native'] and e['connected'] and e['state'] == 'running'
               and e['duration'] > 0.05 and e['channels'] >= 1 and e['url'] for e in starts), starts
    assert not events(page, type_='decode-failed'), 'unexpected native decode failure'


def wait_start(page, since=0, timeout=12000):
    page.wait_for_function('n=>window.__qaAudio.events.slice(n).some(e=>e.owner==="runtime"&&e.type==="start")', arg=since, timeout=timeout)


def idle(page, timeout=50000):
    page.wait_for_function('window.__qaAudio.active===0', timeout=timeout)
    # A scheduled phrase must not start after the previous source ended.
    count = stats(page)['starts']
    page.wait_for_timeout(200)
    assert stats(page)['starts'] == count and stats(page)['active'] == 0, 'late queued audio after idle/cancellation'


def queue(page, task):
    value = page.evaluate('''async task=>{
      const n=await import('./narration.mjs?v=5');
      return n.instruction(task).map(part=>{
        if(typeof part==='number')return {id:'c_'+part,number:part,url:new URL(n.clipUrl('c_'+part),location.href).href};
        if(part&&typeof part.clip==='string')return {id:part.clip,url:new URL(n.clipUrl(part.clip),location.href).href};
        throw new Error('narration is not a static clip/quantity array');
      });
    }''', task)
    assert value, ('empty narration', task)
    return value


def expect_queue(page, expected, since, timeout=50000):
    urls = [part['url'] for part in expected]
    page.wait_for_function('''({n,minimum})=>window.__qaAudio.events.slice(n).filter(e=>e.owner==='runtime'&&e.type==='start').length>=minimum''',
                           arg={'n': since, 'minimum': len(urls)}, timeout=timeout)
    idle(page, timeout)
    starts = events(page, since, 'start')
    actual = [e['url'] for e in starts]
    assert actual == urls, {'expected': urls, 'actual': actual}
    assert_native(page)
    return starts


def number_url(page, number):
    return page.evaluate('async n=>new URL((await import("./narration.mjs?v=5")).clipUrl("c_"+n),location.href).href', number)


def voice_cases(browser, site, ev):
    def shell():
        with qa.session(browser, site, ev, init=OBSERVER) as s:
            page = s.goto()
            assert page.locator('[data-build="tsifrograd-2.0-v1"]').count() == 1, 'v2 build missing'
            assert page.locator('#home').get_attribute('data-stage') == '1', 'v2 home missing'
            api = page.evaluate('''async()=>{
              const j=await import('./journey.mjs'),n=await import('./narration.mjs?v=5');
              const t=j.createTask(1,'find',4);
              return {task:t,queue:n.instruction(t),feedback:n.feedback(t,'wrong'),url:n.clipUrl('c_40')};
            }''')
            assert isinstance(api['queue'], list) and isinstance(api['feedback'], list), api
            assert api['task']['target'] == 5 and '/audio/' in api['url'], api
            assert_native(page)
            return api
    ready = ev.case('v2 surface / pure narration(task), feedback(task,status), clipUrl API', shell)

    def static_inventory():
        with qa.session(browser, site, ev, init=OBSERVER) as s:
            # Standalone static JSON document, not a partial/in-progress app shell.
            # Asset health can pass independently; it is never a runtime voice verdict.
            page = s.page
            s.context.add_init_script('''(()=>{
              const icon=()=>{if(!document.head)return false;
                const e=document.createElement('link');e.rel='icon';e.href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';document.head.append(e);return true};
              if(!icon()){const m=new MutationObserver(()=>{if(icon())m.disconnect()});m.observe(document,{childList:true,subtree:true})}
            })()''')
            page.goto(urljoin(site.url, 'audio/manifest.json'), wait_until='networkidle')
            page.locator('body').click(position={'x': 1, 'y': 1})
            decoded = page.evaluate('''async labURL=>{
              window.__qaAudioOwner='asset-audit';
              const n=await import(new URL('./narration.mjs?v=5',labURL).href);
              const response=await fetch(new URL('./audio/manifest.json',labURL));if(!response.ok)throw Error('manifest HTTP '+response.status);
              const manifest=await response.json();
              const ids=[...new Set([...Array.from({length:40},(_,i)=>'c_'+(i+1)),...Object.keys(manifest.clips)])];
              const c=new AudioContext(),result=[];
              try {
                for(const id of ids){
                  const relative=n.clipUrl(id),url=new URL(relative,labURL).href;
                  if(!url.startsWith(location.origin+'/')||url.includes('audio-svetlana'))throw Error('non-Julia/static URL '+url);
                  if(/^c_([1-9]|[12][0-9]|30)$/.test(id)&&!url.includes('/tsifrograd/audio/'))throw Error('number 1–30 not borrowed from Julia bank');
                  if(/^c_(3[1-9]|40)$/.test(id)&&!url.includes('/tsifrograd-2/audio/'))throw Error('number31–40 not local Julia bank');
                  const r=await fetch(url);if(!r.ok)throw Error(id+' HTTP '+r.status);
                  const bytes=await r.arrayBuffer(),byteLength=bytes.byteLength;
                  const b=await c.decodeAudioData(bytes);
                  if(id==='c_1'){
                    await c.resume();
                    const source=c.createBufferSource();source.buffer=b;source.connect(c.destination);
                    const ended=new Promise(resolve=>source.addEventListener('ended',resolve,{once:true}));
                    source.start();await new Promise(resolve=>setTimeout(resolve,100));source.stop();await ended;
                  }
                  result.push({id,url,bytes:byteLength,duration:b.duration,channels:b.numberOfChannels,samples:b.length});
                }
              } finally {await c.close();window.__qaAudioOwner='runtime'}
              return result;
            }''', site.url)
            ev.meta['static_mp3_decoded'] = decoded
            assert len({d['id'] for d in decoded}) == len(decoded) >= 40
            assert all(d['bytes'] > 100 and d['duration'] > 0.05 and d['channels'] >= 1 and d['samples'] > 0 for d in decoded), decoded
            assert_native(page)
            audit = page.evaluate('window.__qaAudio.events.filter(e=>e.owner==="asset-audit")')
            audit_starts = [e for e in audit if e['type'] == 'start']
            assert len(audit_starts) == 1 and audit_starts[0]['native'] and audit_starts[0]['connected'] and audit_starts[0]['state'] == 'running', audit
            assert any(e['type'] == 'stop' for e in audit), audit
            ev.meta['asset_audit_native_graph'] = audit
            return {'real_native_decodes': len(decoded), 'ids': [d['id'] for d in decoded],
                    'observer_start_stop_selfcheck_not_application_playback': audit_starts}
    ev.case('real fetch + native decode of c1…40 and all local Julia manifest clips', static_inventory)

    pending = []
    def add(name, fn):
        pending.append((name, fn))

    def instruction(kind, stage, round_):
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(stage, {stage: {kind: round_}}, sound=True),
                        viewport={'width': 390, 'height': 844}, touch=True) as s:
            page = s.goto()
            qa.select_stage(page, stage)
            task = page.evaluate('async a=>(await import("./journey.mjs")).createTask(...a)', [stage, kind, round_])
            expected = queue(page, task)
            since = cursor(page)
            page.locator(f'button[data-action="start"][data-kind="{kind}"]:visible').tap()
            assert qa.state(page)['kind'] == kind
            starts = expect_queue(page, expected, since)
            assert page.locator('#voice-note').is_hidden()
            s.screenshot(f'voice-{kind}-stage{stage}-instruction')
            # Every instruction part was decoded for the application's own context,
            # not only by the separate static asset audit.
            decoded = {e['url'] for e in events(page, since, 'decoded')}
            assert set(part['url'] for part in expected) <= decoded, (expected, decoded)
            ev.meta.setdefault('runtime_instruction_stats', {})[f'{stage}/{kind}'] = stats(page)
            return {'stage': stage, 'kind': kind, 'target': task['target'], 'expected_queue': expected,
                    'actual_native_starts': starts, 'zero_system_speech': True}
    for kind, stage, round_ in [('find', 1, 4), ('load', 3, 9), ('count', 2, 9), ('neighbors', 3, 9),
                               ('missing', 5, 5), ('orders', 4, 9), ('sharing', 4, 2), ('bridge', 5, 9)]:
        add(f'{kind} stage{stage}: exact recorded instruction order, actual runtime decode/start/end',
            lambda k=kind, s=stage, r=round_: instruction(k, s, r))

    def load_numbers():
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(1, {1: {'load': 4}}, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 1, 'load'); task = qa.pure_task(page)
            expected = queue(page, task)
            page.wait_for_function('n=>window.__qaAudio.starts>=n', arg=len(expected), timeout=40000)
            idle(page)
            actions = []
            for number in (1, 2):
                since = cursor(page)
                page.locator('#board button[data-action="add"][data-value="1"]').click()
                url = number_url(page, number)
                page.wait_for_function('''({n,url})=>window.__qaAudio.events.slice(n).some(e=>e.owner==='runtime'&&e.type==='start'&&e.url===url)''', arg={'n': since, 'url': url})
                idle(page)
                assert qa.state(page)['current'] == str(number)
                actions.extend(events(page, since, 'start'))
            assert_native(page)
            return {'guided_load_actual_number_starts': actions}
    add('guided load: real c1/c2 quantity feedback after child actions', load_numbers)

    def count_help():
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(1, {1: {'count': 4}}, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 1, 'count')
            task = qa.pure_task(page); initial = queue(page, task)
            page.wait_for_function('n=>window.__qaAudio.starts>=n', arg=len(initial), timeout=40000)
            idle(page); since = cursor(page)
            page.locator('#game button[data-action="help"]:visible').click()
            expected = [number_url(page, i) for i in range(1, task['target'] + 1)]
            page.wait_for_function('''({n,last})=>window.__qaAudio.events.slice(n).some(e=>e.owner==='runtime'&&e.type==='start'&&e.url===last)''', arg={'n': since, 'last': expected[-1]}, timeout=40000)
            idle(page)
            starts = events(page, since, 'start')
            numbers = [e['url'] for e in starts if '/c_' in e['url']]
            assert numbers == expected, (numbers, expected)
            assert qa.state(page)['phase'] == 'playing' and page.locator('#reward').is_hidden(), 'help must not solve the choice'
            assert_native(page)
            return {'help_counted_numbers': numbers, 'full_queue': starts}
    add('count help: actual ordered c1…c5, still requires child answer', count_help)

    def feedback():
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(4, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 4, 'orders')
            task = qa.pure_task(page)
            initial = queue(page, task)
            page.wait_for_function('n=>window.__qaAudio.starts>=n', arg=len(initial), timeout=40000)
            idle(page)
            # Empty order should request its real static corrective phrase.
            since = cursor(page)
            expected = page.evaluate('''async task=>{
              const n=await import('./narration.mjs?v=5');return n.feedback(task,'empty').map(p=>{
                const id=typeof p==='number'?'c_'+p:p.clip;return {id,url:new URL(n.clipUrl(id),location.href).href};
              });
            }''', task)
            assert expected
            page.locator('#check').click(); starts = expect_queue(page, expected, since)
            assert qa.state(page)['phase'] == 'playing' and page.locator('#feedback').inner_text().strip()
            return {'empty_advanced_feedback_real_sources': starts}
    add('wrong advanced check: feedback(task,status) is actual decoded speech', feedback)

    def cancellation():
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(5, {5: {'orders': 9}}, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 5, 'orders')
            wait_start(page)
            first = stats(page); repeat = page.locator('#game button[data-action="repeat"]')
            for _ in range(3):
                repeat.click()
            wait_start(page)
            # Rapid child input interrupts the instruction and previous quantities.
            for _ in range(3):
                page.locator('#board button[data-action="add"][data-value="10"]').click()
            assert qa.state(page)['phase'] == 'playing' and qa.state(page)['current'] == '30'
            for number in (31, 32):
                since = cursor(page)
                page.locator('#board button[data-action="add"][data-value="1"]').click()
                url = number_url(page, number)
                page.wait_for_function('''({n,url})=>window.__qaAudio.events.slice(n).some(e=>e.owner==='runtime'&&e.type==='start'&&e.url===url)''', arg={'n': since, 'url': url})
            assert qa.state(page)['current'] == '32'
            assert_native(page)
            assert stats(page)['stops'] > first['stops'], stats(page)
            qa.home(page); idle(page)
            assert stats(page)['active'] == 0 and stats(page)['max'] == 1
            stopped = stats(page)['starts']; page.wait_for_timeout(350)
            assert stats(page)['starts'] == stopped, 'old task audio resumed on home'
            ev.meta['cancellation_stats'] = stats(page)
            return {'native_starts_stops': stats(page), 'includes_real_31_32': True}
    add('repeat / rapid actions / 31–32 / home: cancellation, no overlap or delayed old audio', cancellation)

    def mute_both():
        with qa.session(browser, site, ev, init=OBSERVER,
                        fixture=qa.fresh_progress(4, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 4, 'orders'); wait_start(page)
            page.locator('#sound').click()
            assert not qa.sound_on(page)
            idle(page); count = stats(page)['starts']
            page.locator('#game button[data-action="repeat"]').click()
            for _ in range(3):
                page.locator('#board button[data-action="add"][data-value="1"]').click()
            assert qa.state(page)['current'] == '3'
            page.locator('#check').click()
            qa.home(page); qa.open_game(page, 1, 'count')
            page.locator('#game button[data-action="help"]:visible').click()
            page.wait_for_timeout(350)
            assert stats(page)['starts'] == count and stats(page)['active'] == 0, 'mute suppressed only one audio type'
            # Unmute is a gesture that must resume real instruction speech.
            since = cursor(page); page.locator('#sound').click(); wait_start(page, since)
            assert qa.sound_on(page)
            qa.home(page); idle(page); assert_native(page)
            return {'muted_phrase_quantity_feedback_help': True, 'real_unmute_recovery': True, 'stats': stats(page)}
    add('mute stops and suppresses speech + numbers + help; unmute really resumes native audio', mute_both)

    def failure_retry():
        injection = {'attempts': 0, 'injected': 0}
        def routes(s):
            def fail_once(route):
                injection['attempts'] += 1
                if not injection['injected']:
                    injection['injected'] += 1
                    s.expected_failures.append(route.request.url)
                    route.fulfill(status=503, content_type='audio/mpeg', body=b'')
                else:
                    route.continue_()
            s.page.route('**/audio/ph_orders_start.mp3*', fail_once)
        with qa.session(browser, site, ev, init=OBSERVER, routes=routes,
                        fixture=qa.fresh_progress(4, sound=True)) as s:
            page = s.goto(); qa.open_game(page, 4, 'orders')
            page.wait_for_function('!document.querySelector("#voice-note").hidden', timeout=15000)
            assert page.locator('#voice-note').inner_text().strip()
            assert injection['injected'] == 1
            s.screenshot('voice-one-503-visible-warning')
            url = s.expected_failures[0]
            since = cursor(page)
            with page.expect_response(lambda r: r.url == url and r.status == 200, timeout=15000):
                page.locator('#game button[data-action="repeat"]').click()
            page.wait_for_function('''({n,url})=>window.__qaAudio.events.slice(n).some(e=>e.owner==='runtime'&&e.type==='decoded'&&e.url===url)&&window.__qaAudio.events.slice(n).some(e=>e.owner==='runtime'&&e.type==='start'&&e.url===url)''', arg={'n': since, 'url': url}, timeout=15000)
            page.wait_for_function('document.querySelector("#voice-note").hidden')
            assert injection['attempts'] == 2, injection
            failures = [r for r in s.resources if r['url'] == url]
            assert len(failures) == 1 and failures[0].get('status') == 503, failures
            assert len([c for c in s.console if url in c['location'].get('url', '') or url in c['text']]) <= 1, s.console
            assert_native(page)
            s.screenshot('voice-static-retry-real-decode-recovered')
            return {'injection': injection, 'expected_failed_static_request': failures,
                    'repeat_actual_decode_start': events(page, since), 'recovered_warning': True}
    add('single injected static MP3 503 → visible warning → repeat retries real fetch/decode/start', failure_retry)

    if not ready:
        ev.blocked([name for name, _ in pending], 'v2 UI/narration prerequisite absent; do not mistake asset decode for integrated voice acceptance')
    else:
        for name, fn in pending:
            ev.case(name, fn)


def main():
    ev = qa.Evidence('voice', 'VOICE_QA_OUT')
    try:
        with qa.Site() as site, sync_playwright() as p:
            chrome = qa.chrome_path(p)
            ev.meta.update(base_url=site.url, chrome=chrome, native_observer='prototype wrappers, no AudioContext replacement')
            browser = p.chromium.launch(headless=True, executable_path=chrome, args=['--no-sandbox'])
            try:
                voice_cases(browser, site, ev)
            finally:
                browser.close()
    except Exception as exc:
        ev.case('runner infrastructure', lambda: (_ for _ in ()).throw(exc))
    return ev.finish()


if __name__ == '__main__':
    sys.exit(main())
