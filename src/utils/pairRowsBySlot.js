import { slotKey } from './slotKey';

function latestRowBySlot(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = slotKey(row.name);
    const prev = map.get(key);
    if (!prev || (row.startTime ?? 0) > (prev.startTime ?? 0)) {
      map.set(key, row);
    }
  }
  return map;
}

export function buildSharedSlots(rowsA, rowsB) {
  const slots = [];
  const seen = new Set();
  for (const row of rowsA || []) {
    const s = slotKey(row.name);
    if (!seen.has(s)) {
      seen.add(s);
      slots.push(s);
    }
  }
  for (const row of rowsB || []) {
    const s = slotKey(row.name);
    if (s && !seen.has(s)) {
      seen.add(s);
      slots.push(s);
    }
  }
  return slots;
}

export function pairRowsBySlot(rowsA, rowsB) {
  const slots = buildSharedSlots(rowsA, rowsB);
  const mapA = latestRowBySlot(rowsA);
  const mapB = latestRowBySlot(rowsB);
  return {
    slots,
    rowsA: slots.map((s) => mapA.get(s) || null),
    rowsB: slots.map((s) => mapB.get(s) || null),
  };
}
