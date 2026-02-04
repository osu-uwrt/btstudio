/**
 * WorkspaceToolbar Component
 * 
 * Handles workspace-level operations and menu events in Electron mode.
 * This component doesn't render visible UI but manages Electron menu listeners.
 */

import { useEffect } from 'react';
import { useWorkspaceOps } from '../hooks/useWorkspaceOps';

export const WorkspaceToolbar: React.FC = () => {
  const { openWorkspace, openTreeFile, saveWorkspace, createNewTree, isElectron } = useWorkspaceOps();
  
  // Set up Electron menu event listeners
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;
    
    const cleanups: (() => void)[] = [];
    
    // Open workspace handler
    cleanups.push(
      window.electronAPI.onMenuOpenWorkspace(async () => {
        // ask openWorkspace to immediately run the file picker after folder selection
        await openWorkspace(true);
      })
    );
    
    // Open tree handler
    cleanups.push(
      window.electronAPI.onMenuOpenTree(async () => {
        await openTreeFile();
      })
    );
    
    // New tree handler
    cleanups.push(
      window.electronAPI.onMenuNewTree(async () => {
        await createNewTree();
      })
    );
    
    // Export handler (different from save - always prompts for location)
    cleanups.push(
      window.electronAPI.onMenuExport(() => {
        // Export is handled by TreeEditor's handleExport
        // This is just a pass-through
      })
    );
    
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [isElectron, openWorkspace, openTreeFile, saveWorkspace, createNewTree]);
  
  // This component doesn't render any UI
  return null;
};

export default WorkspaceToolbar;
