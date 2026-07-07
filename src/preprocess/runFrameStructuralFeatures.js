import {
  buildFrameStructuralFeatures,
} from './buildFrameStructuralFeatures.js';

const limitPerSystem = process.env.PREPROCESS_LIMIT
  ? Number.parseInt(process.env.PREPROCESS_LIMIT, 10)
  : null;

const systems = process.argv.slice(2);

async function main() {
  process.stdout.write('Building frame_structural_features.csv…\n');

  const result = buildFrameStructuralFeatures({
    systems: systems.length ? systems : undefined,
    limitPerSystem,
  });

  process.stdout.write(
    `Processed ${result.trajectoryCount} trajectories → ${result.outputPath}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
