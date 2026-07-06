export const STATE_COLORS = [
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
];

export function getMarkovStateColor(state) {
  return STATE_COLORS[state] || '#cccccc';
}

// Epoch palette: 12 anchors (#a6cee3 … #b15928) resampled to 16 epochs.
export const EPOCH_ANCHOR_COLORS = [
  '#001F3F',
  '#1B1B1B',
  '#081C15',
  '#240046',
  '#1D004E',
  '#0B132B',
  '#10002B',
  '#0A0908',
  '#03071E',
  '#6a3d9a',
  '#ffff99',
  '#000000',
];

// Epoch colors (one per epoch index 1–16).
export const EPOCH_COLORS = {
  1: '#964343',
  2: '#A74848',
  3: '#B46E4D',
  4: '#B4994D',
  5: '#AAA84A',
  6: '#94B44D',
  7: '#4BAF4B',
  8: '#439643',
  9: '#3B7E3B',
  10: '#3B7E65',
  11: '#3B8080',
  12: '#46829F',
  13: '#46689F',
  14: '#414190',
  15: '#5D397A',
  16: '#67356E',
};

export function getEpochColor(epoch) {
  return EPOCH_COLORS[epoch] || '#999999';
}

export const ROW_HEIGHT = 6;
export const LABEL_WIDTH = 150;
export const BIN_COUNT = 200;
export const HIST_HEIGHT = 24;

// Default horizontal time shift (frames) for System B in dual overlay charts.
export const DEFAULT_SYSTEM_B_TIME_OFFSET = 3000;
