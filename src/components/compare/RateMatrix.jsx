import { getMarkovStateColor } from '../../utils/constants';

const MATRIX_BG = [255, 255, 255]; // #fff — match panel surfaces

function heatColor(v, maxV) {
  const denom = maxV > 0 ? maxV : 1;
  const t = Math.max(0, Math.min(1, v / denom));
  const c0 = MATRIX_BG;
  const c1 = [8, 48, 107];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * t);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * t);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function stateCellBg(state, ratio) {
  const hex = getMarkovStateColor(state);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const t = Math.max(0, Math.min(1, ratio));
  const base = MATRIX_BG[0];
  const mix = (c) => Math.round(base + (c - base) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function pct(v) {
  if (!v) return '0.0';
  return `${(v * 100).toFixed(1)}`;
}

export default function RateMatrix({
  mode = 'absolute',
  showTitle = false,
  stateAvg,
  stateCounts,
  transAvg,
  transCounts,
  stateAvgA,
  stateAvgB,
  stateCountsA,
  stateCountsB,
  transAvgA,
  transAvgB,
  countsA,
  countsB,
  totalChanges,
  totalFrames,
  totalFramesA,
  totalFramesB,
  numStates,
}) {
  const states = Array.from({ length: numStates }, (_, i) => i);
  const isDiff = mode === 'diff';

  let maxTrans = 0;
  for (let i = 0; i < numStates; i++) {
    for (let j = 0; j < numStates; j++) {
      if (i === j) continue;
      const v = transAvg[i][j] || 0;
      if (v > maxTrans) maxTrans = v;
    }
  }

  return (
    <div className="rate-matrix">
      {showTitle && <div className="rate-matrix-title">Rate</div>}
      <div
        className="rate-matrix-grid"
        style={{ gridTemplateColumns: `auto repeat(${numStates}, 1fr)` }}
      >
        <div className="rate-matrix-corner" aria-hidden="true" />
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
            isDiff={isDiff}
            stateAvg={stateAvg}
            stateCounts={stateCounts}
            stateAvgA={stateAvgA}
            stateAvgB={stateAvgB}
            stateCountsA={stateCountsA}
            stateCountsB={stateCountsB}
            transAvg={transAvg}
            transCounts={transCounts}
            transAvgA={transAvgA}
            transAvgB={transAvgB}
            countsA={countsA}
            countsB={countsB}
            totalChanges={totalChanges}
            totalFrames={totalFrames}
            totalFramesA={totalFramesA}
            totalFramesB={totalFramesB}
            maxTrans={maxTrans}
          />
        ))}
      </div>
    </div>
  );
}

function FragmentRow({
  i,
  states,
  isDiff,
  stateAvg,
  stateCounts,
  stateAvgA,
  stateAvgB,
  stateCountsA,
  stateCountsB,
  transAvg,
  transCounts,
  transAvgA,
  transAvgB,
  countsA,
  countsB,
  totalChanges,
  totalFrames,
  totalFramesA,
  totalFramesB,
  maxTrans,
}) {
  return (
    <>
      <div className="rate-matrix-rowhead">
        <span style={{ color: getMarkovStateColor(i) }}>S{i}</span>
      </div>
      {states.map((j) => {
        const diag = i === j;

        if (diag) {
          const value = stateAvg?.[i] || 0;
          const count = stateCounts?.[i] || 0;
          let title;
          if (isDiff) {
            const a = stateAvgA?.[i] || 0;
            const b = stateAvgB?.[i] || 0;
            const aCnt = stateCountsA?.[i] || 0;
            const bCnt = stateCountsB?.[i] || 0;
            title = `|S${i}|: |${pct(a)}% − ${pct(b)}%| = ${pct(value)}% (A: ${aCnt}/${totalFramesA} · B: ${bCnt}/${totalFramesB} frames)`;
          } else {
            title = `S${i}: ${count} / ${totalFrames} state-frames (${pct(value)}% of all states)`;
          }
          return (
            <div
              key={`c${i}-${j}`}
              className="rate-matrix-cell rate-matrix-diag"
              style={{
                background: isDiff
                  ? heatColor(value, 1)
                  : stateCellBg(i, value),
                color: isDiff
                  ? value > 0.5
                    ? '#fff'
                    : '#333'
                  : value > 0.45
                    ? '#fff'
                    : '#333',
              }}
              title={title}
            >
              {pct(value)}
            </div>
          );
        }

        const value = transAvg[i][j] || 0;
        const count = transCounts?.[i]?.[j] || 0;

        let title;
        if (isDiff) {
          const aRate = transAvgA?.[i]?.[j] || 0;
          const bRate = transAvgB?.[i]?.[j] || 0;
          const aCnt = countsA?.[i]?.[j] || 0;
          const bCnt = countsB?.[i]?.[j] || 0;
          title = `|S${i}→S${j}|: |${pct(aRate)}% − ${pct(bRate)}%| = ${pct(value)}% (${aCnt} vs ${bCnt} changes)`;
        } else {
          title = `S${i}→S${j}: ${count} / ${totalChanges} directed changes (${pct(value)}% of all changes)`;
        }

        return (
          <div
            key={`c${i}-${j}`}
            className="rate-matrix-cell"
            style={{
              background: heatColor(value, maxTrans),
              color: value / (maxTrans || 1) > 0.55 ? '#fff' : '#333',
            }}
            title={title}
          >
            {pct(value)}
          </div>
        );
      })}
    </>
  );
}
