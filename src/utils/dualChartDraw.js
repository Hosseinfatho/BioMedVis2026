import { getEpochColor, getMarkovStateColor } from './constants';
import { CHART_MARGIN, X_MAX } from './chartLayout';

const OVERLAP_MISMATCH_GRAY = '#b0b8c0';

export function stateAtTime(row, globalTime) {
  if (!row?.states?.length) return null;
  const frame = Math.floor(globalTime - (row.startTime ?? 0));
  if (frame < 0 || frame >= row.states.length) return null;
  return row.states[frame];
}

function rowSpan(row, timeOffset = 0) {
  if (!row) return null;
  const start = (row.startTime ?? 0) + timeOffset;
  const len = row.length ?? row.states?.length ?? 0;
  return { start, end: start + len };
}

function fillTimeSpan(ctx, x, y, rowPx, t0, t1, color) {
  if (t1 <= t0) return;
  const x0 = x(Math.min(t0, X_MAX));
  const x1 = x(Math.min(t1, X_MAX));
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, rowPx));
}

export function drawColorEpochBar(ctx, x, y, row, rowPx, timeOffset = 0) {
  if (!row) return;
  const span = rowSpan(row, timeOffset);
  if (!span) return;
  fillTimeSpan(ctx, x, y, rowPx, span.start, span.end, getEpochColor(row.epoch));
}

// Draw each epoch bar as a rigid segment (B shifted), then paint the overlap zone only.
export function drawDualEpochRow(ctx, x, y, rowA, rowB, rowPx, offsetB = 0) {
  if (rowA) {
    drawColorEpochBar(ctx, x, y, rowA, rowPx, 0);
  }
  if (rowB) {
    drawColorEpochBar(ctx, x, y, rowB, rowPx, offsetB);
  }

  if (!rowA || !rowB) return;

  const spanA = rowSpan(rowA, 0);
  const spanB = rowSpan(rowB, offsetB);
  if (!spanA || !spanB) return;

  const overlapStart = Math.max(spanA.start, spanB.start);
  const overlapEnd = Math.min(spanA.end, spanB.end);
  if (overlapEnd <= overlapStart) return;

  const overlapColor =
    rowA.epoch === rowB.epoch
      ? getEpochColor(rowA.epoch)
      : OVERLAP_MISMATCH_GRAY;
  fillTimeSpan(ctx, x, y, rowPx, overlapStart, overlapEnd, overlapColor);
}

export function drawDualStateRow(ctx, x, y, rowA, rowB, rowPx, offsetB = 0) {
  if (!rowA && !rowB) return;
  if (!rowA) {
    drawColorStateRuns(ctx, x, y, rowB, rowPx, offsetB);
    return;
  }
  if (!rowB) {
    drawColorStateRuns(ctx, x, y, rowA, rowPx, 0);
    return;
  }

  let runStart = null;
  let runColor = null;

  const flush = (t) => {
    if (runStart == null || runColor == null) return;
    fillTimeSpan(ctx, x, y, rowPx, runStart, t, runColor);
    runStart = null;
    runColor = null;
  };

  for (let t = 0; t <= X_MAX; t++) {
    const sa = stateAtTime(rowA, t);
    const sb = stateAtTime(rowB, t - offsetB);

    let color = null;
    if (sa != null && sb != null) {
      color = sa === sb ? getMarkovStateColor(sa) : OVERLAP_MISMATCH_GRAY;
    } else if (sa != null) {
      color = getMarkovStateColor(sa);
    } else if (sb != null) {
      color = getMarkovStateColor(sb);
    }

    if (color == null) {
      flush(t);
      continue;
    }

    if (runColor === color) continue;
    flush(t);
    runStart = t;
    runColor = color;
  }
  flush(X_MAX + 1);
}

function drawColorStateRuns(ctx, x, y, row, rowPx, timeOffset = 0) {
  if (!row?.states?.length) return;

  let runStart = 0;
  const base = (row.startTime ?? 0) + timeOffset;
  const states = row.states;

  for (let j = 1; j <= states.length; j++) {
    if (j === states.length || states[j] !== states[runStart]) {
      fillTimeSpan(
        ctx,
        x,
        y,
        rowPx,
        base + runStart,
        base + j,
        getMarkovStateColor(states[runStart])
      );
      runStart = j;
    }
  }
}

export function framesPerPixel(width) {
  const plotW = width - CHART_MARGIN.left - CHART_MARGIN.right;
  if (plotW <= 0) return 1;
  return X_MAX / plotW;
}

export function drawTimeShiftMarker(ctx, x, timeOffset, chartHeight) {
  const px = x(Math.min(Math.max(timeOffset, 0), X_MAX));
  const y0 = CHART_MARGIN.top;
  const y1 = chartHeight - CHART_MARGIN.bottom;

  ctx.save();
  ctx.strokeStyle = 'rgba(230, 81, 0, 0.85)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(px, y0);
  ctx.lineTo(px, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
