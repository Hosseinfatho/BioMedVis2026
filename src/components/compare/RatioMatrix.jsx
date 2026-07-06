import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getMarkovStateColor } from '../../utils/constants';
import { buildFeatureRows } from '../../utils/computeTransitionFeatures';
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

export default function RatioMatrix({
  columns,
  numStates,
  mode = 'intensity',
  highlightCells = [],
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

    highlightCells.forEach(({ row, col }) => {
      if (row < 0 || row >= featureRows.length || col < viewStart) return;
      const localC = col - viewStart;
      if (localC >= visibleCount) return;

      const x = LABEL_W + localC * colW;
      const yTop = bodyTop + row * ROW_H;
      ctx.save();
      ctx.strokeStyle = '#e65100';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, yTop + 0.5, colW - 1, ROW_H - 1);
      ctx.restore();
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
    highlightCells,
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
