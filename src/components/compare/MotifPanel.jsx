import { useMemo, useState } from 'react';
import { motifFromStates } from '../../utils/motifs';

export default function MotifPanel({
  numStates,
  onActiveMotifChange,
}) {
  const [draftStates, setDraftStates] = useState([]);

  const draftMotif = useMemo(() => motifFromStates(draftStates), [draftStates]);
  const stateOptions = useMemo(
    () => Array.from({ length: numStates }, (_, i) => i),
    [numStates]
  );

  const appendState = (state) => {
    setDraftStates((prev) => {
      if (prev.length && prev[prev.length - 1] === state) return prev;
      return [...prev, state];
    });
  };

  const applyDraft = () => {
    if (!draftMotif) return;
    onActiveMotifChange(draftMotif);
  };

  const clearAll = () => {
    setDraftStates([]);
    onActiveMotifChange(null);
  };

  return (
    <div className="motif-panel">
      <span className="motif-panel-label">Motif pattern</span>
      <div className="motif-state-buttons">
        {stateOptions.map((s) => (
          <button
            key={s}
            type="button"
            className="motif-state-btn"
            onClick={() => appendState(s)}
          >
            S{s}
          </button>
        ))}
      </div>
      <span className="motif-draft-label">
        {draftStates.length ? draftStates.join(' → ') : 'Click states…'}
      </span>
      <div className="motif-action-group">
        <button
          type="button"
          className="motif-action-btn"
          onClick={applyDraft}
          disabled={!draftMotif}
        >
          Apply
        </button>
        <button type="button" className="motif-action-btn secondary" onClick={clearAll}>
          Clear
        </button>
      </div>
    </div>
  );
}
