'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PROGRESS_KEY, createRound, step, cardState, parseProgress, createAlbum } = require('../src/engine.cjs');

const round = (stage) => createRound(stage, () => 0.36);
const card = (state, index) => step(state, { type: 'card', index });
const action = (state, type) => step(state, { type });
const choose = (state, hero) => step(state, { type: 'choose', hero });
const mate = (state, index) => state.cards.findIndex((id, i) => i !== index && id === state.cards[index]);

function countPairs(state, expected) {
  const heroes = [...new Set(state.cards)];
  assert.equal(heroes.length, expected);
  assert.equal(state.cards.length, expected * 2);
  for (const hero of heroes) assert.equal(state.cards.filter((id) => id === hero).length, 2);
}

test('open round has two visible pairs', () => {
  const state = round('open');
  countPairs(state, 2);
  assert.ok(state.cards.every((_, i) => cardState(state, i) === 'face'));
});

test('open replay can change the matching positions as well as the portraits', () => {
  const positions = [0, 0.36, 0.5, 0.99].map((value) => mate(createRound('open', () => value), 0));
  assert.ok(new Set(positions).size > 1, `First card always matches slot ${positions[0]}`);
});

test('memory round starts with six closed cards', () => {
  const state = round('closed');
  countPairs(state, 3);
  assert.ok(state.cards.every((_, i) => cardState(state, i) === 'back'));
});

test('wrong pairing is recoverable; duplicate input is not a second card', () => {
  let state = card(round('closed'), 0);
  const wrong = state.cards.findIndex((id) => id !== state.cards[0]);
  assert.equal(cardState(state, 0), 'picked');
  assert.strictEqual(card(state, 0), state);
  assert.strictEqual(card(state, -1), state);
  assert.strictEqual(card(state, '1'), state);
  state = card(state, wrong);
  assert.deepEqual(state.found, []);
  assert.equal(cardState(state, wrong), 'retry');
  assert.equal(cardState(state, 0), 'retry');
  assert.strictEqual(card(state, wrong), state);
  const next = mate(state, 0);
  state = card(state, next);
  assert.equal(cardState(state, 0), 'back');
  assert.equal(cardState(state, wrong), 'back');
  assert.equal(cardState(state, next), 'picked');
  state = card(state, 0);
  assert.deepEqual(new Set(state.found), new Set([0, next]));
});

test('only all matched pairs complete a round; found cards and solved rounds ignore input', () => {
  let state = round('open');
  const twin = mate(state, 0);
  state = card(card(state, 0), twin);
  assert.equal(state.finished, false);
  assert.equal(cardState(state, 0), 'found');
  assert.strictEqual(card(state, 0), state);
  const last = state.cards.findIndex((_, i) => !state.found.includes(i));
  state = card(card(state, last), mate(state, last));
  assert.equal(state.finished, true);
  assert.deepEqual([...state.found].sort(), [0, 1, 2, 3]);
  assert.strictEqual(card(state, last), state);
});

test('peek ignores picks and closes without consuming the first card', () => {
  const picked = card(round('closed'), 0);
  const peek = action(picked, 'toggle-peek');
  const twin = mate(picked, 0);
  assert.equal(peek.peeking, true);
  assert.deepEqual(peek.found, []);
  assert.strictEqual(card(peek, twin), peek);
  assert.deepEqual(action(peek, 'dismiss'), picked);
  const closed = action(peek, 'toggle-peek');
  assert.deepEqual(closed, picked);
  assert.equal(cardState(closed, 0), 'picked');
  assert.equal(card(card(closed, twin), twin).found.length, 2);
  const open = round('open');
  assert.strictEqual(action(open, 'toggle-peek'), open);
});

test('a new round carries no cards chosen or revealed from the old one', () => {
  const old = action(card(round('closed'), 0), 'toggle-peek');
  const fresh = round('closed');
  assert.notStrictEqual(fresh.cards, old.cards);
  assert.equal(fresh.first, null);
  assert.equal(fresh.second, null);
  assert.equal(fresh.peeking, false);
  assert.deepEqual(fresh.found, []);
});

test('missing-hero candidates require remembering, not just spotting a non-present hero', () => {
  let seed = 47;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const answers = new Set();
  for (let i = 0; i < 36; i += 1) {
    const state = createRound('missing', random);
    answers.add(state.answer);
    assert.equal(new Set(state.original).size, 3);
    assert.deepEqual(state.remaining, state.original.filter((id) => id !== state.answer));
    assert.equal(new Set(state.options).size, 3);
    assert.ok(state.options.includes(state.answer));
    assert.equal(state.options.filter((id) => state.remaining.includes(id)).length, 1);
    assert.equal(state.options.filter((id) => !state.original.includes(id)).length, 1);
  }
  assert.ok(answers.size > 1);
});

test('remember is a deliberate action; a wrong choice is not final', () => {
  let state = round('missing');
  assert.strictEqual(choose(state, state.answer), state);
  assert.equal(state.phase, 'study');
  state = action(state, 'remember');
  assert.equal(state.phase, 'question');
  assert.strictEqual(action(state, 'remember'), state);
  assert.strictEqual(choose(state, 'not-a-candidate'), state);
  const wrong = state.options.find((id) => id !== state.answer);
  state = choose(state, wrong);
  assert.equal(state.attempt, wrong);
  assert.equal(state.finished, false);
  assert.strictEqual(choose(state, wrong), state);
  state = choose(state, state.answer);
  assert.equal(state.finished, true);
  assert.strictEqual(choose(state, state.answer), state);
  assert.strictEqual(action(state, 'toggle-original'), state);
});

test('viewing the original never awards a photo or discards an attempt', () => {
  let state = round('missing');
  assert.strictEqual(action(state, 'toggle-original'), state);
  state = action(state, 'remember');
  state = choose(state, state.options.find((id) => id !== state.answer));
  const original = action(state, 'toggle-original');
  assert.equal(original.viewing, true);
  assert.equal(original.finished, false);
  assert.strictEqual(choose(original, state.answer), original);
  assert.deepEqual(action(original, 'dismiss'), state);
  assert.deepEqual(action(original, 'toggle-original'), state);
});

test('progress validation: only the versioned, bounded, well-typed album is accepted', () => {
  assert.deepEqual(parseProgress(null), []);
  assert.deepEqual(parseProgress('{"version":1,"completed":[]}'), []);
  assert.deepEqual(parseProgress('{"version":1,"completed":["missing","open","closed"]}'), ['open', 'closed', 'missing']);
  for (const bad of ['', 'null', '["open"]', '{not json', ' '.repeat(4096),
    '{"version":2,"completed":["open"]}', '{"version":1,"completed":"open"}',
    '{"version":1,"completed":["open","open"]}', '{"version":1,"completed":["later"]}',
    '{"version":1,"completed":[null]}', '{"version":1,"completed":[],"__proto__":{"polluted":true}}',
    '{"version":1,"completed":["<img src=x>"]}']) assert.equal(parseProgress(bad), null, bad);
});

test('one stamp and one write per stage, only in the specified key', () => {
  assert.equal(PROGRESS_KEY, 'pary-2-v1');
  const calls = [];
  let raw = '{"version":1,"completed":["closed"]}';
  const album = createAlbum(() => ({
    getItem(key) { calls.push(['get', key]); return raw; },
    setItem(key, value) { calls.push(['set', key, JSON.parse(value)]); raw = value; },
  }));
  assert.deepEqual(album.completed(), ['closed']);
  album.completed().push('missing');
  assert.equal(album.earn('closed'), false);
  assert.equal(album.earn('foreign'), false);
  assert.equal(album.earn('open'), true);
  assert.equal(album.earn('open'), false);
  assert.equal(album.earn('missing'), true);
  assert.deepEqual(album.completed(), ['open', 'closed', 'missing']);
  assert.deepEqual(calls, [
    ['get', PROGRESS_KEY],
    ['get', PROGRESS_KEY],
    ['set', PROGRESS_KEY, { version: 1, completed: ['open', 'closed'] }],
    ['get', PROGRESS_KEY],
    ['set', PROGRESS_KEY, { version: 1, completed: ['open', 'closed', 'missing'] }],
  ]);
});

test('two open albums save both stamps in album order', () => {
  let raw = null;
  const getStorage = () => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
  const first = createAlbum(getStorage);
  const second = createAlbum(getStorage);
  assert.equal(first.earn('closed'), true);
  assert.deepEqual(second.completed(), []);
  assert.equal(second.earn('open'), true);
  assert.deepEqual(JSON.parse(raw), { version: 1, completed: ['open', 'closed'] });
  assert.deepEqual(second.completed(), ['open', 'closed']);
  assert.deepEqual(createAlbum(getStorage).completed(), ['open', 'closed']);
});

test('a stale album displays an existing stamp without writing another award', () => {
  const writes = [];
  const getStorage = () => ({
    getItem: () => writes.at(-1) ?? null,
    setItem: (_key, value) => { writes.push(value); },
  });
  const first = createAlbum(getStorage);
  const second = createAlbum(getStorage);
  assert.equal(first.earn('open'), true);
  assert.equal(second.earn('open'), true); // The stamp is new to this view, not to storage.
  assert.deepEqual(second.completed(), ['open']);
  assert.equal(second.earn('open'), false);
  assert.equal(writes.length, 1);
});

test('a record corrupted after opening is left untouched', () => {
  let raw = '{"version":1,"completed":["open"]}';
  const album = createAlbum(() => ({ getItem: () => raw, setItem: (_key, value) => { raw = value; } }));
  const damaged = '{"version":1,"completed":["closed","closed"]}';
  raw = damaged;
  assert.equal(album.earn('missing'), true);
  assert.equal(album.earn('closed'), true);
  assert.deepEqual(album.completed(), ['open', 'closed', 'missing']);
  assert.equal(raw, damaged);
});

test('a read failure after opening leaves the album playable without a write', () => {
  let blocked = false;
  const writes = [];
  const album = createAlbum(() => ({
    getItem() { if (blocked) throw new Error('disabled'); return '{"version":1,"completed":["open"]}'; },
    setItem(key) { writes.push(key); },
  }));
  blocked = true;
  assert.equal(album.earn('missing'), true);
  assert.deepEqual(album.completed(), ['open', 'missing']);
  assert.deepEqual(writes, []);
});

test('bad/empty records and read failures leave a playable in-memory album', () => {
  for (const raw of ['', '{bad', '{"version":1,"completed":["<svg>"]}', undefined]) {
    let writes = 0;
    const album = createAlbum(() => ({
      getItem() { if (raw === undefined) throw new Error('disabled'); return raw; },
      setItem() { writes += 1; },
    }));
    assert.deepEqual(album.completed(), []);
    assert.equal(album.earn('missing'), true);
    assert.equal(album.earn('missing'), false);
    assert.deepEqual(album.completed(), ['missing']);
    assert.equal(writes, 0);
  }
  const album = createAlbum(() => { throw new Error('no storage getter'); });
  assert.equal(album.earn('open'), true);
});

test('write failure switches to memory without losing earned stamps', () => {
  const writes = [];
  const album = createAlbum(() => ({
    getItem() { return '{"version":1,"completed":["open"]}'; },
    setItem(key) { writes.push(key); throw new Error('quota'); },
  }));
  assert.equal(album.earn('missing'), true);
  assert.equal(album.earn('closed'), true);
  assert.deepEqual(album.completed(), ['open', 'closed', 'missing']);
  assert.deepEqual(writes, [PROGRESS_KEY]);
});
