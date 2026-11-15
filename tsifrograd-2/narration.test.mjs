import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as narration from './narration.mjs';

const { clipUrl, instruction, NEW_CLIPS } = narration;
const source = JSON.parse(readFileSync(new URL('../tsifrograd/src/clips.json', import.meta.url)));
const common = JSON.parse(readFileSync(new URL('../bukvograd/src/clips.json', import.meta.url)));
const local = JSON.parse(readFileSync(new URL('./tts/clips.json', import.meta.url)));
const task = (kind, target = 11, extra = {}) => ({ kind, target, ...extra });
const checkQueue = parts => {
  assert.ok(Array.isArray(parts));
  for (const part of parts) {
    if (typeof part === 'number') assert.ok(Number.isSafeInteger(part) && part >= 1 && part <= 40, `Quantity, not pause: ${part}`);
    else assert.deepEqual(Object.keys(part), ['clip']);
    const id = typeof part === 'number' ? `c_${part}` : part.clip;
    assert.ok(existsSync(new URL(clipUrl(id), import.meta.url)), id);
    assert.ok(source[id] || common[id] || local.clips[id], `No authored text for ${id}`);
  }
};

test('all numbers through the editable maximum resolve to a real recorded file', () => {
  for (let n = 1; n <= 40; n++) {
    const path = clipUrl(`c_${n}`);
    assert.ok(existsSync(new URL(path, import.meta.url)), path);
    assert.equal(path.startsWith('../tsifrograd/'), n <= 30);
  }
});

test('unknown identifiers cannot become network or arbitrary asset paths', () => {
  for (const id of ['../secret', 'https://example.com/key', 'c_0', 'c_41', 'c_01', 'f_11', 'ph_invented', 'ph_find', 'toString', '__proto__', null, 31, {}, Symbol('id')]) assert.throws(() => clipUrl(id), RangeError);
});

test('all 21 own Julia clips retain authored text, actual bytes and manifest hashes', () => {
  const manifest = JSON.parse(readFileSync(new URL('./audio/manifest.json', import.meta.url)));
  assert.equal(manifest.voice, 'julia'); assert.equal(manifest.apiVersion, 'v3'); assert.equal(manifest.provider, 'Yandex SpeechKit');
  assert.equal(NEW_CLIPS.length, 21); assert.ok(Object.isFrozen(NEW_CLIPS));
  assert.deepEqual([...NEW_CLIPS].sort(), Object.keys(local.clips).sort());
  for (const id of NEW_CLIPS) {
    assert.equal(clipUrl(id), `./audio/${id}.mp3`);
    const data = readFileSync(new URL(clipUrl(id), import.meta.url));
    assert.ok(data.length > 500);
    assert.equal(createHash('sha256').update(data).digest('hex'), manifest.clips[id].sha256);
    assert.equal(local.clips[id].text, manifest.clips[id].text);
  }
});

test('explicit existing core phrases are allowed; common Julia clips come from Bukvograd', () => {
  const ids = ['ph_tap', 'ph_load', 'ph_loaded', 'ph_howmany', 'ph_howmany10', 'ph_together', 'ph_missing', 'ph_missing2', 'ph_before', 'ph_after', 'ph_long'];
  for (const id of ids) {
    assert.ok(source[id]); assert.equal(clipUrl(id), `../tsifrograd/audio/${id}.mp3`); checkQueue([{ clip: id }]);
  }
  for (let n = 1; n <= 10; n++) for (const prefix of ['f', 'g']) {
    const id = `${prefix}_${n}`; assert.ok(source[id]); assert.equal(clipUrl(id), `../tsifrograd/audio/${id}.mp3`); checkQueue([{ clip: id }]);
  }
  for (const id of ['ph_p1', 'ph_try_again']) {
    assert.ok(common[id]); assert.equal(clipUrl(id), `../bukvograd/audio/${id}.mp3`); checkQueue([{ clip: id }]);
    assert.equal(createHash('sha256').update(readFileSync(new URL(clipUrl(id), import.meta.url))).digest('hex'), createHash('sha256').update(readFileSync(new URL(`../tsifrograd/audio/${id}.mp3`, import.meta.url))).digest('hex'));
  }
});

test('find uses the actual spoken find instruction, not a visible answer or invented phrase', () => {
  for (let n = 1; n <= 10; n++) assert.deepEqual(instruction(task('find', n)), [{ clip: `f_${n}` }]);
  assert.throws(() => instruction(task('find', 11)), RangeError);
});

test('load talks about the existing crate, and count asks without reading out the answer', () => {
  for (let n = 1; n <= 30; n++) {
    const load = instruction(task('load', n));
    checkQueue(load);
    assert.deepEqual(load, n <= 10 ? [{ clip: `g_${n}` }, { clip: 'ph_tap' }] : [n, { clip: 'ph_load' }]);
    const count = instruction(task('count', n));
    assert.deepEqual(count, [{ clip: 'ph_howmany10' }]); checkQueue(count);
  }
  assert.match(source.ph_load, /ящик/); assert.match(source.ph_howmany10, /тут/);
});

test('neighbors read the reference, then the recorded before/after question, never the answer', () => {
  for (const direction of ['before', 'after']) for (const anchor of [2, 12, 20, 29]) {
    const target = anchor + (direction === 'before' ? -1 : 1);
    const parts = instruction(task('neighbors', target, { anchor, direction }));
    assert.deepEqual(parts, [anchor, { clip: `ph_${direction}` }]); checkQueue(parts);
    assert.ok(!parts.includes(target));
  }
});

test('missing counts holes and long uses an existing counting helper', () => {
  assert.deepEqual(instruction(task('missing', 12, { holes: [1] })), [{ clip: 'ph_missing' }]);
  assert.deepEqual(instruction(task('missing', 12, { holes: [1, 3] })), [{ clip: 'ph_missing2' }]);
  assert.deepEqual(instruction(task('long', 5)), [{ clip: 'ph_long' }]);
});

test('advanced instructions and corrective phrases preserve their exact authored clips', () => {
  assert.equal(typeof narration.feedback, 'function');
  for (let n = 11; n <= 30; n++) for (const kind of ['orders', 'bridge']) {
    const t = task(kind, n);
    const parts = instruction(t); assert.deepEqual(parts, [{ clip: `ph_${kind}_start` }, n, { clip: `ph_${kind}_help` }]); checkQueue(parts);
    for (const status of ['less', 'more']) { const queue = narration.feedback(t, status); assert.deepEqual(queue, [{ clip: `ph_${kind}_${status}` }]); checkQueue(queue); }
    assert.deepEqual(narration.feedback(t, 'empty'), [{ clip: `ph_${kind}_less` }]);
  }
  assert.deepEqual(instruction(task('sharing', 3)), [{ clip: 'ph_sharing_start' }]);
  assert.deepEqual(narration.feedback(task('sharing', 3), 'unequal'), [{ clip: 'ph_sharing_unequal' }]);
});

test('core mistakes use calm existing feedback, success uses existing Julia praise', () => {
  assert.equal(typeof narration.feedback, 'function');
  for (const kind of ['load', 'find', 'count', 'missing', 'neighbors', 'long']) {
    const current = task(kind, kind === 'find' ? 5 : 11);
    for (const status of ['wrong', 'empty', 'less', 'more']) {
      const parts = narration.feedback(current, status); assert.deepEqual(parts, [{ clip: 'ph_try_again' }]); checkQueue(parts);
    }
    assert.deepEqual(narration.feedback(current, 'progress'), []);
    assert.deepEqual(narration.feedback(current, 'correct'), [{ clip: 'ph_p1' }]);
  }
});

test('every queue for every stage, action and assessment resolves to authored existing audio', async () => {
  const { STAGES, availableGames, createTask, act, assess } = await import('./journey.mjs');
  for (const stage of STAGES) for (const kind of availableGames(stage.id)) for (let round = 0; round < 60; round++) {
    const t = createTask(stage.id, kind, round); checkQueue(instruction(t)); checkQueue(narration.feedback(t, assess(t).status));
    const actions = t.parts ? [{ type: 'add', value: 1 }]
      : t.piles ? [{ type: 'transfer', value: 0 }, { type: 'transfer', value: 1 }]
      : kind === 'long' ? [{ type: 'tick' }]
      : t.choices.map(value => ({ type: 'pick', value }));
    for (const action of actions) { const next = act(t, action); checkQueue(narration.feedback(next, assess(next).status)); }
  }
});

test('missing narration rejects sparse, duplicate and out-of-board hole positions', () => {
  for (const holes of [Array(1), [undefined], [1, 1], [-1], [5], [999], [1.5], ['1']]) {
    assert.throws(() => instruction(task('missing', 12, { holes })), RangeError);
  }
});

test('invalid narration inputs fail closed rather than inventing a phrase or silent pause', () => {
  for (const value of [null, undefined, [], {}, task('bad'), task('count', 0), task('count', 31), task('count', '5'), task('neighbors', 12, { anchor: 31, direction: 'after' }), task('neighbors', 12, { anchor: 13, direction: 'bad' }), task('missing', 12, { holes: [] })]) assert.throws(() => instruction(value), RangeError);
  for (const status of ['bad', undefined, null, 'toString']) assert.throws(() => narration.feedback(task('orders'), status), RangeError);
  assert.throws(() => narration.feedback(task('bad'), 'wrong'), RangeError);
});
