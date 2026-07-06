import { slotKey } from './slotKey';

// One row per matrix column: the latest-in-time trajectory for each slot.
// Matches featuresBySlot() used to build pattern matrix columns.
export function representativeRowsBySlot(allRows, matrixSlots) {
  if (!allRows?.length) return [];

  const slots = matrixSlots?.length
    ? matrixSlots
    : (() => {
        const out = [];
        const seen = new Set();
        for (const row of allRows) {
          const s = slotKey(row.name);
          if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
          }
        }
        return out;
      })();

  const reps = [];
  for (const slot of slots) {
    let best = null;
    for (const row of allRows) {
      if (slotKey(row.name) !== slot) continue;
      if (!best || (row.startTime ?? 0) > (best.startTime ?? 0)) best = row;
    }
    if (best) reps.push(best);
  }

  reps.sort(
    (a, b) =>
      (a.startTime ?? 0) - (b.startTime ?? 0) ||
      String(a.name).localeCompare(String(b.name))
  );

  return reps;
}

// One trajectory per matrix column index (slot order), or null when empty.
export function trajectoriesByMatrixSlot(allRows, matrixSlots) {
  if (!allRows?.length) return [];

  const slots = matrixSlots?.length
    ? matrixSlots
    : (() => {
        const out = [];
        const seen = new Set();
        for (const row of allRows) {
          const s = slotKey(row.name);
          if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
          }
        }
        return out;
      })();

  return slots.map((slot) => {
    let best = null;
    for (const row of allRows) {
      if (slotKey(row.name) !== slot) continue;
      if (!best || (row.startTime ?? 0) > (best.startTime ?? 0)) best = row;
    }
    return best;
  });
}
