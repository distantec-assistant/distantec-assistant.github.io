// Pure round transitions; preview is a projection, never a card pick or answer.
const PROGRESS_KEY = 'pary-2-v1';
const STAGES = Object.freeze(['open', 'closed', 'missing']);
const HEROES = Object.freeze(['fox', 'penguin', 'frog', 'rabbit', 'bear', 'cat']);

function shuffled(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createRound(kind, random = Math.random) {
  const order = shuffled(HEROES, random);
  if (kind === 'missing') {
    const original = order.slice(0, 3);
    const answer = original[Math.floor(random() * original.length)];
    const remaining = original.filter((hero) => hero !== answer);
    const stillThere = remaining[Math.floor(random() * remaining.length)];
    const options = shuffled([answer, stillThere, order[3]], random);
    return { kind, original, answer, remaining, options, phase: 'study', viewing: false, attempt: null, finished: false };
  }
  const faces = order.slice(0, kind === 'open' ? 2 : 3);
  const cards = shuffled([...faces, ...faces], random);
  return { kind, cards, first: null, second: null, found: [], peeking: false, finished: false };
}

function stepMissing(state, action) {
  if (state.phase === 'study') {
    return action.type === 'remember' ? { ...state, phase: 'question' } : state;
  }
  if (action.type === 'toggle-original') return { ...state, viewing: !state.viewing };
  if (action.type === 'dismiss' && state.viewing) return { ...state, viewing: false };
  if (state.viewing || action.type !== 'choose' || !state.options.includes(action.hero)) return state;
  if (action.hero === state.attempt) return state;
  return { ...state, attempt: action.hero, finished: action.hero === state.answer };
}

function step(state, action) {
  if (state.finished) return state;
  if (state.kind === 'missing') return stepMissing(state, action);
  if (action.type === 'toggle-peek' && state.kind === 'closed') return { ...state, peeking: !state.peeking };
  if (action.type === 'dismiss' && state.peeking) return { ...state, peeking: false };
  if (state.peeking || action.type !== 'card') return state;

  const i = action.index;
  if (!Number.isInteger(i) || i < 0 || i >= state.cards.length || state.found.includes(i) || i === state.first || i === state.second) {
    return state;
  }
  // A mismatch stays visible until the child taps another card. No delayed callback can change a later round.
  if (state.first === null || state.second !== null) return { ...state, first: i, second: null };
  if (state.cards[i] !== state.cards[state.first]) return { ...state, second: i };
  const found = [...state.found, state.first, i];
  return { ...state, first: null, second: null, found, finished: found.length === state.cards.length };
}

function cardState(state, index) {
  if (state.found.includes(index)) return 'found';
  if (index === state.first || index === state.second) return state.second === null ? 'picked' : 'retry';
  return state.kind === 'open' ? 'face' : 'back';
}

function parseProgress(raw) {
  if (raw === null) return [];
  if (typeof raw !== 'string' || raw.length > 256) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Object.keys(value).length !== 2 ||
        !Object.hasOwn(value, 'version') || value.version !== 1 || !Object.hasOwn(value, 'completed') ||
        !Array.isArray(value.completed)) return null;
    const stages = new Set(value.completed);
    if (stages.size !== value.completed.length || [...stages].some((stage) => !STAGES.includes(stage))) return null;
    return STAGES.filter((stage) => stages.has(stage));
  } catch {
    return null;
  }
}

function createAlbum(getStorage) {
  let completed = [];
  let storage = null;
  try {
    const available = getStorage();
    const saved = parseProgress(available.getItem(PROGRESS_KEY));
    if (saved !== null) {
      completed = saved;
      storage = available;
    }
  } catch {
    // Some file viewers and privacy settings deny even getting the storage object.
  }
  return {
    completed: () => [...completed],
    earn(stage) {
      if (!STAGES.includes(stage) || completed.includes(stage)) return false;
      completed = STAGES.filter((id) => id === stage || completed.includes(id));
      if (storage) {
        try {
          const saved = parseProgress(storage.getItem(PROGRESS_KEY));
          if (saved === null) storage = null;
          else {
            completed = STAGES.filter((id) => completed.includes(id) || saved.includes(id));
            if (completed.length > saved.length) {
              storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, completed }));
            }
          }
        } catch {
          storage = null;
        }
      }
      // Redraw even if this tab learned the stamp from storage rather than writing it.
      return true;
    },
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROGRESS_KEY, createRound, step, cardState, parseProgress, createAlbum };
}
