import { useRef, useCallback, useState, useEffect } from 'react';
import { CHART_MARGIN, CHART_HEIGHT, X_MAX } from '../utils/chartLayout';

export default function ChartTimeShiftHandle({
  width,
  timeOffset,
  onTimeOffsetChange,
  label = 'System B',
}) {
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const plotW = Math.max(1, width - CHART_MARGIN.left - CHART_MARGIN.right);
  const leftPx =
    CHART_MARGIN.left + (Math.min(Math.max(timeOffset, 0), X_MAX) / X_MAX) * plotW;

  const onMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startOffset: timeOffset,
      };
      setDragging(true);
    },
    [timeOffset]
  );

  const onMouseMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      const fpp = X_MAX / plotW;
      const delta = Math.round((e.clientX - d.startX) * fpp);
      const next = Math.max(0, Math.min(X_MAX, d.startOffset + delta));
      onTimeOffsetChange?.(next);
    },
    [plotW, onTimeOffsetChange]
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  return (
    <div
      className="chart-offset-handle-layer"
      style={{ width, height: CHART_HEIGHT }}
      aria-hidden={false}
    >
      <div
        className={`chart-offset-handle${dragging ? ' dragging' : ''}`}
        style={{ left: `${leftPx}px` }}
        onMouseDown={onMouseDown}
        title={`${label} time shift: ${timeOffset} frames — drag to align`}
        role="slider"
        aria-valuenow={timeOffset}
        aria-valuemin={0}
        aria-valuemax={X_MAX}
        aria-label={`${label} time shift`}
      >
        <span className="chart-offset-handle-knob" />
        <span className="chart-offset-handle-label">{timeOffset}</span>
      </div>
    </div>
  );
}
