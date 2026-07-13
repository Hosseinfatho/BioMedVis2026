# Alignment (Compare panel)

> **Code:** `src/utils/alignment.js` · **Used by:** `Compare.jsx`, `Trace.jsx`, `InteractiveMatrix.jsx`

For each trajectory column, alignment finds a chosen **event** in the Markov-state sequence—either the full run from frame 0, the first frame that **enters** a state S*k*, or the first **S*a*→S*b* transition**—then keeps only a fixed window around that anchor (default ±300 frames) and recomputes state occupancy and transition ratios on that slice. The benefit is **event-centered comparison**: Free Aβ42, Aβ42+TMP, and Aβ42+SPA can be compared on the same kind of kinetic moment (e.g. around a 0→2 transition) instead of mixing unrelated parts of long simulations that started at different times, so ratio matrices, rate heatmaps, and the state trace reflect behavior **near the event**, not the whole trajectory from t=0.

**Options:** `From frame 0` · `First entry into S{k}` · `First S{a}→S{b} transition` (list grows with the selected MSM model).
