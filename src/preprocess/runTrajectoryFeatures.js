import path from 'node:path';
import {
  buildTrajectoryFeaturesFromFrameIndex,
  TRAJECTORY_FEATURE_COLUMNS,
  writeTrajectoryFeaturesCsv,
} from './buildTrajectoryFeatures.js';
import { OUTPUT_DIR } from './paths.js';

const OUTPUT_FILE = path.join(OUTPUT_DIR, 'trajectory_features.csv');

async function main() {
  process.stdout.write('Reading frame_index.csv… ');
  const rows = await buildTrajectoryFeaturesFromFrameIndex();
  process.stdout.write(`${rows.length.toLocaleString()} trajectories\n`);

  writeTrajectoryFeaturesCsv(rows, OUTPUT_FILE, TRAJECTORY_FEATURE_COLUMNS);
  process.stdout.write(
    `Wrote ${rows.length.toLocaleString()} rows → ${OUTPUT_FILE}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
