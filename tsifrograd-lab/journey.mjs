// Pure task contract. UI owns phase/awards; autoFinish is a UI hint, not a submit action.
// Every task: {stageId, kind, round, target, autoFinish}.
// load/orders/bridge: +{parts, pieces}; sharing: +{piles}; long: +{cursor}.
// find/count: +{choices, selected}; neighbors: +{choices, selected, anchor, direction}.
// missing: +{sequence, holes, solution, answers, choices, lastCorrect, lastPick};
// holes/solution stay ordered by position; only correct picks fill sequence/answers.
// add=value (denomination), remove=value (part index), transfer=value (donor 0/1),
// pick=value (answer), tick with no value (or the next 1-based cursor).
export const GAME_IDS = Object.freeze(['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge']);
export const STAGES = Object.freeze([
  { id: 1, title: 'Лужайка', range: '1–5', min: 1, max: 5, art: 'meadow' },
  { id: 2, title: 'Лес', range: '1–10', min: 1, max: 10, art: 'forest' },
  { id: 3, title: 'Город', range: '11–20', min: 11, max: 20, art: 'town' },
  { id: 4, title: 'Мастерская', range: '11–20', min: 11, max: 20, art: 'workshop' },
  { id: 5, title: 'Большое путешествие', range: '21–30', min: 21, max: 30, art: 'mountains' },
].map(Object.freeze));

const GAMES = [
  ['load', 'find', 'count'],
  ['load', 'find', 'count', 'long'],
  ['load', 'count', 'missing', 'neighbors', 'long'],
  ['count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'],
  ['load', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'],
];
const ADVANCED = ['orders', 'sharing', 'bridge'];
const isCount = n => Number.isSafeInteger(n) && n >= 0;
const isStageId = id => Number.isSafeInteger(id) && id >= 1 && id <= STAGES.length;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const normalizeRound = n => isCount(n) && n > 0 ? n : 0;
const sum = values => values.reduce((total, value) => total + value, 0);
const same = (values, expected) => Array.isArray(values) && values.length === expected.length && expected.every((n, i) => values[i] === n);

export function getStage(id) {
  if (!isStageId(id)) throw new RangeError('Unknown stage');
  return STAGES[id - 1];
}

export function availableGames(stageId) {
  getStage(stageId);
  return [...GAMES[stageId - 1]];
}

export function planJourney(stageId, index = 0) {
  getStage(stageId);
  index = normalizeRound(index);
  if (stageId === 1) return ['load', ['find', 'count'][index % 2]];
  if (stageId === 2) return [['load', 'find'][index % 2], 'count'];
  if (stageId === 3) return ['load', ['count', 'missing', 'neighbors'][index % 3]];
  return [['count', 'missing', 'neighbors'][index % 3], ['orders', 'sharing', 'bridge'][index % 3]];
}

function bounds(stage, kind) {
  if (kind === 'sharing') return stage.id === 4 ? [3, 5] : [6, 15];
  if (kind === 'bridge' && stage.id === 4) return [11, 15];
  return [stage.min, stage.max];
}

function denominations(stageId, kind) {
  if (kind === 'load') return stageId <= 2 ? [1] : [1, 10];
  if (kind === 'orders') return [1, 10];
  return stageId === 4 ? [1, 2, 5] : [1, 2, 5, 10];
}

// Local, reproducible shuffle. Reduce the round before arithmetic: huge safe counters
// never overflow into an unsafe multiplied round or allocate a round-sized array.
function choicesFor(stage, required, round, kind) {
  const size = stage.id === 1 ? 2 : 3;
  const values = [...required];
  for (let distance = 1; values.length < size; distance++) {
    for (const n of [required[0] - distance, required[0] + distance]) {
      if (n >= stage.min && n <= stage.max && !values.includes(n)) values.push(n);
      if (values.length === size) break;
    }
  }
  let seed = ((round % 0x100000000) ^ (stage.id * 131 + GAME_IDS.indexOf(kind) * 17)) >>> 0;
  for (let i = values.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function createTask(stageId, kind, round = 0) {
  const stage = getStage(stageId);
  if (!GAMES[stageId - 1].includes(kind)) throw new RangeError('Activity unavailable in this stage');
  round = normalizeRound(round);
  const [min, max] = bounds(stage, kind);
  const target = min + round % (max - min + 1);
  const task = { stageId, kind, round, target, autoFinish: !ADVANCED.includes(kind) };
  if (['load', 'orders', 'bridge'].includes(kind)) return { ...task, parts: [], pieces: denominations(stageId, kind) };
  if (kind === 'sharing') {
    const offset = Math.min(stageId === 4 ? 2 : 4, 1 + Math.floor(round / (max - min + 1)));
    const left = target + (round % 2 === 0 ? offset : -offset);
    return { ...task, piles: [left, 2 * target - left] };
  }
  if (kind === 'long') return { ...task, cursor: 0 };
  if (kind === 'missing') {
    const start = Math.max(min, Math.min(target - 2, max - 4));
    const full = Array.from({ length: 5 }, (_, i) => start + i);
    if (stageId === 5 && round >= 5 && round % 2 === 1) full.reverse();
    const first = full.indexOf(target);
    const holes = [first];
    if (stageId >= 4 && round >= 3) holes.push((first + 2) % full.length);
    holes.sort((a, b) => a - b);
    const solution = holes.map(i => full[i]);
    const sequence = full.map((n, i) => holes.includes(i) ? null : n);
    return { ...task, sequence, holes, solution, answers: [], choices: choicesFor(stage, solution, round, kind), lastCorrect: null, lastPick: null };
  }
  const choice = { ...task, choices: choicesFor(stage, [target], round, kind), selected: null };
  if (kind !== 'neighbors') return choice;
  let direction = round % 2 === 0 ? 'after' : 'before';
  const anchorMin = stageId === 5 ? 20 : min;
  if (target - 1 < anchorMin) direction = 'before';
  if (target + 1 > max) direction = 'after';
  return { ...choice, anchor: target + (direction === 'before' ? 1 : -1), direction };
}

function validChoices(task, stage, required) {
  const { choices } = task;
  return Array.isArray(choices) && choices.length === (stage.id === 1 ? 2 : 3)
    && new Set(choices).size === choices.length
    && [...choices].every(n => Number.isSafeInteger(n) && n >= stage.min && n <= stage.max)
    && required.every(n => choices.includes(n));
}

function validMissing(task, stage) {
  const { sequence, holes, solution, answers, lastCorrect, lastPick } = task;
  const expectedHoles = stage.id === 3 || task.round < 3 ? 1 : 2;
  if (!Array.isArray(sequence) || sequence.length !== 5 || !Array.isArray(holes) || holes.length !== expectedHoles
      || !Array.isArray(solution) || solution.length !== holes.length || !Array.isArray(answers) || answers.length > holes.length) return false;
  if (![...holes].every((n, i) => isCount(n) && n < sequence.length && (i === 0 || n > holes[i - 1]))) return false;
  if (![...solution].every(n => Number.isSafeInteger(n) && n >= stage.min && n <= stage.max)
      || new Set(solution).size !== solution.length || !solution.includes(task.target)
      || ![...answers].every((n, i) => n === solution[i]) || !validChoices(task, stage, solution)) return false;
  const full = [...sequence];
  for (let i = 0; i < holes.length; i++) {
    if (sequence[holes[i]] !== (i < answers.length ? solution[i] : null)) return false;
    full[holes[i]] = solution[i];
  }
  if (!full.every(n => Number.isSafeInteger(n) && n >= stage.min && n <= stage.max)) return false;
  const step = full[1] - full[0];
  if (step !== 1 && !(step === -1 && stage.id === 5 && task.round >= 5)) return false;
  if (!full.slice(1).every((n, i) => n - full[i] === step)) return false;
  if (lastCorrect === null) return answers.length === 0 && lastPick === null;
  if (typeof lastCorrect !== 'boolean' || !task.choices.includes(lastPick)) return false;
  if (lastCorrect) return answers.length > 0 && lastPick === answers[answers.length - 1];
  return answers.length < solution.length && lastPick !== solution[answers.length];
}

function isTask(task) {
  if (!record(task) || !isStageId(task.stageId) || !GAMES[task.stageId - 1].includes(task.kind) || !isCount(task.round)) return false;
  const stage = STAGES[task.stageId - 1];
  const [min, max] = bounds(stage, task.kind);
  if (!Number.isSafeInteger(task.target) || task.target < min || task.target > max
      || task.autoFinish !== !ADVANCED.includes(task.kind)) return false;
  if (['load', 'orders', 'bridge'].includes(task.kind)) {
    const expected = denominations(task.stageId, task.kind);
    if (!same(task.pieces, expected) || !Array.isArray(task.parts) || task.parts.length > 40) return false;
    let current = 0;
    for (const part of task.parts) {
      if (!expected.includes(part)) return false;
      current += part;
    }
    return current <= (task.kind === 'load' ? task.target : 40);
  }
  if (task.kind === 'sharing') {
    return Array.isArray(task.piles) && task.piles.length === 2 && isCount(task.piles[0]) && isCount(task.piles[1])
      && task.piles[0] <= 2 * task.target && task.piles[1] <= 2 * task.target && sum(task.piles) === 2 * task.target;
  }
  if (task.kind === 'long') return isCount(task.cursor) && task.cursor <= task.target;
  if (task.kind === 'missing') return validMissing(task, stage);
  if (!validChoices(task, stage, [task.target]) || (task.selected !== null && !task.choices.includes(task.selected))) return false;
  if (task.kind !== 'neighbors') return true;
  return Number.isSafeInteger(task.anchor) && task.anchor >= (stage.id === 5 ? 20 : stage.min) && task.anchor <= stage.max
    && ['before', 'after'].includes(task.direction) && task.target === task.anchor + (task.direction === 'before' ? -1 : 1);
}

export function act(task, action) {
  if (!isTask(task) || !record(action)) return task;
  const { type, value } = action;
  if (['load', 'orders', 'bridge'].includes(task.kind)) {
    if (type === 'add' && task.pieces.includes(value) && sum(task.parts) + value <= (task.kind === 'load' ? task.target : 40)) return { ...task, parts: [...task.parts, value] };
    if (type === 'remove' && isCount(value) && value < task.parts.length) return { ...task, parts: task.parts.filter((_, i) => i !== value) };
    return task;
  }
  if (task.kind === 'sharing') {
    if (type !== 'transfer' || (value !== 0 && value !== 1) || task.piles[value] === 0) return task;
    const piles = [...task.piles]; piles[value]--; piles[1 - value]++;
    return { ...task, piles };
  }
  if (task.kind === 'long') {
    if (type !== 'tick' || task.cursor >= task.target || (value !== undefined && value !== task.cursor + 1)) return task;
    return { ...task, cursor: task.cursor + 1 };
  }
  if (type !== 'pick' || !task.choices.includes(value)) return task;
  if (task.kind !== 'missing') return value === task.selected ? task : { ...task, selected: value };
  if (task.answers.length === task.solution.length) return task;
  const lastCorrect = value === task.solution[task.answers.length];
  if (!lastCorrect) return { ...task, lastCorrect: false, lastPick: value };
  const sequence = [...task.sequence]; sequence[task.holes[task.answers.length]] = value;
  return { ...task, sequence, answers: [...task.answers, value], lastCorrect: true, lastPick: value };
}

// For missing this is the number of completed holes, for long the cursor, for
// choices the selected number (0 before a pick). Sharing totals both piles.
function currentTotal(task) {
  if (['load', 'orders', 'bridge'].includes(task.kind)) return sum(task.parts);
  if (task.kind === 'sharing') return sum(task.piles);
  if (task.kind === 'missing') return task.answers.length;
  if (task.kind === 'long') return task.cursor;
  return task.selected ?? 0;
}

export function taskTotal(task) {
  return isTask(task) ? currentTotal(task) : 0;
}

export function assess(task) {
  // Missing uses completed/required hole counts; sharing uses the left pile and
  // signed left-minus-right imbalance. Other tasks compare current with task.target.
  if (!isTask(task)) throw new TypeError('Invalid task');
  let current = currentTotal(task);
  let target = task.target;
  let delta = current - target;
  let status;
  if (task.kind === 'sharing') {
    current = task.piles[0]; delta = current - task.piles[1];
    status = delta === 0 ? 'correct' : 'unequal';
  } else if (task.kind === 'missing') {
    target = task.solution.length; delta = current - target;
    status = current === target ? 'correct' : task.lastCorrect === false ? 'wrong' : current > 0 ? 'progress' : 'empty';
  } else if (task.kind === 'long') status = delta === 0 ? 'correct' : current > 0 ? 'progress' : 'empty';
  else if (['find', 'count', 'neighbors'].includes(task.kind)) status = task.selected === null ? 'empty' : delta === 0 ? 'correct' : 'wrong';
  else status = delta === 0 ? 'correct' : current === 0 ? 'empty' : delta > 0 ? 'more' : 'less';
  return { correct: status === 'correct', status, current, target, delta };
}
