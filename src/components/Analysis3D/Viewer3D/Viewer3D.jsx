import { useEffect, useMemo, useRef, useState } from 'react';
import $3Dmol from '3dmol';
import { getMarkovStateColor } from '../../../utils/constants';
import { sortTrajectories } from '../../../utils/sortTrajectories';
import { DEFAULT_FRAME, DEFAULT_TRAJECTORY, pdbUrl } from './trajectoryConfig';
import { applyCoordsToViewer, loadFrameCoords } from './viewerTrajectory';
import Viewer3DColorBar from './Viewer3DColorBar';

export const RESIDUE_VIEWER_TITLE = 'Residue viewer';

function initialTrajectory(rows) {
  if (!rows?.length) return DEFAULT_TRAJECTORY;
  const preferred = rows.find((row) => row.name === DEFAULT_TRAJECTORY);
  return preferred?.name ?? rows[0].name;
}

const RIBBON_CARTOON = {
  color: 'spectrum',
  colorscheme: 'sinebow',
  style: 'rectangle',
  width: 1.0,
  thickness: 0.1,
  arrows: false,
  tubes: false,
  opacity: 0.65,
};

function renderViewer(viewer, stateColor, residueHighlight = null) {
  viewer.setStyle({ model: -1 }, {});
  viewer.setStyle({ model: -1 }, { cartoon: RIBBON_CARTOON });
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

  viewer.removeAllShapes();

  if (residueHighlight?.i && residueHighlight?.j) {
    const { i, j } = residueHighlight;
    viewer.addStyle(
      { model: -1, resi: [i, j], atom: 'CA' },
      {
        sphere: {
          color: '#ff7a18',
          radius: 0.75,
          opacity: 1,
        },
      }
    );

    const model = viewer.getModel();
    const caI = model?.selectedAtoms?.({ resi: i, atom: 'CA' })?.[0];
    const caJ = model?.selectedAtoms?.({ resi: j, atom: 'CA' })?.[0];
    if (caI && caJ) {
      viewer.addCylinder({
        start: { x: caI.x, y: caI.y, z: caI.z },
        end: { x: caJ.x, y: caJ.y, z: caJ.z },
        color: '#e74c3c',
        radius: 0.12,
        fromCap: 1,
        toCap: 1,
        dashed: true,
      });
    }
  }

  viewer.zoomTo({ atom: 'CA' });
  viewer.resize();
  viewer.render(undefined, { regen: true });
}

function TrajectoryControls({
  systems,
  systemId,
  onSystemChange,
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
      <select
        className="viewer-3d-select"
        value={systemId}
        onChange={(e) => onSystemChange(e.target.value)}
        aria-label="System"
      >
        {systems.map((system) => (
          <option key={system.systemId} value={system.systemId}>
            {system.label}
          </option>
        ))}
      </select>

      <select
        className="viewer-3d-select"
        value={trajectoryName}
        onChange={(e) => onTrajectoryChange(e.target.value)}
        aria-label="Trajectory"
      >
        {trajectoryRows.map((row) => (
          <option key={row.name} value={row.name}>
            {row.name}
          </option>
        ))}
      </select>

      <select
        className="viewer-3d-select viewer-3d-select--frame"
        value={safeFrame}
        onChange={(e) => onFrameChange(Number(e.target.value))}
        aria-label="Frame"
      >
        {frameOptions.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>

      <div
        className="viewer-3d-state-badge"
        style={{ color: stateColor, borderColor: stateColor }}
        aria-label={`State S${markovState}`}
      >
        S{markovState}
      </div>
    </div>
  );
}

export default function Viewer3D({
  systems = [],
  defaultSystemId,
  viewerTarget = null,
  residueHighlight = null,
}) {
  const [systemId, setSystemId] = useState(() => {
    if (defaultSystemId && systems.some((s) => s.systemId === defaultSystemId)) {
      return defaultSystemId;
    }
    return systems[0]?.systemId ?? '';
  });
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const pdbDataRef = useRef(null);
  const modelReadyRef = useRef(false);
  const [status, setStatus] = useState('loading');
  const [frameLoading, setFrameLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trajectoryName, setTrajectoryName] = useState(DEFAULT_TRAJECTORY);
  const [frameIndex, setFrameIndex] = useState(DEFAULT_FRAME);

  const activeSystem = useMemo(
    () => systems.find((system) => system.systemId === systemId) ?? systems[0],
    [systems, systemId]
  );

  const trajectoryRows = activeSystem?.trajectoryRows ?? [];

  const sortedRows = useMemo(
    () => sortTrajectories(trajectoryRows, 'order'),
    [trajectoryRows]
  );

  const selectedRow = useMemo(
    () => sortedRows.find((row) => row.name === trajectoryName) || sortedRows[0],
    [sortedRows, trajectoryName]
  );

  const markovState = selectedRow?.states?.[frameIndex] ?? 0;
  const stateColor = getMarkovStateColor(markovState);

  useEffect(() => {
    if (!viewerTarget?.systemId || !viewerTarget?.trajectoryName) return;
    if (!systems.some((system) => system.systemId === viewerTarget.systemId)) return;
    setSystemId(viewerTarget.systemId);
    setTrajectoryName(viewerTarget.trajectoryName);
    setFrameIndex(viewerTarget.frameIndex ?? 0);
  }, [
    viewerTarget?.systemId,
    viewerTarget?.trajectoryName,
    viewerTarget?.frameIndex,
    systems,
  ]);

  useEffect(() => {
    if (!systems.length) return;
    const exists = systems.some((system) => system.systemId === systemId);
    if (!exists) {
      setSystemId(systems[0].systemId);
    }
  }, [systems, systemId]);

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
    if (!systemId) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError(null);
    pdbDataRef.current = null;
    modelReadyRef.current = false;
    container.innerHTML = '';
    viewerRef.current = null;

    const viewer = $3Dmol.createViewer(container, {
      backgroundColor: '#fafafa',
    });
    viewerRef.current = viewer;

    fetch(pdbUrl(systemId))
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load PDB (${res.status})`);
        return res.text();
      })
      .then((pdbData) => {
        if (cancelled) return;
        pdbDataRef.current = pdbData;
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });

    const ro = new ResizeObserver(() => {
      if (viewerRef.current) {
        viewerRef.current.resize();
        viewerRef.current.render();
      }
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      viewerRef.current = null;
      pdbDataRef.current = null;
      modelReadyRef.current = false;
      container.innerHTML = '';
    };
  }, [systemId]);

  useEffect(() => {
    if (status !== 'ready' || !pdbDataRef.current || !trajectoryName) {
      return undefined;
    }

    const viewer = viewerRef.current;
    const pdbData = pdbDataRef.current;
    if (!viewer || !pdbData) return undefined;

    let cancelled = false;
    setFrameLoading(true);
    setError(null);

    loadFrameCoords(systemId, trajectoryName, frameIndex)
      .then((data) => {
        if (cancelled) return;

        if (!modelReadyRef.current) {
          viewer.addModel(pdbData, 'pdb', { keepH: true });
          modelReadyRef.current = true;
        }

        applyCoordsToViewer(viewer, data.coords);
        renderViewer(viewer, stateColor, residueHighlight);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setFrameLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [systemId, trajectoryName, frameIndex, status, stateColor, residueHighlight]);

  if (!systems.length || !sortedRows.length) {
    return null;
  }

  const handleSystemChange = (nextSystemId) => {
    const nextSystem = systems.find((system) => system.systemId === nextSystemId);
    if (!nextSystem) return;
    setSystemId(nextSystemId);
    setTrajectoryName(initialTrajectory(nextSystem.trajectoryRows));
    setFrameIndex(0);
  };

  return (
    <div className="viewer-3d">
      <div className="viewer-3d-toolbar">
        <h3 className="viewer-3d-title">{RESIDUE_VIEWER_TITLE}</h3>
        <TrajectoryControls
        systems={systems}
        systemId={systemId}
        onSystemChange={handleSystemChange}
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
      </div>

      {status === 'loading' && (
        <div className="viewer-3d-status">Loading residues…</div>
      )}
      {frameLoading && status === 'ready' && (
        <div className="viewer-3d-status">Loading frame…</div>
      )}
      {status === 'error' && <div className="viewer-3d-error">{error}</div>}
      {status === 'ready' && error && (
        <div className="viewer-3d-error">{error}</div>
      )}

      <div className="viewer-3d-body">
        <div
          ref={containerRef}
          className="viewer-3d-canvas"
          aria-label={`Residue view for ${activeSystem?.label ?? systemId}, ${trajectoryName}, frame ${frameIndex}, state ${markovState}`}
        />
        <Viewer3DColorBar />
      </div>
    </div>
  );
}
