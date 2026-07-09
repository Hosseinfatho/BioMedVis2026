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
      <div className="viewer-3d-colorbar-track">
        <span className="viewer-3d-colorbar-label viewer-3d-colorbar-label--top">
          1 (N)
        </span>
        <div
          className="viewer-3d-colorbar-gradient"
          style={{ background: gradient }}
        />
        <span className="viewer-3d-colorbar-label viewer-3d-colorbar-label--bottom">
          {residueCount} (C)
        </span>
      </div>
    </div>
  );
}
