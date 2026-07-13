import { slotKey } from './slotKey';

/** Collect unique adaptive-sampling slot keys from trajectory rows (stable order). */
export function buildMatrixSlotsFromRows(rowsList) {
  const slots = [];
  const seen = new Set();

  for (const rows of rowsList) {
    if (!rows?.length) continue;
    for (const row of rows) {
      const s = slotKey(row.name);
      if (s && !seen.has(s)) {
        seen.add(s);
        slots.push(s);
      }
    }
  }

  return slots;
}

/** Build shared matrix columns from Comparison `systemData` entries. */
export function buildMatrixSlotsFromSystemData(systemData) {
  if (!systemData?.length) return [];

  return buildMatrixSlotsFromRows(
    systemData.map(({ rows, viewMode, originalRows }) =>
      viewMode === 'concatenated' && originalRows?.length ? originalRows : rows
    )
  );
}

/** Keep slot order stable; append any columns only present in another list. */
export function mergeMatrixSlots(primary = [], secondary = []) {
  const merged = [...primary];
  const seen = new Set(primary);
  for (const slot of secondary) {
    if (!slot || seen.has(slot)) continue;
    seen.add(slot);
    merged.push(slot);
  }
  return merged;
}

/** Union of system ids that should share matrix columns and motif search. */
export function unionSystemIds(...lists) {
  const ids = new Set();
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) {
      if (id) ids.add(id);
    }
  }
  return [...ids];
}
