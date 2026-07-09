import { RESIDUE_COUNT } from './stateDriverMetrics';

function markerSize(strength) {
  return 3 + Math.max(0, Math.min(1, strength)) * 10;
}

export default function LigandContactRows({
  ligandRows = [],
  width = 920,
  onContactSelect,
  selectedContact = null,
}) {
  const padL = 28;
  const padR = 28;
  const plotW = width - padL - padR;
  const rowHeight = 30;
  const svgHeight = Math.max(40, ligandRows.length * rowHeight + 16);

  const xForResidue = (residue) => {
    if (RESIDUE_COUNT <= 1) return padL;
    return padL + ((residue - 1) / (RESIDUE_COUNT - 1)) * plotW;
  };

  if (!ligandRows.length) return null;

  return (
    <div className="state-driver-ligand-wrap">
      <svg
        className="state-driver-ligand-svg"
        viewBox={`0 0 ${width} ${svgHeight}`}
        role="img"
        aria-label="Ligand contact rows for active systems"
      >
        {ligandRows.map((row, rowIndex) => {
          const y = 20 + rowIndex * rowHeight;
          return (
            <g key={row.systemId}>
              <text x={4} y={y + 4} className="state-driver-ligand-row-label" fill={row.color}>
                {row.label}
              </text>
              {row.contacts.map((contact) => {
                const key = `${row.systemId}-${contact.residue}`;
                const selected =
                  selectedContact?.systemId === row.systemId &&
                  selectedContact?.residue === contact.residue;
                return (
                  <circle
                    key={key}
                    cx={xForResidue(contact.residue)}
                    cy={y}
                    r={markerSize(contact.strength)}
                    fill={selected ? '#7570b3' : row.color}
                    fillOpacity={0.35 + contact.persistence * 0.55}
                    stroke={selected ? '#7570b3' : row.color}
                    strokeWidth={selected ? 2 : 1}
                    className="state-driver-ligand-marker"
                    onClick={() => onContactSelect?.(contact)}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
