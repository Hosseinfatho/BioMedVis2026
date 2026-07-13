import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { getMarkovStateColor } from '../utils/constants';
import { getMatrixStates } from '../utils/computeTransitionFeatures';
import { trajectoriesByMatrixSlot } from '../utils/matrixRepresentativeRows';
import { LABEL_W, RIGHT_PAD } from './compare/layout';
import {
  columnLabelStep,
  shouldDrawColumnLabel,
  visibleSelection,
} from '../utils/matrixViewport';

export const TRACE_HEIGHT = 80;
const MARGIN_TOP = 4;
const MARGIN_BOTTOM = 4;
const MAX_PTS_PER_COL = 48;

// Distinct gray per state (light → dark) for back-layer comparison.
const STATE_GRAY = ['#b8c4cc', '#8e9aa6', '#b0baa8', '#7d8a72'];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function mixHex(hex, targetHex, t) {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(targetHex);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function colorForState(state, mode) {
  if (mode === 'gray-states') {
    return STATE_GRAY[state] || '#aaa';
  }
  if (mode === 'gray') {
    return mixHex(getMarkovStateColor(state), '#b0b0b0', 0.72);
  }
  return getMarkovStateColor(state);
}

function yForState(state, numStates, plotTop, plotH) {
  const bandH = plotH / numStates;
  return plotTop + plotH - (state + 0.5) * bandH;
}

function downsampleStates(states, maxPts) {
  if (!states?.length || states.length <= maxPts) return states || [];
  const out = [];
  const step = (states.length - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) {
    out.push(states[Math.round(i * step)]);
  }
  return out;
}

function buildColumnPoints(states, numStates, x0, innerW, plotTop, plotH) {
  const sampled = downsampleStates(states, MAX_PTS_PER_COL);
  if (!sampled.length) return [];
  const n = sampled.length;
  return sampled.map((state, f) => ({
    x: x0 + (n > 1 ? (f / (n - 1)) * innerW : innerW / 2),
    y: yForState(state, numStates, plotTop, plotH),
    state,
  }));
}

function alignedTrajectories(rows, matrixSlots, alignmentId) {
  const trajs = trajectoriesByMatrixSlot(rows, matrixSlots);
  if (!alignmentId || !rows) return trajs;
  return trajs.map((traj) =>
    traj
      ? { ...traj, states: getMatrixStates(traj, 'original', alignmentId) }
      : null
  );
}

function drawSystemLayer(ctx, columnTrajectories, geom, colorMode, styleMode) {
  const { numStates, viewStart, visibleCount, totalCols, colW, plotTop, plotH } = geom;
  const alpha = styleMode === 'high' ? 1 : styleMode === 'medium' ? 0.78 : 0.55;
  const lineWidth = styleMode === 'high' ? 2.5 : 2;
  const columnPoints = [];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let localC = 0; localC < visibleCount; localC++) {
    const globalC = viewStart + localC;
    if (globalC >= totalCols) break;

    const x0 = LABEL_W + localC * colW;
    const innerW = Math.max(2, colW - 2);
    const states = columnTrajectories[globalC]?.states || [];
    const points = buildColumnPoints(states, numStates, x0 + 1, innerW, plotTop, plotH);
    columnPoints.push(points);

    if (points.length < 2) continue;

    let runState = points[0].state;
    ctx.strokeStyle = colorForState(runState, colorMode);
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.state !== runState) {
        ctx.stroke();
        runState = p.state;
        ctx.strokeStyle = colorForState(runState, colorMode);
        ctx.lineWidth = lineWidth + 0.5;
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
      }
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  if (colW >= 4) {
    ctx.setLineDash([3, 2]);
    ctx.lineWidth = 1.25;
    for (let localC = 0; localC < visibleCount - 1; localC++) {
      const globalC = viewStart + localC;
      if (globalC + 1 >= totalCols) break;
      const left = columnPoints[localC];
      const right = columnPoints[localC + 1];
      if (!left?.length || !right?.length) continue;

      const a = left[left.length - 1];
      const b = right[0];
      const xBound = LABEL_W + (localC + 1) * colW;
      ctx.strokeStyle = colorForState(a.state, colorMode);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(xBound, a.y);
      ctx.lineTo(xBound, b.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.restore();
  return columnPoints;
}

export default function Trace({
  traceSystems = [],
  numStates,
  matrixSlots = [],
  alignmentId,
  viewStart = 0,
  viewCount,
  hoverIndex = null,
  selection = null,
  onHoverChange,
  onViewChange,
  numCols = 0,
  showColumnLabels = false,
}) {
  const canvasRef = useRef(null);
  const plotRef = useRef(null);
  const hoverRaf = useRef(null);
  const [plotW, setPlotW] = useState(0);

  const systemIds = useMemo(
    () => traceSystems.map((s) => s.systemId),
    [traceSystems]
  );

  const [layerState, setLayerState] = useState({
    layers: {},
    order: [],
  });

  useEffect(() => {
    if (!systemIds.length) return;
    setLayerState({
      layers: Object.fromEntries(systemIds.map((id, index) => [id, index === 0])),
      order: [...systemIds],
    });
  }, [systemIds.join('|')]);

  const alignedBySystem = useMemo(() => {
    const out = {};
    for (const sys of traceSystems) {
      out[sys.systemId] = alignedTrajectories(sys.rows, matrixSlots, alignmentId);
    }
    return out;
  }, [traceSystems, matrixSlots, alignmentId]);

  const totalCols =
    traceSystems[0]?.systemId && alignedBySystem[traceSystems[0].systemId]?.length
      ? alignedBySystem[traceSystems[0].systemId].length
      : numCols;
  const visibleCount = viewCount ?? totalCols;

  const visSel = useMemo(
    () => visibleSelection(selection, viewStart, visibleCount),
    [selection, viewStart, visibleCount]
  );

  const { layers, order: layerOrder } = layerState;

  const enabledLayers = useMemo(
    () => systemIds.filter((id) => layers[id]),
    [systemIds, layers]
  );

  const topLayer = useMemo(() => {
    const activeOrder = layerOrder.filter((id) => enabledLayers.includes(id));
    return activeOrder[activeOrder.length - 1] || enabledLayers[enabledLayers.length - 1] || null;
  }, [layerOrder, enabledLayers]);

  const colorForLayer = useCallback(
    (layerId) => (layerId === topLayer ? 'color' : 'gray-states'),
    [topLayer]
  );
  const styleForLayer = useCallback(
    (layerId) => (layerId === topLayer ? 'high' : 'gray-back'),
    [topLayer]
  );

  const toggleLayer = useCallback((key) => {
    setLayerState((prev) => {
      const nextLayers = { ...prev.layers, [key]: !prev.layers[key] };
      const nextOrder = [...prev.order];
      if (nextLayers[key]) {
        if (!nextOrder.includes(key)) nextOrder.push(key);
      } else {
        const idx = nextOrder.indexOf(key);
        if (idx >= 0) nextOrder.splice(idx, 1);
      }
      if (!Object.values(nextLayers).some(Boolean)) return prev;
      return { layers: nextLayers, order: nextOrder };
    });
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setPlotW(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colAt = useCallback(
    (clientX) => {
      const rect = plotRef.current?.getBoundingClientRect();
      if (!rect || numCols <= 0 || visibleCount <= 0) return 0;
      const plotWidth = plotW - LABEL_W - RIGHT_PAD;
      const colW = plotWidth / visibleCount;
      if (colW <= 0) return 0;
      const localC = Math.floor((clientX - rect.left - LABEL_W) / colW);
      return Math.max(0, Math.min(numCols - 1, viewStart + localC));
    },
    [numCols, visibleCount, viewStart, plotW]
  );

  const onWheel = useCallback(
    (e) => {
      if (!onViewChange || numCols <= 0) return;
      e.preventDefault();
      onViewChange({
        anchorCol: colAt(e.clientX),
        deltaY: e.deltaY,
        shiftKey: e.shiftKey,
      });
    },
    [colAt, numCols, onViewChange]
  );

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !onViewChange) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel, onViewChange]);

  const handleMouseMove = useCallback(
    (e) => {
      if (!onHoverChange) return;
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
      const x = e.clientX;
      hoverRaf.current = requestAnimationFrame(() => {
        onHoverChange(colAt(x));
      });
    },
    [onHoverChange, colAt]
  );

  useEffect(
    () => () => {
      if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const width = plotW;
    if (!canvas || !width || totalCols <= 0 || visibleCount <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = TRACE_HEIGHT * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${TRACE_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, TRACE_HEIGHT);

    const plotWidth = width - LABEL_W - RIGHT_PAD;
    const colW = plotWidth / visibleCount;
    const plotTop = MARGIN_TOP;
    const plotH = TRACE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;
    if (colW <= 0) return;

    const geom = { numStates, viewStart, visibleCount, totalCols, colW, plotTop, plotH };

    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let s = 0; s < numStates; s++) {
      ctx.fillText(`S${s}`, LABEL_W - 6, yForState(s, numStates, plotTop, plotH));
    }

    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 1;
    for (let s = 0; s <= numStates; s++) {
      const y = plotTop + plotH - (s / numStates) * plotH;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, y);
      ctx.lineTo(LABEL_W + plotWidth, y);
      ctx.stroke();
    }

    if (visSel) {
      ctx.fillStyle = 'rgba(30, 60, 120, 0.1)';
      ctx.fillRect(
        LABEL_W + visSel.localStart * colW,
        plotTop,
        (visSel.localEnd - visSel.localStart + 1) * colW,
        plotH
      );
    }

    const labelStep = columnLabelStep(visibleCount);
    if (showColumnLabels) {
      ctx.fillStyle = '#888';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let localC = 0; localC < visibleCount; localC++) {
        const globalC = viewStart + localC;
        if (globalC >= totalCols) break;
        if (!shouldDrawColumnLabel(globalC, viewStart, visibleCount, labelStep)) continue;
        ctx.fillText(
          String(globalC + 1),
          LABEL_W + (localC + 0.5) * colW,
          TRACE_HEIGHT - MARGIN_BOTTOM + 2
        );
      }
    }

    if (hoverIndex != null && hoverIndex >= viewStart && hoverIndex < viewStart + visibleCount) {
      ctx.fillStyle = 'rgba(30, 60, 120, 0.12)';
      ctx.fillRect(LABEL_W + (hoverIndex - viewStart) * colW, plotTop, colW, plotH);
    }

    for (const layerId of layerOrder) {
      if (!layers[layerId]) continue;
      const trajs = alignedBySystem[layerId] || [];
      drawSystemLayer(
        ctx,
        trajs,
        geom,
        colorForLayer(layerId),
        styleForLayer(layerId)
      );
    }

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(LABEL_W, plotTop);
    ctx.lineTo(LABEL_W, plotTop + plotH);
    ctx.stroke();
  }, [
    plotW,
    totalCols,
    visibleCount,
    viewStart,
    alignedBySystem,
    layerOrder,
    layers,
    numStates,
    hoverIndex,
    visSel,
    colorForLayer,
    styleForLayer,
    showColumnLabels,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!totalCols) return null;

  return (
    <div className="trace-combined">
      <div
        className="im-system-label"
        title="State trace"
        style={{ minHeight: TRACE_HEIGHT }}
      >
        State trace
      </div>
      <div
        className="trace-combined-plot im-plot-zoomable"
        ref={plotRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHoverChange?.(null)}
      >
        <canvas ref={canvasRef} />
      </div>
      <div className="trace-layer-controls">
        <div className="trace-layer-controls-title">Layers</div>
        {traceSystems.map((sys) => (
          <label
            key={sys.systemId}
            className={`trace-layer-option${topLayer === sys.systemId ? ' trace-layer-option-active' : ''}`}
          >
            <input
              type="checkbox"
              checked={Boolean(layers[sys.systemId])}
              onChange={() => toggleLayer(sys.systemId)}
            />
            <span
              className="state-driver-system-check-swatch trace-layer-swatch"
              data-system={sys.systemId}
            />
            {sys.label}
          </label>
        ))}
      </div>
    </div>
  );
}
