import { useCallback, useMemo } from 'react';
import {
  ROW_PX,
  rowY,
  makeChartXScale,
  hitTestMotifBundles,
  makeConcatStepResolver,
} from '../utils/chartLayout';

export function useMotifChartInteraction({
  width,
  rows,
  viewMode,
  globalOccurrences,
  systemId,
  onMotifHoverChange,
}) {
  const resolveStep = useMemo(
    () =>
      viewMode === 'concatenated' && rows?.length
        ? makeConcatStepResolver(rows)
        : null,
    [viewMode, rows]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!globalOccurrences?.length || !onMotifHoverChange) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const x = makeChartXScale(width);
      const idx = hitTestMotifBundles(
        mx,
        my,
        globalOccurrences,
        x,
        rowY,
        ROW_PX,
        resolveStep,
        rows
      );
      onMotifHoverChange(systemId, idx);
    },
    [width, rows, globalOccurrences, systemId, onMotifHoverChange, resolveStep]
  );

  const handleMouseLeave = useCallback(() => {
    onMotifHoverChange?.(systemId, null);
  }, [systemId, onMotifHoverChange]);

  const motifHoverable = Boolean(globalOccurrences?.length && onMotifHoverChange);

  return { handleMouseMove, handleMouseLeave, motifHoverable };
}
