import { useEffect, useRef, useState } from 'react';
import $3Dmol from '3dmol';
import { pdbUrl } from './trajectoryConfig';

export default function MoleculeViewer3D({
  systemId,
  trajectoryName,
  frameIndex = 0,
}) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    setStatus('loading');
    setError(null);
    container.innerHTML = '';

    const viewer = $3Dmol.createViewer(container, {
      backgroundColor: '#f8fafc',
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
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
        viewer.addStyle({ atom: 'CA' }, { sphere: { radius: 0.3, color: 'gray' } });
        viewer.zoomTo();
        viewer.render();
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
      container.innerHTML = '';
    };
  }, [systemId, trajectoryName]);

  return (
    <div className="molecule-viewer-3d">
      <div className="molecule-viewer-3d-header">
        <strong>3D structure</strong>
        <span className="molecule-viewer-3d-meta">
          {trajectoryName} · frame {frameIndex}
        </span>
      </div>
      {status === 'loading' && (
        <div className="molecule-viewer-3d-status">Loading structure…</div>
      )}
      {status === 'error' && (
        <div className="molecule-viewer-3d-error">{error}</div>
      )}
      <div
        ref={containerRef}
        className="molecule-viewer-3d-canvas"
        aria-label="Interactive 3D molecular viewer"
      />
    </div>
  );
}
