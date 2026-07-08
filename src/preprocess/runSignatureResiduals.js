import { buildSignatureResiduals } from './buildSignatureResiduals.js';

const systems = process.argv.slice(2);

async function main() {
  process.stdout.write('Building state_signature_residuals.json…\n');
  const result = buildSignatureResiduals({
    systems: systems.length ? systems : undefined,
  });
  process.stdout.write(
    `Wrote ${result.groupCount} state groups → ${result.outputPath}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
