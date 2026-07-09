Distance / proximity. For each Markov state, the first measure is spatial proximity: how close two residues, or one residue and TMP/SPA, are in 3D space. Instead of using only Cα atoms, we calculate the minimum heavy-atom distance between residue pairs, because real molecular interactions occur through side-chain/heavy atoms. For ligand systems, we calculate the minimum heavy-atom distance between each Aβ42 residue and TMP or SPA. To avoid a hard binary cutoff, we can summarize the full distance distribution across frames using median distance, mean distance, and distance variation, following distance-distribution ideas such as DRID for MD conformational analysis. In the visualization, distance can be encoded by arc height, arc curvature, or an internal distance cue: shorter distance means stronger proximity. \cite{Clementel2022RING3,Salentin2015PLIP,Schaffler2025AB42DRID}
.
For distance calculation, for each frame assigned to a selected Markov state, compute the minimum heavy-atom distance between two non-neighboring residues Ri and Rj, meaning all heavy atoms of residue i are compared with all heavy atoms of residue j, and the smallest atom–atom distance is stored as dij(t); for ligand systems, compute the minimum heavy-atom distance between each residue and TMP/SPA in the same way. To avoid an arbitrary fixed cutoff such as 4.5 Å or 6 Å, use a pair-specific soft threshold based on a reference distance dij0, taken from the representative frame of the selected state or from the median distance of that residue pair in the state. Then convert each frame distance into a soft-contact score using the Best–Hummer style function, where the transition midpoint is λdij0 rather than one universal Å cutoff; commonly λ=1.8 and β=5A˚−1 are used in native-contact analysis. In this way, if dij(t) is close to or smaller than its reference distance, the score is near 1, and if it becomes much larger, the score smoothly approaches 0. Therefore, the “threshold” is not fixed globally; it adapts to each residue pair, while the final visualization can show only the top percentile of interactions with high average soft-contact score and low distance variation. \cite{Best2013NativeContacts,Clementel2022RING3}

Frequency / occupancy. After proximity is calculated for every frame, the second measure is frequency, also called occupancy: how often an interaction appears across frames assigned to the same Markov state. With a soft-contact approach, this does not need to be a strict yes/no count; instead, we average the soft-contact score across all frames in the selected state. A residue pair that is close in many frames will have a high frequency/occupancy score, while a pair that is only occasionally close will have a low score. The Best–Hummer native-contact formulation is useful here because it converts distance into a smooth contact value instead of a binary threshold, allowing interaction frequency to be represented as an average continuous contact strength. In the visualization, frequency can be encoded as arc width: thicker arcs mean the interaction appears more often in that state. \cite{Best2013NativeContacts}

Consistency / persistence. The third measure is consistency, or persistence: whether an interaction remains stable across frames instead of appearing randomly or flickering. Two residue pairs can have the same average frequency but different consistency; one may stay close for long continuous frame segments, while another may appear only in scattered frames. We measure this using the variation of the distance or soft-contact score across frames, such as standard deviation or longest continuous contact segment. A low distance standard deviation means the interaction is more consistent inside that Markov state, while a high standard deviation means the interaction is unstable or transient. In the visualization, consistency can be encoded as opacity: darker arcs represent stable/persistent interactions, while faded arcs represent noisy or inconsistent interactions. \cite{Clementel2022RING3,Best2013NativeContacts}


Script: scripts/state_driver_system.py
Output: public/data/Residual/state_driver_interactions.json
Heavy-atom min distances, pairs with |i−j| ≥ 3
Best-Hummer soft score with pair-specific median d0
Ligand min-distance per residue
Visualization encodings
Gray arc → shared interaction
Green #1b9e77 above → TMP stronger
Orange #d95f02 below → SPA stronger
Arc width → frequency · opacity → persistence · arc length → proximity


Strength:
per frame, per residue pair, within the same Markov state.

For each frame assigned to a given state:

Take all heavy atoms in residue i (not name H*)
Take all heavy atoms in residue j
Compute every pairwise distance between them
Use the minimum of those distances as that pair’s distance for that frame
Only pairs with sequence separation ≥ 3 are included (e.g. R1–R5, not R1–R2).

Then, for a fixed system + model + state, all frames in that state are combined:

distances are histogrammed
mean_soft is the average soft-contact score over those frames
So it is not one fixed atom pair (like CA–CA only); it is the closest heavy-atom contact between the two residues in each frame, then averaged over the state’s frames.





ligand row:

What is the ligand?
TMP and SPA are small drug molecules (not part of the protein). They bind near Aβ42 in the simulation. Each amino acid (residue) is one building block of the protein — R1, R23, R42, and so on.
Ligand contact means: this amino acid is close to the drug in that state.



igand contact means a residue that is close to the drug molecule (ligand) in the simulation — for this project, TMP (zsab3) or SPA (zsab4).

For each frame in a Markov state, the code finds the minimum distance between any heavy atom on that residue and any heavy atom on the ligand. Those distances are averaged over frames and turned into a soft-contact strength (same idea as residue–residue interactions).

In the StateDriver plot, the colored circles below the hill are ligand contacts:

Each circle sits under the residue number it refers to (e.g. R23).
Color = system (green = TMP, orange = SPA).
Size = contact strength (closer / stronger → bigger).
Click = select that residue’s ligand contact (highlight in 3D and show details in the meta bar).
Free Aβ42 (zsab2) has no ligand, so it usually has no ligand-contact row. Only ligand-bound systems (TMP, SPA) show these markers.

Example (intuitive)
Imagine the drug near residue 23:

Some atom on R23 might be 4.2 Å from the drug
Another might be 6.8 Å
The closest might be 3.1 Å
Minimum distance = 3.1 Å for that frame.

If in many frames R23 stays around 3–5 Å from TMP → strong ligand contact.
If it is usually 15–20 Å away → weak or no contact.

Does it mean the amino acid “interacts” with TMP/SPA?
Mostly yes, in a geometric sense:

Small minimum distance → that amino acid is often near the drug → likely contact / binding region.
Large minimum distance → that amino acid is far from the drug → not a main contact site in that state.
It does not by itself prove a specific chemical interaction (hydrogen bond, hydrophobic, etc.). It only measures closeness in 3D space, averaged over frames in that Markov state.
