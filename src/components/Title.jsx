import { useCallback, useEffect, useState } from 'react';

const APP_NAME = 'ConformaLens';

const DIALOG_COPY = {
  about: {
    title: 'About ConformaLens',
    body: 'About content will be added here.',
  },
  help: {
    title: 'Help',
    body: 'Help content will be added here.',
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
          <p>{copy.body}</p>
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
