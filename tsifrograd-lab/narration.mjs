// Static recording map. There is no speech-provider credential or API call here.
export const NEW_CLIPS = Object.freeze([
  'ph_orders_start', 'ph_orders_help', 'ph_sharing_start', 'ph_bridge_start', 'ph_bridge_help',
  'ph_orders_less', 'ph_orders_more', 'ph_sharing_unequal', 'ph_bridge_less', 'ph_bridge_more', 'ph_capacity',
  ...Array.from({ length: 10 }, (_, i) => `c_${31 + i}`),
]);
const local = new Set(NEW_CLIPS);
export function clipUrl(id) {
  if (typeof id !== 'string') throw new RangeError('Unknown recording');
  if (/^c_([1-9]|[12][0-9]|30)$/.test(id) || id === 'ph_p1') return `../tsifrograd/audio/${id}.mp3`;
  if (local.has(id)) return `./audio/${id}.mp3`;
  throw new RangeError('Unknown recording');
}
export function instruction(kind, target) {
  if (kind === 'sharing') return [{ clip: 'ph_sharing_start' }];
  if (!['orders', 'bridge'].includes(kind) || !Number.isInteger(target) || target < 11 || target > 30) throw new RangeError('Unknown task');
  return [{ clip: `ph_${kind}_start` }, target, { clip: `ph_${kind}_help` }];
}
export function feedbackClip(kind, status) {
  const id = `ph_${kind}_${status}`;
  if (!local.has(id)) throw new RangeError('Unknown feedback');
  return id;
}
