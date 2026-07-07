import Viewer3D from './Viewer3D/Viewer3D';

export const ANALYSIS_3D_TITLE = '3D residue analysis';

export default function Analysis3D({ systemId, trajectoryRows = [] }) {
  if (!trajectoryRows?.length) {
    return null;
  }

  return (
    <div className="analysis-3d-section">
      <section className="analysis-3d">
        <div className="analysis-3d-header">
          <h3 className="analysis-3d-title">{ANALYSIS_3D_TITLE}</h3>
        </div>

        <Viewer3D systemId={systemId} trajectoryRows={trajectoryRows} />
      </section>
    </div>
  );
}
