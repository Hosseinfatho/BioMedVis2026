# ConformationalDrivers

ConformationalDrivers is a tab inside Analysis3D designed to explain which residue-level interactions help define each Markov state and connect those abstract patterns to the real 3D molecular structure. The component uses a 42×42 residual contact matrix, where each row and column represents one Aβ42 residue. For a selected system, model, and state, the matrix shows whether each residue pair contacts more or less often in that state compared with the average across states. A positive residual means the contact is stronger in the selected state, while a negative residual means the contact is weaker. When the user clicks a residue pair in the matrix, the 3D viewer loads the representative frame of that state and highlights the selected residues on the molecular ribbon. RMSD and radius-of-gyration summaries are shown beside the matrix to describe whether the selected state is structurally stable, flexible, compact, or rearranged.

Bullet points
Goal: Explain which residue–residue contacts are stronger or weaker in each Markov state.
Main visualization: A 42×42 residual contact matrix.
Row = residue i
Column = residue j
Cell = contact residual for residue pair i–j
Contact definition: A residue pair is considered in contact when the Cα distance is less than or equal to 6 Å.
Residual calculation:
residual(i,j,state) =
contact frequency in selected state
-
mean contact frequency across all states
Color meaning:
Red/high = stronger contact in this state
Blue/low = weaker contact in this state
White/neutral = close to average
Input files:
state_contact_maps.json → builds the 42×42 residue matrix
representative_frames.csv → finds the representative frame for the selected state
state_summary.csv → provides average RMSD, radius of gyration, and state statistics
rmsd_by_state.csv → provides RMSD histogram data
Controls:
System: zsab2, zsab3, zsab4
Model: states2, states3, states4
State: State 0, State 1, State 2, State 3
Trajectory type: original
Interaction with 3D viewer:
User clicks a matrix cell, for example residue 14 × 17
Component selects residue pair R14–R17
Viewer3D loads the rank-1 representative frame for the selected state
Viewer3D highlights residues 14 and 17 on the structure
RMSD panel:
RMSD is not used to create the 42×42 matrix
RMSD shows how structurally stable or variable the selected state is
Low RMSD = similar structure
High RMSD = more rearranged structure
Wide RMSD distribution = more flexible or mixed state
==============================================================
Input Files

All files are located in:

public/data/Residual/
state_contact_maps.json

Contains residue–residue contact frequencies for each system, model, trajectory type, and Markov state.
Used to build the 42×42 residual contact matrix.

representative_frames.csv

Contains the representative frame for each system, model, trajectory type, and Markov state.
Used to tell the 3D viewer which trajectory and frame to load.

state_summary.csv

Contains state-level structural summaries such as average RMSD and radius of gyration.
Used to show whether a state is compact, expanded, stable, or variable.

rmsd_by_state.csv

Contains RMSD histogram values for each Markov state.
Used to show the RMSD distribution of the selected state.
==============================================================
For structural comparison, we calculate the root-mean-square deviation (RMSD) using the Cα atoms of residues 1–42 as a simplified representation of the Aβ42 backbone. Following the common practice described by Maiorov and Crippen (1994), protein conformations can be compared by first performing an optimal rigid-body superposition and then measuring the RMSD between corresponding Cα atomic coordinates. In our analysis, each molecular frame is aligned to a selected reference structure, such as the representative frame of a Markov state, and the RMSD is computed across the matched Cα atoms. A lower RMSD indicates that the frame has a backbone conformation similar to the reference state, while a higher RMSD indicates a larger conformational difference. This allows us to quantify how structurally similar or different frames are within and across Markov states.
Maiorov, V. N., & Crippen, G. M. (1994). “Significance of root-mean-square deviation in comparing three-dimensional structures of globular proteins.” Journal of Molecular Biology, 235, 625–634.
Use this reference for explaining that protein structures are commonly compared using RMSD of Cα coordinates after optimal rigid-body superposition.


Per frame
Take CA positions of frame 0 of that trajectory → reference
Take CA positions of the current frame → mobile
Align mobile to reference (remove translation + rotation)
Compute RMSD:
RMSD=1/N∑i=1N∥xiframe−xiref∥2
RMSD=N1​i=1∑N​∥xiframe​−xiref​∥2​
where:
NN = number of CA atoms (42 for Aβ42)
xi​ = 3D coordinates (x,y,z)
(x,y,z) of CA atom 
i
distance is in Å
So it is:

atomic coordinates → yes
CA only → yes
after superposition → yes (fair shape comparison, not just molecule drifting in space)

For the residual matrix, we compute a state-specific residue–residue contact residual to identify which residue interactions are unusually strong or weak in each Markov state. For every frame, each residue pair (i,j) is tested for contact using a distance cutoff, for example 5 Å, which is commonly used in contact-based protein structure/network analysis. Residue–residue contacts are a standard way to represent protein structure because they convert 3D proximity relationships into a 2D contact map, and contact-based residue networks are widely used to study conformational changes and residue interaction patterns in molecular dynamics. For each Markov state s, we calculate the contact frequency Cs(i,j), meaning the fraction of frames in that state where residues i and j are close. Then we subtract the overall contact frequency C
all (i,j) across all frames: Rs(i,j)=Cs(i,j)−Call (i,j). A positive residual means that the residue pair interacts more often in that state than in the overall ensemble, while a negative residual means that the interaction is reduced in that state. This 42×42 residual matrix therefore highlights the residue-pair interactions that help explain why frames are assigned to a particular Markov state, and selected high-residual residue pairs can be linked to the 3D viewer for spatial interpretation.

References to use:
Zhang, H. et al. (2021). “Evaluation of residue-residue contact prediction methods.”
Salamanca Viloria, J., Allega, M. F., Lambrughi, M., & Papaleo, E. (2017). “An optimal distance cutoff for contact-based Protein Structure Networks using side-chain centers of mass.” Scientific Reports, 7, 2838.
Yehorova, D. et al. (2024). “Using Residue Interaction Networks (RINs) to Understand Protein Structure and Function.”