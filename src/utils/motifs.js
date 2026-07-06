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
    // Cross-trajectory steps are ordered by row index; only require
    // monotonic time when two steps fall on the same trajectory.
    if (
      steps[i].trajectoryIndex === steps[i - 1].trajectoryIndex &&
      steps[i].globalTime <= steps[i - 1].globalTime
    ) {
      return false;
    }
  }
  return true;
}

// Pick the next transition on a strictly later trajectory (row index).
function findNextChainStep(events, used, reserved, from, to, lastTraj, lastTime) {
  let best = null;

  for (let j = 0; j < events.length; j++) {
    if (used.has(j) || reserved.has(j)) continue;

    const ev = events[j];
    if (ev.from !== from || ev.to !== to) continue;
    if (ev.trajectoryIndex <= lastTraj) continue;
    if (ev.trajectoryIndex === lastTraj && ev.globalTime <= lastTime) continue;

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

// Cross-trajectory chain: each step on a strictly later trajectory (row index).
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

export function attachMatrixColumns(occurrences, matrixSlots) {
  if (!occurrences?.length) return occurrences || [];
  if (!matrixSlots?.length) return occurrences;

  const slotToCol = new Map(matrixSlots.map((slot, index) => [slot, index]));

  return occurrences.map((occ) => ({
    ...occ,
    steps: occ.steps.map((step) => {
      const slot = step.slot ?? slotKey(step.rowName);
      let col = -1;
      if (slot) {
        if (slotToCol.has(slot)) col = slotToCol.get(slot);
        else {
          const idx = matrixSlots.indexOf(slot);
          if (idx >= 0) col = idx;
        }
      }
      if (col < 0 && step.col != null && step.col >= 0 && !matrixSlots?.length) {
        col = step.col;
      }
      return { ...step, slot, col };
    }),
  }));
}

export function filterOccurrencesToRows(occurrences, rows) {
  if (!occurrences?.length || !rows?.length) return occurrences || [];

  const names = new Set(rows.map((row) => row.name));
  return occurrences.filter((occ) =>
    occ.steps.every((step) => names.has(step.rowName))
  );
}

export function alignedMotifOccurrencesForSystem(
  motif,
  rows,
  matrixSlots,
  getStates = (row) => row.states || []
) {
  if (!motif || !rows?.length) return [];
  return attachMatrixColumns(
    filterOccurrencesToRows(
      findGlobalMotifOccurrences(motif, rows, matrixSlots, getStates),
      rows
    ),
    matrixSlots
  );
}

export function motifOccurrencesForSystem(
  motif,
  rows,
  matrixSlots,
  getStates = (row) => row.states || []
) {
  return alignedMotifOccurrencesForSystem(motif, rows, matrixSlots, getStates);
}

export function motifBundlesForSystem(
  motif,
  numStates,
  rows,
  matrixSlots,
  getStates = (row) => row.states || []
) {
  if (!motif || !rows?.length) return [];

  const aligned = alignedMotifOccurrencesForSystem(
    motif,
    rows,
    matrixSlots,
    getStates
  );
  return computeMotifMatrixHighlights(
    motif,
    numStates,
    aligned,
    matrixSlots
  ).bundles;
}

export function computeMotifMatrixHighlights(motif, numStates, occurrences, matrixSlots = []) {
  if (!motif || !occurrences?.length) return { bundles: [] };

  const slotToCol = new Map(
    (matrixSlots || []).map((slot, index) => [slot, index])
  );

  const resolveCol = (step) => {
    const slot = step.slot ?? slotKey(step.rowName);
    if (slot && slotToCol.has(slot)) {
      return slotToCol.get(slot);
    }
    if (slot && matrixSlots?.length) {
      const idx = matrixSlots.indexOf(slot);
      if (idx >= 0) return idx;
    }
    if (!matrixSlots?.length && step.col != null && step.col >= 0) {
      return step.col;
    }
    return -1;
  };

  const bundles = [];

  for (let occIdx = 0; occIdx < occurrences.length; occIdx++) {
    const occ = occurrences[occIdx];
    const cells = [];

    for (let stepIdx = 0; stepIdx < occ.steps.length; stepIdx++) {
      const step = occ.steps[stepIdx];
      const row = featureRowIndexForTransition(step.from, step.to, numStates);
      const col = resolveCol(step);
      if (row < 0 || col < 0) continue;
      cells.push({ row, col, stepIdx });
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

export function motifBundlesForSystems(
  motif,
  numStates,
  systems,
  matrixSlots,
  getStates = (row) => row.states || []
) {
  if (!motif || !systems?.length) return [];

  const merged = [];
  let nextIdx = 0;

  for (const rows of systems) {
    if (!rows?.length) continue;
    const bundles = motifBundlesForSystem(
      motif,
      numStates,
      rows,
      matrixSlots,
      getStates
    );
    for (const bundle of bundles) {
      merged.push({ ...bundle, occurrenceIndex: nextIdx++ });
    }
  }

  return merged;
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
  return computeMotifMatrixHighlights(motif, numStates, occurrences, matrixSlots);
}
