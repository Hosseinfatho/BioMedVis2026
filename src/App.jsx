import { useState, useCallback } from 'react';
import ControlPanel from './components/ControlPanel';
import Comparison from './components/comparison/Comparison';
import Compare from './components/compare/Compare';
import { MODELS } from './config/dataFiles';
import { loadSystemData } from './utils/loadSystemData';

export default function App() {
  const [selectedSystems, setSelectedSystems] = useState(['zsab2']);
  const [selectedModel, setSelectedModel] = useState('states3');
  const [viewMode, setViewMode] = useState('original');
  const [systemData, setSystemData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generated, setGenerated] = useState(false);
  // trajectory window shared between the compare matrices and the charts
  const [selection, setSelection] = useState(null);
  // hovered trajectory column, highlighted as a crosshair on the charts
  const [hoverIndex, setHoverIndex] = useState(null);
  const [matrixSlots, setMatrixSlots] = useState([]);

  const numStates = MODELS[selectedModel].numStates;

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
        />
      )}
    </div>
  );
}
