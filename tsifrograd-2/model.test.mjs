import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as model from './model.mjs';

const { GAME_IDS, createRound, addPiece, removePiece, transfer, total, evaluate } = model;
const BAD_NUMBERS = [
  NaN, Infinity, -Infinity, 0.5, 1.5, Number.MAX_SAFE_INTEGER + 1,
  '0', '1', '10', '', null, undefined, true, false, {}, [], new Number(1), 1n, Symbol('number'),
];
const PIECES = { orders: [1, 10], bridge: [1, 2, 5, 10] };

function frozen(state) {
  Object.freeze(state.parts ?? state.piles);
  return Object.freeze(state);
}

function partsState(kind, parts, target = 20) {
  return { ...createRound(kind), target, parts };
}

function sharingState(target, left) {
  return { ...createRound('sharing'), target, piles: [left, 2 * target - left] };
}

function solve(state, denominations) {
  let remaining = state.target;
  for (const value of denominations) {
    while (remaining >= value) {
      state = addPiece(state, value);
      remaining -= value;
    }
  }
  assert.equal(remaining, 0);
  return state;
}

test('exports the agreed API and stable game identifiers', () => {
  assert.deepEqual(Object.keys(model).sort(), [
    'GAME_IDS', 'addPiece', 'createRound', 'evaluate', 'removePiece', 'total', 'transfer',
  ]);
  assert.deepEqual(GAME_IDS, ['orders', 'sharing', 'bridge']);
  assert.ok(Object.isFrozen(GAME_IDS));
});

for (const kind of ['orders', 'sharing', 'bridge']) {
  test(`${kind}: creates independent plain-object rounds`, () => {
    const first = createRound(kind);
    const second = createRound(kind, 0);
    const key = kind === 'sharing' ? 'piles' : 'parts';
    assert.equal(Object.getPrototypeOf(first), Object.prototype);
    assert.deepEqual(Object.keys(first).sort(), [kind === 'sharing' ? 'piles' : 'parts', 'kind', 'round', 'target'].sort());
    assert.equal(first.kind, kind);
    assert.equal(first.round, 0);
    assert.deepEqual(first, second);
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first[key], second[key]);
    if (kind === 'sharing') first.piles[0] = 0;
    else first.parts.push(1);
    assert.deepEqual(second, createRound(kind));
  });

  test(`${kind}: normalizes invalid rounds without coercion`, () => {
    for (const round of [-1, -100, -0.5, ...BAD_NUMBERS]) {
      assert.deepEqual(createRound(kind, round), createRound(kind, 0));
    }
    assert.equal(Object.is(createRound(kind, -0).round, -0), false);
    for (const round of [0, 1, 19, 20, 100, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER]) {
      assert.equal(createRound(kind, round).round, round);
      const period = kind === 'sharing' ? 26 : 20;
      const reduced = createRound(kind, round % period);
      assert.deepEqual(createRound(kind, round), { ...reduced, round });
    }
  });
}

test('unknown kinds throw rather than silently selecting a game', () => {
  for (const kind of ['', 'order', 'Orders', 'toString', '__proto__', null, undefined, 0, [], {}, new String('orders'), Symbol('orders')]) {
    assert.throws(() => createRound(kind));
  }
});

for (const kind of ['orders', 'bridge']) {
  test(`${kind}: cycles deterministically through every target from 11 to 30`, () => {
    const targets = Array.from({ length: 20 }, (_, round) => createRound(kind, round).target);
    assert.deepEqual([...new Set(targets)].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 11));
    assert.notDeepEqual(targets, [...targets].sort((a, b) => a - b));
    for (let round = 0; round < 160; round++) {
      const state = createRound(kind, round);
      assert.equal(state.target, targets[round % targets.length]);
      assert.deepEqual(state.parts, []);
      assert.equal(total(state), 0);
      assert.deepEqual(evaluate(frozen(state)), {
        correct: false, status: 'less', current: 0, target: state.target, delta: -state.target,
      });
    }
  });

  test(`${kind}: all targets are reachable with ones and mixed denominations`, () => {
    for (let round = 0; round < 20; round++) {
      for (const denominations of [[1], [...PIECES[kind]].reverse()]) {
        const start = frozen(createRound(kind, round));
        const solved = solve(start, denominations);
        assert.equal(total(solved), start.target);
        assert.deepEqual(evaluate(frozen(solved)), {
          correct: true, status: 'correct', current: start.target, target: start.target, delta: 0,
        });
        assert.deepEqual(start.parts, []);
      }
    }
  });

  test(`${kind}: valid additions are immutable and preserve metadata`, () => {
    const state = frozen(createRound(kind, 7));
    for (const value of PIECES[kind]) {
      const result = addPiece(state, value);
      assert.notStrictEqual(result, state);
      assert.notStrictEqual(result.parts, state.parts);
      assert.deepEqual(result, { ...state, parts: [value] });
      assert.deepEqual(state.parts, []);
    }
  });

  test(`${kind}: rejects invalid or unsupported piece values without coercion`, () => {
    const state = frozen(partsState(kind, [10, 1]));
    for (const value of [-1, 0, 3, 4, 6, 7, 8, 9, 11, 40, Number.MAX_SAFE_INTEGER, ...BAD_NUMBERS]) {
      assert.strictEqual(addPiece(state, value), state);
    }
    if (kind === 'orders') {
      assert.strictEqual(addPiece(state, 2), state);
      assert.strictEqual(addPiece(state, 5), state);
    }
  });

  test(`${kind}: every addition respects the inclusive total cap of 40`, () => {
    for (let current = 0; current <= 40; current++) {
      const state = frozen(partsState(kind, Array(current).fill(1)));
      for (const value of PIECES[kind]) {
        const result = addPiece(state, value);
        if (current + value > 40) {
          assert.strictEqual(result, state);
        } else {
          assert.equal(total(result), current + value);
          assert.deepEqual(result.parts, [...state.parts, value]);
        }
        assert.ok(total(result) <= 40);
        assert.equal(total(state), current);
      }
    }
  });

  test(`${kind}: reports exact, short and overfilled solutions for all targets`, () => {
    for (let target = 11; target <= 30; target++) {
      for (const current of [0, target - 1, target, target + 1, 40]) {
        const state = frozen(partsState(kind, Array(current).fill(1), target));
        assert.deepEqual(evaluate(state), {
          correct: current === target,
          status: current === target ? 'correct' : current > target ? 'more' : 'less',
          current, target, delta: current - target,
        });
        assert.equal(total(state), current);
      }
      const solved = frozen(partsState(kind, Array(target).fill(1), target));
      const overfilled = addPiece(solved, 1);
      assert.equal(evaluate(overfilled).status, 'more');
      const corrected = removePiece(frozen(overfilled), 0);
      assert.equal(evaluate(corrected).status, 'correct');
    }
  });

  test(`${kind}: removes the selected piece, not every matching value`, () => {
    const pieces = kind === 'orders' ? [10, 1, 10, 1] : [10, 2, 5, 1, 10];
    const state = frozen(partsState(kind, pieces));
    for (let index = 0; index < pieces.length; index++) {
      const result = removePiece(state, index);
      assert.notStrictEqual(result, state);
      assert.notStrictEqual(result.parts, state.parts);
      assert.deepEqual(result, { ...state, parts: [...pieces.slice(0, index), ...pieces.slice(index + 1)] });
      assert.equal(total(result), total(state) - pieces[index]);
    }
    const singleton = frozen(partsState(kind, [1]));
    assert.deepEqual(removePiece(singleton, 0).parts, []);
  });

  test(`${kind}: empty removal and invalid indices are identity-preserving no-ops`, () => {
    for (const pieces of [[], [10, 1]]) {
      const state = frozen(partsState(kind, pieces));
      for (const index of [-1, pieces.length, pieces.length + 1, Number.MAX_SAFE_INTEGER, ...BAD_NUMBERS]) {
        assert.strictEqual(removePiece(state, index), state);
      }
    }
    assert.strictEqual(transfer(frozen(createRound(kind)), 0).kind, kind);
    const state = frozen(createRound(kind));
    for (const from of [0, 1, ...BAD_NUMBERS]) assert.strictEqual(transfer(state, from), state);
  });
}

test('sharing: creates deterministic unequal positive piles with all targets from 3 to 15', () => {
  const targets = new Set();
  const directions = new Set();
  for (let round = 0; round < 156; round++) {
    const state = createRound('sharing', round);
    assert.deepEqual(state, createRound('sharing', round));
    assert.equal(state.piles.length, 2);
    assert.ok(Number.isSafeInteger(state.target));
    assert.ok(state.target >= 3 && state.target <= 15);
    assert.notEqual(state.piles[0], state.piles[1]);
    for (const pile of state.piles) assert.ok(Number.isSafeInteger(pile) && pile > 0);
    assert.equal(total(state), 2 * state.target);
    assert.ok(total(state) <= 30);
    assert.equal(evaluate(state).status, 'unequal');
    targets.add(state.target);
    directions.add(Math.sign(state.piles[0] - state.piles[1]));
  }
  assert.deepEqual([...targets].sort((a, b) => a - b), Array.from({ length: 13 }, (_, i) => i + 3));
  assert.deepEqual([...directions].sort((a, b) => a - b), [-1, 1]);
});

test('sharing: every distribution preserves its sum under either legal transfer', () => {
  for (let target = 3; target <= 15; target++) {
    for (let left = 0; left <= 2 * target; left++) {
      const state = frozen(sharingState(target, left));
      const before = [...state.piles];
      for (const from of [0, 1]) {
        const result = transfer(state, from);
        if (before[from] === 0) {
          assert.strictEqual(result, state);
        } else {
          assert.notStrictEqual(result, state);
          assert.notStrictEqual(result.piles, state.piles);
          const expected = [...before];
          expected[from]--;
          expected[1 - from]++;
          assert.deepEqual(result, { ...state, piles: expected });
        }
        assert.deepEqual(state.piles, before);
        assert.equal(total(result), 2 * target);
        assert.ok(result.piles.every(pile => Number.isSafeInteger(pile) && pile >= 0));
      }
    }
  }
});

test('sharing: evaluates every distribution using the left pile and signed imbalance', () => {
  for (let target = 3; target <= 15; target++) {
    for (let left = 0; left <= 2 * target; left++) {
      const state = frozen(sharingState(target, left));
      assert.deepEqual(evaluate(state), {
        correct: left === target,
        status: left === target ? 'correct' : 'unequal',
        current: left, target, delta: left - state.piles[1],
      });
    }
  }
});

test('sharing: every distribution can be equalized, checked, disturbed and corrected', () => {
  for (let target = 3; target <= 15; target++) {
    for (let left = 0; left <= 2 * target; left++) {
      let state = sharingState(target, left);
      for (let moves = Math.abs(left - target); moves > 0; moves--) {
        state = transfer(frozen(state), state.piles[0] > state.piles[1] ? 0 : 1);
        assert.equal(total(state), 2 * target);
      }
      assert.deepEqual(state.piles, [target, target]);
      assert.equal(evaluate(state).correct, true);
      for (const from of [0, 1]) {
        const disturbed = transfer(frozen(state), from);
        assert.equal(evaluate(disturbed).status, 'unequal');
        assert.equal(Math.abs(evaluate(disturbed).delta), 2);
        assert.deepEqual(transfer(frozen(disturbed), 1 - from), state);
      }
    }
  }
});

test('sharing: bad donor indices and piece operations are identity-preserving no-ops', () => {
  const state = frozen(createRound('sharing'));
  for (const from of [-1, 2, 3, Number.MAX_SAFE_INTEGER, ...BAD_NUMBERS]) {
    assert.strictEqual(transfer(state, from), state);
  }
  for (const value of [0, 1, 2, 5, 10, ...BAD_NUMBERS]) assert.strictEqual(addPiece(state, value), state);
  for (const index of [0, 1, ...BAD_NUMBERS]) assert.strictEqual(removePiece(state, index), state);
});

test('malformed states never enter arithmetic or accept mutations', () => {
  const order = createRound('orders');
  const sharing = createRound('sharing');
  const malformed = [
    null, undefined, false, 0, 'orders', {}, [],
    { ...order, kind: 'unknown' },
    ...[-1, NaN, Infinity, 0.5, '1', Number.MAX_SAFE_INTEGER + 1].map(round => ({ ...order, round })),
    ...[0, 10, 31, NaN, 11.5, '11'].map(target => ({ ...order, target })),
    ...[null, {}, [NaN], [Infinity], [-1], [0], [2], [1.5], ['1'], Array(1), Array(41).fill(1)].map(parts => ({ ...order, parts })),
    ...[2, 16, NaN, 3.5, '3'].map(target => ({ ...sharing, target })),
    ...[null, {}, [], [1], [1, 1, 1], [1, '5'], [NaN, 6], [1.5, 4.5], [-1, 7], [0, 0], Array(2)].map(piles => ({ ...sharingState(3, 1), piles })),
  ];
  for (const state of malformed) {
    if (state && typeof state === 'object' && !Array.isArray(state)) {
      if (Array.isArray(state.parts)) Object.freeze(state.parts);
      if (Array.isArray(state.piles)) Object.freeze(state.piles);
      Object.freeze(state);
    }
    assert.strictEqual(addPiece(state, 1), state);
    assert.strictEqual(removePiece(state, 0), state);
    assert.strictEqual(transfer(state, 0), state);
    assert.equal(total(state), 0);
    assert.throws(() => evaluate(state), TypeError);
  }
});

test('model imports and runs without DOM, storage, clocks or randomness', () => {
  const url = new URL('./model.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    for (const name of ['window', 'document', 'localStorage']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error('Forbidden global: ' + name); } });
    }
    Math.random = () => { throw new Error('Randomness is forbidden'); };
    Date.now = () => { throw new Error('Clock is forbidden'); };
    const m = await import(${JSON.stringify(url)});
    for (const kind of m.GAME_IDS) {
      const state = m.createRound(kind, 9);
      m.total(state);
      m.evaluate(state);
      m.evaluate(m.addPiece(state, 1));
      m.evaluate(m.removePiece(state, 0));
      m.evaluate(m.transfer(state, 0));
    }
  `], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});
