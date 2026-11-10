export const KEY = 'tsifrograd-lab-v1';
const IDS = ['orders', 'sharing', 'bridge'];
const LIMIT = 1000000;
const fresh = () => ({ version: 1, counts: { orders: 0, sharing: 0, bridge: 0 }, sound: true });

export function parseProgress(raw) {
  const result = fresh();
  let value;
  try { value = JSON.parse(raw); } catch { return result; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  if (typeof value.sound === 'boolean') result.sound = value.sound;
  if (value.counts && typeof value.counts === 'object' && !Array.isArray(value.counts)) {
    for (const id of IDS) {
      const n = value.counts[id];
      if (Number.isSafeInteger(n) && n >= 0 && n <= LIMIT) result.counts[id] = n;
    }
  }
  return result;
}

export function winProgress(progress, kind) {
  const result = parseProgress(JSON.stringify(progress));
  if (IDS.includes(kind)) result.counts[kind] = Math.min(LIMIT, result.counts[kind] + 1);
  return result;
}
