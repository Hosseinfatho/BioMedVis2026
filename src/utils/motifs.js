import { featureRowIndexForTransition } from './computeTransitionFeatures';
import { slotKey } from './slotKey';

export function motifFromStates(states) {
  if (!states?.length || states.length < 2) return null;

  const transitions = [];
  for (let i = 1; i < states.length; i++) {
    transitions.push([states[i - 1], states[i]]);
  }

  return {
    id: states.join('-'),
    states: [...states],
    transitions,
    label: states.join(' → '),
  };
}

export function defaultMotifPresets(numStates) {
  const paths = [];
  if (numStates >= 3) {
    paths.push([0, 1, 2], [2, 1, 0]);
  }
  if (numStates >= 2) {
    paths.push([1, 2], [0, 2]);
  }
  return paths.map(motifFromStates).filter(Boolean);
}

function buildSlotColumnMap(matrixSlots, rows) {
  if (matrixSlots?.length) {
    return new Map(matrixSlots.map((s, i) => [s, i]));
  }
  const slots = [];
  const seen = new Set();
  for (const row of rows) {
    const s = slotKey(row.name);
    if (!seen.has(s)) {
      seen.add(s);
      slots.push(s);
    }
  }
  return new Map(slots.map((s, i) => [s, i]));
}

function makeStepEvent(row, col, frame, from, to, trajectoryIndex) {
  const time0 = row.startTime ?? 0;
  return {
    col,
    slot: slotKey(row.name),
    rowName: row.name,
    trajectoryIndex,
    frame,
    globalTime: time0 + frame,
    from,
    to,
    startFrame: frame - 1,
    endFrame: frame + 1,
  };
}

export function buildTransitionEvents(rows, matrixSlots, getStates = (r) => r.states || []) {
  const slotToCol = buildSlotColumnMap(matrixSlots, rows);
  const events = [];

  for (let trajIdx = 0; trajIdx < rows.length; trajIdx++) {
    const row = rows[trajIdx];
    const slot = slotKey(row.name);
    const col = slotToCol.get(slot) ?? -1;

    const states = getStates(row);
    if (!states?.length) continue;

    for (let f = 1; f < states.length; f++) {
      const from = states[f - 1];
      const to = states[f];
      if (from === to) continue;

      events.push({
        col,
        slot,
        rowName: row.name,
        trajectoryIndex: trajIdx,
        frame: f,
        globalTime: (row.startTime ?? 0) + f,
        from,
        to,
        startFrame: f - 1,
        endFrame: f + 1,
      });
    }
  }

  return events;
}

function occurrenceKey(occ) {
  return occ.steps
    .map((s) => `${s.rowName}@${s.globalTime}:${s.from}->${s.to}`)
    .join('|');
}

function mergeOccurrences(lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const occ of list) {
      const key = occurrenceKey(occ);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(occ);
    }
  }
  merged.sort(
    (a, b) =>
      a.steps[0].trajectoryIndex - b.steps[0].trajectoryIndex ||
      a.startTime - b.startTime
  );
  return merged;
}

function isValidMotifChain(steps) {
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].trajectoryIndex <= steps[i - 1].trajectoryIndex) return false;
    if (steps[i].globalTime <= steps[i - 1].globalTime) return false;
  }
  return true;
}

// Pick the next transition on a later trajectory, later in global time.
function findNextChainStep(events, used, reserved, from, to, lastTraj, lastTime) {
  let best = null;

  for (let j = 0; j < events.length; j++) {
    if (used.has(j) || reserved.has(j)) continue;

    const ev = events[j];
    if (ev.from !== from || ev.to !== to) continue;
    if (ev.trajectoryIndex <= lastTraj) continue;
    if (ev.globalTime <= lastTime) continue;

    if (
      !best ||
      ev.trajectoryIndex < best.ev.trajectoryIndex ||
      (ev.trajectoryIndex === best.ev.trajectoryIndex &&
        ev.globalTime < best.ev.globalTime)
    ) {
      best = { ev, j };
    }
  }

  return best;
}

// Consecutive state path within one trajectory (e.g. …0,1,2,0… on the same row).
export function findIntraTrajectoryMotifOccurrences(
  motif,
  rows,
  matrixSlots,
  getStates = (r) => r.states || []
) {
  if (!motif?.states?.length || motif.states.length < 2 || !rows?.length) return [];

  const slotToCol = buildSlotColumnMap(matrixSlots, rows);
  const motifStates = motif.states;
  const n = motifStates.length;
  const occurrences = [];

  for (let trajIdx = 0; trajIdx < rows.length; trajIdx++) {
    const row = rows[trajIdx];
    const states = getStates(row);
    if (!states || states.length < n) continue;

    const col = slotToCol.get(slotKey(row.name)) ?? -1;

    for (let start = 0; start <= states.length - n; start++) {
      let match = true;
      for (let k = 0; k < n; k++) {
        if (states[start + k] !== motifStates[k]) {
          match = false;
          break;
        }
      }
      if (!match) continue;

      const steps = motif.transitions.map(([from, to], t) =>
        makeStepEvent(row, col, start + t + 1, from, to, trajIdx)
      );

      occurrences.push({
        steps,
        startTime: steps[0].globalTime,
        endTime: steps[steps.length - 1].globalTime,
      });
    }
  }

  return occurrences;
}

// Cross-trajectory chain: each step on a strictly later trajectory (row index)
// and at a strictly later global time than the previous step.
// Example 0→1→2→0: 0→1 on traj 10, 1→2 on traj 100, 2→0 on traj 500.
export function findCrossTrajectoryMotifOccurrences(
  motif,
  rows,
  matrixSlots,
  getStates = (r) => r.states || []
) {
  if (!motif?.transitions?.length || !rows?.length) return [];

  const events = buildTransitionEvents(rows, matrixSlots, getStates);
  const transitions = motif.transitions;
  const occurrences = [];
  const used = new Set();

  for (let trajIdx = 0; trajIdx < rows.length; trajIdx++) {
    const [f0, t0] = transitions[0];

    const step0Candidates = events
      .map((ev, idx) => ({ ev, idx }))
      .filter(
        ({ ev, idx }) =>
          ev.trajectoryIndex === trajIdx &&
          ev.from === f0 &&
          ev.to === t0 &&
          !used.has(idx)
      )
      .sort((a, b) => a.ev.globalTime - b.ev.globalTime);

    for (const { ev: startEv, idx: startIdx } of step0Candidates) {
      const steps = [startEv];
      const indices = [startIdx];
      const reserved = new Set();
      let lastTraj = startEv.trajectoryIndex;
      let lastTime = startEv.globalTime;

      for (let ti = 1; ti < transitions.length; ti++) {
        const [from, to] = transitions[ti];
        const found = findNextChainStep(
          events,
          used,
          reserved,
          from,
          to,
          lastTraj,
          lastTime
        );
        if (!found) break;

        steps.push(found.ev);
        indices.push(found.j);
        lastTraj = found.ev.trajectoryIndex;
        lastTime = found.ev.globalTime;
      }

      if (steps.length !== transitions.length) continue;
      if (!isValidMotifChain(steps)) continue;

      for (const j of indices) used.add(j);

      occurrences.push({
        steps,
        startTime: steps[0].globalTime,
        endTime: steps[steps.length - 1].globalTime,
      });
    }
  }

  return occurrences;
}

export function findGlobalMotifOccurrences(
  motif,
  rows,
  matrixSlots,
  getStates = (r) => r.states || []
) {
  if (!motif?.transitions?.length || !rows?.length) return [];

  const intra = findIntraTrajectoryMotifOccurrences(
    motif,
    rows,
    matrixSlots,
    getStates
  );

  const cross = findCrossTrajectoryMotifOccurrences(
    motif,
    rows,
    matrixSlots,
    getStates
  );

  return mergeOccurrences([intra, cross]);
}

export function motifTransitionRowIndices(motif, numStates) {
  if (!motif?.transitions?.length) return [];
  return motif.transitions
    .map(([from, to]) => featureRowIndexForTransition(from, to, numStates))
    .filter((i) => i >= 0);
}

export const MOTIF_BUNDLE_COLORS = [
  '#8dd3c7',
  '#ffffb3',
  '#bebada',
  '#fb8072',
  '#80b1d3',
  '#fdb462',
  '#b3de69',
  '#fccde5',
  '#d9d9d9',
  '#bc80bd',
  '#ccebc5',
  '#ffed6f',
];

export function computeMotifMatrixHighlights(motif, numStates, occurrences) {
  if (!motif || !occurrences?.length) return { bundles: [] };

  const bundles = [];

  for (let occIdx = 0; occIdx < occurrences.length; occIdx++) {
    const occ = occurrences[occIdx];
    const cells = [];

    for (let stepIdx = 0; stepIdx < occ.steps.length; stepIdx++) {
      const step = occ.steps[stepIdx];
      const row = featureRowIndexForTransition(step.from, step.to, numStates);
      if (row < 0 || step.col < 0) continue;
      cells.push({ row, col: step.col, stepIdx });
    }

    if (cells.length !== occ.steps.length) continue;
    if (cells.length !== motif.transitions.length) continue;

    const [firstFrom, firstTo] = motif.transitions[0];
    const [lastFrom, lastTo] = motif.transitions[motif.transitions.length - 1];
    const firstRow = featureRowIndexForTransition(firstFrom, firstTo, numStates);
    const lastRow = featureRowIndexForTransition(lastFrom, lastTo, numStates);
    if (firstRow < 0 || lastRow < 0) continue;
    if (cells[0].row !== firstRow || cells[cells.length - 1].row !== lastRow) {
      continue;
    }

    // Path: first transition (e.g. 3→1) … last transition (e.g. S2→S3).
    const path = cells.map((cell, i) => ({
      ...cell,
      kind: 'transition',
      isStart: i === 0,
      isEnd: i === cells.length - 1,
    }));

    bundles.push({ occurrenceIndex: occIdx, cells, path });
  }

  return { bundles };
}

export function computeMotifHighlights(
  motif,
  numStates,
  rows,
  matrixSlots,
  getStates
) {
  const occurrences = findGlobalMotifOccurrences(
    motif,
    rows,
    matrixSlots,
    getStates
  );
  return computeMotifMatrixHighlights(motif, numStates, occurrences);
}
