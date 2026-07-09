import { useCallback, useEffect, useRef, useState } from 'react';

const PAD = { l: 36, r: 12, t: 10, b: 28 };
const COLOR_BELOW = '#8eb5f0';
const COLOR_BELOW_SEL = '#5b8def';
const COLOR_WITHIN = '#4caf50';
const COLOR_WITHIN_SEL = '#2e7d32';

function hitBar(layout, clientX, clientY, canvas) {
  if (!layout || !canvas || !layout.bars?.length) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < PAD.l || y < PAD.t || y > layout.height - PAD.b) return null;
  const idx = Math.floor((x - PAD.l) / layout.barW);
  if (idx < 0 || idx >= layout.bars.length) return null;
  return layout.bars[idx];
}

export default function TrajectoryFrameHistogram({
  histogram,
  selectedBar = null,
  onBarSelect,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const layoutRef = useRef(null);
  const [hover, setHover] = useState(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const bars = histogram?.bars ?? [];
    if (!canvas || !wrap || !bars.length) return;

    const width = Math.max(200, wrap.clientWidth);
    const height = Math.max(220, wrap.clientHeight);
    const plotW = width - PAD.l - PAD.r;
    const plotH = height - PAD.t - PAD.b;
    const barW = plotW / bars.length;
    const maxCount = histogram.maxCount || 1;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    const axisY = PAD.t + plotH;
    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(PAD.l, PAD.t);
    ctx.lineTo(PAD.l, axisY);
    ctx.lineTo(PAD.l + plotW, axisY);
    ctx.stroke();

    bars.forEach((bar, i) => {
      const totalH = (bar.stateFrameCount / maxCount) * plotH;
      let withinH = (bar.withinThresholdCount / maxCount) * plotH;
      if (bar.withinThresholdCount > 0 && withinH < 2) withinH = 2;
      if (withinH > totalH) withinH = totalH;
      const belowH = totalH - withinH;
      const x = PAD.l + i * barW + 1;
      const w = Math.max(2, barW - 2);
      const selected =
        selectedBar?.trajectoryIndex === bar.trajectoryIndex ||
        hover?.trajectoryIndex === bar.trajectoryIndex;

      if (belowH > 0) {
        ctx.fillStyle = selected ? COLOR_BELOW_SEL : COLOR_BELOW;
        ctx.fillRect(x, axisY - totalH, w, belowH);
      }
      if (withinH > 0) {
        ctx.fillStyle = selected ? COLOR_WITHIN_SEL : COLOR_WITHIN;
        ctx.fillRect(x, axisY - withinH, w, withinH);
      }

      if (selected && totalH > 0) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.5, axisY - totalH + 0.5, w - 1, totalH - 1);
      }
    });

    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelStep = Math.max(1, Math.ceil(bars.length / 20));
    for (let i = 0; i < bars.length; i += labelStep) {
      const x = PAD.l + i * barW + barW / 2;
      ctx.fillText(String(bars[i].trajectoryIndex), x, axisY + 6);
    }
    if (bars.length > 0 && (bars.length - 1) % labelStep !== 0) {
      const last = bars.length - 1;
      const x = PAD.l + last * barW + barW / 2;
      ctx.fillText(String(bars[last].trajectoryIndex), x, axisY + 6);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', PAD.l - 4, axisY);
    ctx.fillText(String(maxCount), PAD.l - 4, PAD.t + 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Trajectory #', PAD.l + plotW / 2, height - 4);

    layoutRef.current = { barW, bars, height, width };
  }, [histogram, selectedBar, hover]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const handleClick = (event) => {
    const bar = hitBar(layoutRef.current, event.clientX, event.clientY, canvasRef.current);
    if (!bar || !onBarSelect || bar.stateFrameCount === 0) return;
    onBarSelect(bar);
  };

  const handleMove = (event) => {
    const bar = hitBar(layoutRef.current, event.clientX, event.clientY, canvasRef.current);
    setHover(bar);
  };

  const tip = hover
    ? `Trajectory ${hover.trajectoryIndex}: ${hover.stateFrameCount} in state (${hover.withinThresholdCount} near centroid, ${hover.belowThresholdCount} farther)`
    : selectedBar
      ? `Trajectory ${selectedBar.trajectoryIndex}: ${selectedBar.stateFrameCount} frames in state`
      : histogram?.hasThresholdData
        ? 'Stacked bar: blue = in state but farther from centroid; green = closest 10% by structural distance. Click a bar for Viewer3D.'
        : 'Run preprocess:state-trajectory-frame-counts for green threshold stacks.';

  if (!histogram?.bars?.length) {
    if (histogram?.totalStateFrames === 0 && histogram?.trajectoryCount > 0) {
      return (
        <p className="conf-driver-muted">
          No frames assigned to this Markov state for the selected model.
        </p>
      );
    }
    return <p className="conf-driver-muted">No trajectory data for this state.</p>;
  }

  if (histogram.totalStateFrames === 0) {
    return (
      <p className="conf-driver-muted">
        No frames assigned to this Markov state for the selected model.
      </p>
    );
  }

  return (
    <div className="sig-frame-hist-wrap">
      <div ref={wrapRef} className="sig-frame-hist-body">
        <canvas
          ref={canvasRef}
          className="sig-frame-hist-canvas"
          role="img"
          aria-label="Stacked histogram of state frames per trajectory"
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </div>
      <div className="sig-frame-hist-legend" aria-hidden="true">
        <span className="sig-frame-hist-legend-item">
          <span className="sig-frame-hist-swatch sig-frame-hist-swatch--below" />
          In state, above threshold
        </span>
        <span className="sig-frame-hist-legend-item">
          <span className="sig-frame-hist-swatch sig-frame-hist-swatch--within" />
          In state, within threshold
        </span>
      </div>
      <div className="conf-driver-matrix-tip" aria-live="polite">
        {tip}
      </div>
    </div>
  );
}
