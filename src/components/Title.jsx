import { useCallback, useEffect, useState } from 'react';

const APP_NAME = 'ConformaLens';

const EXTERNAL_LINK_PROPS = {
  target: '_blank',
  rel: 'noopener noreferrer',
};

function AboutDialogBody() {
  return (
    <>
      <p>
        ConformaLens is an interactive visual analytics system for exploring adaptive molecular
        dynamics simulations and comparing conformational state patterns across systems. It was
        developed for the{' '}
        <a href="http://biovis.net/2026/biovisChallenges_vis/" {...EXTERNAL_LINK_PROPS}>
          Bio+MedVis Challenge 2026
        </a>
        .
      </p>
      <p className="title-dialog-about-author">
        Created by{' '}
        <a href="https://hosseinfatho.github.io/" {...EXTERNAL_LINK_PROPS}>
          Hossein Fathollahian
        </a>
        , University of Illinois Chicago,{' '}
        <a href="https://www.evl.uic.edu/" {...EXTERNAL_LINK_PROPS}>
          Electronic Visualization Laboratory (EVL)
        </a>
        .
      </p>
    </>
  );
}

const DIALOG_COPY = {
  about: {
    title: 'About ConformaLens',
  },
  help: {
    title: 'Help',
    intro:
      'ConformaLens supports exploration of adaptive molecular dynamics simulations by turning large trajectory ensembles into linked 2D and 3D views. Its goal is to help you compare systems, spot state and transition patterns, and connect those patterns to molecular structure and interactions.',
    sections: [
      {
        heading: '1. Trajectory overview',
        body:
          'Select systems, a state model, and trajectory view, then click Generate. Epoch timelines and state charts show how each simulation moves through Markov states over time.',
      },
      {
        heading: '2. Compare matrices',
        body:
          'Pick System A and B, click Compare, and inspect ratio matrices with the state trace above. Brush columns to sync a time window; use Alignment and Motif pattern to focus on specific frames and state sequences.',
      },
      {
        heading: '3. 3D analysis',
        body:
          'The 3D viewer shows structures for the selected frame and state. StateSignature and StateDriver tabs add residue stability maps and differential interaction views linked to your matrix selection.',
      },
    ],
  },
};

function TitleDialog({ kind, onClose }) {
  const copy = DIALOG_COPY[kind];

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="title-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="title-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`title-dialog-heading-${kind}`}
      >
        <div className="title-dialog-header">
          <h2 className="title-dialog-heading" id={`title-dialog-heading-${kind}`}>
            {copy.title}
          </h2>
          <button
            type="button"
            className="title-dialog-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="title-dialog-body">
          {kind === 'about' ? (
            <AboutDialogBody />
          ) : (
            <>
              {copy.intro ? <p className="title-dialog-intro">{copy.intro}</p> : null}
              {copy.sections ? (
                copy.sections.map((section) => (
                  <div key={section.heading} className="title-dialog-section">
                    <h3 className="title-dialog-section-heading">{section.heading}</h3>
                    <p>{section.body}</p>
                  </div>
                ))
              ) : (
                <p>{copy.body}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Title() {
  const [openDialog, setOpenDialog] = useState(null);

  const closeDialog = useCallback(() => setOpenDialog(null), []);

  return (
    <>
      <header className="app-title-bar" aria-label="Application title">
        <h1 className="app-title-bar-name">{APP_NAME}</h1>
        <div className="app-title-bar-actions">
          <button
            type="button"
            className="app-title-bar-btn"
            onClick={() => setOpenDialog('about')}
          >
            About
          </button>
          <button
            type="button"
            className="app-title-bar-btn"
            onClick={() => setOpenDialog('help')}
          >
            Help
          </button>
        </div>
      </header>

      {openDialog ? <TitleDialog kind={openDialog} onClose={closeDialog} /> : null}
    </>
  );
}
