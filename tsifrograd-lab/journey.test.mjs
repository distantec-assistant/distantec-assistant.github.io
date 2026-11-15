import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as journey from './journey.mjs';

const { GAME_IDS, STAGES, getStage, availableGames, planJourney, createTask, act, assess, taskTotal } = journey;
const EXPECTED_IDS = ['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'];
const ROUNDS = [...Array.from({ length: 120 }, (_, i) => i), 1000000, Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER];
const BAD = [-1, 0.5, NaN, Infinity, '1', null, true, [], {}, 1n, Symbol('bad'), Number.MAX_SAFE_INTEGER + 1];
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function solve(task) {
  if (['load', 'orders', 'bridge'].includes(task.kind)) {
    while (taskTotal(task) < task.target) {
      const piece = [...task.pieces].reverse().find(n => n <= task.target - taskTotal(task));
      task = act(task, { type: 'add', value: piece });
    }
  } else if (task.kind === 'sharing') {
    while (task.piles[0] !== task.piles[1]) task = act(task, { type: 'transfer', value: task.piles[0] > task.piles[1] ? 0 : 1 });
  } else if (task.kind === 'missing') {
    for (const value of task.solution) task = act(task, { type: 'pick', value });
  } else if (task.kind === 'long') {
    while (task.cursor < task.target) task = act(task, { type: 'tick' });
  } else task = act(task, { type: 'pick', value: task.target });
  return task;
}

test('journey exports the complete native, stable API', () => {
  assert.deepEqual(Object.keys(journey).sort(), ['GAME_IDS', 'STAGES', 'act', 'assess', 'availableGames', 'createTask', 'getStage', 'planJourney', 'taskTotal'].sort());
  assert.deepEqual(GAME_IDS, EXPECTED_IDS);
  assert.ok(Object.isFrozen(GAME_IDS));
  assert.ok(Object.isFrozen(STAGES));
  assert.deepEqual(STAGES.map(({ id, title, range, min, max, art }) => [id, title, range, min, max, art]), [
    [1, 'Лужайка', '1–5', 1, 5, 'meadow'], [2, 'Лес', '1–10', 1, 10, 'forest'],
    [3, 'Город', '11–20', 11, 20, 'town'], [4, 'Мастерская', '11–20', 11, 20, 'workshop'],
    [5, 'Большое путешествие', '21–30', 21, 30, 'mountains'],
  ]);
  STAGES.forEach(stage => { assert.ok(Object.isFrozen(stage)); assert.strictEqual(getStage(stage.id), stage); });
});

test('all worlds are explicit, while activities are gated by stage', () => {
  const lists = [
    ['load', 'find', 'count'], ['load', 'find', 'count', 'long'],
    ['load', 'count', 'missing', 'neighbors', 'long'],
    ['count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'],
    ['load', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'],
  ];
  for (const stage of STAGES) {
    const games = availableGames(stage.id);
    assert.deepEqual(games, lists[stage.id - 1]);
    games.pop(); assert.deepEqual(availableGames(stage.id), lists[stage.id - 1]);
    for (const kind of GAME_IDS) {
      if (lists[stage.id - 1].includes(kind)) assert.equal(createTask(stage.id, kind).stageId, stage.id);
      else assert.throws(() => createTask(stage.id, kind), RangeError);
    }
  }
  for (const stage of [0, 6, undefined, ...BAD]) {
    assert.throws(() => getStage(stage), RangeError);
    assert.throws(() => availableGames(stage), RangeError);
    assert.throws(() => createTask(stage, 'count'), RangeError);
    assert.throws(() => planJourney(stage, 0), RangeError);
  }
  for (const kind of ['wrong', 'toString', '__proto__', undefined, ...BAD]) assert.throws(() => createTask(5, kind), RangeError);
});

test('journeys contain exactly two activities with deliberate rotations, never mandatory long', () => {
  for (const index of ROUNDS) {
    for (const stage of STAGES) {
      const route = planJourney(stage.id, index);
      assert.equal(route.length, 2);
      assert.ok(route.every(kind => availableGames(stage.id).includes(kind)));
      assert.ok(!route.includes('long'));
      if (stage.id === 1) assert.deepEqual(route, ['load', ['find', 'count'][index % 2]]);
      if (stage.id === 2) assert.deepEqual(route, [['load', 'find'][index % 2], 'count']);
      if (stage.id === 3) assert.deepEqual(route, ['load', ['count', 'missing', 'neighbors'][index % 3]]);
      if (stage.id >= 4) assert.deepEqual(route, [['count', 'missing', 'neighbors'][index % 3], ['orders', 'sharing', 'bridge'][index % 3]]);
    }
  }
  for (const index of [undefined, ...BAD]) assert.deepEqual(planJourney(1, index), planJourney(1, 0));
});

test('targets begin at the smallest amount, increase by one and remain safe at huge counters', () => {
  for (const stage of STAGES) {
    for (const kind of availableGames(stage.id)) {
      const min = kind === 'sharing' ? stage.id === 4 ? 3 : 6 : stage.min;
      const max = kind === 'sharing' ? stage.id === 4 ? 5 : 15 : kind === 'bridge' && stage.id === 4 ? 15 : stage.max;
      for (const round of ROUNDS) {
        const task = createTask(stage.id, kind, round);
        assert.equal(task.target, min + round % (max - min + 1), `${stage.id}/${kind}/${round}`);
        assert.equal(task.round, round);
        assert.equal(task.autoFinish, !['orders', 'sharing', 'bridge'].includes(kind));
        assert.deepEqual(task, createTask(stage.id, kind, round));
        assert.ok(Number.isSafeInteger(task.target));
        assert.ok(task.target >= min && task.target <= max);
      }
      for (const round of [undefined, ...BAD]) assert.deepEqual(createTask(stage.id, kind, round), createTask(stage.id, kind, 0));
    }
  }
});

test('every generated task has independent JSON-safe data and can be solved without mutation', () => {
  for (const stage of STAGES) for (const kind of availableGames(stage.id)) for (const round of [0, 1, 3, 5, 9, 29, Number.MAX_SAFE_INTEGER]) {
    const start = freeze(createTask(stage.id, kind, round));
    const copy = JSON.stringify(start);
    assert.equal(assess(start).correct, false);
    const solved = freeze(solve(start));
    assert.equal(assess(solved).correct, true, `${stage.id}/${kind}/${round}`);
    assert.equal(assess(solved).status, 'correct');
    assert.equal(assess(solved).delta, 0);
    assert.equal(JSON.stringify(start), copy);
    assert.deepEqual(createTask(stage.id, kind, round), JSON.parse(copy));
    assert.notStrictEqual(createTask(stage.id, kind, round), start);
    for (const key of Object.keys(start)) if (Array.isArray(start[key])) assert.notStrictEqual(createTask(stage.id, kind, round)[key], start[key]);
  }
});

test('guided load uses one-unit crates early, tens later and cannot exceed its target', () => {
  for (const id of [1, 2, 3, 5]) {
    const start = freeze(createTask(id, 'load', 2));
    assert.deepEqual(start.parts, []);
    assert.deepEqual(start.pieces, id <= 2 ? [1] : [1, 10]);
    assert.deepEqual(assess(start), { correct: false, status: 'empty', current: 0, target: start.target, delta: -start.target });
    const one = act(start, { type: 'add', value: 1 });
    assert.equal(taskTotal(one), 1);
    assert.equal(assess(one).status, 'less');
    assert.deepEqual(act(one, { type: 'remove', value: 0 }), start);
    const solved = freeze(solve(start));
    assert.strictEqual(act(solved, { type: 'add', value: 1 }), solved);
    assert.equal(assess(solved).correct, true);
  }
});

for (const kind of ['find', 'count', 'neighbors']) {
  test(`${kind}: choices are unique, bounded, deterministic and move the answer position`, () => {
    for (const stage of STAGES.filter(stage => availableGames(stage.id).includes(kind))) {
      const positions = new Set();
      for (const round of ROUNDS) {
        const task = freeze(createTask(stage.id, kind, round));
        assert.equal(task.selected, null);
        assert.equal(task.choices.length, stage.id === 1 ? 2 : 3);
        assert.equal(new Set(task.choices).size, task.choices.length);
        assert.ok(task.choices.includes(task.target));
        assert.ok(task.choices.every(n => Number.isSafeInteger(n) && n >= stage.min && n <= stage.max));
        positions.add(task.choices.indexOf(task.target));
        const wrong = task.choices.find(n => n !== task.target);
        const picked = act(task, { type: 'pick', value: wrong });
        assert.equal(picked.selected, wrong);
        assert.deepEqual(assess(picked), { correct: false, status: 'wrong', current: wrong, target: task.target, delta: wrong - task.target });
        const corrected = act(freeze(picked), { type: 'pick', value: task.target });
        assert.equal(assess(corrected).correct, true);
        assert.equal(taskTotal(corrected), task.target);
        assert.strictEqual(act(task, { type: 'pick', value: 0 }), task);
      }
      assert.ok(positions.size > 1, `${stage.id}/${kind}`);
    }
  });
}

test('neighbors always ask a valid adjacent number and can refer to known 20 at the 21 boundary', () => {
  for (const id of [3, 4, 5]) for (const round of ROUNDS) {
    const task = createTask(id, 'neighbors', round);
    assert.ok(['before', 'after'].includes(task.direction));
    assert.equal(task.target, task.anchor + (task.direction === 'before' ? -1 : 1));
    assert.ok(task.anchor >= (id === 5 ? 20 : 11) && task.anchor <= getStage(id).max);
    assert.ok(task.anchor !== 0 && task.anchor !== 31);
  }
  assert.equal(createTask(5, 'neighbors', 0).anchor, 20);
});

test('missing starts with one ascending hole, introduces two later, and reverses only in late stage 5', () => {
  let reversed = false;
  for (const id of [3, 4, 5]) for (const round of ROUNDS) {
    const task = createTask(id, 'missing', round);
    const stage = getStage(id);
    assert.deepEqual(task.answers, []);
    assert.equal(task.lastCorrect, null);
    assert.equal(task.lastPick, null);
    assert.equal(task.holes.length, id === 3 || round < 3 ? 1 : 2);
    assert.deepEqual(task.holes, task.holes.toSorted((a, b) => a - b));
    const full = [...task.sequence];
    task.holes.forEach((index, i) => { assert.equal(full[index], null); full[index] = task.solution[i]; });
    assert.ok(full.every(n => Number.isSafeInteger(n) && n >= stage.min && n <= stage.max));
    const step = full[1] - full[0];
    assert.ok(step === 1 || (id === 5 && round >= 5 && step === -1));
    assert.ok(full.slice(1).every((n, i) => n - full[i] === step));
    assert.ok(task.solution.every(n => task.choices.includes(n)));
    assert.ok(task.choices.every(n => n >= stage.min && n <= stage.max));
    assert.equal(task.choices.length, new Set(task.choices).size);
    if (step === -1) reversed = true;
  }
  assert.ok(reversed);
});

test('wrong missing picks never fill a hole; partial correct picks are progress, not a win', () => {
  const start = freeze(createTask(4, 'missing', 3));
  const wrong = start.choices.find(n => !start.solution.includes(n));
  const failed = act(start, { type: 'pick', value: wrong });
  assert.deepEqual(failed.sequence, start.sequence);
  assert.deepEqual(failed.answers, []);
  assert.equal(failed.lastCorrect, false);
  assert.equal(failed.lastPick, wrong);
  assert.equal(assess(failed).status, 'wrong');
  const partial = freeze(act(freeze(failed), { type: 'pick', value: start.solution[0] }));
  assert.deepEqual(partial.answers, [start.solution[0]]);
  assert.equal(partial.sequence[start.holes[0]], start.solution[0]);
  assert.equal(partial.sequence[start.holes[1]], null);
  assert.equal(partial.lastCorrect, true);
  assert.deepEqual(assess(partial), { correct: false, status: 'progress', current: 1, target: 2, delta: -1 });
  const wrongAfter = act(partial, { type: 'pick', value: start.solution[0] });
  assert.deepEqual(wrongAfter.answers, partial.answers);
  assert.deepEqual(wrongAfter.sequence, partial.sequence);
  assert.equal(assess(wrongAfter).status, 'wrong');
  const done = freeze(act(wrongAfter, { type: 'pick', value: start.solution[1] }));
  assert.equal(assess(done).correct, true);
  assert.equal(taskTotal(done), 2);
  assert.strictEqual(act(done, { type: 'pick', value: wrong }), done);
});

test('long is an optional ordered counter; only reaching the goal is correct', () => {
  let task = freeze(createTask(2, 'long', 4));
  assert.equal(task.cursor, 0);
  assert.equal(assess(task).status, 'empty');
  assert.strictEqual(act(task, { type: 'tick', value: 2 }), task);
  task = freeze(act(task, { type: 'tick', value: 1 }));
  assert.equal(task.cursor, 1);
  assert.equal(assess(task).status, 'progress');
  while (task.cursor < task.target) task = freeze(act(task, { type: 'tick' }));
  assert.equal(assess(task).correct, true);
  assert.equal(taskTotal(task), task.target);
  assert.strictEqual(act(task, { type: 'tick' }), task);
});

for (const kind of ['orders', 'bridge']) {
  test(`${kind}: advanced construction allows independent overshoot, exact removal and correction up to 40`, () => {
    for (const id of [4, 5]) {
      const initial = createTask(id, kind);
      assert.equal(initial.autoFinish, false);
      assert.deepEqual(initial.pieces, kind === 'orders' ? [1, 10] : id === 4 ? [1, 2, 5] : [1, 2, 5, 10]);
      for (const current of Array.from({ length: 41 }, (_, i) => i)) {
        const state = freeze({ ...initial, parts: Array(current).fill(1) });
        assert.equal(taskTotal(state), current);
        const result = assess(state);
        assert.equal(result.current, current);
        assert.equal(result.delta, current - state.target);
        assert.equal(result.status, current === 0 ? 'empty' : current === state.target ? 'correct' : current > state.target ? 'more' : 'less');
        for (const value of state.pieces) {
          const next = act(state, { type: 'add', value });
          if (current + value > 40) assert.strictEqual(next, state);
          else assert.equal(taskTotal(next), current + value);
        }
      }
      const solved = freeze(solve(initial));
      const over = freeze(act(solved, { type: 'add', value: 1 }));
      assert.equal(assess(over).status, 'more');
      assert.equal(assess(act(over, { type: 'remove', value: over.parts.length - 1 })).correct, true);
      const repeated = freeze({ ...initial, parts: [1, 1, 1] });
      assert.deepEqual(act(repeated, { type: 'remove', value: 1 }).parts, [1, 1]);
      assert.strictEqual(act(initial, { type: 'remove', value: 0 }), initial);
    }
  });
}

test('sharing starts at 4/2, progresses gently, and preserves food even through empty piles', () => {
  assert.deepEqual(createTask(4, 'sharing').piles, [4, 2]);
  assert.deepEqual(solve(createTask(4, 'sharing')).piles, [3, 3]);
  for (const id of [4, 5]) for (const round of ROUNDS) {
    const initial = freeze(createTask(id, 'sharing', round));
    const offset = Math.abs(initial.piles[0] - initial.target);
    assert.ok(offset >= 1 && offset <= (id === 4 ? 2 : 4));
    if (round === 0) assert.equal(offset, 1);
    assert.equal(taskTotal(initial), 2 * initial.target);
    assert.equal(initial.autoFinish, false);
    assert.equal(assess(initial).status, 'unequal');
    for (let left = 0; left <= 2 * initial.target; left++) {
      const state = freeze({ ...initial, piles: [left, 2 * initial.target - left] });
      assert.deepEqual(assess(state), { correct: left === state.target, status: left === state.target ? 'correct' : 'unequal', current: left, target: state.target, delta: left - state.piles[1] });
      for (const from of [0, 1]) {
        const next = act(state, { type: 'transfer', value: from });
        assert.equal(taskTotal(next), taskTotal(state));
        assert.ok(next.piles.every(n => Number.isSafeInteger(n) && n >= 0));
        if (state.piles[from] === 0) assert.strictEqual(next, state);
        else {
          assert.equal(next.piles[from], state.piles[from] - 1);
          assert.equal(next.piles[1 - from], state.piles[1 - from] + 1);
        }
      }
    }
    const solved = freeze(solve(initial));
    const changed = act(solved, { type: 'transfer', value: 0 });
    assert.equal(assess(changed).status, 'unequal');
    assert.deepEqual(act(changed, { type: 'transfer', value: 1 }), solved);
  }
  assert.equal(Math.abs(createTask(5, 'sharing', 30).piles[0] - createTask(5, 'sharing', 30).target), 4);
});

test('invalid actions are strict, non-coercing identity no-ops for all nine activities', () => {
  for (const stage of STAGES) for (const kind of availableGames(stage.id)) {
    const task = freeze(createTask(stage.id, kind, 4));
    for (const action of [null, undefined, [], {}, { type: 'constructor' }, { type: 'reset' }]) assert.strictEqual(act(task, action), task);
    for (const type of ['add', 'remove', 'transfer', 'pick', 'tick']) {
      for (const value of [undefined, ...BAD]) {
        if (type === 'tick' && value === undefined && kind === 'long') continue;
        assert.strictEqual(act(task, { type, value }), task, `${kind}/${type}/${String(value)}`);
      }
    }
    for (const [type, value] of [['add', 0], ['add', 40], ['remove', 40], ['transfer', 2], ['pick', 40], ['tick', 40]]) assert.strictEqual(act(task, { type, value }), task);
  }
});

test('malformed tasks cannot enter arithmetic, be edited or be evaluated as wins', () => {
  const load = createTask(1, 'load');
  const count = createTask(1, 'count');
  const missing = createTask(4, 'missing', 3);
  const sharing = createTask(4, 'sharing');
  const long = createTask(2, 'long', 5);
  const malformed = [null, undefined, 0, '', [], {},
    { ...load, stageId: '1' }, { ...load, kind: 'bridge' }, { ...load, kind: 'toString' },
    { ...load, target: 0 }, { ...load, target: 6 }, { ...load, autoFinish: false },
    ...BAD.map(round => ({ ...load, round })),
    ...[null, [0], [-1], ['1'], [2], Array(2), Array(41).fill(1)].map(parts => ({ ...load, parts })),
    { ...load, pieces: [1, 10] }, { ...count, selected: '1' }, { ...count, selected: 40 },
    { ...count, choices: [1, 1] }, { ...count, choices: [0, 1] }, { ...count, choices: ['1', 2] },
    { ...missing, answers: [999] }, { ...missing, answers: [missing.solution[1]] },
    { ...missing, holes: [-1] }, { ...missing, sequence: [null] }, { ...missing, lastCorrect: 'no' },
    { ...missing, solution: [100, 101] }, { ...missing, choices: [missing.solution[0]] },
    { ...sharing, piles: [0, 0] }, { ...sharing, piles: [-1, 7] }, { ...sharing, piles: ['4', 2] },
    { ...sharing, piles: Array(2) }, { ...sharing, target: 6 }, { ...sharing, autoFinish: true },
    { ...long, cursor: -1 }, { ...long, cursor: 20 }, { ...long, cursor: '1' },
  ];
  for (const task of malformed) {
    freeze(task);
    assert.equal(taskTotal(task), 0);
    assert.throws(() => assess(task), TypeError);
    for (const type of ['add', 'remove', 'transfer', 'pick', 'tick']) assert.strictEqual(act(task, { type, value: 1 }), task);
  }
});

test('sparse arrays and foreign payload fields cannot become arithmetic or a missing win', () => {
  const count = createTask(1, 'count');
  const missing = createTask(4, 'missing', 3);
  const sparseAnswers = Array(1);
  const invalid = [
    { ...count, choices: [count.target, ...Array(1)] },
    { ...count, choices: Object.assign(Array(2), { 0: count.target }) },
    { ...missing, answers: sparseAnswers, sequence: missing.sequence.map((n, i) => i === missing.holes[0] ? missing.solution[0] : n), lastCorrect: true, lastPick: missing.solution[0] },
    { ...missing, holes: Array(2), solution: Array(2) },
  ];
  for (const task of invalid) {
    assert.equal(taskTotal(task), 0);
    assert.throws(() => assess(task), TypeError);
    assert.strictEqual(act(task, { type: 'pick', value: task.target }), task);
  }
  for (const kind of ['count', 'missing', 'long', 'sharing']) {
    const t = createTask(kind === 'long' ? 2 : 4, kind);
    const decorated = { ...t, parts: ['untrusted'] };
    assert.equal(taskTotal(decorated), taskTotal(t));
    assert.deepEqual(assess(decorated), assess(t));
  }
});

test('the same repeated target does not always occupy the same answer position', () => {
  for (const id of [1, 2, 3, 4, 5]) {
    const span = getStage(id).max - getStage(id).min + 1;
    const positions = new Set(Array.from({ length: 24 }, (_, cycle) => {
      const t = createTask(id, 'count', span * cycle);
      return t.choices.indexOf(t.target);
    }));
    assert.ok(positions.size > 1, String(id));
  }
});

test('journey model is independent of storage, browser, randomness and clocks', () => {
  const url = new URL('./journey.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', `
    for (const name of ['window', 'document', 'localStorage']) Object.defineProperty(globalThis, name, { get() { throw Error(name); } });
    Math.random = () => { throw Error('random'); }; Date.now = () => { throw Error('clock'); };
    const m = await import(${JSON.stringify(url)});
    for (const s of m.STAGES) for (const kind of m.availableGames(s.id)) {
      const t = m.createTask(s.id, kind, Number.MAX_SAFE_INTEGER); m.assess(t); m.taskTotal(t); m.planJourney(s.id, t.round);
      for (const type of ['add', 'remove', 'transfer', 'pick', 'tick']) m.act(t, {type, value: 1});
    }
  `], { encoding: 'utf8', timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
});
