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
