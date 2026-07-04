// Trajectory names look like `e10s10_e3s15p0f841`. The part before `_` is the
// adaptive-sampling slot and exists in every system.
export function slotKey(name) {
  if (!name) return '';
  return name.split('_')[0];
}
