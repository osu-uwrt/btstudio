/**
 * Workspace Operations Hook
 * 
 * Provides high-level operations for managing the workspace:
 * - Opening workspace folders
 * - Loading tree files
 * - Saving with workspace-wide subtree synchronization
 * - Detecting and handling external file changes
 */

import { useCallback } from 'react';
import { useWorkspace, SUBTREE_LIBRARY_FILENAME, WorkspaceFile } from '../store/workspaceStore';
import { 
  importMultiTreeFromXML, 
  importSubtreeLibraryFromXML,
  exportMultiTreeToXML,
  exportSubtreeLibraryToXML,
  getReferencedSubtreeIds,
  TreeData,
} from '../utils/xmlSerializer';
import { SubTreePort } from '../types';

interface UseWorkspaceOpsResult {
  openWorkspace: () => Promise<boolean>;
  openTreeFile: (filePath?: string) => Promise<boolean>;
  saveWorkspace: () => Promise<boolean>;
  createNewTree: () => Promise<void>;
  createNewSubtree: (name: string, description?: string, ports?: SubTreePort[]) => void;
  importTreeAsSubtree: (filePath: string, subtreeName: string, ports: SubTreePort[]) => Promise<void>;
  isElectron: boolean;
}

export function useWorkspaceOps(): UseWorkspaceOpsResult {
  const { state, dispatch } = useWorkspace();
  
  const isElectron = typeof window !== 'undefined' && window.isElectron === true;
  
  /**
   * Open a workspace folder and load the subtree library
   */
  const openWorkspace = useCallback(async (): Promise<boolean> => {
    if (!isElectron || !window.electronAPI) {
      console.error('Electron API not available');
      return false;
    }
    
    try {
      const folderPath = await window.electronAPI.openFolder();
      if (!folderPath) return false;
      
      // List XML files in the workspace
      const files = await window.electronAPI.listXmlFiles(folderPath);
      
      dispatch({
        type: 'SET_WORKSPACE_PATH',
        path: folderPath,
        files,
      });
      
      // Load subtree library if it exists
      const libraryPath = `${folderPath}/${SUBTREE_LIBRARY_FILENAME}`;
      const libraryResult = await window.electronAPI.readFile(libraryPath);
      
      if (libraryResult) {
        const librarySubtrees = importSubtreeLibraryFromXML(libraryResult.content);
        dispatch({
          type: 'SET_LIBRARY_SUBTREES',
          subtrees: librarySubtrees,
          modifiedTime: libraryResult.modifiedTime,
        });
      } else {
        // Create empty library file
        const emptyLibrary = '<?xml version="1.0"?>\n<root BTCPP_format="4">\n  <!-- BTstudio Subtree Library -->\n</root>';
        await window.electronAPI.writeFile(libraryPath, emptyLibrary);
        dispatch({
          type: 'SET_LIBRARY_SUBTREES',
          subtrees: new Map(),
          modifiedTime: null,
        });
      }
      
      // Update window title
      const folderName = folderPath.split('/').pop() || folderPath;
      window.electronAPI.setTitle(`BTstudio - ${folderName}`);
      
      return true;
    } catch (error) {
      console.error('Error opening workspace:', error);
      return false;
    }
  }, [isElectron, dispatch]);
  
  /**
   * Open a specific tree file
   */
  const openTreeFile = useCallback(async (filePath?: string): Promise<boolean> => {
    if (!isElectron || !window.electronAPI) {
      console.error('Electron API not available');
      return false;
    }
    
    try {
      let targetPath = filePath;
      
      if (!targetPath) {
        // Show file picker
        targetPath = await window.electronAPI.openFile({
          title: 'Open Tree File',
          defaultPath: state.workspacePath || undefined,
        }) || undefined;
      }
      
      if (!targetPath) return false;
      
      // Read the file
      const fileResult = await window.electronAPI.readFile(targetPath);
      if (!fileResult) {
        await window.electronAPI.showWarning({
          title: 'Error',
          message: 'Could not read file',
          detail: `Failed to read: ${targetPath}`,
        });
        return false;
      }
      
      // Parse the file
      const parseResult = importMultiTreeFromXML(fileResult.content);
      
      // Check for discrepancies with library subtrees
      const discrepancies = await checkLibraryDiscrepancies(
        parseResult.subtrees,
        state.librarySubtrees
      );
      
      if (discrepancies.length > 0) {
        const shouldContinue = await window.electronAPI.showConfirm({
          title: 'Subtree Discrepancy Detected',
          message: 'Some subtrees in this file differ from the library versions.',
          detail: `Affected subtrees: ${discrepancies.join(', ')}\n\n` +
            'The library version will be used as the source of truth. ' +
            'If you save this file, the library versions will overwrite these subtrees.\n\n' +
            'Continue loading?',
          buttons: ['Continue', 'Cancel'],
        });
        
        if (!shouldContinue) {
          return false;
        }
        
        // Replace file subtrees with library versions
        discrepancies.forEach(subtreeId => {
          const libraryVersion = state.librarySubtrees.get(subtreeId);
          if (libraryVersion) {
            parseResult.subtrees.set(subtreeId, {
              ...libraryVersion,
              nodes: JSON.parse(JSON.stringify(libraryVersion.nodes)),
              edges: JSON.parse(JSON.stringify(libraryVersion.edges)),
              variables: [...libraryVersion.variables],
              description: libraryVersion.description,
              ports: libraryVersion.ports ? [...libraryVersion.ports] : undefined,
            });
          }
        });
      }
      
      // Extract filename
      const fileName = targetPath.split('/').pop() || 'Untitled';
      
      dispatch({
        type: 'SET_ACTIVE_FILE',
        path: targetPath,
        name: fileName,
        mainTree: parseResult.mainTree,
        subtrees: parseResult.subtrees,
      });
      
      // Track file modification time
      dispatch({
        type: 'UPDATE_FILE_MODIFIED_TIME',
        filePath: targetPath,
        modifiedTime: fileResult.modifiedTime,
      });
      
      // Update window title
      const workspaceName = state.workspacePath?.split('/').pop() || '';
      window.electronAPI.setTitle(`BTstudio - ${workspaceName} - ${fileName}`);
      
      return true;
    } catch (error) {
      console.error('Error opening tree file:', error);
      if (window.electronAPI) {
        await window.electronAPI.showWarning({
          title: 'Error',
          message: 'Failed to parse tree file',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    }
  }, [isElectron, state.workspacePath, state.librarySubtrees, dispatch]);
  
  /**
   * Save the workspace - updates current file, library, and all affected workspace files
   */
  const saveWorkspace = useCallback(async (): Promise<boolean> => {
    if (!isElectron || !window.electronAPI) {
      console.error('Electron API not available');
      return false;
    }
    
    if (!state.mainTree) {
      console.error('No tree to save');
      return false;
    }
    
    try {
      let targetPath = state.activeFilePath;
      
      // If no file path, prompt for save location
      if (!targetPath) {
        targetPath = await window.electronAPI.saveFile({
          title: 'Save Tree File',
          defaultPath: state.workspacePath 
            ? `${state.workspacePath}/${state.activeFileName}`
            : state.activeFileName,
        });
        
        if (!targetPath) return false;
      }
      
      // 1. Save the current tree file with all its subtrees
      const treeXML = exportMultiTreeToXML(state.mainTree, state.subtrees);
      await window.electronAPI.writeFile(targetPath, treeXML);
      
      // 2. Always update library with all subtrees from current file
      if (state.workspacePath) {
        const libraryPath = `${state.workspacePath}/${SUBTREE_LIBRARY_FILENAME}`;
        
        // Merge all subtrees from current file into library
        const updatedLibrary = new Map(state.librarySubtrees);
        state.subtrees.forEach((subtree, subtreeId) => {
          updatedLibrary.set(subtreeId, subtree);
        });
        
        const libraryXML = exportSubtreeLibraryToXML(updatedLibrary);
        await window.electronAPI.writeFile(libraryPath, libraryXML);
        
        // Update library state
        dispatch({
          type: 'SET_LIBRARY_SUBTREES',
          subtrees: updatedLibrary,
          modifiedTime: new Date().toISOString(),
        });
        
        // 3. Update all other workspace files that use any subtrees from current file
        if (state.workspaceFiles.length > 0 && state.subtrees.size > 0) {
          // Get all subtree IDs that might need updating in other files
          const allSubtreeIds = new Set(state.subtrees.keys());
          await updateWorkspaceFiles(
            state.workspacePath,
            state.workspaceFiles,
            targetPath,
            allSubtreeIds,
            state.subtrees
          );
        }
      }
      
      // Clear dirty state
      dispatch({ type: 'CLEAR_MODIFIED_SUBTREES' });
      
      // Update file path if it was a new save
      if (targetPath !== state.activeFilePath) {
        const fileName = targetPath.split('/').pop() || 'Untitled';
        dispatch({
          type: 'SET_ACTIVE_FILE',
          path: targetPath,
          name: fileName,
          mainTree: state.mainTree,
          subtrees: state.subtrees,
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error saving workspace:', error);
      if (window.electronAPI) {
        await window.electronAPI.showWarning({
          title: 'Save Error',
          message: 'Failed to save workspace',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
      return false;
    }
  }, [isElectron, state, dispatch]);
  
  /**
   * Create a new empty tree - prompts for filename
   */
  const createNewTree = useCallback(async () => {
    // In Electron, prompt for filename using save dialog
    if (isElectron && window.electronAPI) {
      const filePath = await window.electronAPI.showPrompt({
        title: 'New Tree File',
        defaultValue: 'NewTree.xml',
        filters: [{ name: 'XML Files', extensions: ['xml'] }],
      });
      
      if (!filePath) return; // User cancelled
      
      // Extract filename without extension for the tree ID
      const fileName = filePath.split('/').pop() || 'Untitled.xml';
      const treeId = fileName.replace(/\.xml$/i, '').replace(/[^a-zA-Z0-9_]/g, '_') || 'MainTree';
      
      const emptyMainTree: TreeData = {
        id: treeId,
        nodes: [{
          id: 'root_node',
          type: 'btNode',
          position: { x: 250, y: 50 },
          data: {
            id: 'root',
            type: 'Root',
            category: 'root',
            name: 'Root',
            description: 'Root node of the behavior tree',
            fields: [],
            instanceId: 'root_node',
            color: '#F44336',
          },
        }],
        edges: [],
        variables: [],
      };
      
      dispatch({
        type: 'SET_ACTIVE_FILE',
        path: filePath,
        name: fileName,
        mainTree: emptyMainTree,
        subtrees: new Map(),
      });
      
      const workspaceName = state.workspacePath?.split('/').pop() || '';
      window.electronAPI.setTitle(`BTstudio${workspaceName ? ` - ${workspaceName}` : ''} - ${fileName}`);
    } else {
      // Fallback for non-Electron (web) mode
      const emptyMainTree: TreeData = {
        id: 'MainTree',
        nodes: [{
          id: 'root_node',
          type: 'btNode',
          position: { x: 250, y: 50 },
          data: {
            id: 'root',
            type: 'Root',
            category: 'root',
            name: 'Root',
            description: 'Root node of the behavior tree',
            fields: [],
            instanceId: 'root_node',
            color: '#F44336',
          },
        }],
        edges: [],
        variables: [],
      };
      
      dispatch({
        type: 'SET_ACTIVE_FILE',
        path: '',
        name: 'Untitled.xml',
        mainTree: emptyMainTree,
        subtrees: new Map(),
      });
    }
  }, [isElectron, state.workspacePath, dispatch]);
  
  /**
   * Create a new subtree and add it to the library
   */
  const createNewSubtree = useCallback((name: string, description?: string, ports?: SubTreePort[]) => {
    if (!name.trim()) return;
    
    const subtreeId = name.trim().replace(/\s+/g, '_');
    
    // Check if subtree already exists
    if (state.librarySubtrees.has(subtreeId) || state.subtrees.has(subtreeId)) {
      if (window.electronAPI) {
        window.electronAPI.showWarning({
          title: 'Subtree Exists',
          message: `A subtree named "${subtreeId}" already exists.`,
          detail: 'Please choose a different name.',
        });
      }
      return;
    }
    
    const newSubtree: TreeData = {
      id: subtreeId,
      nodes: [{
        id: `${subtreeId}_root`,
        type: 'btNode',
        position: { x: 250, y: 50 },
        data: {
          id: 'root',
          type: 'Root',
          category: 'root',
          name: 'Root',
          description: 'Root node of the subtree',
          fields: [],
          instanceId: `${subtreeId}_root`,
          color: '#F44336',
        },
      }],
      edges: [],
      variables: [],
      description: description?.trim() || undefined,
      ports: ports || [], // Add ports to subtree definition
    };
    
    // Add to library
    dispatch({ type: 'ADD_NEW_SUBTREE_TO_LIBRARY', subtree: newSubtree });
    
    // Add to current file's subtrees
    dispatch({ type: 'ADD_SUBTREE_FROM_LIBRARY', subtreeId });
    
    // Switch to editing the new subtree
    dispatch({ type: 'SET_ACTIVE_TREE', treeId: subtreeId });
  }, [state.librarySubtrees, state.subtrees, dispatch]);
  
  /**
   * Import an existing tree file as a subtree
   */
  const importTreeAsSubtree = useCallback(async (filePath: string, subtreeName: string, ports: SubTreePort[]) => {
    if (!isElectron || !window.electronAPI) {
      console.error('Electron API not available');
      return;
    }
    
    const subtreeId = subtreeName.trim().replace(/\s+/g, '_');
    
    // Check if subtree already exists
    if (state.librarySubtrees.has(subtreeId) || state.subtrees.has(subtreeId)) {
      await window.electronAPI.showWarning({
        title: 'Subtree Exists',
        message: `A subtree named "${subtreeId}" already exists.`,
        detail: 'Please choose a different name.',
      });
      return;
    }
    
    try {
      // Read the tree file
      const fileResult = await window.electronAPI.readFile(filePath);
      if (!fileResult) {
        await window.electronAPI.showWarning({
          title: 'Error',
          message: 'Could not read file',
          detail: `Failed to read: ${filePath}`,
        });
        return;
      }
      
      // Parse the tree file
      const parseResult = importMultiTreeFromXML(fileResult.content);
      
      // Create the subtree from the main tree of the imported file
      const newSubtree: TreeData = {
        id: subtreeId,
        nodes: JSON.parse(JSON.stringify(parseResult.mainTree.nodes)),
        edges: JSON.parse(JSON.stringify(parseResult.mainTree.edges)),
        variables: [...parseResult.mainTree.variables],
        description: `Imported from ${filePath.split('/').pop()}`,
        ports: ports,
      };
      
      // Add to library
      dispatch({ type: 'ADD_NEW_SUBTREE_TO_LIBRARY', subtree: newSubtree });
      
      // Add to current file's subtrees
      dispatch({ type: 'ADD_SUBTREE_FROM_LIBRARY', subtreeId });
      
      // Switch to editing the new subtree
      dispatch({ type: 'SET_ACTIVE_TREE', treeId: subtreeId });
    } catch (error) {
      console.error('Error importing tree as subtree:', error);
      if (window.electronAPI) {
        await window.electronAPI.showWarning({
          title: 'Import Error',
          message: 'Failed to import tree',
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [isElectron, state.librarySubtrees, state.subtrees, dispatch]);
  
  return {
    openWorkspace,
    openTreeFile,
    saveWorkspace,
    createNewTree,
    createNewSubtree,
    importTreeAsSubtree,
    isElectron,
  };
}

/**
 * Check for discrepancies between file subtrees and library subtrees
 */
async function checkLibraryDiscrepancies(
  fileSubtrees: Map<string, TreeData>,
  librarySubtrees: Map<string, TreeData>
): Promise<string[]> {
  const discrepancies: string[] = [];
  
  fileSubtrees.forEach((fileSubtree, subtreeId) => {
    const librarySubtree = librarySubtrees.get(subtreeId);
    if (librarySubtree) {
      // Simple comparison - check if node/edge counts differ
      // A more thorough comparison could be implemented if needed
      if (
        fileSubtree.nodes.length !== librarySubtree.nodes.length ||
        fileSubtree.edges.length !== librarySubtree.edges.length
      ) {
        discrepancies.push(subtreeId);
      }
    }
  });
  
  return discrepancies;
}

/**
 * Update all workspace files that reference modified subtrees
 */
async function updateWorkspaceFiles(
  workspacePath: string,
  workspaceFiles: WorkspaceFile[],
  excludePath: string,
  modifiedSubtreeIds: Set<string>,
  updatedSubtrees: Map<string, TreeData>
): Promise<void> {
  if (!window.electronAPI) return;
  
  for (const file of workspaceFiles) {
    // Skip the current file (already saved)
    if (file.path === excludePath) continue;
    
    try {
      // Read and parse the file
      const fileResult = await window.electronAPI.readFile(file.path);
      if (!fileResult) continue;
      
      const parseResult = importMultiTreeFromXML(fileResult.content);
      
      // Check if this file uses any of the modified subtrees
      let needsUpdate = false;
      const fileSubtreeIds = Array.from(parseResult.subtrees.keys());
      
      // Also check for SubTree references in the main tree
      const mainTreeRefs = getReferencedSubtreeIds(parseResult.mainTree.nodes);
      const allRefs = [...fileSubtreeIds, ...mainTreeRefs];
      
      modifiedSubtreeIds.forEach(modifiedId => {
        if (allRefs.includes(modifiedId)) {
          needsUpdate = true;
          // Update the subtree in this file's data, preserving ports
          const updatedSubtree = updatedSubtrees.get(modifiedId);
          if (updatedSubtree) {
            parseResult.subtrees.set(modifiedId, {
              id: modifiedId,
              nodes: JSON.parse(JSON.stringify(updatedSubtree.nodes)),
              edges: JSON.parse(JSON.stringify(updatedSubtree.edges)),
              variables: [...updatedSubtree.variables],
              description: updatedSubtree.description,
              ports: updatedSubtree.ports ? [...updatedSubtree.ports] : undefined,
            });
          }
        }
      });
      
      if (needsUpdate) {
        // Re-export and save the file
        const updatedXML = exportMultiTreeToXML(parseResult.mainTree, parseResult.subtrees);
        await window.electronAPI.writeFile(file.path, updatedXML);
      }
    } catch (error) {
      console.error(`Error updating workspace file ${file.path}:`, error);
      // Continue with other files even if one fails
    }
  }
}
