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
  '#a6cee3',
  '#1f78b4',
  '#b2df8a',
  '#33a02c',
  '#fb9a99',
  '#e31a1c',
  '#fdbf6f',
  '#ff7f00',
  '#cab2d6',
  '#6a3d9a',
  '#ffff99',
  '#b15928',
];

// RGB-linear interpolation between anchors → 16 distinct epoch colors.
export const EPOCH_COLORS = {
  1: '#a6cee3',
  2: '#438fc1',
  3: '#64a8a0',
  4: '#99d277',
  5: '#3ba432',
  6: '#b89c75',
  7: '#f16767',
  8: '#e63027',
  9: '#faa964',
  10: '#fe992c',
  11: '#ed9047',
  12: '#c4aad2',
  13: '#7d54a6',
  14: '#b9a499',
  15: '#ead37b',
  16: '#b15928',
};

export function getEpochColor(epoch) {
  return EPOCH_COLORS[epoch] || '#999999';
}

export const ROW_HEIGHT = 6;
export const LABEL_WIDTH = 150;
export const BIN_COUNT = 200;
export const HIST_HEIGHT = 24;
