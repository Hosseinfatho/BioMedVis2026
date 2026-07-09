import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import $3Dmol from '3dmol';
import { getMarkovStateColor } from '../../../utils/constants';
import { stateOptionsForModel } from '../../../utils/conformationalDriversData';
import { sortTrajectories } from '../../../utils/sortTrajectories';
import { DEFAULT_FRAME, DEFAULT_TRAJECTORY, pdbUrl } from './trajectoryConfig';
import { applyCoordsToViewer, loadFrameCoords } from './viewerTrajectory';
import Viewer3DColorBar from './Viewer3DColorBar';

export const VIEWER_3D_TAB_LABEL = '3DViewer';

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

function zoomToResidueClose(viewer, resi) {
  const model = viewer.getModel();
  const caAtoms = model?.selectedAtoms?.({ resi, atom: 'CA' }) ?? [];
  if (caAtoms.length > 0) {
    viewer.zoomTo({ resi, atom: 'CA' });
    viewer.zoom(0.20);
    return;
  }

  const resAtoms = model?.selectedAtoms?.({ resi }) ?? [];
  if (resAtoms.length > 0) {
    viewer.zoomTo({ resi });
    viewer.zoom(0.20);
    return;
  }

  viewer.zoomTo({ atom: 'CA' });
}

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
  } else if (residueHighlight?.i) {
    const { i } = residueHighlight;
    viewer.addStyle(
      { model: -1, resi: i },
      {
        cartoon: {
          color: '#ff7a18',
          opacity: 0.95,
        },
      }
    );
    viewer.addStyle(
      { model: -1, resi: i, atom: 'CA' },
      {
        sphere: {
          color: '#ff7a18',
          radius: 0.85,
          opacity: 1,
        },
      }
    );
  }

  if (residueHighlight?.i && !residueHighlight?.j) {
    zoomToResidueClose(viewer, residueHighlight.i);
  } else {
    viewer.zoomTo({ atom: 'CA' });
  }
  viewer.resize();
  viewer.render(undefined, { regen: true });
}

function firstFrameForState(states, targetState, preferredIndex = 0) {
  const target = Number(targetState);
  if (!states?.length || !Number.isFinite(target)) return -1;
  const fromPreferred = states.findIndex(
    (state, index) => Number(state) === target && index >= preferredIndex
  );
  if (fromPreferred >= 0) return fromPreferred;
  return states.findIndex((state) => Number(state) === target);
}

function frameStateAt(row, frameIndex) {
  const state = row?.states?.[frameIndex];
  return Number.isFinite(Number(state)) ? Number(state) : 0;
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
  selectedState,
  stateOptions,
  onStateChange,
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
        className="viewer-3d-select viewer-3d-select--system"
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
        className="viewer-3d-select viewer-3d-select--trajectory"
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

      <select
        className="viewer-3d-select viewer-3d-select--state"
        value={selectedState}
        onChange={(e) => onStateChange(Number(e.target.value))}
        aria-label="State"
      >
        {stateOptions.map((state) => (
          <option key={state} value={state}>
            State-{state}
          </option>
        ))}
      </select>

      <div
        className="viewer-3d-state-badge"
        style={{ color: stateColor, borderColor: stateColor }}
        aria-label={`State S${selectedState}`}
      >
        S{selectedState}
      </div>
    </div>
  );
}

export default function Viewer3D({
  systems = [],
  defaultSystemId,
  defaultModelId = 'states2',
  markovState,
  onMarkovStateChange,
  viewerTarget = null,
  onViewerTargetChange,
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
  const [selectedState, setSelectedState] = useState(0);

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

  const frameState = frameStateAt(selectedRow, frameIndex);
  const stateColor = getMarkovStateColor(selectedState);

  const stateOptions = useMemo(
    () => stateOptionsForModel(defaultModelId),
    [defaultModelId]
  );

  const handleFrameChange = useCallback(
    (nextFrame) => {
      const frameState = frameStateAt(selectedRow, nextFrame);
      setFrameIndex(nextFrame);
      setSelectedState(frameState);
      onMarkovStateChange?.(frameState);
      onViewerTargetChange?.({
        systemId,
        trajectoryName,
        frameIndex: nextFrame,
        state: frameState,
      });
    },
    [selectedRow, systemId, trajectoryName, onMarkovStateChange, onViewerTargetChange]
  );

  const handleStateChange = useCallback(
    (nextState) => {
      const target = Number(nextState);
      if (!Number.isFinite(target)) return;
      setSelectedState(target);
      onMarkovStateChange?.(target);
      const states = selectedRow?.states ?? [];
      const nextFrame = firstFrameForState(states, target, 0);
      const resolvedFrame = nextFrame >= 0 ? nextFrame : frameIndex;
      if (nextFrame >= 0) {
        setFrameIndex(nextFrame);
      }
      onViewerTargetChange?.({
        systemId,
        trajectoryName,
        frameIndex: resolvedFrame,
        state: target,
      });
    },
    [
      selectedRow,
      systemId,
      trajectoryName,
      frameIndex,
      onMarkovStateChange,
      onViewerTargetChange,
    ]
  );

  useEffect(() => {
    if (markovState == null || !Number.isFinite(Number(markovState))) return;
    const next = Number(markovState);
    if (next !== selectedState) {
      setSelectedState(next);
    }
  }, [markovState, selectedState]);

  useEffect(() => {
    if (!viewerTarget?.systemId || !viewerTarget?.trajectoryName) return;
    if (!systems.some((system) => system.systemId === viewerTarget.systemId)) return;
    const nextFrame =
      viewerTarget.frameIndex != null ? viewerTarget.frameIndex : 0;
    const targetSystem = systems.find((system) => system.systemId === viewerTarget.systemId);
    const targetRow = targetSystem?.trajectoryRows?.find(
      (row) => row.name === viewerTarget.trajectoryName
    );
    setSystemId(viewerTarget.systemId);
    setTrajectoryName(viewerTarget.trajectoryName);
    setFrameIndex(nextFrame);
    if (viewerTarget.state != null && Number.isFinite(Number(viewerTarget.state))) {
      setSelectedState(Number(viewerTarget.state));
      onMarkovStateChange?.(Number(viewerTarget.state));
    } else {
      const syncedState = frameStateAt(targetRow, nextFrame);
      setSelectedState(syncedState);
      onMarkovStateChange?.(syncedState);
    }
  }, [
    viewerTarget?.systemId,
    viewerTarget?.trajectoryName,
    viewerTarget?.frameIndex,
    viewerTarget?.state,
    systems,
    onMarkovStateChange,
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
      const nextTrajectory = initialTrajectory(sortedRows);
      const nextRow = sortedRows.find((row) => row.name === nextTrajectory);
      setTrajectoryName(nextTrajectory);
      setFrameIndex(0);
      setSelectedState(frameStateAt(nextRow, 0));
    }
  }, [sortedRows, trajectoryName]);

  useEffect(() => {
    if (!selectedRow) return;
    const maxFrame = Math.max(0, selectedRow.length - 1);
    if (frameIndex > maxFrame) {
      handleFrameChange(maxFrame);
    }
  }, [selectedRow, frameIndex, handleFrameChange]);

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
      backgroundColor: '#ffffff',
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
        renderViewer(viewer, getMarkovStateColor(selectedState), residueHighlight);
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
  }, [systemId, trajectoryName, frameIndex, status, selectedState, residueHighlight]);

  if (!systems.length || !sortedRows.length) {
    return null;
  }

  const handleSystemChange = (nextSystemId) => {
    const nextSystem = systems.find((system) => system.systemId === nextSystemId);
    if (!nextSystem) return;
    const nextTrajectory = initialTrajectory(nextSystem.trajectoryRows);
    const nextRow = nextSystem.trajectoryRows?.find((row) => row.name === nextTrajectory);
    setSystemId(nextSystemId);
    setTrajectoryName(nextTrajectory);
    setFrameIndex(0);
    setSelectedState(frameStateAt(nextRow, 0));
  };

  return (
    <section className="viewer-3d-panel" aria-label="3D viewer panel">
      <div className="viewer-3d-panel-header">
        <div className="viewer-3d-panel-tabs" role="tablist" aria-label="3D viewer views">
          <button
            type="button"
            role="tab"
            className="viewer-3d-panel-tab is-active"
            aria-selected
            id="viewer-3d-tab-main"
            aria-controls="viewer-3d-panel-main"
          >
            {VIEWER_3D_TAB_LABEL}
          </button>
        </div>

        <div className="viewer-3d-toolbar">
          <TrajectoryControls
            systems={systems}
            systemId={systemId}
            onSystemChange={handleSystemChange}
            trajectoryRows={sortedRows}
            trajectoryName={trajectoryName}
            onTrajectoryChange={(name) => {
              const nextRow = sortedRows.find((row) => row.name === name);
              setTrajectoryName(name);
              setFrameIndex(0);
              setSelectedState(frameStateAt(nextRow, 0));
            }}
            frameIndex={frameIndex}
            onFrameChange={handleFrameChange}
            selectedState={selectedState}
            stateOptions={stateOptions}
            onStateChange={handleStateChange}
            stateColor={stateColor}
          />
        </div>
      </div>

      <div
        className="viewer-3d-panel-body"
        role="tabpanel"
        id="viewer-3d-panel-main"
        aria-labelledby="viewer-3d-tab-main"
      >
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
            aria-label={`3D view for ${activeSystem?.label ?? systemId}, ${trajectoryName}, frame ${frameIndex}, state ${frameState}`}
          />
          <Viewer3DColorBar />
        </div>
      </div>
    </section>
  );
}
