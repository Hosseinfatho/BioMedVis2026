import { slotKey } from './slotKey';
import { MOTIF_BUNDLE_COLORS } from './motifs';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const CHART_MARGIN = { top: 8, right: 16, bottom: 28, left: 68 };
export const X_MAX = 8000;
export const X_TICK_STEP = 2000;
export const Y_MAX = 320;
export const Y_TICK_STEP = 100;
export const ROW_PX = 1;
export const PLOT_H = Y_MAX * ROW_PX;
export const CHART_HEIGHT = PLOT_H + CHART_MARGIN.top + CHART_MARGIN.bottom;

export function drawChartGrid(ctx, width, { showYLabels = true, yLabel, showXAxis = true } = {}) {
  const M = CHART_MARGIN;
  const plotW = width - M.left - M.right;
  const plotH = PLOT_H;
  const yTop = M.top;
  const x = (t) => M.left + (t / X_MAX) * plotW;

  ctx.strokeStyle = '#eee';
  ctx.lineWidth = 1;

  for (let t = X_TICK_STEP; t <= X_MAX; t += X_TICK_STEP) {
    const px = x(t);
    ctx.beginPath();
    ctx.moveTo(px, yTop);
    ctx.lineTo(px, yTop + plotH);
    ctx.stroke();
  }

  for (let rank = Y_TICK_STEP; rank <= Y_MAX; rank += Y_TICK_STEP) {
    const py = yTop + plotH - (rank / Y_MAX) * plotH;
    ctx.beginPath();
    ctx.moveTo(M.left, py);
    ctx.lineTo(M.left + plotW, py);
    ctx.stroke();
  }

  ctx.strokeStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(M.left, yTop);
  ctx.lineTo(M.left, yTop + plotH);
  ctx.lineTo(M.left + plotW, yTop + plotH);
  ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.font = '10px sans-serif';

  if (showXAxis) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let t = X_TICK_STEP; t <= X_MAX; t += X_TICK_STEP) {
      ctx.fillText(t.toString(), x(t), yTop + plotH + 5);
    }
    ctx.fillText('Time (frames)', M.left + plotW / 2, CHART_HEIGHT - 13);
  }

  if (showYLabels) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTickValues = [];
    for (let rank = 0; rank < Y_MAX; rank += Y_TICK_STEP) {
      yTickValues.push(rank);
    }
    yTickValues.push(Y_MAX);
    for (const rank of yTickValues) {
      const py = yTop + plotH - (rank / Y_MAX) * plotH;
      ctx.fillText(rank.toString(), M.left - 7, py);
    }

    ctx.save();
    ctx.translate(13, yTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      yLabel || 'Aligned trajectories (sorted in time)',
      0,
      0
    );
    ctx.restore();
  }

  return { plotW, plotH, yTop, x };
}

export function rowY(index) {
  return CHART_MARGIN.top + PLOT_H - (index + 1) * ROW_PX;
}

// Time extent [t0, t1] of a single trajectory row, used to place the vertical
// arms of the hover crosshair around the trajectory's bar.
export function rowTimeBounds(row, viewMode) {
  if (!row) return null;
  if (viewMode === 'concatenated') {
    const segs = row.segments || [];
    if (!segs.length) return null;
    let t0 = Infinity;
    let t1 = -Infinity;
    for (const s of segs) {
      const len = s.length ?? (s.states ? s.states.length : 0);
      t0 = Math.min(t0, s.concatStart);
      t1 = Math.max(t1, s.concatStart + len);
    }
    return { t0, t1 };
  }
  const len = row.length ?? (row.states ? row.states.length : 0);
  return { t0: row.startTime, t1: row.startTime + len };
}

// Draws a "target" crosshair for the hovered trajectory: one horizontal line at
// the trajectory's row plus two vertical lines bounding its time span (or the
// full plot width when no bounds are given). Forms a big plus centred on the row.
export function drawHoverCrosshair(ctx, width, index, count, bounds) {
  if (index == null || index < 0 || index >= count) return;
  const M = CHART_MARGIN;
  const plotW = width - M.left - M.right;
  const yTop = M.top;
  const plotH = PLOT_H;
  const y = rowY(index) + ROW_PX / 2;
  const x = (t) => M.left + (Math.min(t, X_MAX) / X_MAX) * plotW;

  let x0 = M.left;
  let x1 = M.left + plotW;
  if (bounds && bounds.t0 != null && bounds.t1 != null) {
    x0 = x(bounds.t0);
    x1 = x(bounds.t1);
  }

  ctx.save();
  ctx.strokeStyle = '#d62728';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(M.left, y + 0.5);
  ctx.lineTo(M.left + plotW, y + 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(Math.round(x0) + 0.5, yTop);
  ctx.lineTo(Math.round(x0) + 0.5, yTop + plotH);
  ctx.moveTo(Math.round(x1) + 0.5, yTop);
  ctx.lineTo(Math.round(x1) + 0.5, yTop + plotH);
  ctx.stroke();
  ctx.restore();
}

// Draws the selection window as two parallel horizontal lines (the range
// boundaries) plus a light band, matching a brush selected on the matrices.
// `startIdx`/`endIdx` are inclusive trajectory-row indices; `count` is the
// number of rows actually drawn (used to clamp).
export function drawSelectionBand(ctx, width, startIdx, endIdx, count) {
  if (startIdx == null || endIdx == null || !count) return;
  const M = CHART_MARGIN;
  const plotW = width - M.left - M.right;
  const a = Math.max(0, Math.min(startIdx, count - 1));
  const b = Math.max(0, Math.min(endIdx, count - 1));
  const yBottom = rowY(a); // lower index sits lower on screen (larger y)
  const yTop = rowY(b + 1);

  ctx.save();
  ctx.fillStyle = 'rgba(30, 60, 120, 0.08)';
  ctx.fillRect(M.left, yTop, plotW, yBottom - yTop);
  ctx.strokeStyle = '#1e3c78';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M.left, yBottom + 0.5);
  ctx.lineTo(M.left + plotW, yBottom + 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(M.left, yTop + 0.5);
  ctx.lineTo(M.left + plotW, yTop + 0.5);
  ctx.stroke();
  ctx.restore();
}

function latestTrajectoryForSlot(originalRows, slot) {
  if (!originalRows?.length || !slot) return null;
  let best = null;
  for (const row of originalRows) {
    if (slotKey(row.name) !== slot) continue;
    if (!best || row.startTime > best.startTime) best = row;
  }
  return best;
}

function latestTrajectoryInSlotRange(originalRows, matrixSlots, startCol, endCol) {
  if (!originalRows?.length || !matrixSlots?.length) return null;
  const a = Math.max(0, startCol);
  const b = Math.min(matrixSlots.length - 1, endCol);
  let best = null;
  for (let c = a; c <= b; c++) {
    const traj = latestTrajectoryForSlot(originalRows, matrixSlots[c]);
    if (traj && (!best || traj.startTime > best.startTime)) best = traj;
  }
  return best;
}

function findPathSegmentForTrajectory(concatRows, trajectoryName) {
  if (!concatRows?.length || !trajectoryName) return null;
  for (let i = 0; i < concatRows.length; i++) {
    for (const seg of concatRows[i].segments || []) {
      if (seg.name === trajectoryName) return { pathIndex: i, segment: seg };
    }
  }
  return null;
}

// In concatenated view, map matrix columns to a single path row: the path that
// contains the latest-in-time original trajectory for the slot (or brush range).
export function drawConcatenatedSelectionBand(
  ctx,
  width,
  concatRows,
  originalRows,
  matrixSlots,
  startCol,
  endCol
) {
  const traj = latestTrajectoryInSlotRange(
    originalRows,
    matrixSlots,
    startCol,
    endCol
  );
  if (!traj) return;
  const hit = findPathSegmentForTrajectory(concatRows, traj.name);
  if (!hit) return;
  drawSelectionBand(ctx, width, hit.pathIndex, hit.pathIndex, concatRows.length);
}

export function drawConcatenatedHoverCrosshair(
  ctx,
  width,
  concatRows,
  originalRows,
  matrixSlots,
  hoverCol
) {
  const slot = matrixSlots?.[hoverCol];
  const traj = latestTrajectoryForSlot(originalRows, slot);
  if (!traj) return;
  const hit = findPathSegmentForTrajectory(concatRows, traj.name);
  if (!hit) return;
  const len =
    hit.segment.length ??
    (hit.segment.states ? hit.segment.states.length : 0);
  drawHoverCrosshair(ctx, width, hit.pathIndex, concatRows.length, {
    t0: hit.segment.concatStart,
    t1: hit.segment.concatStart + len,
  });
}

export function makeChartXScale(width) {
  const M = CHART_MARGIN;
  const plotW = width - M.left - M.right;
  return (t) => M.left + (t / X_MAX) * plotW;
}

function buildMotifOccurrencePoints(occ, rows, x, getRowY, rowPx, resolveStep, rowByName) {
  const points = [];

  for (let stepIdx = 0; stepIdx < occ.steps.length; stepIdx++) {
    const step = occ.steps[stepIdx];
    let rowIdx;
    let bandCenter;

    if (resolveStep) {
      const pos = resolveStep(step);
      if (!pos) return null;
      rowIdx = pos.rowIdx;
      bandCenter = pos.time;
    } else {
      rowIdx = rowByName.get(step.rowName);
      if (rowIdx === undefined) return null;
      bandCenter = step.globalTime;
    }

    const y = getRowY(rowIdx);
    const bandLeft = bandCenter - 1;
    const bandRight = bandCenter + 1;
    const x0 = x(Math.min(bandLeft, X_MAX));
    const x1 = x(Math.min(bandRight, X_MAX));
    const midT = bandCenter - 0.5;
    points.push({
      x0,
      x1,
      y,
      px: x(Math.min(midT, X_MAX)),
      py: y + rowPx / 2,
      stepIdx,
      step,
    });
  }

  return points;
}

function isValidMotifOccurrenceChain(steps) {
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const cur = steps[i];
    if (cur.trajectoryIndex <= prev.trajectoryIndex) return false;
    if (
      cur.trajectoryIndex === prev.trajectoryIndex &&
      cur.globalTime <= prev.globalTime
    ) {
      return false;
    }
  }
  return true;
}

export function hitTestMotifBundles(
  mx,
  my,
  occurrences,
  x,
  getRowY,
  rowPx = ROW_PX,
  resolveStep = null,
  rows = []
) {
  if (!occurrences?.length) return null;

  const rowByName = resolveStep ? null : new Map(rows.map((r, i) => [r.name, i]));
  const pad = 6;
  const hitR = 9;

  for (let occIdx = occurrences.length - 1; occIdx >= 0; occIdx--) {
    const occ = occurrences[occIdx];
    if (!isValidMotifOccurrenceChain(occ.steps)) continue;

    const points = buildMotifOccurrencePoints(
      occ,
      rows,
      x,
      getRowY,
      rowPx,
      resolveStep,
      rowByName
    );
    if (!points || points.length !== occ.steps.length) continue;

    for (const p of points) {
      const w = Math.max(2, p.x1 - p.x0);
      if (
        mx >= p.x0 - pad &&
        mx <= p.x0 + w + pad &&
        my >= p.y - 2 - pad &&
        my <= p.y + rowPx + 4 + pad
      ) {
        return occIdx;
      }
      const dx = mx - p.px;
      const dy = my - p.py;
      if (dx * dx + dy * dy <= hitR * hitR) return occIdx;
    }
  }

  return null;
}

function drawOneMotifBundle(ctx, points, color, rowPx, { hovered = false, dimmed = false } = {}) {
  const fillAlpha = hovered ? 0.88 : dimmed ? 0.14 : 0.55;
  const strokeW = hovered ? 3.5 : dimmed ? 1 : 2.5;
  const connectorW = hovered ? 4.5 : dimmed ? 1.5 : 3;
  const dotR = (isEnd, isStart) => {
    if (hovered) return isEnd || isStart ? 6.5 : 5.5;
    if (dimmed) return isEnd || isStart ? 3 : 2.5;
    return isEnd || isStart ? 5 : 4;
  };

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.22;
  else if (hovered) ctx.globalAlpha = 1;

  if (points.length >= 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = connectorW;
    ctx.setLineDash(hovered ? [] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(points[0].px, points[0].py);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].px, points[i].py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of points) {
    const w = Math.max(2, p.x1 - p.x0);
    const isStart = p.stepIdx === 0;
    const isEnd = p.stepIdx === points.length - 1;
    const edgeW = hovered && (isEnd || isStart) ? 3.5 : isEnd || isStart ? strokeW : strokeW - 0.5;

    ctx.fillStyle = hexToRgba(color, fillAlpha);
    ctx.fillRect(p.x0, p.y - 2, w, rowPx + 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = edgeW;
    ctx.strokeRect(p.x0 + 0.5, p.y - 1.5, w - 1, rowPx + 3);

    ctx.fillStyle = color;
    ctx.font = hovered ? 'bold 10px sans-serif' : 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(String(p.stepIdx + 1), p.px, p.y - 3);
    ctx.beginPath();
    ctx.arc(p.px, p.py, dotR(isEnd, isStart), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function findConcatPositionForStep(concatRows, step) {
  if (!concatRows?.length || !step?.rowName) return null;
  const frame = step.frame;
  if (frame == null) return null;

  for (let pathIndex = 0; pathIndex < concatRows.length; pathIndex++) {
    for (const seg of concatRows[pathIndex].segments || []) {
      if (seg.name !== step.rowName) continue;
      const end = seg.frameEnd ?? seg.concatEnd;
      if (frame > seg.frameStart && frame <= end) {
        return {
          rowIdx: pathIndex,
          time: seg.concatStart + (frame - seg.frameStart),
        };
      }
    }
  }
  return null;
}

export function makeConcatStepResolver(concatRows) {
  return (step) => findConcatPositionForStep(concatRows, step);
}

// Draw each complete motif as one bundle: connector in motif order + step bands.
export function drawAllMotifBundles(
  ctx,
  x,
  rows,
  occurrences,
  getRowY,
  rowPx = ROW_PX,
  resolveStep = null,
  hoveredOccIdx = null
) {
  if (!occurrences?.length || !rows?.length) return;

  const rowByName = resolveStep ? null : new Map(rows.map((r, i) => [r.name, i]));
  const bundleColors = MOTIF_BUNDLE_COLORS;
  const dimOthers = hoveredOccIdx != null;

  const drawOrder = occurrences.map((_, i) => i);
  if (hoveredOccIdx != null) {
    drawOrder.sort((a, b) => {
      if (a === hoveredOccIdx) return 1;
      if (b === hoveredOccIdx) return -1;
      return a - b;
    });
  }

  for (const occIdx of drawOrder) {
    const occ = occurrences[occIdx];
    if (!isValidMotifOccurrenceChain(occ.steps)) continue;

    const points = buildMotifOccurrencePoints(
      occ,
      rows,
      x,
      getRowY,
      rowPx,
      resolveStep,
      rowByName
    );
    if (!points || points.length !== occ.steps.length) continue;

    const color = bundleColors[occIdx % bundleColors.length];
    const hovered = occIdx === hoveredOccIdx;
    const dimmed = dimOthers && !hovered;
    drawOneMotifBundle(ctx, points, color, rowPx, { hovered, dimmed });
  }
}
