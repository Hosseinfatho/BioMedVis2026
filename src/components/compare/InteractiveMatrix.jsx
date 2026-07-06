import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { aggregateRateFromWindow, diffRateMatrices, getMatrixStates } from '../../utils/computeTransitionFeatures';
import {
  computeMotifMatrixHighlights,
  findGlobalMotifOccurrences,
} from '../../utils/motifs';
import { rateAggregationWindow, visibleSelection } from '../../utils/matrixViewport';
import RatioMatrix from './RatioMatrix';
import RateMatrix from './RateMatrix';
import { LABEL_W, COL_HEADER_H, RIGHT_PAD } from './layout';

export default function InteractiveMatrix({
  columns,
  numStates,
  alignmentId,
  selection,
  onSelectionChange,
  hoverIndex,
  onHoverChange,
  trajectoryRows,
  trajectoryRowsB,
  matrixSlots,
  activeMotif,
  viewStart,
  viewCount,
  onViewChange,
  rateMode = 'absolute',
  showRate = true,
  showRateTitle = false,
}) {
  const numCols = columns.length;
  const plotRef = useRef(null);
  const dragRef = useRef(null);
  const [plotW, setPlotW] = useState(1000);

  const sel = selection || { start: 0, end: Math.max(0, numCols - 1) };
  const setSel = onSelectionChange || (() => {});

  const selRef = useRef(sel);
  selRef.current = sel;

  const visibleCount = viewCount ?? numCols;
  const colW =
    numCols > 0 && visibleCount > 0
      ? (plotW - LABEL_W - RIGHT_PAD) / visibleCount
      : 0;

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
      const rect = plotRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const plotWLocal = plotW;
      const cw =
        numCols > 0 && visibleCount > 0
          ? (plotWLocal - LABEL_W - RIGHT_PAD) / visibleCount
          : 0;
      if (cw <= 0) return 0;

      const localC = Math.floor((x - LABEL_W) / cw);
      const globalC = viewStart + localC;
      return Math.max(0, Math.min(numCols - 1, globalC));
    },
    [numCols, visibleCount, viewStart, plotW]
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

  const startNew = (e) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    const c = colAt(e.clientX);
    setSel({ start: c, end: c });
    dragRef.current = { mode: 'right', anchorCol: c, origStart: c, origEnd: c };
  };

  const onWheel = useCallback(
    (e) => {
      if (!onViewChange || numCols <= 0) return;
      e.preventDefault();

      const anchorCol = colAt(e.clientX);
      onViewChange({ anchorCol, deltaY: e.deltaY, shiftKey: e.shiftKey });
    },
    [colAt, numCols, onViewChange]
  );

  useEffect(() => {
    const el = plotRef.current;
    if (!el || !onViewChange) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel, onViewChange]);

  const { start: rateStart, end: rateEnd } = useMemo(
    () =>
      rateAggregationWindow(
        viewStart ?? 0,
        visibleCount,
        selection,
        numCols
      ),
    [viewStart, visibleCount, selection, numCols]
  );

  const rateA = useMemo(
    () =>
      aggregateRateFromWindow(rateStart, rateEnd, numStates, {
        allRows: trajectoryRows,
        matrixSlots,
        alignmentId,
      }),
    [rateStart, rateEnd, numStates, trajectoryRows, matrixSlots, alignmentId]
  );

  const rateB = useMemo(
    () =>
      rateMode === 'diff' && trajectoryRowsB
        ? aggregateRateFromWindow(rateStart, rateEnd, numStates, {
            allRows: trajectoryRowsB,
            matrixSlots,
            alignmentId,
          })
        : null,
    [rateStart, rateEnd, numStates, trajectoryRowsB, matrixSlots, rateMode, alignmentId]
  );

  const rate =
    rateMode === 'diff' && rateB
      ? diffRateMatrices(rateA, rateB, numStates)
      : rateA;

  const motifSearchRows = useMemo(() => {
    if (rateMode === 'diff' && trajectoryRowsB?.length) {
      return [...(trajectoryRows || []), ...trajectoryRowsB];
    }
    return trajectoryRows || [];
  }, [rateMode, trajectoryRows, trajectoryRowsB]);

  const globalOccurrences = useMemo(() => {
    if (!activeMotif || !motifSearchRows.length) return [];
    return findGlobalMotifOccurrences(
      activeMotif,
      motifSearchRows,
      matrixSlots,
      (row) => row.states || []
    );
  }, [activeMotif, motifSearchRows, matrixSlots]);

  const { cells: highlightCells } = useMemo(
    () => computeMotifMatrixHighlights(activeMotif, numStates, globalOccurrences),
    [activeMotif, numStates, globalOccurrences]
  );

  const cw =
    numCols > 0 && visibleCount > 0
      ? (plotW - LABEL_W - RIGHT_PAD) / visibleCount
      : 0;

  const visSel = visibleSelection(
    selection,
    viewStart,
    visibleCount
  );

  const brushTop = COL_HEADER_H;
  const left = visSel ? LABEL_W + visSel.localStart * cw : 0;
  const wsel = visSel ? (visSel.localEnd - visSel.localStart + 1) * cw : 0;

  const hoverVisible =
    hoverIndex != null &&
    hoverIndex >= viewStart &&
    hoverIndex < viewStart + visibleCount;

  return (
    <div className="interactive-matrix">
      <div className="im-plot im-plot-zoomable" ref={plotRef}>
        <RatioMatrix
          columns={columns}
          numStates={numStates}
          highlightCells={highlightCells}
          viewStart={viewStart}
          viewCount={visibleCount}
        />
        <div
          className="im-brush-layer"
          style={{ top: `${brushTop}px` }}
          onMouseDown={startNew}
          onMouseMove={reportHover}
          onMouseLeave={clearHover}
        >
          {numCols > 0 && hoverVisible && (
            <div
              className="im-hover-col"
              style={{
                left: `${LABEL_W + (hoverIndex - viewStart) * cw}px`,
                width: `${cw}px`,
              }}
            />
          )}
          {numCols > 0 && visSel && (
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
      {showRate && (
        <div className="im-rate-matrix">
          <RateMatrix
            mode={rateMode}
            showTitle={showRateTitle}
            stateAvg={rate.stateAvg}
            stateCounts={rate.stateCounts}
            transAvg={rate.transAvg}
            transCounts={rate.transCounts}
            stateAvgA={rate.stateAvgA}
            stateAvgB={rate.stateAvgB}
            stateCountsA={rate.stateCountsA}
            stateCountsB={rate.stateCountsB}
            transAvgA={rate.transAvgA}
            transAvgB={rate.transAvgB}
            countsA={rate.countsA}
            countsB={rate.countsB}
            totalChanges={rateMode === 'diff' ? undefined : rate.totalChanges}
            totalFrames={rateMode === 'diff' ? undefined : rate.totalFrames}
            totalFramesA={rate.totalFramesA}
            totalFramesB={rate.totalFramesB}
            totalChangesA={rate.totalChangesA}
            totalChangesB={rate.totalChangesB}
            numStates={numStates}
          />
        </div>
      )}
    </div>
  );
}
