import { residualColor } from '../../../../../utils/conformationalDriversData';

function buildResidualCssGradient() {
  const high = residualColor(1, 1);
  const mid = residualColor(0, 1);
  const low = residualColor(-1, 1);
  return `linear-gradient(to bottom, ${high}, ${mid}, ${low})`;
}

export default function ResidualColorBar() {
  return (
    <div className="conf-driver-colorbar" aria-label="Residual contact scale">
      <div className="conf-driver-colorbar-track">
        <div
          className="conf-driver-colorbar-gradient"
          style={{ background: buildResidualCssGradient() }}
        />
        <div className="conf-driver-colorbar-labels">
          <span>High</span>
          <span>Low</span>
        </div>
      </div>
    </div>
  );
}

