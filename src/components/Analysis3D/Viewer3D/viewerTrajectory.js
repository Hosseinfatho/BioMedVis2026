const frameCache = new Map();

function cacheKey(systemId, trajectoryName, frameIndex) {
  return `${systemId}:${trajectoryName}:${frameIndex}`;
}

function frameApiBase() {
  // Optional external backend (e.g. hosted Python XTC service) so that the
  // static GitHub Pages build can still play trajectories when configured.
  // Set VITE_FRAME_API_BASE to something like "https://my-api.onrender.com".
  const base = import.meta.env.VITE_FRAME_API_BASE;
  if (base && typeof base === 'string' && base.trim()) {
    return base.trim().replace(/\/+$/, '');
  }
  return window.location.origin;
}

export async function loadFrameCoords(systemId, trajectoryName, frameIndex) {
  const key = cacheKey(systemId, trajectoryName, frameIndex);
  if (frameCache.has(key)) {
    return frameCache.get(key);
  }

  const url = new URL('/api/trajectory-frame', frameApiBase());
  url.searchParams.set('system', systemId);
  url.searchParams.set('trajectory', trajectoryName);
  url.searchParams.set('frame', String(frameIndex));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Failed to load frame from XTC (${res.status})`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  frameCache.set(key, data);
  return data;
}

export function applyCoordsToViewer(viewer, coords) {
  if (!viewer || !coords?.length) return false;

  const model = viewer.getModel();
  if (!model?.atoms?.length) return false;

  if (model.atoms.length !== coords.length) {
    console.warn(
      `Viewer atom count (${model.atoms.length}) != frame coords (${coords.length})`
    );
  }

  for (const atom of model.atoms) {
    const idx = (atom.serial ?? 0) - 1;
    if (idx < 0 || idx >= coords.length) continue;
    const c = coords[idx];
    atom.x = c[0];
    atom.y = c[1];
    atom.z = c[2];
  }

  model.molObj = null;
  if (model.renderedMolObj && viewer.modelGroup) {
    model.removegl(viewer.modelGroup);
  }
  return true;
}
