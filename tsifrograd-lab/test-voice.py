"""Recorded Julia regression: actual Chromium audio graph, no paid calls."""
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('VOICE_QA_OUT', '/root/.hermes/cache/scratch/tsifrograd-julia-return/voice'))
OUT.mkdir(parents=True, exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
server = None
base = os.environ.get('LAB_BASE_URL')
if not base:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(H, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
setup = """(()=>{
  window.__systemSpeechAccess=0;
  Object.defineProperty(window,'speechSynthesis',{configurable:true,get(){window.__systemSpeechAccess++;throw new Error('System voice must not be used')}});
  window.__voiceStats={starts:0,stops:0,active:0,max:0};
  const Native=window.AudioContext;
  window.AudioContext=class extends Native {
    createBufferSource(){
      const s=super.createBufferSource(),start=s.start.bind(s),stop=s.stop.bind(s),v=window.__voiceStats;
      let playing=false;
      const finish=()=>{if(playing){playing=false;v.active--}};
      s.start=(...args)=>{start(...args);playing=true;v.starts++;v.active++;v.max=Math.max(v.max,v.active)};
      s.stop=(...args)=>{stop(...args);finish();v.stops++};
      s.addEventListener('ended',finish);
      return s;
    }
  };
})()"""
checks = []
errors = []
requests = []
try:
    with sync_playwright() as p:
        candidates = sorted(Path('/root/.cache/ms-playwright').glob('chromium-*/chrome-linux64/chrome'), reverse=True)
        browser = p.chromium.launch(headless=True, executable_path=str(candidates[0]), args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
        context.add_init_script(setup)
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: requests.append(r.url))
        page.goto(base + '/tsifrograd-lab/', wait_until='networkidle')
        # A real WebAudio decode for every new, published-compatible URL.
        decoded = page.evaluate("""async()=>{
          const m=await (await fetch('./audio/manifest.json')).json();
          const c=new AudioContext();const result=[];
          for(const id of Object.keys(m.clips)){
            const r=await fetch('./audio/'+id+'.mp3');if(!r.ok)throw new Error('missing '+id);
            const b=await c.decodeAudioData(await r.arrayBuffer());
            result.push({id,duration:b.duration,channels:b.numberOfChannels});
          }
          await c.close();return result;
        }""")
        assert len(decoded) == 21 and all(d['duration'] > 0.1 for d in decoded)
        checks.append('all 21 Julia MP3 assets fetched and decoded in Chromium')
        for kind, minimum in [('orders', 3), ('sharing', 1), ('bridge', 3)]:
            starts = page.evaluate('window.__voiceStats.starts')
            with page.expect_response(lambda r: f'/audio/ph_{kind}_start.mp3' in r.url) as response:
                page.locator(f'[data-action=start][data-kind={kind}]').tap()
            assert response.value.status == 200
            page.wait_for_function('(n)=>window.__voiceStats.starts>=n', arg=starts + minimum, timeout=20000)
            assert page.locator('#voice-note').is_hidden()
            page.locator('#sound').tap()
            page.wait_for_function('window.__voiceStats.active===0')
            page.locator('#game [data-action=home]').first.tap()
            page.locator('#sound').tap()
        checks.append('all three instructions play from recordings, including phrase-number-phrase sequences')
        page.locator('[data-action=start][data-kind=orders]').tap()
        for _ in range(3):
            page.locator('[data-action=add][data-value="10"]').tap()
        with page.expect_response(lambda r: '/audio/c_31.mp3' in r.url) as response:
            page.locator('[data-action=add][data-value="1"]').tap()
        assert response.value.status == 200
        page.locator('#sound').tap()
        page.wait_for_function('window.__voiceStats.active===0')
        stats = page.evaluate('window.__voiceStats')
        assert stats['max'] == 1, stats
        assert page.evaluate('window.__systemSpeechAccess') == 0
        checks.append('number 31, rapid input and mute: no overlapping sources, zero system-voice calls')
        assert all(u.startswith(base + '/') or u.startswith('data:') for u in requests), requests
        checks.append('runtime requests stay on the site; no synthesis/API traffic')
        context.close()
        # A transient static-file failure is retryable by the explicit repeat button.
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        context.add_init_script(setup)
        page = context.new_page();page.on('pageerror', lambda e: errors.append(str(e)))
        failed_once = [False]
        def fail_once(route):
            if not failed_once[0]:
                failed_once[0] = True;route.fulfill(status=503, body='fixture unavailable')
            else:
                route.continue_()
        page.route('**/audio/ph_orders_start.mp3', fail_once)
        page.goto(base + '/tsifrograd-lab/', wait_until='networkidle')
        page.locator('[data-action=start][data-kind=orders]').click()
        page.wait_for_function("!document.getElementById('voice-note').hidden")
        with page.expect_response(lambda r: '/audio/ph_orders_start.mp3' in r.url and r.status == 200):
            page.locator('[data-action=repeat]').click()
        page.wait_for_function("document.getElementById('voice-note').hidden")
        assert page.evaluate('window.__systemSpeechAccess') == 0
        checks.append('one injected 503: visible warning, explicit repeat retries and recovers')
        context.close();browser.close()
    assert not errors, errors
    report = {'result': 'PASS', 'checks': checks, 'page_errors': errors, 'decoded': decoded, 'voice_stats': stats, 'limitation': 'Actual WebAudio execution, not human listening or a physical-device test'}
    (OUT / 'voice-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({'result': 'PASS', 'groups': len(checks), 'new_clips_decoded': len(decoded), 'voice_stats': stats, 'page_errors': errors, 'evidence': str(OUT)}, ensure_ascii=False, indent=2))
finally:
    if server:
        server.shutdown()
