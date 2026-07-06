import { useRef, useEffect, useState, useCallback } from 'react';
import { getEpochColor, EPOCH_COLORS } from '../utils/constants';
import ChartTimeShiftHandle from './ChartTimeShiftHandle';
import {
  CHART_HEIGHT,
  ROW_PX,
  drawChartGrid,
  rowY,
  drawSelectionBand,
  drawHoverCrosshair,
  rowTimeBounds,
} from '../utils/chartLayout';
import { drawDualEpochRow, drawTimeShiftMarker } from '../utils/dualChartDraw';

function EpochLegend() {
  const epochs = Object.keys(EPOCH_COLORS)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="epoch-legend">
      <div className="epoch-legend-title">Epoch</div>
      {epochs.map((e) => (
        <div key={e} className="epoch-legend-item">
          <span
            className="epoch-swatch"
            style={{ backgroundColor: getEpochColor(e) }}
          />
          {e}
        </div>
      ))}
    </div>
  );
}

export default function DualTrajectoryRows({
  rowsA,
  rowsB,
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

    const { x } = drawChartGrid(ctx, width, {
      showYLabels: true,
      yLabel: 'Trajectories (B shifted in time)',
    });

    for (let i = 0; i < rowCount; i++) {
      const y = rowY(i);
      drawDualEpochRow(ctx, x, y, rowsA[i], rowsB[i], ROW_PX, timeOffsetB);
    }

    drawTimeShiftMarker(ctx, x, timeOffsetB, CHART_HEIGHT);

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
    return <div className="trajectory-rows empty">No trajectories</div>;
  }

  return (
    <>
      <div className="dual-chart-wrap trajectory-rows dual-chart" ref={wrapRef}>
        <canvas ref={canvasRef} />
        <ChartTimeShiftHandle
          width={width}
          timeOffset={timeOffsetB}
          onTimeOffsetChange={onTimeOffsetBChange}
        />
      </div>
      <EpochLegend />
    </>
  );
}
