import { useEffect, useMemo, useRef, useState } from 'react';
import {
  HILL_SAG,
  STATE_DRIVER_CHAIN_BASE_Y,
  STATE_DRIVER_CHAIN_PAD,
  buildResidueHillNodes,
  chainViewBoxString,
  computeChainViewBounds,
  residueHillWavePosition,
} from './stateDriverMetrics';

const PAD = STATE_DRIVER_CHAIN_PAD;
const CHAIN_BASE_Y = STATE_DRIVER_CHAIN_BASE_Y;
/** Left gutter for row labels (Free / TMP / SPA) so markers stay aligned with the arc. */
const LIGAND_ROW_LABEL_COL = 40;

/** Between compact and old markers; sized for readable residue labels. */
function markerRadius(/** @type {number} */ strength) {
  return 7.5 + Math.max(0, Math.min(1, strength)) * 2.5;
}

function markerOpacity(/** @type {number} */ strength, /** @type {number} */ persistence) {
  return 0.4 + Math.max(0, Math.min(1, strength)) * 0.35 + persistence * 0.15;
}

/**
 * @param {Object} props
 * @param {any[]} [props.ligandRows]
 * @param {(contact: any) => void} [props.onContactSelect]
 * @param {any | null} [props.selectedContact]
 */
export default function LigandContactRows({
  ligandRows = [],
  onContactSelect,
  selectedContact = null,
}) {
  const wrapRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const update = () => setWidth(Math.max(260, Math.floor(el.clientWidth)));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const padL = PAD.l;
  const padR = PAD.r;
  const plotW = width - padL - padR;
  const rowHeight = 30;
  const visibleRows = ligandRows.filter((row) => row.contacts.length > 0);
  const svgHeight = Math.max(40, visibleRows.length * rowHeight + 16);

  const xViewBounds = useMemo(() => {
    const nodes = buildResidueHillNodes(null, plotW, CHAIN_BASE_Y, HILL_SAG, padL);
    const bounds = computeChainViewBounds(nodes, [], { t: 0, r: 16, b: 0, l: 16 });
    return { x: bounds.x, width: bounds.width };
  }, [plotW, padL]);

  const xForResidue = (residue) =>
    residueHillWavePosition(residue, plotW, CHAIN_BASE_Y, HILL_SAG, padL).x;

  if (!visibleRows.length) return null;

  const viewX = xViewBounds.x - LIGAND_ROW_LABEL_COL;
  const viewW = xViewBounds.width + LIGAND_ROW_LABEL_COL;

  return (
    <div ref={wrapRef} className="state-driver-ligand-wrap">
      <svg
        className="state-driver-ligand-svg"
        viewBox={`${viewX} 0 ${viewW} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Ligand contact rows for active systems"
      >
        {visibleRows.map((row, rowIndex) => {
          const y = 20 + rowIndex * rowHeight;
          return (
            <g key={row.systemId}>
              <text
                x={viewX + 6}
                y={y + 4}
                className="state-driver-ligand-row-label"
                fill={row.color}
              >
                {row.label}
              </text>
              {row.contacts.map((contact) => {
                const key = `${row.systemId}-${contact.residue}`;
                const cx = xForResidue(contact.residue);
                const selected =
                  selectedContact?.systemId === row.systemId &&
                  selectedContact?.residue === contact.residue;
                const r = markerRadius(contact.strength);
                return (
                  <g
                    key={key}
                    className={`state-driver-ligand-marker-g${selected ? ' is-selected' : ''}`}
                    onClick={() => onContactSelect?.(contact)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${row.label} ligand contact residue ${contact.residue}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onContactSelect?.(contact);
                      }
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={y}
                      r={r}
                      fill={selected ? '#7570b3' : row.color}
                      fillOpacity={markerOpacity(contact.strength, contact.persistence)}
                      stroke={selected ? '#7570b3' : row.color}
                      strokeWidth={selected ? 1.5 : 0.8}
                      className="state-driver-ligand-marker"
                    />
                    <text
                      x={cx}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={Math.max(7, r * 1.5)}
                      className="state-driver-ligand-marker-label"
                      pointerEvents="none"
                    >
                      {contact.residue}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
