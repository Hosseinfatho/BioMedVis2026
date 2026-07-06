import { useRef, useEffect, useState, useCallback } from 'react';
import { getMarkovStateColor } from '../utils/constants';
import ChartTimeShiftHandle from './ChartTimeShiftHandle';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  ROW_PX,
  drawChartGrid,
  rowY,
  drawSelectionBand,
  drawHoverCrosshair,
  rowTimeBounds,
} from '../utils/chartLayout';
import { drawDualStateRow, drawTimeShiftMarker } from '../utils/dualChartDraw';

function StateLegend({ numStates }) {
  const states = Array.from({ length: numStates }, (_, i) => i);

  return (
    <div className="state-legend">
      <div className="state-legend-title">State</div>
      {states.map((s) => (
        <div key={s} className="state-legend-item">
          <span
            className="state-swatch"
            style={{ backgroundColor: getMarkovStateColor(s) }}
          />
          {s}
        </div>
      ))}
    </div>
  );
}

export default function DualState({
  rowsA,
  rowsB,
  numStates,
  timeOffsetB = 0,
  onTimeOffsetBChange,
  selection = null,
  hoverIndex = null,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);

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

  const rowCount = Math.max(rowsA?.length || 0, rowsB?.length || 0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || rowCount === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = CHART_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CHART_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, CHART_HEIGHT);

    const { x } = drawChartGrid(ctx, width, { showYLabels: false });

    for (let i = 0; i < rowCount; i++) {
      const y = rowY(i);
      drawDualStateRow(ctx, x, y, rowsA[i], rowsB[i], ROW_PX, timeOffsetB);
    }

    drawTimeShiftMarker(ctx, x, timeOffsetB, CHART_HEIGHT);

    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(
      CHART_MARGIN.left / 2,
      CHART_MARGIN.top +
        (CHART_HEIGHT - CHART_MARGIN.top - CHART_MARGIN.bottom) / 2
    );
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Markov state', 0, 0);
    ctx.restore();

    if (selection) {
      drawSelectionBand(ctx, width, selection.start, selection.end, rowCount);
    }

    if (hoverIndex != null) {
      const row = rowsA[hoverIndex] || rowsB[hoverIndex];
      drawHoverCrosshair(
        ctx,
        width,
        hoverIndex,
        rowCount,
        rowTimeBounds(row, 'original')
      );
    }
  }, [rowsA, rowsB, width, timeOffsetB, rowCount, selection, hoverIndex]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (rowCount === 0) {
    return <div className="state-rows empty">No trajectories</div>;
  }

  return (
    <>
      <div className="dual-chart-wrap state-rows dual-chart" ref={wrapRef}>
        <canvas ref={canvasRef} />
        <ChartTimeShiftHandle
          width={width}
          timeOffset={timeOffsetB}
          onTimeOffsetChange={onTimeOffsetBChange}
        />
      </div>
      <StateLegend numStates={numStates} />
    </>
  );
}
