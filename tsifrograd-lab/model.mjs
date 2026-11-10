export const GAME_IDS = Object.freeze(['orders', 'sharing', 'bridge']);

const PIECES = { orders: [1, 10], bridge: [1, 2, 5, 10] };
const MAX_TOTAL = 40;
const isCount = value => Number.isSafeInteger(value) && value >= 0;
const sum = values => values.reduce((result, value) => result + value, 0);

// Сначала берём остаток: даже MAX_SAFE_INTEGER не вызывает потери точности.
export function createRound(kind, round = 0) {
  if (!GAME_IDS.includes(kind)) throw new RangeError('Unknown game kind');
  round = Number.isSafeInteger(round) && round > 0 ? round : 0;
  if (kind === 'sharing') {
    const index = round % 26;
    const target = 3 + (index * 5) % 13;
    const offset = 1 + index % (target - 1);
    const left = target + (index % 2 === 0 ? offset : -offset);
    return { kind, round, target, piles: [left, 2 * target - left] };
  }
  return { kind, round, target: 11 + ((round % 20) * 7) % 20, parts: [] };
}

function isState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  if (!isCount(state.round) || !Number.isSafeInteger(state.target)) return false;
  if (state.kind === 'sharing') {
    const { target, piles } = state;
    return target >= 3 && target <= 15 && Array.isArray(piles) && piles.length === 2
      && isCount(piles[0]) && isCount(piles[1]) && sum(piles) === 2 * target;
  }
  if (state.kind !== 'orders' && state.kind !== 'bridge') return false;
  if (state.target < 11 || state.target > 30 || !Array.isArray(state.parts)) return false;
  let current = 0;
  for (const value of state.parts) {
    if (!PIECES[state.kind].includes(value)) return false;
    current += value;
    if (current > MAX_TOTAL) return false;
  }
  return true;
}

export function addPiece(state, value) {
  if (!isState(state) || state.kind === 'sharing') return state;
  if (!PIECES[state.kind].includes(value) || sum(state.parts) + value > MAX_TOTAL) return state;
  return { ...state, parts: [...state.parts, value] };
}

export function removePiece(state, index) {
  if (!isState(state) || state.kind === 'sharing') return state;
  if (!isCount(index) || index >= state.parts.length) return state;
  return { ...state, parts: state.parts.filter((_, position) => position !== index) };
}

export function transfer(state, from) {
  if (!isState(state) || state.kind !== 'sharing') return state;
  if ((from !== 0 && from !== 1) || state.piles[from] === 0) return state;
  const piles = [...state.piles];
  piles[from]--;
  piles[1 - from]++;
  return { ...state, piles };
}

// Повреждённое состояние не превращается в строковую/NaN-сумму.
export function total(state) {
  if (!isState(state)) return 0;
  return sum(state.kind === 'sharing' ? state.piles : state.parts);
}

export function evaluate(state) {
  if (!isState(state)) throw new TypeError('Invalid game state');
  const { kind, target } = state;
  const current = kind === 'sharing' ? state.piles[0] : sum(state.parts);
  const delta = kind === 'sharing' ? state.piles[0] - state.piles[1] : current - target;
  const correct = delta === 0;
  const status = correct ? 'correct' : kind === 'sharing' ? 'unequal' : delta > 0 ? 'more' : 'less';
  return { correct, status, current, target, delta };
}
