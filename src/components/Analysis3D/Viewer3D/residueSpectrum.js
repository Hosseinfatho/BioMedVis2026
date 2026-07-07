import $3Dmol from '3dmol';

export const AB42_RESIDUE_COUNT = 42;

const DEFAULT_MIN = 1;
const DEFAULT_MAX = AB42_RESIDUE_COUNT;

/** Reversed Sinebow — matches 3Dmol cartoon `color: 'spectrum'`. */
export function createResidueSpectrumGradient(
  minRes = DEFAULT_MIN,
  maxRes = DEFAULT_MAX
) {
  return new $3Dmol.Gradient.Sinebow(maxRes, minRes);
}

/** 3Dmol Sinebow packs channels as R (high), B (mid), G (low). */
export function spectrumHexToCss(hex) {
  const n =
    typeof hex === 'number'
      ? hex
      : parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = n & 0xff;
  const b = (n >> 8) & 0xff;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function buildResidueSpectrumCssGradient(
  minRes = DEFAULT_MIN,
  maxRes = DEFAULT_MAX,
  steps = 64
) {
  const grad = createResidueSpectrumGradient(minRes, maxRes);
  const stops = Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const resi = minRes + t * (maxRes - minRes);
    const pct = (t * 100).toFixed(2);
    return `${spectrumHexToCss(grad.valueToHex(resi))} ${pct}%`;
  });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}

export function residueSpectrumColorScheme(
  minRes = DEFAULT_MIN,
  maxRes = DEFAULT_MAX
) {
  return {
    prop: 'resi',
    gradient: createResidueSpectrumGradient(minRes, maxRes),
  };
}
