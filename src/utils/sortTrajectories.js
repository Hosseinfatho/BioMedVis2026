export function sortTrajectories(trajectories, sortBy = 'order') {
  const sorted = [...trajectories];

  switch (sortBy) {
    case 'epoch':
      sorted.sort((a, b) => a.epoch - b.epoch || a.simulationId - b.simulationId);
      break;
    case 'dominantState':
      sorted.sort(
        (a, b) =>
          (a.features?.dominantState ?? 0) - (b.features?.dominantState ?? 0) ||
          a.orderIndex - b.orderIndex
      );
      break;
    case 'transitions':
      sorted.sort(
        (a, b) =>
          (b.features?.numStateChanges ?? 0) - (a.features?.numStateChanges ?? 0)
      );
      break;
    case 'support':
      sorted.sort((a, b) => (b.features?.support ?? 0) - (a.features?.support ?? 0));
      break;
  case 'feature':
      if (sorted[0]?.sortFeatureKey !== undefined) {
        const key = sorted[0].sortFeatureKey;
        sorted.sort((a, b) => (b.features?.[key] ?? 0) - (a.features?.[key] ?? 0));
      }
      break;
    case 'order':
    default:
      sorted.sort(
        (a, b) =>
          a.orderIndex - b.orderIndex ||
          a.epoch - b.epoch ||
          a.simulationId - b.simulationId ||
          a.name.localeCompare(b.name)
      );
  }

  return sorted;
}
