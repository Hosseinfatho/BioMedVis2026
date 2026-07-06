export const ALIGNMENT_NONE = 'none';

const DEFAULT_BEFORE = 300;
const DEFAULT_AFTER = 300;

export function buildAlignmentOptions(numStates) {
  const options = [{ id: ALIGNMENT_NONE, label: 'From frame 0 (default)' }];

  for (let s = 0; s < numStates; s++) {
    options.push({
      id: `entry:${s}`,
      label: `First entry into S${s}`,
    });
  }

  for (let a = 0; a < numStates; a++) {
    for (let b = 0; b < numStates; b++) {
      if (a !== b) {
        options.push({
          id: `trans:${a}->${b}`,
          label: `First S${a}→S${b} transition`,
        });
      }
    }
  }

  return options;
}

export function alignmentLabel(alignmentId, numStates) {
  if (!alignmentId || alignmentId === ALIGNMENT_NONE) return null;
  const opt = buildAlignmentOptions(numStates).find((o) => o.id === alignmentId);
  return opt?.label ?? alignmentId;
}

// Returns the frame index of the alignment event, or null if not found.
export function findAlignmentAnchor(states, alignmentId) {
  if (!alignmentId || alignmentId === ALIGNMENT_NONE || !states?.length) {
    return null;
  }

  if (alignmentId.startsWith('entry:')) {
    const state = Number.parseInt(alignmentId.slice(6), 10);
    for (let i = 0; i < states.length; i++) {
      if (states[i] === state) return i;
    }
    return null;
  }

  if (alignmentId.startsWith('trans:')) {
    const match = alignmentId.slice(6).match(/^(\d+)->(\d+)$/);
    if (!match) return null;
    const from = Number.parseInt(match[1], 10);
    const to = Number.parseInt(match[2], 10);
    for (let i = 1; i < states.length; i++) {
      if (states[i - 1] === from && states[i] === to) return i;
    }
    return null;
  }

  return null;
}

// Slice frames around the anchor so experts can compare before/after the same event.
export function extractAlignedWindow(
  states,
  anchor,
  { before = DEFAULT_BEFORE, after = DEFAULT_AFTER } = {}
) {
  if (anchor == null || !states?.length) return [];

  const start = Math.max(0, anchor - before);
  const end = Math.min(states.length, anchor + after + 1);
  return states.slice(start, end);
}

export function getAlignedStates(states, alignmentId) {
  if (!alignmentId || alignmentId === ALIGNMENT_NONE) return states || [];
  const anchor = findAlignmentAnchor(states, alignmentId);
  if (anchor == null) return [];
  return extractAlignedWindow(states, anchor);
}
