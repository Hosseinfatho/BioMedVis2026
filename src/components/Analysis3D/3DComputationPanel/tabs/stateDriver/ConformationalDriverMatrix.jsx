import { useCallback, useEffect, useRef, useState } from 'react';
import { AB42_RESIDUE_COUNT } from '../../../Viewer3D/residueSpectrum';
import { residualColor } from '../../../../../utils/conformationalDriversData';
import ResidualColorBar from './ResidualColorBar';

const LABEL_W = 22;
const LABEL_H = 18;
const COLORBAR_W = 44;
const WRAP_GAP = 8;
const MIN_CELL = 3;

function hitCell(layout, clientX, clientY, canvas) {
  if (!layout || !canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const col = Math.floor((x - layout.labelW) / layout.cell);
  const row = Math.floor((y - layout.labelH) / layout.cell);

  if (
    col < 0 ||
    row < 0 ||
    col >= layout.size ||
    row >= layout.size ||
    x < layout.labelW ||
    y < layout.labelH
  ) {
    return null;
  }

  return { row, col, i: row + 1, j: col + 1 };
}

export default function ConformationalDriverMatrix({
  matrix,
  maxAbs = 1,
  selectedPair = null,
  onCellSelect,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const layoutRef = useRef(null);
  const [hoverPair, setHoverPair] = useState(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !matrix?.length) return;

    const size = matrix.length;
    const availW = Math.max(80, wrap.clientWidth - COLORBAR_W - WRAP_GAP);
    const availH = Math.max(80, wrap.clientHeight);
    const plotW = availW - LABEL_W;
    const plotH = availH - LABEL_H;
    const cell = Math.max(
      MIN_CELL,
      Math.floor(Math.min(plotH, plotW) / size)
    );
    const width = LABEL_W + cell * size;
    const height = LABEL_H + cell * size;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, width, height);

    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const value = matrix[row][col];
        ctx.fillStyle = residualColor(value, maxAbs);
        ctx.fillRect(LABEL_W + col * cell, LABEL_H + row * cell, cell, cell);
      }
    }

    // One marker on the clicked contact cell only (e.g. row 14 × col 17)
    if (selectedPair?.i && selectedPair?.j && selectedPair.i !== selectedPair.j) {
      const row = selectedPair.row ?? selectedPair.i - 1;
      const col = selectedPair.col ?? selectedPair.j - 1;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        LABEL_W + col * cell + 0.5,
        LABEL_H + row * cell + 0.5,
        cell - 1,
        cell - 1
      );
    }

    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= size; i += 1) {
      if (i % 5 !== 0 && i !== 1 && i !== size) continue;
      const idx = i - 1;
      ctx.fillText(String(i), LABEL_W - 4, LABEL_H + idx * cell + cell / 2);
      ctx.textAlign = 'center';
      ctx.fillText(String(i), LABEL_W + idx * cell + cell / 2, LABEL_H - 5);
      ctx.textAlign = 'right';
    }

    layoutRef.current = { cell, size, width, height, labelW: LABEL_W, labelH: LABEL_H };
  }, [matrix, maxAbs, selectedPair]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const handleClick = (event) => {
    const hit = hitCell(layoutRef.current, event.clientX, event.clientY, canvasRef.current);
    if (!hit || !onCellSelect) return;
    if (hit.i === hit.j) return;

    onCellSelect({
      i: hit.i,
      j: hit.j,
      row: hit.row,
      col: hit.col,
      value: matrix[hit.row][hit.col],
    });
  };

  const handleMove = (event) => {
    const hit = hitCell(layoutRef.current, event.clientX, event.clientY, canvasRef.current);
    if (!hit || hit.i === hit.j) {
      setHoverPair(null);
      return;
    }
    setHoverPair({ i: hit.i, j: hit.j, value: matrix[hit.row][hit.col] });
  };

  const tip = hoverPair
    ? `R${hoverPair.i}–R${hoverPair.j}: ${hoverPair.value >= 0 ? '+' : ''}${hoverPair.value.toFixed(4)} (closer-than-average)`
    : selectedPair
      ? `Selected R${selectedPair.i}–R${selectedPair.j}`
      : 'Click a cell (e.g. row 14, col 17) to select that residue pair';

  return (
    <div ref={wrapRef} className="conf-driver-matrix-wrap">
      <div className="conf-driver-matrix-body">
        <canvas
          ref={canvasRef}
          className="conf-driver-matrix"
          role="img"
          aria-label={`${AB42_RESIDUE_COUNT} by ${AB42_RESIDUE_COUNT} residual contact matrix`}
          onClick={handleClick}
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverPair(null)}
        />
      </div>
      <ResidualColorBar />
      <div className="conf-driver-matrix-tip" aria-live="polite">
        {tip}
      </div>
    </div>
  );
}

