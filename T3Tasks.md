> **Master doc:** [`../explain.md`](../explain.md) §3 (tasks) · §5 (task→component map)

1. Which conformational changes are responsible for Markov state assignment?
Use: states*.txt + filtered.pdb + output.filtered.xtc
states*.txt gives the Markov state label for each frame.
filtered.pdb + output.filtered.xtc give the molecular structure for those frames.
2. Which frame or frames are most representative of each Markov state?
Use: states*.txt + filtered.pdb + output.filtered.xtc
states*.txt groups frames by state.
output.filtered.xtc provides the atomic positions needed to find representative frames.
3. Which amino acid residues interact with each other or with TMP/SPA in different Markov states, and where do those interactions happen?
Use: states*.txt + filtered.pdb + output.filtered.xtc
filtered.pdb identifies residues, atoms, TMP, and SPA.
output.filtered.xtc gives distances over time.
states*.txt separates interactions by Markov state.
4. Add residue-interaction measures, RMSD, and connect abstract views to 3D spatial views.
Use: states*.txt + filtered.pdb + output.filtered.xtc + order.txt + concatenated.txt
states*.txt connects abstract states to frames.
filtered.pdb + output.filtered.xtc compute residue contacts and RMSD.
order.txt helps order trajectories in the dashboard.
concatenated.txt supports the concatenated trajectory view.