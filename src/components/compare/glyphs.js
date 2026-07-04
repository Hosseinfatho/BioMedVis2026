// Shared cell glyphs for the fingerprint / difference matrices.

// Fills the cell scaled by `ratio`, centered. At ratio 1 it completely fills
// the whole home (colW x rowH).
export function drawStateGlyph(ctx, cx, cy, colW, rowH, ratio, color) {
  if (ratio <= 0) return;
  const w = colW * ratio;
  const h = rowH * ratio;
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, cy - h / 2, Math.max(0.5, w), Math.max(0.5, h));
}

// Fills the cell split top/bottom: top half = source color, bottom half =
// target color. Vertical split gives each color more area in narrow columns.
export function drawTransitionGlyph(
  ctx,
  cx,
  cy,
  colW,
  rowH,
  ratio,
  fromColor,
  toColor
) {
  if (ratio <= 0) return;
  const w = colW * ratio;
  const h = rowH * ratio;
  const left = cx - w / 2;
  const ww = Math.max(0.5, w);
  const half = Math.max(0.5, h / 2);

  ctx.fillStyle = fromColor;
  ctx.fillRect(left, cy - h / 2, ww, half);

  ctx.fillStyle = toColor;
  ctx.fillRect(left, cy, ww, half);
}

// Intensity encoding: the whole cell is filled and the value (0..1) controls
// opacity. Used by the difference matrix so every "home" keeps the same
// footprint as the system matrices — empty when identical, stronger when the
// two systems differ more.
export function fillStateCell(ctx, x, y, w, h, value, color) {
  if (value <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, value);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0.5, w), h);
  ctx.restore();
}

export function fillTransitionCell(ctx, x, y, w, h, value, fromColor, toColor) {
  if (value <= 0) return;
  const ww = Math.max(0.5, w);
  const half = h / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, value);
  ctx.fillStyle = fromColor;
  ctx.fillRect(x, y, ww, half);
  ctx.fillStyle = toColor;
  ctx.fillRect(x, y + half, ww, half);
  ctx.restore();
}
