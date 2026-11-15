import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as storage from './progress.mjs';

const { KEY, parseProgress, winProgress } = storage;
const IDS = ['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'];
const fresh = () => ({
  version: 2, stage: 1, sound: true,
  counts: Object.fromEntries([1, 2, 3, 4, 5].map(id => [id, Object.fromEntries(IDS.map(kind => [kind, 0]))])),
  sessions: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
});
const frozen = p => { Object.values(p.counts).forEach(Object.freeze); Object.freeze(p.counts); Object.freeze(p.sessions); return Object.freeze(p); };

test('v2 uses a single isolated key and the full five-world schema', () => {
  assert.equal(KEY, 'tsifrograd-2-v1');
  assert.notEqual(KEY, 'tsifrograd-v1');
  assert.notEqual(KEY, 'tsifrograd-lab-v1');
  assert.deepEqual(parseProgress(null), fresh());
  assert.equal(typeof storage.finishJourney, 'function');
});

test('missing, corrupt, non-string and unsupported-version saves return independent defaults', () => {
  for (const raw of [undefined, null, '', '{', 'null', '[]', '42', '"text"', 42, {}, [], 1n, Symbol('bad'),
    JSON.stringify({ version: 1, sound: false, counts: { orders: 999 } }),
    JSON.stringify({ version: 3, sound: false }), JSON.stringify({ sound: false, counts: { orders: 7 } })]) {
    assert.deepEqual(parseProgress(raw), fresh());
  }
  const first = parseProgress(null); first.counts[1].load = 9; first.sessions[1] = 9;
  assert.deepEqual(parseProgress(null), fresh());
});

test('all known valid values survive without reading old flat counters', () => {
  const p = fresh(); p.stage = 4; p.sound = false;
  for (let id = 1; id <= 5; id++) { IDS.forEach((kind, i) => { p.counts[id][kind] = id * 10 + i; }); p.sessions[id] = id; }
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  assert.equal(parseProgress(JSON.stringify({ ...fresh(), counts: { orders: 8, '1': { count: 3 } } })).counts[1].orders, 0);
});

test('counters are strict safe nonnegative integers bounded at one million', () => {
  for (const n of [-1, 1.5, 1000001, Number.MAX_SAFE_INTEGER, NaN, Infinity, '9', null, true, {}, []]) {
    const p = fresh(); p.counts[1].load = n; p.sessions[1] = n; p.counts[2].bridge = 17;
    const result = parseProgress(JSON.stringify(p));
    assert.equal(result.counts[1].load, 0);
    assert.equal(result.sessions[1], 0);
    assert.equal(result.counts[2].bridge, 17);
  }
  for (const n of [0, 1, 1000000]) {
    const p = fresh(); p.counts[5].bridge = n; p.sessions[5] = n;
    assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  }
});

test('stage is bounded to known worlds without numeric coercion; sound is boolean only', () => {
  for (const stage of [1, 2, 3, 4, 5]) assert.equal(parseProgress(JSON.stringify({ ...fresh(), stage })).stage, stage);
  assert.equal(parseProgress(JSON.stringify({ ...fresh(), stage: 0 })).stage, 1);
  assert.equal(parseProgress(JSON.stringify({ ...fresh(), stage: 20 })).stage, 5);
  for (const stage of ['4', null, true, 2.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(parseProgress(JSON.stringify({ ...fresh(), stage })).stage, 1);
  for (const sound of ['false', 0, null, []]) assert.equal(parseProgress(JSON.stringify({ ...fresh(), sound })).sound, true);
});

test('malformed nested maps and prototype-looking keys cannot leak into progress', () => {
  for (const counts of [null, [], 'bad', 20, { '1': [] }, { '1': null }]) {
    assert.deepEqual(parseProgress(JSON.stringify({ ...fresh(), counts })).counts, fresh().counts);
  }
  const p = parseProgress('{"version":2,"counts":{"1":{"load":3,"__proto__":{"polluted":true}},"6":{"bridge":4}},"sessions":{"1":2,"constructor":9},"__proto__":{"polluted":true},"unknown":1}');
  assert.equal(p.counts[1].load, 3); assert.equal(p.sessions[1], 2);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(p).sort(), ['counts', 'sessions', 'sound', 'stage', 'version']);
  assert.deepEqual(Object.keys(p.counts[1]), IDS);
});

test('wins increment only the requested stage/game immutably, capped at one million', () => {
  for (let id = 1; id <= 5; id++) for (const kind of IDS) {
    const p = frozen(fresh()); const expected = fresh(); expected.counts[id][kind] = 1;
    const next = winProgress(p, id, kind);
    assert.deepEqual(next, expected);
    assert.deepEqual(p, fresh());
    assert.notStrictEqual(next, p); assert.notStrictEqual(next.counts[id], p.counts[id]);
  }
  const p = fresh(); p.counts[5].bridge = 1000000;
  assert.equal(winProgress(frozen(p), 5, 'bridge').counts[5].bridge, 1000000);
  for (const [id, kind] of [[0, 'count'], [6, 'count'], ['1', 'count'], [1, 'toString'], [1, '__proto__'], [1, null]]) assert.deepEqual(winProgress(frozen(fresh()), id, kind), fresh());
});

test('finishing a two-task journey increments only its world session and never unlocks or forces another world', () => {
  assert.equal(typeof storage.finishJourney, 'function');
  for (let id = 1; id <= 5; id++) {
    const p = fresh(); p.stage = 3; p.counts[2].count = 7;
    const before = structuredClone(p);
    const next = storage.finishJourney(frozen(p), id);
    const expected = structuredClone(before); expected.sessions[id] = 1;
    assert.deepEqual(next, expected); assert.deepEqual(p, before);
  }
  const p = fresh(); p.sessions[4] = 1000000;
  assert.equal(storage.finishJourney(frozen(p), 4).sessions[4], 1000000);
  for (const id of [undefined, null, '2', 0, 6, NaN]) assert.deepEqual(storage.finishJourney(frozen(fresh()), id), fresh());
});

test('immutable helpers repair damaged input without JSON-stringify failures', () => {
  const cyclic = { version: 2, stage: 2, sound: false, counts: { '2': { count: 4n } } }; cyclic.circular = cyclic;
  const result = winProgress(cyclic, 2, 'count');
  assert.equal(result.counts[2].count, 1); assert.equal(result.stage, 2); assert.equal(result.sound, false);
  assert.deepEqual(winProgress(null, 1, 'load'), { ...fresh(), counts: { ...fresh().counts, '1': { ...fresh().counts[1], load: 1 } } });
});

test('progress helpers never access browser storage or legacy keys themselves', () => {
  const url = new URL('./progress.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    for (const name of ['window', 'document', 'localStorage']) Object.defineProperty(globalThis, name, { get() { throw Error(name); } });
    const m = await import(${JSON.stringify(url)}); const p = m.parseProgress(null);
    m.winProgress(p, 1, 'load'); m.finishJourney(p, 1);
  `], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stderr);
});
