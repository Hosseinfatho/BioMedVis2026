import { useState } from 'react';
import StateSignature from './tabs/signature';
import StateDriver from './tabs/stateDriver';
import {
  ComputationToolbarPortalProvider,
  ComputationToolbarPortalTarget,
} from '../ComputationToolbarPortal';

const TABS = [
  {
    id: 'state-signature',
    label: 'StateSignature',
    Component: StateSignature,
  },
  {
    id: 'state-driver',
    label: 'StateDriver',
    Component: StateDriver,
  },
];

export default function Computation3DPanel({
  defaultSystemId,
  defaultModelId,
  systems = [],
  markovState = 0,
  onMarkovStateChange,
  onViewerTargetChange,
  onResidueHighlightChange,
}) {
  const [activeTabId, setActiveTabId] = useState(TABS[0].id);

  const activeTab = TABS.find((tab) => tab.id === activeTabId) ?? TABS[0];
  const ActiveComponent = activeTab.Component;

  return (
    <ComputationToolbarPortalProvider>
      <section className="computation-3d-panel" aria-label="3D computation panel">
        <div className="computation-3d-panel-header">
          <div className="computation-3d-panel-tabs" role="tablist" aria-label="Computation views">
            {TABS.map((tab) => {
              const selected = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`computation-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`computation-panel-${tab.id}`}
                  className={`computation-3d-panel-tab${selected ? ' is-active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <ComputationToolbarPortalTarget className="computation-3d-panel-toolbar" />
        </div>

        <div
          className="computation-3d-panel-body"
          role="tabpanel"
          id={`computation-panel-${activeTab.id}`}
          aria-labelledby={`computation-tab-${activeTab.id}`}
        >
          <ActiveComponent
            defaultSystemId={defaultSystemId}
            defaultModelId={defaultModelId}
            systems={systems}
            markovState={markovState}
            onMarkovStateChange={onMarkovStateChange}
            onViewerTargetChange={onViewerTargetChange}
            onResidueHighlightChange={onResidueHighlightChange}
          />
        </div>
      </section>
    </ComputationToolbarPortalProvider>
  );
}
