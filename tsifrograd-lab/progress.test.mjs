import test from 'node:test';
import assert from 'node:assert/strict';
import { KEY, parseProgress, winProgress } from './progress.mjs';

test('lab storage is separate from the released game', () => {
  assert.equal(KEY, 'tsifrograd-lab-v1');
  assert.notEqual(KEY, 'tsifrograd-v1');
});
test('missing, broken and wrongly shaped saves are harmless', () => {
  for (const raw of [null, '', '{', 'null', '[]', '42', '"text"']) {
    assert.deepEqual(parseProgress(raw), { version: 1, counts: { orders: 0, sharing: 0, bridge: 0 }, sound: true });
  }
});
test('valid counts survive and unsafe values are rejected individually', () => {
  const value = parseProgress(JSON.stringify({ counts: { orders: 7, sharing: -3, bridge: '9' }, sound: false }));
  assert.deepEqual(value, { version: 1, counts: { orders: 7, sharing: 0, bridge: 0 }, sound: false });
  for (const n of [1.5, 1e20, null, {}, []]) {
    assert.equal(parseProgress(JSON.stringify({ counts: { orders: n } })).counts.orders, 0);
  }
});
test('only known fields are read, without prototype changes', () => {
  const p = parseProgress('{"counts":{"orders":3,"__proto__":{"polluted":true}},"__proto__":{"polluted":true},"sound":"no"}');
  assert.equal(p.counts.orders, 3);
  assert.equal(p.sound, true);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(p).sort(), ['counts', 'sound', 'version']);
});
test('wins increment only the chosen game and do not mutate the input', () => {
  const p = parseProgress(null);
  const next = winProgress(p, 'bridge');
  assert.equal(next.counts.bridge, 1);
  assert.equal(next.counts.orders, 0);
  assert.equal(p.counts.bridge, 0);
  assert.deepEqual(winProgress(p, 'not-a-game'), p);
});
