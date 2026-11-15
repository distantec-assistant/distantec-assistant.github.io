import { GAME_IDS, STAGES } from './journey.mjs?v=5';

export const KEY = 'tsifrograd-2-v1';
const LIMIT = 1000000;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCounter = n => Number.isSafeInteger(n) && n >= 0 && n <= LIMIT;
const isStage = id => Number.isSafeInteger(id) && id >= 1 && id <= STAGES.length;
const fresh = () => ({
  version: 2, stage: 1, sound: true,
  counts: Object.fromEntries(STAGES.map(({ id }) => [id, Object.fromEntries(GAME_IDS.map(kind => [kind, 0]))])),
  sessions: Object.fromEntries(STAGES.map(({ id }) => [id, 0])),
});

// Read only explicit fields; do not stringify the caller's object or migrate v1.
function clean(value) {
  const result = fresh();
  if (!record(value) || value.version !== 2) return result;
  if (Number.isSafeInteger(value.stage)) result.stage = Math.max(1, Math.min(STAGES.length, value.stage));
  if (typeof value.sound === 'boolean') result.sound = value.sound;
  for (const { id } of STAGES) {
    const counts = record(value.counts) && record(value.counts[id]) ? value.counts[id] : null;
    for (const kind of GAME_IDS) if (counts && isCounter(counts[kind])) result.counts[id][kind] = counts[kind];
    if (record(value.sessions) && isCounter(value.sessions[id])) result.sessions[id] = value.sessions[id];
  }
  return result;
}

export function parseProgress(raw) {
  if (typeof raw !== 'string') return fresh();
  try { return clean(JSON.parse(raw)); } catch { return fresh(); }
}

export function winProgress(progress, stageId, kind) {
  const result = clean(progress);
  if (isStage(stageId) && GAME_IDS.includes(kind)) result.counts[stageId][kind] = Math.min(LIMIT, result.counts[stageId][kind] + 1);
  return result;
}

// Completion records the session, not an automatic jump or a world lock.
// The UI phase prevents awarding the same round/session more than once.
export function finishJourney(progress, stageId) {
  const result = clean(progress);
  if (isStage(stageId)) result.sessions[stageId] = Math.min(LIMIT, result.sessions[stageId] + 1);
  return result;
}
