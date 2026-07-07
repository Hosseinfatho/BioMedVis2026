import { useEffect, useMemo, useRef, useState } from 'react';
import $3Dmol from '3dmol';
import { getMarkovStateColor } from '../../../utils/constants';
import { DEFAULT_FRAME, DEFAULT_TRAJECTORY, pdbUrl } from './trajectoryConfig';
import Viewer3DColorBar from './Viewer3DColorBar';

function initialTrajectory(rows) {
  if (!rows?.length) return DEFAULT_TRAJECTORY;
  const preferred = rows.find((row) => row.name === DEFAULT_TRAJECTORY);
  return preferred?.name ?? rows[0].name;
}

function applyRibbonStyle(viewer) {
  viewer.setStyle(
    { model: -1 },
    {
      cartoon: {
        color: 'spectrum',
        colorscheme: 'sinebow',
        style: 'oval',
        thickness: 0.25,
        opacity: 0.55,
      },
    }
  );
}

function applySphereStateColor(viewer, stateColor) {
  viewer.addStyle(
    { model: -1, atom: 'CA' },
    {
      sphere: {
        color: stateColor,
        radius: 0.5,
        opacity: 1,
      },
    }
  );
}

function TrajectoryControls({
  trajectoryRows,
  trajectoryName,
  onTrajectoryChange,
  frameIndex,
  onFrameChange,
  markovState,
  stateColor,
}) {
  const selected =
    trajectoryRows.find((row) => row.name === trajectoryName) || trajectoryRows[0];
  const maxFrame = Math.max(0, (selected?.length ?? 1) - 1);
  const safeFrame = Math.min(frameIndex, maxFrame);

  const frameOptions = useMemo(
    () => Array.from({ length: maxFrame + 1 }, (_, i) => i),
    [maxFrame]
  );

  return (
    <div className="viewer-3d-controls">
      <label className="viewer-3d-field">
        Trajectory
        <select
          value={trajectoryName}
          onChange={(e) => onTrajectoryChange(e.target.value)}
        >
          {trajectoryRows.map((row) => (
            <option key={row.name} value={row.name}>
              {row.name}
            </option>
          ))}
        </select>
      </label>

      <label className="viewer-3d-field">
        Frame
        <select
          value={safeFrame}
          onChange={(e) => onFrameChange(Number(e.target.value))}
        >
          {frameOptions.map((i) => (
            <option key={i} value={i}>
              Frame {i}
            </option>
          ))}
        </select>
      </label>

      <div className="viewer-3d-state-field">
        <span className="viewer-3d-state-field-label">State</span>
        <span
          className="viewer-3d-state-value"
          style={{ color: stateColor, borderColor: stateColor }}
        >
          S{markovState}
        </span>
      </div>
    </div>
  );
}

export default function Viewer3D({ systemId, trajectoryRows = [] }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [trajectoryName, setTrajectoryName] = useState(() =>
    initialTrajectory(trajectoryRows)
  );
  const [frameIndex, setFrameIndex] = useState(DEFAULT_FRAME);

  const sortedRows = useMemo(
    () =>
      [...trajectoryRows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    [trajectoryRows]
  );

  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.name === trajectoryName) || sortedRows[0],
    [sortedRows, trajectoryName]
  );

  const markovState = selectedRow?.states?.[frameIndex] ?? 0;
  const stateColor = getMarkovStateColor(markovState);

  useEffect(() => {
    if (!sortedRows.length) return;
    const exists = sortedRows.some((row) => row.name === trajectoryName);
    if (!exists) {
      setTrajectoryName(initialTrajectory(sortedRows));
      setFrameIndex(0);
    }
  }, [sortedRows, trajectoryName]);

  useEffect(() => {
    if (!selectedRow) return;
    const maxFrame = Math.max(0, selectedRow.length - 1);
    if (frameIndex > maxFrame) setFrameIndex(maxFrame);
  }, [selectedRow, frameIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError(null);
    container.innerHTML = '';
    viewerRef.current = null;

    const viewer = $3Dmol.createViewer(container, {
      backgroundColor: '#fafafa',
    });

    const url = pdbUrl(systemId);

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load PDB (${res.status})`);
        return res.text();
      })
      .then((pdbData) => {
        if (cancelled) return;
        viewer.addModel(pdbData, 'pdb');
        applyRibbonStyle(viewer);

        if (typeof viewer.addResLabels === 'function') {
          viewer.addResLabels({
            font: '9px sans-serif',
            fontColor: '#333333',
            screenOffset: { x: 0.3, y: 0.3 },
          });
        }

        viewer.zoomTo({ atom: 'CA' });
        viewerRef.current = viewer;
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      container.innerHTML = '';
    };
  }, [systemId]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || status !== 'ready') return;

    applyRibbonStyle(viewer);
    applySphereStateColor(viewer, stateColor);
    viewer.render();
  }, [status, stateColor, markovState, frameIndex]);

  if (!sortedRows.length) {
    return null;
  }

  return (
    <div className="viewer-3d">
      <TrajectoryControls
        trajectoryRows={sortedRows}
        trajectoryName={trajectoryName}
        onTrajectoryChange={(name) => {
          setTrajectoryName(name);
          setFrameIndex(0);
        }}
        frameIndex={frameIndex}
        onFrameChange={setFrameIndex}
        markovState={markovState}
        stateColor={stateColor}
      />

      {status === 'loading' && (
        <div className="viewer-3d-status">Loading residues…</div>
      )}
      {status === 'error' && <div className="viewer-3d-error">{error}</div>}

      <div className="viewer-3d-body">
        <div
          ref={containerRef}
          className="viewer-3d-canvas"
          aria-label={`Residue view for ${trajectoryName}, frame ${frameIndex}, state ${markovState}`}
        />
        <Viewer3DColorBar />
      </div>
    </div>
  );
}
