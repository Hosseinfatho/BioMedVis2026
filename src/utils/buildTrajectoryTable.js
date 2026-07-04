import { parseEpoch } from './parseEpoch';

export function buildTrajectoryTable(parsedStates, orderMap = new Map()) {
  return parsedStates.map((traj) => {
    const epochInfo = parseEpoch(traj.name);
    const orderEntry = orderMap.get(traj.name);
    const orderIndex = orderEntry ? orderEntry.orderIndex : Infinity;
    const startTime = orderEntry ? orderEntry.startTime : 0;

    return {
      name: traj.name,
      states: traj.states,
      length: traj.length,
      ...epochInfo,
      orderIndex,
      startTime,
    };
  });
}
