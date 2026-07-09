import { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const ComputationToolbarPortalContext = createContext(null);

export function ComputationToolbarPortalProvider({ children }) {
  const [node, setNode] = useState(null);
  const value = useMemo(() => ({ node, setNode }), [node]);

  return (
    <ComputationToolbarPortalContext.Provider value={value}>
      {children}
    </ComputationToolbarPortalContext.Provider>
  );
}

export function ComputationToolbarPortalTarget({ className }) {
  const ctx = useContext(ComputationToolbarPortalContext);
  if (!ctx) return null;

  return <div ref={ctx.setNode} className={className} />;
}

export function useComputationToolbarPortal(content) {
  const ctx = useContext(ComputationToolbarPortalContext);
  if (!ctx?.node || content == null) return null;
  return createPortal(content, ctx.node);
}
