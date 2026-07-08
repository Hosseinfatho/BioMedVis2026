export default function TopResidualPairs({ pairs, onPairClick }) {
  if (!pairs?.length) return null;

  return (
    <div className="conf-driver-top-pairs">
      <h5 className="conf-driver-subtitle">Top residual contacts</h5>
      <ul className="conf-driver-pair-list">
        {pairs.map((pair) => {
          const key = `${pair.i}-${pair.j}`;
          const sign = pair.residual >= 0 ? '+' : '';
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
                        value: pair.residual,
                      })
                    }
              >
                <span>
                  R{pair.i}–R{pair.j}
                </span>
                <span className={pair.residual >= 0 ? 'is-more' : 'is-less'}>
                  {sign}
                  {pair.residual.toFixed(4)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
