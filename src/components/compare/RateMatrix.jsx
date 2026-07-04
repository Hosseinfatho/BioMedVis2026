import { getMarkovStateColor } from '../../utils/constants';

function heatColor(v) {
  const t = Math.max(0, Math.min(1, v));
  const c0 = [247, 251, 255];
  const c1 = [8, 48, 107];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function pct(v) {
  if (!v) return '0';
  return `${Math.round(v * 100)}`;
}

export default function RateMatrix({ stateAvg, transAvg, numStates, count }) {
  const states = Array.from({ length: numStates }, (_, i) => i);

  return (
    <div className="rate-matrix">
      <div className="rate-matrix-title">Rate</div>
      <div
        className="rate-matrix-grid"
        style={{ gridTemplateColumns: `auto repeat(${numStates}, 1fr)` }}
      >
        <div className="rate-matrix-corner">to →</div>
        {states.map((j) => (
          <div key={`h${j}`} className="rate-matrix-head">
            <span style={{ color: getMarkovStateColor(j) }}>S{j}</span>
          </div>
        ))}
        {states.map((i) => (
          <FragmentRow
            key={`r${i}`}
            i={i}
            states={states}
            stateAvg={stateAvg}
            transAvg={transAvg}
          />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({ i, states, stateAvg, transAvg }) {
  return (
    <>
      <div className="rate-matrix-rowhead">
        <span style={{ color: getMarkovStateColor(i) }}>S{i}</span>
      </div>
      {states.map((j) => {
        const value = i === j ? stateAvg[i] || 0 : transAvg[i][j] || 0;
        const diag = i === j;
        return (
          <div
            key={`c${i}-${j}`}
            className={`rate-matrix-cell${diag ? ' rate-matrix-diag' : ''}`}
            style={{
              background: heatColor(value),
              color: value > 0.5 ? '#fff' : '#333',
            }}
            title={`${diag ? `state S${i}` : `S${i}→S${j}`}: ${(
              value * 100
            ).toFixed(1)}%`}
          >
            {pct(value)}
          </div>
        );
      })}
    </>
  );
}
