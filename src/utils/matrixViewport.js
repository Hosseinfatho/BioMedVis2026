export const MIN_VISIBLE_COLS = 5;

export function clampView(viewStart, viewCount, totalCols) {
  if (totalCols <= 0) return { viewStart: 0, viewCount: 0 };

  const count = Math.max(
    MIN_VISIBLE_COLS,
    Math.min(totalCols, Math.round(viewCount))
  );
  const maxStart = Math.max(0, totalCols - count);
  const start = Math.max(0, Math.min(maxStart, Math.round(viewStart)));

  return { viewStart: start, viewCount: count };
}

export function fullView(totalCols) {
  return clampView(0, totalCols, totalCols);
}

// Scroll up (deltaIn < 0) zooms in; scroll down zooms out. Anchor stays under cursor.
export function zoomView(viewStart, viewCount, totalCols, anchorCol, deltaIn) {
  if (totalCols <= 0) return { viewStart: 0, viewCount: 0 };

  const factor = deltaIn < 0 ? 0.8 : 1.25;
  let newCount = Math.round(viewCount * factor);
  newCount = Math.max(MIN_VISIBLE_COLS, Math.min(totalCols, newCount));

  const rel = viewCount > 0 ? (anchorCol - viewStart) / viewCount : 0.5;
  let newStart = Math.round(anchorCol - rel * newCount);

  return clampView(newStart, newCount, totalCols);
}

export function panView(viewStart, viewCount, totalCols, deltaCols) {
  return clampView(viewStart + deltaCols, viewCount, totalCols);
}

export function columnLabelStep(visibleCount) {
  if (visibleCount <= 15) return 1;
  if (visibleCount <= 40) return 5;
  return 10;
}

export function shouldDrawColumnLabel(globalIndex, viewStart, visibleCount, step) {
  const local = globalIndex - viewStart;
  if (local < 0 || local >= visibleCount) return false;
  if (local === 0 || local === visibleCount - 1) return true;
  return globalIndex % step === 0;
}

export function visibleSelection(selection, viewStart, viewCount) {
  if (!selection || viewCount <= 0) return null;

  const viewEnd = viewStart + viewCount - 1;
  const start = Math.max(selection.start, viewStart);
  const end = Math.min(selection.end, viewEnd);
  if (start > end) return null;

  return {
    globalStart: start,
    globalEnd: end,
    localStart: start - viewStart,
    localEnd: end - viewStart,
  };
}

// Rate matrix aggregates trajectories inside the zoom viewport, optionally
// narrowed further by the brush selection.
export function rateAggregationWindow(viewStart, viewCount, selection, totalCols) {
  if (totalCols <= 0 || viewCount <= 0) {
    return { start: 0, end: 0 };
  }

  const viewEnd = Math.min(totalCols - 1, viewStart + viewCount - 1);

  if (!selection) {
    return { start: viewStart, end: viewEnd };
  }

  const start = Math.max(viewStart, selection.start);
  const end = Math.min(viewEnd, selection.end);
  if (start > end) {
    return { start: viewStart, end: viewEnd };
  }

  return { start, end };
}
