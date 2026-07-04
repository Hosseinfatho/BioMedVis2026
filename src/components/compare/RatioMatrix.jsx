import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getMarkovStateColor } from '../../utils/constants';
import { buildFeatureRows } from '../../utils/computeTransitionFeatures';
import {
  drawStateGlyph,
  drawTransitionGlyph,
  fillStateCell,
  fillTransitionCell,
} from './glyphs';
import { LABEL_W, TOP_PAD, RIGHT_PAD, ROW_H } from './layout';

// Generic matrix renderer. `columns` is an array where each column carries a
// value (0..1) per feature:
//   { stateVals: number[], transitionVals: { 'a->b': number } }
// The same renderer draws both the absolute per-system matrices and the
// difference matrix, so their homes line up column-for-column.
//
// mode:
//   'size'      — glyph is scaled by the value (used for the system matrices)
//   'intensity' — the whole cell is filled and the value drives opacity (used
//                 for the difference matrix so cells keep a full footprint)
export default function RatioMatrix({ columns, numStates, mode = 'intensity' }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(1000);

  const featureRows = useMemo(() => buildFeatureRows(numStates), [numStates]);

  const numCols = columns.length;
  const colW = numCols > 0 ? (width - LABEL_W - RIGHT_PAD) / numCols : 0;
  const height = featureRows.length * ROW_H + TOP_PAD * 2;

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
    if (!canvas || !numCols || colW <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const plotW = numCols * colW;

    featureRows.forEach((feature, r) => {
      const yTop = TOP_PAD + r * ROW_H;
      const cy = yTop + ROW_H / 2;

      ctx.fillStyle = '#333';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(feature.label, LABEL_W - 6, cy);

      for (let c = 0; c < numCols; c++) {
        const col = columns[c];
        const cx = LABEL_W + (c + 0.5) * colW;
        const cellX = LABEL_W + c * colW;

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
            fillTransitionCell(ctx, cellX, yTop, colW, ROW_H, v, fromColor, toColor);
          } else {
            drawTransitionGlyph(ctx, cx, cy, colW, ROW_H, v, fromColor, toColor);
          }
        }
      }
    });

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let r = 0; r <= featureRows.length; r++) {
      const y = TOP_PAD + r * ROW_H;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(LABEL_W + plotW, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(LABEL_W, TOP_PAD);
    ctx.lineTo(LABEL_W, TOP_PAD + featureRows.length * ROW_H);
    ctx.stroke();
  }, [numCols, colW, width, height, columns, featureRows, mode]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!numCols) return null;

  return (
    <div className="fingerprint-matrix" ref={wrapRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
