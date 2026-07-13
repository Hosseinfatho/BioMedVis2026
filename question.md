Top questions experts ask about residues (and why)
1. Which residues form contacts over time?
Question: Do residues i and j come within ~4–6 Å of each other?

Why it matters: Contacts drive folding, aggregation, and drug binding. For Aβ42, contacts between distant regions often signal compaction or β-sheet formation.

Needs: PDB + XTC (distance between atom pairs per frame)

2. Which regions stay structured vs disordered?
Question: Do residues 15–21 stay helical? Does the C-terminus (e.g. 30–42) stay extended?

Why it matters: Aβ42 toxicity and aggregation depend on which parts stay helix vs convert to β-strand. TMP/SPA effects (zsab3 vs zsab4) are often discussed at residue level.

Needs: PDB + XTC → secondary structure or RMSF per residue

3. How much does each residue move? (flexibility / RMSF)
Question: Which residues fluctuate most across frames?

Why it matters: High RMSF = flexible/disordered; low RMSF = stable core. Experts use this to find “ordered cores” vs “floppy tails.”

Needs: PDB + XTC (CA positions over all frames)

4. How do residue distances map to Markov states?
Question: In state 0 vs state 2, do specific residue pairs get closer or farther?

Why it matters: Your dashboard shows states; experts want to know which structural change defines each state. This links abstract MSM to biology.

Needs: PDB + XTC + states*.txt (color structure by state, compare distances)

5. N-terminal vs C-terminal behavior
Question: Does resid 1–15 behave differently from resid 28–42?

Why it matters: Aβ42 has known “hot spots” (e.g. hydrophobic cluster, charged regions). Drug candidates may bind or stabilize specific segments.

Needs: residue selections on trajectory; compare systems zsab2 vs zsab3 vs zsab4

6. Residue–residue distance distributions per state
Question: What is the distribution of distance(resid 1, resid 42) in each Markov state?

Why it matters: A single number per state (e.g. “state 1 = compact”) becomes interpretable when tied to measurable geometry.

Needs: XTC distances + state labels from txt

7. Which residues drive transitions between states?
Question: At frames where state changes 0→2, which residues move most?

Why it matters: CoVAMPnet uses gradient analysis on inter-residue distances for interpretability — which distances matter for state assignment.

Needs: XTC + states; optionally CoVAMPnet frames_for_gradient_evaluation/

8. Compare residue behavior across systems (drug effect)
Question: With TMP (zsab3) or SPA (zsab4), do the same residues show less β-strand or more helix than free Aβ42 (zsab2)?

Why it matters: Core scientific question of the challenge — comparative conformational effects at residue resolution.

Needs: same residue analysis on ZS-ab2, ZS-ab3, ZS-ab4 trajectories

9. Local vs global motion (RMSD per residue or segment)
Question: Is the whole peptide moving, or only a local loop?

Why it matters: Distinguishes rigid-body drift from internal conformational change (important for alignment and interpretation).

Needs: aligned trajectories; per-residue or per-segment RMSD

10. Can we link a brushed window in the dashboard to 3D?
Question: User selects frames 400–600 on e1s1_0 in the dashboard — what do residues look like there?

Why it matters: Connects your ensemble view (txt) to structural view (PDB+XTC). Strong value for expert users.

Needs: dashboard brush → simulation name + frame range → 3D viewer