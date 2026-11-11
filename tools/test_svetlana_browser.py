#!/usr/bin/env python3
"""Real Chromium migration regressions; no synthesis, fake audio or progress hooks.

    python3 tools/test_svetlana_browser.py
    SV_QA_OUT=/path/to/evidence python3 tools/test_svetlana_browser.py
    LAB_BASE_URL=https://games.distantec.app python3 tools/test_svetlana_browser.py
    python3 tools/test_svetlana_browser.py --only bukvograd-О-catch-phone

Default: temporary loopback-only HTTP server, closed even after a failed case.
Set GAME_AUDIO_BANK=audio to verify the restored Julia bank; the default remains
audio-svetlana for the archived Svetlana migration. The other bank is forbidden.
LAB_CHROME (or SV_CHROME) may select an installed Chromium. Every run receives a
unique evidence directory. Failures do not prevent independent cases running.
Native WebAudio is observed, not replaced: fetch/decode/start/stop pass through.
No claim about human listening, Safari, physical touch or child usability is made.
"""
from __future__ import annotations

import argparse
from collections import Counter
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import unquote, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
COUNTS = {"bukvograd": 523, "tsifrograd": 106, "tsifrograd-lab": 21}
AUDIO_BANK = os.environ.get("GAME_AUDIO_BANK", "audio-svetlana")
if AUDIO_BANK not in {"audio", "audio-svetlana"}:
    raise ValueError("GAME_AUDIO_BANK must name an existing supported bank")
INACTIVE_AUDIO_BANK = "audio-svetlana" if AUDIO_BANK == "audio" else "audio"
KEYS = ("bukvograd-v1", "tsifrograd-v1", "tsifrograd-lab-v1")
SIZES = {"phone": {"width": 390, "height": 844}, "tablet": {"width": 1024, "height": 768}}
LETTERS = [("А", "a", 0), ("М", "m", 1), ("О", "o", 2), ("Ы", "y", 12)]

# These wrappers never manufacture bytes/buffers, alter rate/gain, or shortcut
# promises. Source identity comes from the actual response -> decode -> buffer.
OBSERVER = r"""(() => {
  const qa = window.__svqa = {starts:[], decoded:[], failed:[], max_active:0, forbidden:[]};
  const live = new Map(), bytesFrom = new WeakMap(), decodedFrom = new WeakMap();
  let serial = 0;
  const clean = value => {try {const u=new URL(value,location.href); return u.origin+u.pathname} catch {return 'invalid-url'}};
  const emit = event => {if(window.__svAudioEvent) window.__svAudioEvent(event).catch(()=>{});};
  const active = () => [...live.values()].filter(x=>!x.stop_requested && !x.ended).length;
  Object.defineProperty(qa,'active',{get:active});
  const nativeFetch = window.fetch;
  window.fetch = function(...args) {
    return nativeFetch.apply(this,args).then(response => {
      if(!response.ok) {const item={type:'fetch-failed',url:clean(response.url),status:response.status};qa.failed.push(item);emit(item);}
      const arrayBuffer = response.arrayBuffer;
      response.arrayBuffer = function(...args) {
        return arrayBuffer.apply(this,args).then(bytes => {bytesFrom.set(bytes,clean(response.url)); return bytes;});
      };
      return response;
    });
  };
  const contexts = new Set([window.AudioContext,window.webkitAudioContext].filter(Boolean));
  for(const Context of contexts) {
    const proto = Object.getPrototypeOf(Context.prototype);
    // decodeAudioData is inherited from BaseAudioContext in Chromium.
    const owner = Object.prototype.hasOwnProperty.call(Context.prototype,'decodeAudioData') ? Context.prototype : proto;
    if(owner.__svObserved) continue;
    Object.defineProperty(owner,'__svObserved',{value:true});
    const decode = owner.decodeAudioData;
    owner.decodeAudioData = function(bytes,success,failure) {
      const url = bytesFrom.get(bytes);
      const observe = buffer => {
        if(url) {decodedFrom.set(buffer,url); const item={type:'decoded',url,duration:buffer.duration,sample_rate:buffer.sampleRate}; qa.decoded.push(item); emit(item);}
        return buffer;
      };
      if(typeof success==='function') return decode.call(this,bytes,buffer=>success(observe(buffer)),failure);
      return decode.call(this,bytes).then(observe);
    };
  }
  const proto = window.AudioBufferSourceNode?.prototype;
  if(proto) {
    const start = proto.start, stop = proto.stop;
    const records = new WeakMap();
    proto.start = function(...args) {
      const url=decodedFrom.get(this.buffer);
      const result=start.apply(this,args);
      if(url) {
        const item={type:'start',id:++serial,url,duration:this.buffer.duration,rate:this.playbackRate.value,
                    detune:this.detune?.value||0,stop_requested:false,ended:false};
        records.set(this,item); live.set(item.id,item); qa.starts.push(item);
        qa.max_active=Math.max(qa.max_active,active()); emit({...item});
        this.addEventListener('ended',()=>{item.ended=true;live.delete(item.id);emit({type:'ended',id:item.id,url});},{once:true});
      }
      return result;
    };
    proto.stop = function(...args) {
      const result=stop.apply(this,args), item=records.get(this);
      if(item) {item.stop_requested=true;emit({type:'stop',id:item.id,url:item.url});}
      return result;
    };
  }
  if(window.speechSynthesis) {
    window.speechSynthesis.speak = function() {
      qa.forbidden.push('system-tts');emit({type:'forbidden',kind:'system-tts'});
      throw new Error('System TTS is forbidden in this migration check');
    };
  }
  if(window.WebSocket) {
    window.WebSocket = new Proxy(window.WebSocket,{construct(){
      qa.forbidden.push('websocket');emit({type:'forbidden',kind:'websocket'});
      throw new Error('WebSocket is forbidden in this static-only check');
    }});
  }
})();"""


def compact(value):
    # JSON.stringify's known property order: the active TG save stays byte exact
    # even when its existing route button serializes the unchanged save.
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def fixtures(route="30", letter_index=None, catch=False):
    bg = {"g": {}, "done": {}, "seen": {}, "gn": {}, "pl": {}}
    if letter_index is not None:
        bg["done"] = {str(i): 1 for i in range(letter_index)}
        if catch:
            bg["gn"] = {str(letter_index): {"meet": 1}}
    tg = {"v": 2, "route": route, "done": {}, "gn": {}, "pl": {},
          "small": {"done": {"0": 1} if route == "10" else {}, "gn": {}, "pl": {}}}
    # Deliberate whitespace in saves not written by the selected route button.
    return {KEYS[0]: " \n" + compact(bg) + "\n", KEYS[1]: compact(tg),
            KEYS[2]: ' {"version":1,"counts":{"orders":0,"sharing":0,"bridge":0},"sound":true}\n'}


def safe_url(url):
    parsed = urlsplit(url)
    host = parsed.hostname or "invalid-host"
    try:
        port = ":" + str(parsed.port) if parsed.port else ""
    except ValueError:
        port = ""
    return f"{parsed.scheme}://{host}{port}{parsed.path}"


def short_error(error):
    # No query strings/credentials from a live URL end up in reports.
    text = str(error).split("Call log:", 1)[0].strip()
    text = re.sub(r"https?://[^\s)'\"]+", lambda m: safe_url(m[0]), text)
    return text[:1400]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class Suite:
    def __init__(self, browser, base, out, timeout):
        self.browser, self.base, self.out, self.timeout = browser, base.rstrip("/"), out, timeout
        self.cases = []
        self.case = {}
        self.seed = {}

    def event(self, event):
        if isinstance(event, dict):
            if "url" in event:
                event["url"] = safe_url(event["url"])
            self.case["audio"].append(event)

    def starts(self, page):
        return page.evaluate("window.__svqa.starts.length")

    def played(self, page, clip, after=0, bank=None):
        page.wait_for_function("""({clip,after}) => window.__svqa.starts.slice(after)
          .some(x=>new URL(x.url).pathname.endsWith('/'+clip+'.mp3')) || window.__svqa.failed
          .some(x=>new URL(x.url).pathname.endsWith('/'+clip+'.mp3'))""",
                               arg={"clip": clip, "after": after}, timeout=self.timeout)
        observed = page.evaluate("""({clip,after}) => window.__svqa.starts.slice(after)
          .find(x=>new URL(x.url).pathname.endsWith('/'+clip+'.mp3'))""",
                                 {"clip": clip, "after": after})
        assert observed, f"recording was requested but unavailable: {clip}"
        if bank:
            actual = unquote(urlsplit(observed["url"]).path)
            expected_suffix = f"/{bank}/{AUDIO_BANK}/{clip}.mp3"
            if not actual.endswith(expected_suffix):
                self.case["errors"].append({"code": "wrong-playback-bank", "clip": clip,
                                             "expected_suffix": expected_suffix, "actual": actual})
        assert observed["duration"] > 0 and observed["rate"] == 1 and observed["detune"] == 0
        return observed

    def saves(self, page, allow_lab=False):
        observed = page.evaluate("keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))", list(KEYS))
        for key, value in self.seed.items():
            if allow_lab and key == KEYS[2]:
                continue
            assert observed[key] == value, f"save changed byte-for-byte: {key}"
        return observed

    def audio_health(self, page):
        qa = page.evaluate("({active:__svqa.active,max:__svqa.max_active,forbidden:__svqa.forbidden})")
        assert not qa["forbidden"], "forbidden runtime audio generation"
        assert qa["max"] <= 1, f"uncancelled concurrent narration: {qa}"
        # Existing native hook is read only. Lab intentionally has no invented hook.
        native = page.evaluate("window.__voice ? {...window.__voice} : null")
        if native:
            assert 0 <= native["active"] <= 1 and native["max"] <= 1, native
            assert all(rate == 1 for rate in native["rates"]), native

    def stopped(self, page):
        page.wait_for_function("window.__svqa.active === 0", timeout=self.timeout)
        before = self.starts(page)
        page.wait_for_timeout(650)
        assert self.starts(page) == before, "stale narration resumed after exit/mute"
        self.audio_health(page)

    def layout(self, page, label):
        size = page.evaluate("({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth})")
        assert max(size["document"], size["body"]) <= size["viewport"] + 1, (label, size)
        self.case["layouts"].append({"screen": label, **size})
        page.screenshot(path=str(self.out / f"{self.case['name']}-{label}.png"), full_page=True)

    def reload(self, page, allow_lab=False):
        self.audio_health(page)
        self.saves(page, allow_lab)
        page.reload(wait_until="networkidle")
        self.saves(page, allow_lab)
        assert self.starts(page) == 0, "startup unexpectedly played before user gesture"

    def main_home(self, page):
        page.locator('#station [data-go="map"]').click()
        page.locator('#map [data-go="home"]').click()
        assert page.locator("#home.on").count() == 1
        self.stopped(page)
        self.saves(page)
        self.reload(page)

    def repeat(self, page, selector, first_clip, bank):
        before = self.starts(page)
        for _ in range(3):
            page.locator(selector).click()
        self.played(page, first_clip, after=before, bank=bank)
        self.audio_health(page)

    def run(self, name, bank, size, seed, scenario):
        self.seed = seed
        self.case = {"name": name, "bank": bank, "viewport": SIZES[size], "result": "RED",
                     "scenario_completed": False, "errors": [], "requests": [], "audio": [], "layouts": []}
        case = self.case
        context = None
        page = None
        try:
            context = self.browser.new_context(viewport=SIZES[size], reduced_motion="reduce",
                                               has_touch=size == "phone", is_mobile=size == "phone",
                                               service_workers="block")
            context.set_default_timeout(self.timeout)
            origin = (urlsplit(self.base).scheme, urlsplit(self.base).netloc)
            prefix = urlsplit(self.base).path.rstrip("/")
            def managed_path(url):
                path = unquote(urlsplit(url).path)
                if ".." in path.split("/") or "\\" in path:
                    return False
                return any(path.startswith(f"{prefix}/{game}/") for game in COUNTS)
            def request_event(request):
                parsed = urlsplit(request.url)
                clean = safe_url(request.url)
                case["requests"].append({"method": request.method, "type": request.resource_type, "url": clean})
                path = unquote(parsed.path)
                if re.search(rf"/(bukvograd|tsifrograd|tsifrograd-lab)/{re.escape(INACTIVE_AUDIO_BANK)}/[^/]+\.mp3$", path, re.I):
                    case["errors"].append({"code": "inactive-audio-request", "url": clean})
                if (parsed.scheme, parsed.netloc) != origin:
                    case["errors"].append({"code": "external-request-blocked", "url": clean})
                if request.method not in {"GET", "HEAD"}:
                    case["errors"].append({"code": "nonstatic-request-blocked", "method": request.method, "url": clean})
                if not managed_path(request.url):
                    case["errors"].append({"code": "unmanaged-request-blocked", "url": clean})
            def route_event(route):
                parsed = urlsplit(route.request.url)
                if ((parsed.scheme, parsed.netloc) != origin or route.request.method not in {"GET", "HEAD"}
                        or not managed_path(route.request.url)):
                    route.abort("blockedbyclient")
                else:
                    route.continue_()
            context.route("**/*", route_event)
            context.on("request", request_event)
            context.on("response", lambda response: case["errors"].append(
                {"code": "http-error", "status": response.status, "url": safe_url(response.url)}) if response.status >= 400 else None)
            context.on("requestfailed", lambda request: case["errors"].append(
                {"code": "request-failed", "failure": request.failure, "url": safe_url(request.url)})
                       if request.failure != "net::ERR_ABORTED" else None)
            context.add_init_script("""(() => {
              if(location.protocol!=='http:' && location.protocol!=='https:') return;
              if(!sessionStorage.getItem('sv-qa-seeded')) {
                const values = """ + json.dumps(seed, ensure_ascii=False) + """;
                for(const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
                sessionStorage.setItem('sv-qa-seeded','1');
              }
            })();""")
            context.add_init_script(OBSERVER)
            page = context.new_page()
            page.expose_function("__svAudioEvent", self.event)
            page.on("pageerror", lambda error: case["errors"].append({"code": "javascript-error", "message": short_error(error)}))
            page.on("console", lambda message: case["errors"].append({"code": "console-error", "message": short_error(message.text)}) if message.type == "error" else None)
            response = page.goto(f"{self.base}/{bank}/", wait_until="networkidle")
            assert response and response.status == 200, "page did not return 200"
            case["html_sha256"] = hashlib.sha256(response.body()).hexdigest()
            self.saves(page)
            assert self.starts(page) == 0
            scenario(page)
            self.audio_health(page)
            case["scenario_completed"] = True
        except Exception as error:
            case["errors"].append({"code": "scenario-failed", "message": short_error(error)})
            if page and not page.is_closed():
                try:
                    page.screenshot(path=str(self.out / f"{name}-failure.png"), full_page=True)
                except Exception:
                    pass
        finally:
            if page and not page.is_closed():
                try:
                    self.audio_health(page)
                    missing = page.evaluate("window.__missing || []")
                    if missing:
                        case["errors"].append({"code": "native-missing-audio", "clips": missing})
                    if bank == "tsifrograd-lab" and page.locator("#voice-note").is_visible():
                        case["errors"].append({"code": "lab-audio-unavailable-warning"})
                except Exception as error:
                    case["errors"].append({"code": "final-audio-check-failed", "message": short_error(error)})
            if context:
                context.close()
            case["result"] = "PASS" if case["scenario_completed"] and not case["errors"] else "RED"
            self.cases.append(case)
            (self.out / f"{name}.json").write_text(json.dumps(case, ensure_ascii=False, indent=2) + "\n")
            print(f"{case['result']}: {name} (scenario_completed={case['scenario_completed']}, errors={len(case['errors'])})", flush=True)

    def bukvograd(self, page, ch, clip_id, index, catch=False):
        assert page.evaluate("({index,ch,id})=>window.BG && BG.LET[index].ch===ch && BG.LET[index].id===id",
                             {"index": index, "ch": ch, "id": clip_id})
        self.layout(page, "home")
        page.locator("#play").click()
        self.played(page, "ph_hello", bank="bukvograd")
        page.locator(f'#mapInner [data-st="{index}"]').click()
        assert page.evaluate("BG.state.game") == ("catch" if catch else "meet")
        if catch:
            self.played(page, "find_" + clip_id, bank="bukvograd")
            bubble = page.locator(f'.bub[data-l="{ch}"]:not(.pop)').first
            bubble.wait_for(state="visible")
            # Moving bubbles are never stable: real pointer coordinates, not
            # force clicks, dispatch_event, or calling the game's hit handler.
            box = bubble.bounding_box()
            assert box
            page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            self.played(page, "name_" + clip_id, bank="bukvograd")
            self.repeat(page, "#repeat", "find_" + clip_id, "bukvograd")
        else:
            self.played(page, "l_" + clip_id, bank="bukvograd")
            self.played(page, "snd_" + clip_id, bank="bukvograd")
            word = page.evaluate("index=>BG.LET[index].w[0]", index)
            self.played(page, "w_" + word, bank="bukvograd")
            self.repeat(page, "#repeat", "l_" + clip_id, "bukvograd")
        self.layout(page, "station")
        self.saves(page)
        self.main_home(page)

    def tsifrograd(self, page, route):
        assert page.evaluate("!!window.BG && Array.isArray(BG.SL)")
        self.layout(page, "home")
        page.locator("#play10" if route == "10" else "#play").click()
        assert page.evaluate("BG.route") == route
        assert page.locator("#mapTitle").text_content() == "До " + route
        self.played(page, "ph_hello", bank="tsifrograd")
        index = 1 if route == "10" else 0  # target 2 or 11: one crate click cannot award progress
        page.locator(f'#mapInner [data-st="{index}"]').click()
        first = "g_2" if route == "10" else "c_11"
        assert page.evaluate("BG.state.game") == ("load10" if route == "10" else "load")
        self.played(page, first, bank="tsifrograd")
        self.played(page, "ph_tap" if route == "10" else "ph_load", bank="tsifrograd")
        before = self.starts(page)
        page.locator("#crate").click()
        self.played(page, "c_1", after=before, bank="tsifrograd")
        page.wait_for_function("document.querySelectorAll('#stage .sl i.in').length === 1")
        if route == "30":
            assert page.locator("#count").text_content() == "1"
        self.repeat(page, "#repeat", first, "tsifrograd")
        self.layout(page, "station")
        self.saves(page)
        self.main_home(page)

    def lab_state(self, page):
        return page.locator("#game").evaluate("e=>({...e.dataset})")

    def lab_open(self, page, kind):
        if not page.locator("#home").is_visible():
            page.locator('#game [data-action="home"]').first.click()
        page.locator(f'[data-action="start"][data-kind="{kind}"]').click()
        assert self.lab_state(page)["kind"] == kind and self.lab_state(page)["phase"] == "playing"
        self.played(page, f"ph_{kind}_start", bank="tsifrograd-lab")

    def lab_solve(self, page, kind):
        if kind == "sharing":
            for _ in range(40):
                piles = [int(n) for n in self.lab_state(page)["current"].split(",")]
                if piles[0] == piles[1]:
                    break
                total = sum(piles)
                page.locator(f'[data-action="transfer"][data-from="{int(piles[1] > piles[0])}"]').click()
                assert sum(int(n) for n in self.lab_state(page)["current"].split(",")) == total
            else:
                raise AssertionError("sharing did not converge within legal capacity")
        else:
            target = int(self.lab_state(page)["target"])
            for value in ([10, 1] if kind == "orders" else [10, 5, 2, 1]):
                while int(self.lab_state(page)["current"]) + value <= target:
                    page.locator(f'#board [data-action="add"][data-value="{value}"]').click()
            assert int(self.lab_state(page)["current"]) == target
        assert self.lab_state(page)["phase"] == "playing", "must require manual answer submission"
        before = self.starts(page)
        page.locator("#check").click()
        assert self.lab_state(page)["phase"] == "won" and page.locator("#reward").is_visible()
        self.played(page, "ph_p1", after=before, bank="tsifrograd")

    def lab(self, page):
        assert page.locator('[data-action="start"]').count() == 3
        self.layout(page, "home")
        self.lab_open(page, "orders")
        self.played(page, "c_11", bank="tsifrograd")
        self.played(page, "ph_orders_help", bank="tsifrograd-lab")
        self.repeat(page, '[data-action="repeat"]', "ph_orders_start", "tsifrograd-lab")
        page.locator('#game [data-action="home"]').first.click()
        self.stopped(page)
        self.saves(page)
        self.reload(page)  # No award or mute action: all three opaque strings must survive.
        expected_counts = {"orders": 0, "sharing": 0, "bridge": 0}
        for kind in ["orders", "sharing", "bridge"]:
            self.lab_open(page, kind)
            before = self.starts(page)
            page.locator("#check").click()
            assert self.lab_state(page)["phase"] == "playing"
            self.played(page, f"ph_{kind}_{'unequal' if kind == 'sharing' else 'less'}", after=before, bank="tsifrograd-lab")
            if kind == "orders":
                for _ in range(3):
                    page.locator('[data-action="add"][data-value="10"]').click()
                before = self.starts(page)
                page.locator('[data-action="add"][data-value="1"]').click()
                self.played(page, "c_31", after=before, bank="tsifrograd-lab")
                assert self.lab_state(page)["current"] == "31"
                before = self.starts(page)
                page.locator("#check").click()
                self.played(page, "ph_orders_more", after=before, bank="tsifrograd-lab")
                page.locator('#game [data-action="reset"]').click()
                assert self.lab_state(page)["current"] == "0"
            elif kind == "bridge":
                for _ in range(2):
                    page.locator('[data-action="add"][data-value="10"]').click()
                before = self.starts(page)
                page.locator("#check").click()
                self.played(page, "ph_bridge_more", after=before, bank="tsifrograd-lab")
                page.locator('#board [data-action="remove"]').first.click()
                assert self.lab_state(page)["current"] == "10"
            else:
                piles = [int(n) for n in self.lab_state(page)["current"].split(",")]
                for _ in range(piles[0]):
                    page.locator('[data-action="transfer"][data-from="0"]').click()
                assert page.locator('[data-action="transfer"][data-from="0"]').is_disabled()
                assert sum(int(n) for n in self.lab_state(page)["current"].split(",")) == sum(piles)
                page.locator('#game [data-action="reset"]').click()
                assert [int(n) for n in self.lab_state(page)["current"].split(",")] == piles
            self.layout(page, kind)
            self.lab_solve(page, kind)
            expected_counts[kind] += 1
            saved = json.loads(page.evaluate("localStorage.getItem('tsifrograd-lab-v1')"))
            assert saved["counts"] == expected_counts
            assert page.locator('#board button:not([disabled])').count() == 0
            self.saves(page, allow_lab=True)
            previous = self.lab_state(page)["target"]
            page.locator("#next").click()
            assert self.lab_state(page)["phase"] == "playing"
            if kind != "sharing":
                assert self.lab_state(page)["target"] != previous
        # Mute exists in the lab, not in the two original pages. Test its real
        # state/persistence, cancellation, repeat while muted and rapid re-enable.
        page.locator("#sound").click()
        assert page.locator("#sound").get_attribute("aria-pressed") == "true"
        self.stopped(page)
        before = self.starts(page)
        page.locator('[data-action="repeat"]').click()
        page.locator('[data-action="add"][data-value="1"]').click()
        page.wait_for_timeout(350)
        assert self.starts(page) == before, "muted controls started voice"
        page.locator('#game [data-action="home"]').first.click()
        page.locator("#sound").click()
        for _ in range(4):
            page.locator("#sound").click()
        assert page.locator("#sound").get_attribute("aria-pressed") == "false"
        self.lab_open(page, "orders")
        page.locator('#game [data-action="home"]').first.click()
        self.stopped(page)
        self.reload(page, allow_lab=True)
        saved = json.loads(page.evaluate("localStorage.getItem('tsifrograd-lab-v1')"))
        assert saved["counts"] == {"orders": 1, "sharing": 1, "bridge": 1} and saved["sound"] is True
        self.saves(page, allow_lab=True)


def source_hashes():
    paths = ["bukvograd/index.html", "tsifrograd/index.html", "tsifrograd-lab/index.html",
             "tsifrograd-lab/app.mjs", "tsifrograd-lab/narration.mjs", "tsifrograd-lab/model.mjs",
             "tsifrograd-lab/progress.mjs", "tsifrograd-lab/style.css", "tsifrograd-lab/art.mjs", "tsifrograd-lab/art.css"]
    return {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", help="case name substring; report marks the run as partial")
    parser.add_argument("--timeout-ms", type=int, default=20000)
    args = parser.parse_args()
    if not 1000 <= args.timeout_ms <= 120000:
        parser.error("--timeout-ms must be between 1000 and 120000")
    out = Path(os.environ.get("SV_QA_OUT", "/root/.hermes/cache/scratch/svetlana-migration"))
    out.mkdir(parents=True, exist_ok=True)
    run = Path(tempfile.mkdtemp(prefix="browser-", dir=out))
    server = None
    browser = None
    report = {"schema": 1, "result": "RED", "audio_bank": AUDIO_BANK, "full_coverage": not bool(args.only), "cases": [], "errors": [],
              "limitations": ["Chromium with touch emulation; not Safari or a physical device/child playtest.",
                              "Actual response/decode/native WebAudio starts are observed, not audible intelligibility.",
                              "Mute is tested only where implemented: tsifrograd-lab. Original pages have repeat/exit, no mute control.",
                              "Static asset test, not this browser sample, checks all 650 MP3s."]}
    try:
        base = os.environ.get("LAB_BASE_URL", "").strip()
        if base:
            parsed = urlsplit(base)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
                raise ValueError("LAB_BASE_URL must be a credential-free HTTP(S) root URL without query/fragment")
        else:
            handler = functools.partial(QuietHandler, directory=str(ROOT))
            server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
            threading.Thread(target=server.serve_forever, daemon=True).start()
            base = f"http://127.0.0.1:{server.server_address[1]}"
            report["source_sha256_before"] = source_hashes()
            for bank, count in COUNTS.items():
                directory = ROOT / bank / AUDIO_BANK
                found = len(list(directory.glob("*.mp3"))) if directory.is_dir() else 0
                if found != count:
                    report["errors"].append({"code": "missing-bank" if not directory.is_dir() else "incomplete-bank",
                                               "bank": bank, "expected": count, "actual": found})
        report["base_url"] = safe_url(base)
        with sync_playwright() as playwright:
            chrome = os.environ.get("SV_CHROME") or os.environ.get("LAB_CHROME")
            if not chrome:
                known = Path("/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome")
                choices = sorted(Path("/root/.cache/ms-playwright").glob("chromium-*/chrome-linux64/chrome"), reverse=True)
                chrome = str(known) if known.is_file() else str(choices[0]) if choices else playwright.chromium.executable_path
            browser = playwright.chromium.launch(headless=True, executable_path=chrome, args=["--no-sandbox"])
            suite = Suite(browser, base, run, args.timeout_ms)
            all_cases = []
            for size in SIZES:
                for ch, clip_id, index in LETTERS:
                    name = f"bukvograd-{ch}-meet-{size}"
                    all_cases.append((name, "bukvograd", size, fixtures(letter_index=index),
                                      functools.partial(suite.bukvograd, ch=ch, clip_id=clip_id, index=index)))
                name = f"bukvograd-О-catch-{size}"
                all_cases.append((name, "bukvograd", size, fixtures(letter_index=2, catch=True),
                                  functools.partial(suite.bukvograd, ch="О", clip_id="o", index=2, catch=True)))
                for route in ["10", "30"]:
                    all_cases.append((f"tsifrograd-{route}-{size}", "tsifrograd", size, fixtures(route=route),
                                      functools.partial(suite.tsifrograd, route=route)))
                all_cases.append((f"lab-all-games-{size}", "tsifrograd-lab", size, fixtures(), suite.lab))
            selected = [case for case in all_cases if not args.only or args.only in case[0]]
            report["expected_cases"] = len(selected)
            if not selected:
                raise ValueError("--only did not select a case")
            for case in selected:
                suite.run(*case)
            report["cases"] = suite.cases
            browser.close()
            browser = None
        if not os.environ.get("LAB_BASE_URL", "").strip():
            report["source_sha256_after"] = source_hashes()
            if report["source_sha256_before"] != report["source_sha256_after"]:
                report["errors"].append({"code": "sources-changed-during-run-rerun-required"})
        if len(report["cases"]) != report["expected_cases"]:
            report["errors"].append({"code": "case-count-mismatch"})
    except Exception as error:
        report["errors"].append({"code": "harness-or-environment-failed", "message": short_error(error)})
    finally:
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        if server:
            server.shutdown()
            server.server_close()
    errors = [*report["errors"], *(e for case in report["cases"] for e in case["errors"])]
    report["result"] = "PASS" if report["cases"] and not errors else "RED"
    report["scenario_completed_count"] = sum(c["scenario_completed"] for c in report["cases"])
    report["passed_cases"] = sum(c["result"] == "PASS" for c in report["cases"])
    report["error_counts"] = dict(Counter(e["code"] for e in errors))
    (run / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ["result", "full_coverage", "scenario_completed_count", "passed_cases", "error_counts"]}
                     | {"report": str(run / "browser-report.json")}, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
