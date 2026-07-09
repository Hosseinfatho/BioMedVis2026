import { useCallback, useEffect, useState } from 'react';

export default function StateDriverArcLimit({ value, max, total, onChange }) {
  const [draft, setDraft] = useState(String(value));
  const maxArcs = Math.max(1, max || 1);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(
    (raw = draft) => {
      const parsed = Math.round(Number(raw));
      if (!Number.isFinite(parsed)) {
        setDraft(String(value));
        return;
      }
      const clamped = Math.max(1, Math.min(maxArcs, parsed));
      setDraft(String(clamped));
      onChange(clamped);
    },
    [draft, maxArcs, onChange, value]
  );

  return (
    <label className="state-driver-arc-limit state-driver-arc-limit--toolbar">
      <span className="state-driver-arc-limit-label">Arcs</span>
      <input
        className="state-driver-arc-limit-input"
        type="number"
        min={1}
        max={maxArcs}
        step={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
          }
        }}
        aria-label="Number of arcs to display"
      />
      {total > 0 ? <span className="state-driver-arc-limit-total">/ {total}</span> : null}
      {total > 0 && value < total ? (
        <button type="button" className="state-driver-arc-limit-all" onClick={() => commit(total)}>
          All
        </button>
      ) : null}
    </label>
  );
}
