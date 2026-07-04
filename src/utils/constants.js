export const STATE_COLORS = [
  '#377eb8',
  '#4daf4a',
  '#984ea3',
  '#ff7f00',
];

export function getMarkovStateColor(state) {
  return STATE_COLORS[state] || '#cccccc';
}

export const EPOCH_COLORS = {
  1: '#C01919',
  2: '#D61919',
  3: '#E85B19',
  4: '#E8B219',
  5: '#DBD719',
  6: '#A7E819',
  7: '#19E119',
  8: '#19C019',
  9: '#19A019',
  10: '#199F6E',
  11: '#19A3A1',
  12: '#1992CC',
  13: '#195ECC',
  14: '#1919B8',
  15: '#60199A',
  16: '#7C198A',
};

export function getEpochColor(epoch) {
  return EPOCH_COLORS[epoch] || '#999999';
}

export const ROW_HEIGHT = 6;
export const LABEL_WIDTH = 150;
export const BIN_COUNT = 200;
export const HIST_HEIGHT = 24;
