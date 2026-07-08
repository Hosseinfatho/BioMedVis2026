export default function StateSignatureTopPairs({ pairs, onPairClick }) {
  if (!pairs?.length) return null;

  return (
    <div className="conf-driver-top-pairs">
      <h5 className="conf-driver-subtitle">Top pairs</h5>
      <ul className="conf-driver-pair-list">
        {pairs.map((pair) => {
          const key = `${pair.i}-${pair.j}`;
          return (
            <li key={key}>
              <button
                type="button"
                className="conf-driver-pair-btn"
                onClick={() =>
                  onPairClick?.({
                    i: pair.i,
                    j: pair.j,
                    row: pair.i - 1,
                    col: pair.j - 1,
                    value: pair.stableFraction,
                  })
                }
              >
                <span>
                  R{pair.i}–R{pair.j}
                </span>
                <span className="is-more">
                  {(pair.stableFraction * 100).toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
