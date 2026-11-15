// Static Julia recording allowlists, audited against src/clips.json/data.py.
// Both archived Svetlana banks and all original audio/tts bytes remain untouched.
export const NEW_CLIPS = Object.freeze([
  'ph_orders_start', 'ph_orders_help', 'ph_sharing_start', 'ph_bridge_start', 'ph_bridge_help',
  'ph_orders_less', 'ph_orders_more', 'ph_sharing_unequal', 'ph_bridge_less', 'ph_bridge_more', 'ph_capacity',
  ...Array.from({ length: 10 }, (_, i) => `c_${31 + i}`),
]);
const local = new Set(NEW_CLIPS);
const core = new Set([
  ...Array.from({ length: 30 }, (_, i) => `c_${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `f_${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `g_${i + 1}`),
  'ph_tap', 'ph_load', 'ph_loaded', 'ph_howmany', 'ph_howmany10', 'ph_together',
  'ph_missing', 'ph_missing2', 'ph_before', 'ph_after', 'ph_long',
]);
// data.py REUSE: same Julia processing, authored by Bukvograd, not new synthesis.
const common = new Set(['ph_p1', 'ph_try_again']);
const kinds = ['load', 'find', 'count', 'missing', 'neighbors', 'long', 'orders', 'sharing', 'bridge'];
const queue = clip => [{ clip }];

export function clipUrl(id) {
  if (typeof id !== 'string') throw new RangeError('Unknown recording');
  if (local.has(id)) return `./audio/${id}.mp3`;
  if (core.has(id)) return `../tsifrograd/audio/${id}.mp3`;
  if (common.has(id)) return `../bukvograd/audio/${id}.mp3`;
  throw new RangeError('Unknown recording');
}

// Narration only needs the task's instructional fields. Numbers are spoken
// quantities, never timeout/pause markers; questions do not reveal the answer.
function checkTask(task) {
  if (!task || typeof task !== 'object' || Array.isArray(task) || !kinds.includes(task.kind)
      || !Number.isSafeInteger(task.target) || task.target < 1 || task.target > 30) throw new RangeError('Unknown task');
  if (task.kind === 'find' && task.target > 10) throw new RangeError('Unknown find instruction');
  if (['orders', 'bridge'].includes(task.kind) && task.target < 11) throw new RangeError('Unknown advanced task');
  if (task.kind === 'sharing' && (task.target < 3 || task.target > 15)) throw new RangeError('Unknown sharing task');
}

export function instruction(task) {
  checkTask(task);
  const { kind, target } = task;
  if (kind === 'load') return target <= 10 ? [{ clip: `g_${target}` }, { clip: 'ph_tap' }] : [target, { clip: 'ph_load' }];
  if (kind === 'find') return queue(`f_${target}`);
  if (kind === 'count') return queue('ph_howmany10'); // «Сколько тут?» also fits apple crates.
  if (kind === 'long') return queue('ph_long');
  if (kind === 'sharing') return queue('ph_sharing_start');
  if (kind === 'orders' || kind === 'bridge') return [{ clip: `ph_${kind}_start` }, target, { clip: `ph_${kind}_help` }];
  if (kind === 'missing') {
    if (!Array.isArray(task.holes) || ![1, 2].includes(task.holes.length)
        || ![...task.holes].every(n => Number.isSafeInteger(n) && n >= 0 && n < 5) || new Set(task.holes).size !== task.holes.length) throw new RangeError('Unknown missing task');
    return queue(task.holes.length === 2 ? 'ph_missing2' : 'ph_missing');
  }
  if (!Number.isSafeInteger(task.anchor) || task.anchor < 1 || task.anchor > 30
      || !['before', 'after'].includes(task.direction)
      || target !== task.anchor + (task.direction === 'before' ? -1 : 1)) throw new RangeError('Unknown neighbor task');
  return [task.anchor, { clip: `ph_${task.direction}` }];
}

export function feedback(task, status) {
  checkTask(task);
  if (!['correct', 'progress', 'more', 'less', 'unequal', 'wrong', 'empty', 'capacity'].includes(status)) throw new RangeError('Unknown feedback');
  if (status === 'correct') return queue('ph_p1');
  if (status === 'progress') return [];
  if (status === 'capacity') return queue('ph_capacity');
  if (task.kind === 'sharing') {
    if (status !== 'unequal') throw new RangeError('Unknown sharing feedback');
    return queue('ph_sharing_unequal');
  }
  if (task.kind === 'orders' || task.kind === 'bridge') {
    const state = status === 'empty' ? 'less' : status;
    if (state !== 'less' && state !== 'more') throw new RangeError('Unknown construction feedback');
    return queue(`ph_${task.kind}_${state}`);
  }
  return queue('ph_try_again');
}
