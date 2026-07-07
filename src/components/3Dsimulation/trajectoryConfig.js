const RAW_SYSTEM_FOLDERS = {
  zsab2: 'ZS-ab2',
  zsab3: 'ZS-ab3',
  zsab4: 'ZS-ab4',
};

export const DEFAULT_TRAJECTORY = 'e1s1_0';
export const DEFAULT_FRAME = 0;

export function rawSystemFolder(systemId) {
  return RAW_SYSTEM_FOLDERS[systemId] || 'ZS-ab2';
}

export function pdbUrl(systemId) {
  return `/trajectories/${rawSystemFolder(systemId)}/filtered.pdb`;
}

export function xtcUrl(systemId, trajectoryName) {
  return `/trajectories/${rawSystemFolder(systemId)}/${trajectoryName}/output.filtered.xtc`;
}
