export const SYSTEMS = {
  zsab2: {
    label: 'Free Aβ42',
    folder: '/data/zsab2/',
    files: {
      states2: 'zsab2_states2.txt',
      states3: 'zsab2_states3.txt',
      states4: 'zsab2_states4.txt',
      order: 'zsab2_order.txt',
      names: 'zsab2_names.txt',
      concatenated: 'zsab2_concatenated.txt',
    },
  },
  zsab3: {
    label: 'Aβ42 + TMP',
    folder: '/data/zsab3/',
    files: {
      states2: 'zsab3_states2.txt',
      states3: 'zsab3_states3.txt',
      states4: 'zsab3_states4.txt',
      order: 'zsab3_order.txt',
      names: 'zsab3_names.txt',
      concatenated: 'zsab3_concatenated.txt',
    },
  },
  zsab4: {
    label: 'Aβ42 + SPA',
    folder: '/data/zsab4/',
    files: {
      states2: 'zsab4_states2.txt',
      states3: 'zsab4_states3.txt',
      states4: 'zsab4_states4.txt',
      order: 'zsab4_order.txt',
      names: 'zsab4_names.txt',
      concatenated: 'zsab4_concatenated.txt',
    },
  },
};

export const MODELS = {
  states2: { label: '2-state model', numStates: 2 },
  states3: { label: '3-state model', numStates: 3 },
  states4: { label: '4-state model', numStates: 4 },
};

export const VIEW_MODES = {
  original: { label: 'Original' },
  concatenated: { label: 'Concatenated' },
};

export function getStateFilePath(systemId, modelId) {
  const system = SYSTEMS[systemId];
  return `${system.folder}${system.files[modelId]}`;
}

export function getOrderFilePath(systemId) {
  const system = SYSTEMS[systemId];
  return `${system.folder}${system.files.order}`;
}

export function getConcatenatedFilePath(systemId) {
  const system = SYSTEMS[systemId];
  return `${system.folder}${system.files.concatenated}`;
}
