// Shared layout constants for the fingerprint / difference matrices so the
// canvas renderer and the interactive brush overlay agree on geometry.
import { buildFeatureRows } from '../../utils/computeTransitionFeatures';

export const LABEL_W = 64;
export const COL_HEADER_H = 20;
export const TOP_PAD = 2;
export const RIGHT_PAD = 2;
export const ROW_H = 12;

export function matrixCanvasHeight(numStates, { showColumnHeader = true } = {}) {
  const rows = buildFeatureRows(numStates).length;
  const headerH = showColumnHeader ? COL_HEADER_H : 0;
  return headerH + TOP_PAD * 2 + rows * ROW_H;
}
