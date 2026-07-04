export function computeSignal(states) {
  return states.map((state, index) => {
    if (index === 0) return 0;
    return state !== states[index - 1] ? 1 : 0;
  });
}
