import { useState, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import Comparison from './components/comparison/Comparison';
import Compare from './components/compare/Compare';
import { MODELS } from './config/dataFiles';
import { DEFAULT_SYSTEM_B_TIME_OFFSET } from './utils/constants';
import { loadSystemData } from './utils/loadSystemData';

export default function App() {
  const [selectedSystems, setSelectedSystems] = useState(['zsab2']);
  const [selectedModel, setSelectedModel] = useState('states3');
  const [viewMode, setViewMode] = useState('original');
  const [systemData, setSystemData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [selection, setSelection] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [matrixSlots, setMatrixSlots] = useState([]);
  const [activeMotif, setActiveMotif] = useState(null);
  const [hoveredMotif, setHoveredMotif] = useState(null);
  const [chartTimeOffsetB, setChartTimeOffsetB] = useState(
    DEFAULT_SYSTEM_B_TIME_OFFSET
  );

  const numStates = MODELS[selectedModel].numStates;

  const handleActiveMotifChange = useCallback((motif) => {
    setActiveMotif(motif);
    setHoveredMotif(null);
  }, []);

  const handleMotifHoverChange = useCallback((systemId, occurrenceIndex) => {
    if (occurrenceIndex == null) {
      setHoveredMotif(null);
      return;
    }
    setHoveredMotif({ systemId, occurrenceIndex });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedSystems.length) return;

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        selectedSystems.map(async (systemId) => {
          const rows = await loadSystemData(systemId, selectedModel, viewMode);
          const originalRows =
            viewMode === 'concatenated'
              ? await loadSystemData(systemId, selectedModel, 'original')
              : null;
          return { systemId, rows, viewMode, originalRows };
        })
      );
      setSystemData(results);
      setGenerated(true);
      setChartTimeOffsetB(DEFAULT_SYSTEM_B_TIME_OFFSET);
    } catch (err) {
      setError(err.message);
      setSystemData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSystems, selectedModel, viewMode]);

  return (
    <div className="dashboard">
      <ControlPanel
        selectedSystems={selectedSystems}
        onSystemsChange={setSelectedSystems}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onGenerate={handleGenerate}
        loading={loading}
      />

      {error && <div className="error-banner">{error}</div>}

      {!generated && !loading && (
        <div className="empty-state">
          Select systems, state model, and view mode, then click{' '}
          <strong>Generate</strong>.
        </div>
      )}

      <Comparison
        systemData={systemData}
        selectedModel={selectedModel}
        numStates={numStates}
        selection={selection}
        hoverIndex={hoverIndex}
        matrixSlots={matrixSlots}
        activeMotif={activeMotif}
        hoveredMotif={hoveredMotif}
        onMotifHoverChange={handleMotifHoverChange}
        chartTimeOffsetB={chartTimeOffsetB}
        onChartTimeOffsetBChange={setChartTimeOffsetB}
      />

      {generated && (
        <Compare
          selectedModel={selectedModel}
          numStates={numStates}
          defaultA={selectedSystems[0]}
          defaultB={selectedSystems[1]}
          selection={selection}
          onSelectionChange={setSelection}
          hoverIndex={hoverIndex}
          onHoverChange={setHoverIndex}
          onSlotsChange={setMatrixSlots}
          activeMotif={activeMotif}
          onActiveMotifChange={handleActiveMotifChange}
          hoveredMotif={hoveredMotif}
          onMotifHoverChange={handleMotifHoverChange}
        />
      )}
    </div>
  );
}
