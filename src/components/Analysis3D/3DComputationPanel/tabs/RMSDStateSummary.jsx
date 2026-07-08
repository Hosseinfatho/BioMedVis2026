import { useEffect, useRef } from 'react';

function formatNum(value, digits = 2) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n.toFixed(digits) : '—';
}

function RmsdHistogram({ bins }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bins?.length) return;

    const width = canvas.parentElement?.clientWidth ?? 240;
    const height = 56;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const pad = { l: 28, r: 16, t: 6, b: 18 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;
    const maxFrac = Math.max(...bins.map((b) => b.fraction), 0.001);
    const barW = plotW / bins.length;
    const axisY = pad.t + plotH;
    const labelY = height - 4;

    ctx.fillStyle = '#5b8def';
    bins.forEach((bin, idx) => {
      const h = (bin.fraction / maxFrac) * plotH;
      const x = pad.l + idx * barW;
      const y = axisY - h;
      ctx.fillRect(x + 0.5, y, Math.max(1, barW - 1), h);
    });

    ctx.strokeStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(pad.l, axisY);
    ctx.lineTo(pad.l + plotW, axisY);
    ctx.stroke();

    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillText('0', pad.l, labelY);
    ctx.textAlign = 'center';
    ctx.fillText('RMSD (Å)', pad.l + plotW / 2, labelY);
    ctx.textAlign = 'right';
    ctx.fillText('15', pad.l + plotW, labelY);
  }, [bins]);

  if (!bins?.length) {
    return <p className="conf-driver-muted">No RMSD distribution for this selection.</p>;
  }

  return <canvas ref={canvasRef} className="conf-driver-rmsd-chart" aria-label="RMSD distribution" />;
}

export default function RMSDStateSummary({ summary, rmsdBins, frameCount }) {
  return (
    <div className="conf-driver-summary">
      <div className="conf-driver-summary-grid">
        <div className="conf-driver-stat">
          <span className="conf-driver-stat-label">Avg RMSD</span>
          <span className="conf-driver-stat-value">
            {summary ? `${formatNum(summary.avg_rmsd)} Å` : '—'}
          </span>
        </div>
        <div className="conf-driver-stat">
          <span className="conf-driver-stat-label">Std RMSD</span>
          <span className="conf-driver-stat-value">
            {summary ? `${formatNum(summary.std_rmsd)} Å` : '—'}
          </span>
        </div>
        <div className="conf-driver-stat">
          <span className="conf-driver-stat-label">Radius of gyration</span>
          <span className="conf-driver-stat-value">
            {summary?.avg_radius_of_gyration
              ? `${formatNum(summary.avg_radius_of_gyration)} Å`
              : '—'}
          </span>
        </div>
        <div className="conf-driver-stat">
          <span className="conf-driver-stat-label">Frames in state</span>
          <span className="conf-driver-stat-value">
            {frameCount ? frameCount.toLocaleString() : '—'}
          </span>
        </div>
      </div>

      <RmsdHistogram bins={rmsdBins} />
    </div>
  );
}
