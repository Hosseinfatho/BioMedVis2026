import { useEffect, useMemo, useState } from 'react';
import { findRepresentativeFrame, loadRepresentativeFrameRows } from '../../../../../utils/conformationalDriversData';
import {
  ALL_SYSTEMS,
  DATA_URL,
  TRAJECTORY_TYPE,
  buildLigandRows,
  buildMultiSystemEdges,
  computeNodeProximityScores,
  groupKey,
  sortSystems,
} from './stateDriverMetrics';

let interactionsPromise = null;

function loadInteractions() {
  if (!interactionsPromise) {
    interactionsPromise = fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            'Missing state_driver_interactions.json — run npm run preprocess:state-driver-interactions'
          );
        }
        return res.json();
      })
      .catch((err) => {
        interactionsPromise = null;
        throw err;
      });
  }
  return interactionsPromise;
}

export function useDriverInteractionData(modelId, markovState, activeSystems = ALL_SYSTEMS) {
  const [interactions, setInteractions] = useState(null);
  const [representativeRows, setRepresentativeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const systems = useMemo(
    () => sortSystems(activeSystems.filter((id) => ALL_SYSTEMS.includes(id))),
    [activeSystems]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([loadInteractions(), loadRepresentativeFrameRows()])
      .then(([data, reps]) => {
        if (cancelled) return;
        setInteractions(data);
        setRepresentativeRows(reps);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const bundle = useMemo(() => {
    const emptyRepresentatives = Object.fromEntries(ALL_SYSTEMS.map((id) => [id, null]));
    const emptyFrames = Object.fromEntries(ALL_SYSTEMS.map((id) => [id, 0]));

    if (!interactions || systems.length === 0) {
      return {
        allEligibleEdges: [],
        eligibleArcCount: 0,
        ligandRows: [],
        nodeProximity: new Map(),
        activeSystems: systems,
        compareMode: systems.length > 1,
        frameCounts: emptyFrames,
        representatives: emptyRepresentatives,
      };
    }

    const entriesBySystem = {};
    const frameCounts = { ...emptyFrames };
    const representatives = { ...emptyRepresentatives };

    for (const systemId of systems) {
      const key = groupKey(systemId, modelId, TRAJECTORY_TYPE, markovState);
      entriesBySystem[systemId] = interactions[key];
      frameCounts[systemId] = interactions[key]?.total_frames ?? 0;
      representatives[systemId] = findRepresentativeFrame(
        representativeRows,
        systemId,
        modelId,
        TRAJECTORY_TYPE,
        markovState
      );
    }

    const allEdges = buildMultiSystemEdges(entriesBySystem, systems);
    const allEligibleEdges = allEdges.filter((e) => e.displayStrength > 0.01);
    const ligandRows = buildLigandRows(entriesBySystem, systems);
    const nodeProximity = computeNodeProximityScores(allEdges, ligandRows);

    return {
      allEligibleEdges,
      eligibleArcCount: allEligibleEdges.length,
      ligandRows,
      nodeProximity,
      activeSystems: systems,
      compareMode: systems.length > 1,
      frameCounts,
      representatives,
    };
  }, [interactions, modelId, markovState, representativeRows, systems]);

  return { loading, error, bundle, representativeRows };
}
