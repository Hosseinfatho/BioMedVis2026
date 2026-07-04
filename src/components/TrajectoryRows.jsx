import { useRef, useEffect, useState, useCallback } from 'react';
import { getEpochColor, EPOCH_COLORS } from '../utils/constants';
import {
  CHART_HEIGHT,
  ROW_PX,
  drawChartGrid,
  rowY,
  drawSelectionBand,
  drawHoverCrosshair,
  drawConcatenatedSelectionBand,
  drawConcatenatedHoverCrosshair,
  rowTimeBounds,
} from '../utils/chartLayout';

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
            style={{ backgroundColor: EPOCH_COLORS[e] }}
          />
          {e}
        </div>
      ))}
    </div>
  );
}

function drawOriginalEpoch(ctx, x, trajectories) {
  trajectories.forEach((tr, i) => {
    const x0 = x(tr.startTime);
    const x1 = x(tr.startTime + tr.length);
    const y = rowY(i);
    ctx.fillStyle = getEpochColor(tr.epoch);
    ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, ROW_PX));
  });
}

function drawConcatenatedEpoch(ctx, x, paths) {
  paths.forEach((path, i) => {
    const y = rowY(i);
    path.segments.forEach((seg) => {
      const x0 = x(seg.concatStart);
      const x1 = x(seg.concatStart + seg.length);
      ctx.fillStyle = getEpochColor(seg.epoch);
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, ROW_PX));
    });
  });
}

export default function TrajectoryRows({
  rows,
  viewMode = 'original',
  originalRows = null,
  selection = null,
  hoverIndex = null,
  matrixSlots = [],
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rows.length) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = CHART_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${CHART_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, CHART_HEIGHT);

    const yLabel =
      viewMode === 'concatenated'
        ? 'Concatenated paths'
        : 'Aligned trajectories (sorted in time)';

    const { x } = drawChartGrid(ctx, width, { showYLabels: true, yLabel });

    if (viewMode === 'concatenated') {
      drawConcatenatedEpoch(ctx, x, rows);
    } else {
      drawOriginalEpoch(ctx, x, rows);
    }

    if (selection) {
      if (viewMode === 'concatenated' && originalRows) {
        drawConcatenatedSelectionBand(
          ctx,
          width,
          rows,
          originalRows,
          matrixSlots,
          selection.start,
          selection.end
        );
      } else {
        drawSelectionBand(ctx, width, selection.start, selection.end, rows.length);
      }
    }

    if (hoverIndex != null) {
      if (viewMode === 'concatenated' && originalRows) {
        drawConcatenatedHoverCrosshair(
          ctx,
          width,
          rows,
          originalRows,
          matrixSlots,
          hoverIndex
        );
      } else {
        drawHoverCrosshair(
          ctx,
          width,
          hoverIndex,
          rows.length,
          rowTimeBounds(rows[hoverIndex], viewMode)
        );
      }
    }
  }, [rows, width, viewMode, originalRows, selection, hoverIndex, matrixSlots]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!rows.length) {
    return <div className="trajectory-rows empty">No trajectories</div>;
  }

  return (
    <>
      <div className="trajectory-rows" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <EpochLegend />
    </>
  );
}
