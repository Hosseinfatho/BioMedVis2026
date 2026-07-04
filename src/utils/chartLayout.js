export const CHART_MARGIN = { top: 12, right: 16, bottom: 36, left: 68 };
export const X_MAX = 8000;
export const X_TICK_STEP = 2000;
export const Y_MAX = 320;
export const Y_TICK_STEP = 100;
export const ROW_PX = 1;
export const PLOT_H = Y_MAX * ROW_PX;
export const CHART_HEIGHT = PLOT_H + CHART_MARGIN.top + CHART_MARGIN.bottom;

export function drawChartGrid(ctx, width, { showYLabels = true, yLabel } = {}) {
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

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let t = X_TICK_STEP; t <= X_MAX; t += X_TICK_STEP) {
    ctx.fillText(t.toString(), x(t), yTop + plotH + 5);
  }
  ctx.fillText('Time (frames)', M.left + plotW / 2, CHART_HEIGHT - 13);

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
