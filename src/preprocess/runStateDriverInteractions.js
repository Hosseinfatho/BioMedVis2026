import { buildStateDriverInteractions } from './buildStateDriverInteractions.js';

async function main() {
  process.stdout.write('Building state_driver_interactions.json (zsab2, zsab3, zsab4)…\n');
  const result = await buildStateDriverInteractions();
  process.stdout.write(`Wrote ${result.groupCount} groups → ${result.outputPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
