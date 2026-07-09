import { COLORS, SYSTEM_STYLE, systemLabel } from './stateDriverMetrics';

export default function InteractionLegend({ activeSystems = [] }) {
  const items = [
    ...activeSystems.map((systemId) => ({
      swatch: SYSTEM_STYLE[systemId]?.color ?? '#888',
      label: `${systemLabel(systemId)} stronger / dominant`,
    })),
    { swatch: COLORS.shared, label: 'Shared interaction (gray)' },
    { swatch: COLORS.selected, label: 'Selected interaction' },
  ];

  if (activeSystems.length <= 1) {
    items.splice(items.length - 2, 1);
  }

  return (
    <div className="state-driver-legend" aria-label="Interaction legend">
      <div className="state-driver-legend-items">
        {items.map((item) => (
          <div key={item.label} className="state-driver-legend-item">
            <span className="state-driver-legend-swatch" style={{ background: item.swatch }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="state-driver-legend-encodings">
        <span>Arc width → interaction strength</span>
        <span>Arc opacity → persistence</span>
        <span>Arc height → sequence distance |i−j|</span>
        <span>Residue circles → proximity (nodes only, no backbone line)</span>
      </div>
    </div>
  );
}
