import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import RatioMatrix from './RatioMatrix';
import RateMatrix from './RateMatrix';
import { LABEL_W, RIGHT_PAD } from './layout';

// Wraps a RatioMatrix with a resizable selection window (brush) over the
// trajectory columns. To the right it shows an N x N state/transition
// percentage heatmap aggregated over the selected trajectories. The selection
// is controlled from above so every matrix and the trajectory/state charts
// stay in sync; it starts covering the whole matrix (all trajectories).
export default function InteractiveMatrix({
  columns,
  numStates,
  selection,
  onSelectionChange,
  hoverIndex,
  onHoverChange,
}) {
  const numCols = columns.length;
  const plotRef = useRef(null);
  const dragRef = useRef(null);
  const [plotW, setPlotW] = useState(1000);

  const sel = selection || { start: 0, end: Math.max(0, numCols - 1) };
  const setSel = onSelectionChange || (() => {});

  // keep the latest selection in a ref so the global drag listeners always read
  // fresh values without being torn down on every change
  const selRef = useRef(sel);
  selRef.current = sel;

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

  const colW = numCols > 0 ? (plotW - LABEL_W - RIGHT_PAD) / numCols : 0;

  const colAt = useCallback(
    (clientX) => {
      const rect = plotRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const c = Math.floor((x - LABEL_W) / colW);
      return Math.max(0, Math.min(numCols - 1, c));
    },
    [colW, numCols]
  );

  useEffect(() => {
    function onMove(e) {
      const d = dragRef.current;
      if (!d) return;
      const c = colAt(e.clientX);
      const s = selRef.current;
      if (d.mode === 'left') {
        setSel({ start: Math.min(c, s.end), end: s.end });
      } else if (d.mode === 'right') {
        setSel({ start: s.start, end: Math.max(c, s.start) });
      } else if (d.mode === 'move') {
        const delta = c - d.anchorCol;
        let ns = d.origStart + delta;
        let ne = d.origEnd + delta;
        if (ns < 0) {
          ne -= ns;
          ns = 0;
        }
        if (ne > numCols - 1) {
          ns -= ne - (numCols - 1);
          ne = numCols - 1;
        }
        setSel({ start: Math.max(0, ns), end: Math.min(numCols - 1, ne) });
      }
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [colAt, numCols, setSel]);

  const startDrag = (mode) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      anchorCol: colAt(e.clientX),
      origStart: sel.start,
      origEnd: sel.end,
    };
  };

  const reportHover = (e) => {
    if (!onHoverChange || numCols === 0) return;
    onHoverChange(colAt(e.clientX));
  };
  const clearHover = () => onHoverChange?.(null);

  // click-drag on empty brush area draws a fresh window
  const startNew = (e) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const c = colAt(e.clientX);
    setSel({ start: c, end: c });
    dragRef.current = { mode: 'right', anchorCol: c, origStart: c, origEnd: c };
  };

  const { stateAvg, transAvg } = useMemo(() => {
    const n = numStates;
    const sAvg = new Array(n).fill(0);
    const tAvg = Array.from({ length: n }, () => new Array(n).fill(0));
    const a = Math.max(0, sel.start);
    const b = Math.min(numCols - 1, sel.end);
    const cnt = b >= a ? b - a + 1 : 0;
    if (cnt > 0) {
      for (let c = a; c <= b; c++) {
        const col = columns[c];
        for (let s = 0; s < n; s++) sAvg[s] += col.stateVals[s] || 0;
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i !== j) tAvg[i][j] += col.transitionVals[`${i}->${j}`] || 0;
          }
        }
      }
      for (let s = 0; s < n; s++) sAvg[s] /= cnt;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) tAvg[i][j] /= cnt;
    }
    return { stateAvg: sAvg, transAvg: tAvg };
  }, [columns, sel, numStates, numCols]);

  const selCount = numCols > 0 ? sel.end - sel.start + 1 : 0;
  const left = LABEL_W + sel.start * colW;
  const wsel = (sel.end - sel.start + 1) * colW;

  return (
    <div className="interactive-matrix">
      <div className="im-plot" ref={plotRef}>
        <RatioMatrix columns={columns} numStates={numStates} />
        <div
          className="im-brush-layer"
          onMouseDown={startNew}
          onMouseMove={reportHover}
          onMouseLeave={clearHover}
        >
          {numCols > 0 &&
            hoverIndex != null &&
            hoverIndex >= 0 &&
            hoverIndex < numCols && (
              <div
                className="im-hover-col"
                style={{
                  left: `${LABEL_W + hoverIndex * colW}px`,
                  width: `${colW}px`,
                }}
              />
            )}
          {numCols > 0 && (
            <div
              className="im-selection"
              style={{ left: `${left}px`, width: `${wsel}px` }}
              onMouseDown={startDrag('move')}
            >
              <div
                className="im-handle im-handle-left"
                onMouseDown={startDrag('left')}
              />
              <div
                className="im-handle im-handle-right"
                onMouseDown={startDrag('right')}
              />
            </div>
          )}
        </div>
      </div>
      <div className="im-rate-matrix">
        <RateMatrix
          stateAvg={stateAvg}
          transAvg={transAvg}
          numStates={numStates}
          count={selCount}
        />
      </div>
    </div>
  );
}
