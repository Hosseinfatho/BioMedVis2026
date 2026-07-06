import { useRef, useEffect, useState, useCallback } from 'react';
import { getMarkovStateColor } from '../utils/constants';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  ROW_PX,
  X_MAX,
  drawChartGrid,
  rowY,
  drawSelectionBand,
  drawHoverCrosshair,
  drawConcatenatedSelectionBand,
  drawConcatenatedHoverCrosshair,
  drawAllMotifBundles,
  rowTimeBounds,
} from '../utils/chartLayout';

function drawStateRuns(ctx, x, y, states, timeOffset) {
  if (!states?.length) return;

  let runStart = 0;
  for (let j = 1; j <= states.length; j++) {
    if (j === states.length || states[j] !== states[runStart]) {
      const t0 = timeOffset + runStart;
      const t1 = timeOffset + j;
      const x0 = x(Math.min(t0, X_MAX));
      const x1 = x(Math.min(t1, X_MAX));
      ctx.fillStyle = getMarkovStateColor(states[runStart]);
      ctx.fillRect(x0, y, Math.max(1, x1 - x0), Math.max(1, ROW_PX));
      runStart = j;
    }
  }
}

function drawOriginalStates(ctx, x, trajectories) {
  trajectories.forEach((tr, i) => {
    drawStateRuns(ctx, x, rowY(i), tr.states, tr.startTime);
  });
}

function drawConcatenatedStates(ctx, x, paths) {
  paths.forEach((path, i) => {
    const y = rowY(i);
    path.segments.forEach((seg) => {
      drawStateRuns(ctx, x, y, seg.states, seg.concatStart);
    });
  });
}

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

export default function State({
  rows,
  numStates,
  viewMode = 'original',
  originalRows = null,
  selection = null,
  hoverIndex = null,
  matrixSlots = [],
  globalOccurrences = null,
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

    const { x } = drawChartGrid(ctx, width, { showYLabels: false });

    if (viewMode === 'concatenated') {
      drawConcatenatedStates(ctx, x, rows);
    } else {
      drawOriginalStates(ctx, x, rows);
      if (globalOccurrences?.length) {
        drawAllMotifBundles(ctx, x, rows, globalOccurrences, rowY, ROW_PX);
      }
    }

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
  }, [rows, width, viewMode, originalRows, selection, hoverIndex, matrixSlots, globalOccurrences]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!rows.length) {
    return <div className="state-rows empty">No trajectories</div>;
  }

  return (
    <>
      <div className="state-rows" ref={wrapRef}>
        <canvas ref={canvasRef} />
      </div>
      <StateLegend numStates={numStates} />
    </>
  );
}
