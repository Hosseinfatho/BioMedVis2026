import {
  AB42_RESIDUE_COUNT,
  buildResidueSpectrumCssGradient,
} from './residueSpectrum';

export { AB42_RESIDUE_COUNT };

export default function Viewer3DColorBar({
  residueCount = AB42_RESIDUE_COUNT,
}) {
  const gradient = buildResidueSpectrumCssGradient(1, residueCount);

  return (
    <div
      className="viewer-3d-colorbar"
      aria-label="Residue position color scale for ribbon"
    >
      <div className="viewer-3d-colorbar-title">Residue</div>

      <div className="viewer-3d-colorbar-track">
        <div
          className="viewer-3d-colorbar-gradient"
          style={{ background: gradient }}
        />
        <div className="viewer-3d-colorbar-labels">
          <span>1 (N)</span>
          <span>{residueCount} (C)</span>
        </div>
      </div>
    </div>
  );
}
