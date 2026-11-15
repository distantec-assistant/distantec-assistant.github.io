import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as art from './art.mjs';

const KINDS = ['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'];
const STAGES = [1, 2, 3, 4, 5];
const ANIMALS = ['rabbit', 'fox', 'bear'];
const MOODS = ['happy', 'thinking', 'win'];
const ITEMS = ['apple', 'cookie', 'carrot', 'box10', 'plank'];
const BAD = ['', 'unknown', 'constructor', '__proto__', '<svg onload="alert(1)">', 'url(https://example.org/x)', null, NaN, Infinity, -1, 0, 6, 1.5, true, [], {}, Symbol('untrusted'), { toString() { throw Error('Do not coerce input'); } }];

function required(name) {
  assert.equal(typeof art[name], 'function', `${name} must be exported`);
  return art[name];
}

function variants() {
  const result = [];
  for (const stage of STAGES) {
    for (const kind of KINDS) result.push({ name: `scene/${kind}/${stage}`, svg: required('scene')(kind, stage) });
    result.push({ name: `map/${stage}`, svg: required('worldMap')(stage) });
    result.push({ name: `landmark/${stage}`, svg: required('landmark')(stage) });
  }
  for (const animal of ANIMALS) for (const mood of MOODS) result.push({ name: `portrait/${animal}/${mood}`, svg: required('portrait')(animal, mood) });
  for (const kind of ITEMS) result.push({ name: `item/${kind}`, svg: required('item')(kind) });
  result.push({ name: 'train', svg: required('train')() });
  return result;
}

test('exports exactly the six agreed decorative SVG functions', () => {
  assert.deepEqual(Object.keys(art).sort(), ['item', 'landmark', 'portrait', 'scene', 'train', 'worldMap']);
  for (const name of Object.keys(art)) required(name);
});

test('each region has its own landmark and map with its selected train', () => {
  assert.equal(new Set(STAGES.map(stage => required('landmark')(stage))).size, 5);
  assert.equal(new Set(STAGES.map(stage => required('worldMap')(stage))).size, 5);
  for (const stage of STAGES) {
    const map = required('worldMap')(stage);
    assert.equal((map.match(/class="art-map-stop"/g) ?? []).length, 5);
    assert.equal((map.match(/class="art-map-landmark"/g) ?? []).length, 5);
    assert.equal((map.match(/class="art-map-train"/g) ?? []).length, 1);
    assert.equal((map.match(/class="art-map-selected"/g) ?? []).length, 1);
    assert.equal((map.match(/class="art-map-track"/g) ?? []).length, 1);
  }
});

test('all nine scene kinds respond to the five-region setting', () => {
  for (const kind of KINDS) {
    const scenes = STAGES.map(stage => art.scene(kind, stage));
    assert.equal(new Set(scenes).size, 5, `${kind}: regions must not be one old background`);
  }
  assert.equal(new Set(KINDS.map(kind => art.scene(kind, 1))).size, KINDS.length);
});

test('friends have three different friendly expressions each', () => {
  for (const animal of ANIMALS) assert.equal(new Set(MOODS.map(mood => art.portrait(animal, mood))).size, 3);
  assert.equal(new Set(ANIMALS.map(animal => art.portrait(animal))).size, 3);
});

test('countable objects include apples, cookies and a ten-compartment apple box', () => {
  assert.equal(new Set(ITEMS.map(kind => art.item(kind))).size, ITEMS.length);
  const box = art.item('box10');
  assert.equal((box.match(/class="art-box-cell"/g) ?? []).length, 10);
  assert.equal((box.match(/class="art-apple"/g) ?? []).length, 10);
  assert.match(art.scene('orders', 4), /class="art-cafe"/);
  assert.match(art.scene('orders', 4), /class="art-friend art-friend-rabbit"/);
  assert.match(art.scene('orders', 4), /class="art-box10"/);
  assert.match(art.scene('sharing', 4), /class="art-picnic"/);
  for (const animal of ANIMALS) assert.match(art.scene('sharing', 4), new RegExp(`class="art-friend art-friend-${animal}"`));
  assert.match(art.scene('bridge', 5), /class="art-river-build"/);
});

test('river crane has a full rectangular mast, not an implicitly closed triangular fill', () => {
  const tower = art.scene('bridge', 5).match(/<rect\b[^>]*class="art-crane-tower"[^>]*\/>/);
  assert.ok(tower, 'a closed rectangular mast is required');
  const attributes = Object.fromEntries([...tower[0].matchAll(/(\w+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
  assert.ok(Number(attributes.width) >= 24);
  assert.ok(Number(attributes.height) >= 200);
  assert.ok(Number(attributes.x) + Number(attributes.width) < 270, 'keep construction out of the central task area');
});

test('unknown kinds and moods safely use the documented defaults, without coercion', () => {
  for (const bad of [...BAD, undefined]) {
    assert.equal(art.scene(bad), art.scene('load', 1));
    assert.equal(art.portrait(bad), art.portrait('rabbit', 'happy'));
    assert.equal(art.portrait('fox', bad), art.portrait('fox', 'happy'));
    assert.equal(art.item(bad), art.item('apple'));
  }
});

test('stage IDs use an explicit whitelist, including exact HTML dataset values', () => {
  for (const stage of STAGES) {
    assert.equal(required('worldMap')(String(stage)), art.worldMap(stage));
    assert.equal(required('landmark')(String(stage)), art.landmark(stage));
    for (const kind of KINDS) assert.equal(art.scene(kind, String(stage)), art.scene(kind, stage));
  }
  for (const bad of [...BAD, undefined, '01', '2<script>', '5.0', ' 3 ', new Number(2)]) {
    assert.equal(required('worldMap')(bad), art.worldMap(1));
    assert.equal(required('landmark')(bad), art.landmark(1));
    for (const kind of KINDS) assert.equal(art.scene(kind, bad), art.scene(kind, 1));
  }
});

test('every variant is valid, self-contained, safe XML with no textual task data', () => {
  const all = variants();
  assert.equal(all.length, 70);
  // Real XML parsing, using Python's standard library instead of an HTML regex.
  const parse = spawnSync('python3', ['-c', String.raw`
import json, re, sys
import xml.etree.ElementTree as ET
allowed = {'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'}
count = 0
for entry in json.load(sys.stdin):
    root = ET.fromstring(entry['svg'])
    assert root.tag == '{http://www.w3.org/2000/svg}svg', entry['name']
    assert root.get('aria-hidden') == 'true', entry['name']
    assert root.get('focusable') == 'false', entry['name']
    assert 'width' not in root.attrib and 'height' not in root.attrib, entry['name']
    viewbox = [float(n) for n in root.get('viewBox', '').split()]
    assert len(viewbox) == 4 and viewbox[2] > 0 and viewbox[3] > 0, entry['name']
    for element in root.iter():
        assert element.tag.startswith('{http://www.w3.org/2000/svg}'), entry['name']
        tag = element.tag.rsplit('}', 1)[-1]
        assert tag in allowed, (entry['name'], tag)
        assert not (element.text or '').strip() and not (element.tail or '').strip(), entry['name']
        for key, value in element.attrib.items():
            local = key.rsplit('}', 1)[-1].lower()
            assert not local.startswith('on'), (entry['name'], key)
            assert local not in {'id', 'href', 'src', 'style', 'tabindex', 'role'}, (entry['name'], key)
            assert not re.search(r'url\s*\(|https?://|javascript:|data:|@import', value, re.I), (entry['name'], key)
    count += 1
print(json.dumps({'xmlParsed': count}))
`], { input: JSON.stringify(all), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  assert.equal(parse.status, 0, parse.stderr);
  assert.deepEqual(JSON.parse(parse.stdout), { xmlParsed: all.length });
});

test('repeated exports are deterministic and use no IDs or external resources', () => {
  const all = variants();
  assert.deepEqual(all, variants());
  for (const { name, svg } of all) {
    assert.doesNotMatch(svg, /<(?:script|foreignObject|defs|text|image|use|animate|set)\b|\bid\s*=|\bon[a-z]+\s*=|\b(?:href|src)\s*=/i, name);
    assert.ok(svg.length < 90000, `${name}: decorative art should stay lightweight`);
  }
});

test('art CSS is wrapper-scoped, non-interactive, and disables all decorative motion', () => {
  const css = readFileSync(new URL('./art.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /(^|[},])\s*(?:body|html|button|:root|\*)\s*[{,]/m);
  assert.match(css, /\.art-world-map/);
  assert.match(css, /\.art-landmark/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation:\s*none\s*!important/);
  assert.match(css, /transition:\s*none\s*!important/);
  assert.doesNotMatch(css, /@keyframes[^}]*\btransform\s*:/s, 'do not animate positioned SVG groups');
});
