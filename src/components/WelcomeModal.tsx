import React, { useEffect, useRef, useState } from 'react';
import './WelcomeModal.css';
import { useWorkspace } from '../store/workspaceStore';
import { useWorkspaceOps } from '../hooks/useWorkspaceOps';

/**
 * Blocking welcome modal shown when there is no active file/workspace.
 * - Non-dismissible except by successfully creating/opening a file or workspace
 * - Buttons are vertically stacked and centered to match app UI
 * - Background is blurred by parent when modal is open
 */
const WelcomeModal: React.FC = () => {
  const { openWorkspace, openTreeFile, createNewTree, isElectron } = useWorkspaceOps();
  const [isProcessing, setIsProcessing] = useState(false);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  // Focus the primary action when modal appears
  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, []);

  // Prevent Escape from closing anything (modal is intentionally blocking)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const tryAction = async (action: () => Promise<boolean | void>) => {
    setIsProcessing(true);
    try {
      await action();
    } finally {
      setIsProcessing(false);
    }
  };

  const onCreate = async () => {
    await tryAction(async () => {
      await createNewTree();
    });
  };

  const onOpenTree = async () => {
    await tryAction(async () => {
      await openTreeFile();
    });
  };

  const onOpenWorkspace = async () => {
    await tryAction(async () => {
      await openWorkspace(true);
    });
  };

  // If workspaceState has an active file or mainTree becomes available,
  // the modal will be hidden by the parent (no further action needed here).

  return (
    <div className="bt-welcome-modal" role="dialog" aria-modal="true" aria-labelledby="bt-welcome-title">
      <div className="bt-welcome-card" tabIndex={-1}>
        <h2 id="bt-welcome-title" className="bt-welcome-title">Welcome to BTstudio</h2>
        <div className="bt-welcome-subtitle">OSU UWRT's Custom Behavior Tree XML Editor</div>

        <div className="bt-welcome-actions">
          <button
            className="bt-btn bt-welcome-button"
            onClick={onCreate}
            disabled={isProcessing}
          >
            Create new tree
          </button>

          <button
            className="bt-btn bt-welcome-button"
            onClick={onOpenTree}
            disabled={isProcessing}
          >
            Open tree file
          </button>

          {isElectron && (
            <button
              ref={primaryButtonRef}
              className="bt-btn bt-btn-primary bt-welcome-button"
              onClick={onOpenWorkspace}
              disabled={isProcessing}
            >
              Open workspace
            </button>
          )}

        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
