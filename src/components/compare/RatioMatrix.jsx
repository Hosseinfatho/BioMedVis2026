import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getMarkovStateColor } from '../../utils/constants';
import { buildFeatureRows } from '../../utils/computeTransitionFeatures';
import { MOTIF_BUNDLE_COLORS } from '../../utils/motifs';
import {
  columnLabelStep,
  shouldDrawColumnLabel,
} from '../../utils/matrixViewport';
import {
  drawStateGlyph,
  drawTransitionGlyph,
  fillStateCell,
  fillTransitionCell,
} from './glyphs';
import { LABEL_W, COL_HEADER_H, TOP_PAD, RIGHT_PAD, ROW_H } from './layout';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cellCenter(localC, row, colW, bodyTop) {
  return {
    x: LABEL_W + (localC + 0.5) * colW,
    y: bodyTop + row * ROW_H + ROW_H / 2,
  };
}

// Filled Sankey-style ribbon between two matrix nodes.
function drawSankeyRibbon(ctx, x0, y0, x1, y1, thickness, color) {
  const mx = (x0 + x1) / 2;
  const half = thickness / 2;

  ctx.fillStyle = hexToRgba(color, 0.42);
  ctx.beginPath();
  ctx.moveTo(x0, y0 - half);
  ctx.bezierCurveTo(mx, y0 - half, mx, y1 - half, x1, y1 - half);
  ctx.lineTo(x1, y1 + half);
  ctx.bezierCurveTo(mx, y1 + half, mx, y0 + half, x0, y0 + half);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, 0.85);
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function drawMotifBundlesOnMatrix(
  ctx,
  bundles,
  { viewStart, visibleCount, colW, bodyTop }
) {
  if (!bundles?.length || colW <= 0) return;

  const ribbonW = Math.max(4, Math.min(colW * 0.72, ROW_H * 1.1));

  for (const bundle of bundles) {
    const color =
      MOTIF_BUNDLE_COLORS[bundle.occurrenceIndex % MOTIF_BUNDLE_COLORS.length];
    const pathPoints = [];

    for (const node of bundle.path) {
      const localC = node.col - viewStart;
      if (localC < 0 || localC >= visibleCount) continue;
      pathPoints.push({ ...cellCenter(localC, node.row, colW, bodyTop), node, localC });
    }

    const allVisible = bundle.cells.every((cell) => {
      const localC = cell.col - viewStart;
      return localC >= 0 && localC < visibleCount;
    });
    if (!allVisible || pathPoints.length < 2) continue;

    // Ribbons flow transition → transition; first segment starts at step 1 (e.g. 0→1).
    for (let i = 1; i < pathPoints.length; i++) {
      const a = pathPoints[i - 1];
      const b = pathPoints[i];
      drawSankeyRibbon(ctx, a.x, a.y, b.x, b.y, ribbonW, color);
    }

    const transPoints = [];
    for (const cell of bundle.cells) {
      const localC = cell.col - viewStart;
      if (localC < 0 || localC >= visibleCount) continue;

      const { x, y } = cellCenter(localC, cell.row, colW, bodyTop);
      const x0 = LABEL_W + localC * colW;
      const yTop = bodyTop + cell.row * ROW_H;
      transPoints.push({ x, y, localC, cell });

      ctx.save();
      ctx.fillStyle = hexToRgba(color, 0.5);
      ctx.fillRect(x0 + 1, yTop + 1, colW - 2, ROW_H - 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 0.5, yTop + 0.5, colW - 1, ROW_H - 1);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.stepIdx + 1), x, y);
      ctx.restore();
    }

    for (const p of transPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

export default function RatioMatrix({
  columns,
  numStates,
  mode = 'intensity',
  motifBundles = [],
  viewStart = 0,
  viewCount,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(1000);

  const featureRows = useMemo(() => buildFeatureRows(numStates), [numStates]);
  const totalCols = columns.length;
  const visibleCount = viewCount ?? totalCols;
  const colW =
    visibleCount > 0 ? (width - LABEL_W - RIGHT_PAD) / visibleCount : 0;
  const bodyTop = COL_HEADER_H + TOP_PAD;
  const height = COL_HEADER_H + TOP_PAD * 2 + featureRows.length * ROW_H;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !totalCols || visibleCount <= 0 || colW <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plotW = visibleCount * colW;
    const labelStep = columnLabelStep(visibleCount);

    ctx.fillStyle = '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let localC = 0; localC < visibleCount; localC++) {
      const globalC = viewStart + localC;
      if (globalC >= totalCols) break;
      if (!shouldDrawColumnLabel(globalC, viewStart, visibleCount, labelStep)) {
        continue;
      }
      const cx = LABEL_W + (localC + 0.5) * colW;
      ctx.fillText(String(globalC + 1), cx, COL_HEADER_H / 2);
    }

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL_W, COL_HEADER_H);
    ctx.lineTo(LABEL_W + plotW, COL_HEADER_H);
    ctx.stroke();

    featureRows.forEach((feature, r) => {
      const yTop = bodyTop + r * ROW_H;
      const cy = yTop + ROW_H / 2;

      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(feature.label, LABEL_W - 6, cy);

      for (let localC = 0; localC < visibleCount; localC++) {
        const globalC = viewStart + localC;
        if (globalC >= totalCols) break;

        const col = columns[globalC];
        const cx = LABEL_W + (localC + 0.5) * colW;
        const cellX = LABEL_W + localC * colW;

        if (feature.type === 'state') {
          const v = col.stateVals[feature.state] || 0;
          const color = getMarkovStateColor(feature.state);
          if (mode === 'intensity') {
            fillStateCell(ctx, cellX, yTop, colW, ROW_H, v, color);
          } else {
            drawStateGlyph(ctx, cx, cy, colW, ROW_H, v, color);
          }
        } else {
          const key = `${feature.from}->${feature.to}`;
          const v = col.transitionVals[key] || 0;
          const fromColor = getMarkovStateColor(feature.from);
          const toColor = getMarkovStateColor(feature.to);
          if (mode === 'intensity') {
            fillTransitionCell(
              ctx,
              cellX,
              yTop,
              colW,
              ROW_H,
              v,
              fromColor,
              toColor
            );
          } else {
            drawTransitionGlyph(
              ctx,
              cx,
              cy,
              colW,
              ROW_H,
              v,
              fromColor,
              toColor
            );
          }
        }
      }
    });

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let r = 0; r <= featureRows.length; r++) {
      const y = bodyTop + r * ROW_H;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(LABEL_W + plotW, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(LABEL_W, bodyTop);
    ctx.lineTo(LABEL_W, bodyTop + featureRows.length * ROW_H);
    ctx.stroke();

    drawMotifBundlesOnMatrix(ctx, motifBundles, {
      viewStart,
      visibleCount,
      colW,
      bodyTop,
    });
  }, [
    totalCols,
    visibleCount,
    colW,
    width,
    height,
    columns,
    featureRows,
    mode,
    motifBundles,
    viewStart,
    bodyTop,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!totalCols) return null;

  return (
    <div className="fingerprint-matrix" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
