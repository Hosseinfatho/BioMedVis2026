export function parseEpoch(name) {
  const regex = /^e(\d+)s(\d+)_e(\d+)s(\d+)p0f(\d+)/;
  const match = name.match(regex);
  if (match) {
    return {
      epoch: parseInt(match[1], 10),
      simulationId: parseInt(match[2], 10),
      parentEpoch: parseInt(match[3], 10),
      parentSimulationId: parseInt(match[4], 10),
      parentStartFrame: parseInt(match[5], 10),
    };
  }

  const simple = name.match(/^e(\d+)s(\d+)/);
  if (simple) {
    return {
      epoch: parseInt(simple[1], 10),
      simulationId: parseInt(simple[2], 10),
      parentEpoch: null,
      parentSimulationId: null,
      parentStartFrame: null,
    };
  }

  return {
    epoch: 0,
    simulationId: 0,
    parentEpoch: null,
    parentSimulationId: null,
    parentStartFrame: null,
  };
}
