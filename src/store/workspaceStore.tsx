/**
 * Workspace state management (React Context + useReducer).
 *
 * This store is the single source of truth for:
 *   - The workspace folder path and its XML file listing
 *   - The active file's main tree and embedded subtrees
 *   - The subtree library (subtree_library.xml)
 *   - Dirty / modified tracking for save operations
 *
 * Consumers use `useWorkspace()` to access state and dispatch actions.
 * Heavy side-effects (file I/O, workspace sync) live in
 * `useWorkspaceOps.ts`, which dispatches into this store.
 *
 * Invariants maintained by the reducer:
 *   - `subtrees` is always a fresh Map copy on mutation (immutable updates).
 *   - `modifiedSubtreeIds` is cleared on save (CLEAR_MODIFIED_SUBTREES).
 *   - Switching files (SET_ACTIVE_FILE) resets dirty state.
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { AppNode, AppEdge, Variable, ExpandedSubtreeLevel, ExpandedSubtreeInstance } from '../types';
import { TreeData } from '../utils/xmlSerializer';

// ============ Types ============

export interface WorkspaceFile {
  path: string;
  name: string;
  modifiedTime: string;
}

export interface WorkspaceState {
  // Workspace folder info
  workspacePath: string | null;
  workspaceFiles: WorkspaceFile[];
  
  // Currently active file
  activeFilePath: string | null;
  activeFileName: string;
  
  // Current file's trees
  mainTree: TreeData | null;
  subtrees: Map<string, TreeData>;
  
  // Which tree is being edited
  activeTreeId: string | null; // null = main tree, string = subtree ID
  
  // Library subtrees (from subtree_library.xml)
  librarySubtrees: Map<string, TreeData>;
  libraryModifiedTime: string | null;
  
  // Expanded subtrees hierarchy and instances
  expandedSubtreeHierarchy: ExpandedSubtreeLevel[]; // Current navigation path in expanded subtrees
  expandedSubtreeInstances: Map<string, ExpandedSubtreeInstance>; // All expanded instances with cached state
  
  // Track modifications
  isDirty: boolean;
  modifiedSubtreeIds: Set<string>; // Subtrees modified since last save
  
  // File modification time tracking for external change detection
  fileModifiedTimes: Map<string, string>;
}

export type WorkspaceAction =
  | { type: 'SET_WORKSPACE_PATH'; path: string; files: WorkspaceFile[] }
  | { type: 'CLEAR_WORKSPACE' }
  | { type: 'SET_ACTIVE_FILE'; path: string; name: string; mainTree: TreeData; subtrees: Map<string, TreeData> }
  | { type: 'SET_LIBRARY_SUBTREES'; subtrees: Map<string, TreeData>; modifiedTime: string | null }
  | { type: 'SET_ACTIVE_TREE'; treeId: string | null }
  | { type: 'UPDATE_TREE'; treeId: string | null; nodes: AppNode[]; edges: AppEdge[]; variables: Variable[] }
  | { type: 'ADD_SUBTREE'; subtreeId: string; treeData: TreeData }
  | { type: 'ADD_SUBTREE_FROM_LIBRARY'; subtreeId: string }
  | { type: 'ADD_NEW_SUBTREE_TO_LIBRARY'; subtree: TreeData }
  | { type: 'SET_DIRTY'; isDirty: boolean }
  | { type: 'MARK_SUBTREE_MODIFIED'; subtreeId: string }
  | { type: 'CLEAR_MODIFIED_SUBTREES' }
  | { type: 'UPDATE_FILE_MODIFIED_TIME'; filePath: string; modifiedTime: string }
  | { type: 'REFRESH_WORKSPACE_FILES'; files: WorkspaceFile[] }
  // Expanded subtrees actions
  | { type: 'EXPAND_SUBTREE'; instance: ExpandedSubtreeInstance }
  | { type: 'COLLAPSE_SUBTREE'; instanceKey: string }
  | { type: 'COLLAPSE_ALL_SUBTREES' }
  | { type: 'UPDATE_EXPANDED_SUBTREE_CACHE'; instanceKey: string; nodes: AppNode[]; edges: AppEdge[]; variables: Variable[] };

// ============ Initial State ============

const initialState: WorkspaceState = {
  workspacePath: null,
  workspaceFiles: [],
  activeFilePath: null,
  activeFileName: 'Untitled',
  mainTree: null,
  subtrees: new Map(),
  activeTreeId: null,
  librarySubtrees: new Map(),
  libraryModifiedTime: null,
  expandedSubtreeHierarchy: [],
  expandedSubtreeInstances: new Map(),
  isDirty: false,
  modifiedSubtreeIds: new Set(),
  fileModifiedTimes: new Map(),
};

// ============ Reducer ============

function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'SET_WORKSPACE_PATH': {
      const fileModifiedTimes = new Map<string, string>();
      action.files.forEach(f => fileModifiedTimes.set(f.path, f.modifiedTime));
      
      return {
        ...state,
        workspacePath: action.path,
        workspaceFiles: action.files,
        fileModifiedTimes,
      };
    }
    
    case 'CLEAR_WORKSPACE':
      return { ...initialState };
    
    case 'SET_ACTIVE_FILE':
      return {
        ...state,
        activeFilePath: action.path,
        activeFileName: action.name,
        mainTree: action.mainTree,
        subtrees: new Map(action.subtrees),
        activeTreeId: null, // Reset to main tree
        expandedSubtreeHierarchy: [], // Reset expansion hierarchy
        expandedSubtreeInstances: new Map(), // Clear all expanded instances
        isDirty: false,
        modifiedSubtreeIds: new Set(),
      };
    
    case 'SET_LIBRARY_SUBTREES':
      return {
        ...state,
        librarySubtrees: new Map(action.subtrees),
        libraryModifiedTime: action.modifiedTime,
      };
    
    case 'SET_ACTIVE_TREE':
      return {
        ...state,
        activeTreeId: action.treeId,
      };
    
    case 'UPDATE_TREE': {
      const { treeId, nodes, edges, variables } = action;
      
      if (treeId === null) {
        // Update main tree
        return {
          ...state,
          mainTree: state.mainTree ? {
            ...state.mainTree,
            nodes,
            edges,
            variables,
          } : { id: 'MainTree', nodes, edges, variables },
          isDirty: true,
        };
      } else {
        // Update subtree - preserve description, ports, and color
        const newSubtrees = new Map(state.subtrees);
        const existingSubtree = newSubtrees.get(treeId);
        newSubtrees.set(treeId, {
          id: treeId,
          nodes,
          edges,
          variables: existingSubtree?.variables || variables,
          description: existingSubtree?.description,
          ports: existingSubtree?.ports,
          color: existingSubtree?.color,
        });
        
        const newModified = new Set(state.modifiedSubtreeIds);
        newModified.add(treeId);
        
        return {
          ...state,
          subtrees: newSubtrees,
          modifiedSubtreeIds: newModified,
          isDirty: true,
        };
      }
    }
    
    case 'ADD_SUBTREE': {
      const newSubtrees = new Map(state.subtrees);
      newSubtrees.set(action.subtreeId, action.treeData);
      return {
        ...state,
        subtrees: newSubtrees,
        isDirty: true,
      };
    }
    
    case 'ADD_SUBTREE_FROM_LIBRARY': {
      const librarySubtree = state.librarySubtrees.get(action.subtreeId);
      if (!librarySubtree) return state;
      
      // Deep copy the subtree data including ports and color
      const subtreeCopy: TreeData = {
        id: librarySubtree.id,
        nodes: JSON.parse(JSON.stringify(librarySubtree.nodes)),
        edges: JSON.parse(JSON.stringify(librarySubtree.edges)),
        variables: [...librarySubtree.variables],
        description: librarySubtree.description,
        ports: librarySubtree.ports ? [...librarySubtree.ports] : undefined,
        color: librarySubtree.color,
      };
      
      const newSubtrees = new Map(state.subtrees);
      newSubtrees.set(action.subtreeId, subtreeCopy);
      
      return {
        ...state,
        subtrees: newSubtrees,
        isDirty: true,
      };
    }
    
    case 'ADD_NEW_SUBTREE_TO_LIBRARY': {
      const newLibrary = new Map(state.librarySubtrees);
      newLibrary.set(action.subtree.id, action.subtree);
      
      const newModified = new Set(state.modifiedSubtreeIds);
      newModified.add(action.subtree.id);
      
      return {
        ...state,
        librarySubtrees: newLibrary,
        modifiedSubtreeIds: newModified,
        isDirty: true,
      };
    }
    
    case 'SET_DIRTY':
      return {
        ...state,
        isDirty: action.isDirty,
      };
    
    case 'MARK_SUBTREE_MODIFIED': {
      const newModified = new Set(state.modifiedSubtreeIds);
      newModified.add(action.subtreeId);
      return {
        ...state,
        modifiedSubtreeIds: newModified,
        isDirty: true,
      };
    }
    
    case 'CLEAR_MODIFIED_SUBTREES':
      return {
        ...state,
        modifiedSubtreeIds: new Set(),
        isDirty: false,
      };
    
    case 'UPDATE_FILE_MODIFIED_TIME': {
      const newTimes = new Map(state.fileModifiedTimes);
      newTimes.set(action.filePath, action.modifiedTime);
      return {
        ...state,
        fileModifiedTimes: newTimes,
      };
    }
    
    case 'REFRESH_WORKSPACE_FILES':
      return {
        ...state,
        workspaceFiles: action.files,
      };
    
    // ───── Expanded Subtrees Management ─────
    
    case 'EXPAND_SUBTREE': {
      const newInstances = new Map(state.expandedSubtreeInstances);
      newInstances.set(action.instance.instanceKey, action.instance);
      return {
        ...state,
        expandedSubtreeInstances: newInstances,
      };
    }
    
    case 'COLLAPSE_SUBTREE': {
      const newInstances = new Map(state.expandedSubtreeInstances);
      newInstances.delete(action.instanceKey);
      return {
        ...state,
        expandedSubtreeInstances: newInstances,
      };
    }
    
    case 'COLLAPSE_ALL_SUBTREES': {
      return {
        ...state,
        expandedSubtreeHierarchy: [],
        expandedSubtreeInstances: new Map(),
      };
    }
    
    case 'UPDATE_EXPANDED_SUBTREE_CACHE': {
      const instance = state.expandedSubtreeInstances.get(action.instanceKey);
      if (!instance) return state;
      
      const newInstances = new Map(state.expandedSubtreeInstances);
      newInstances.set(action.instanceKey, {
        ...instance,
        cachedState: {
          nodes: action.nodes,
          edges: action.edges,
          variables: action.variables,
        },
      });
      
      return {
        ...state,
        expandedSubtreeInstances: newInstances,
      };
    }
    
    default:
      return state;
  }
}

// ============ Context ============

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  
  // Computed values
  activeTree: TreeData | null;
  allSubtreeIds: string[];
  
  // Helper functions
  getTree: (treeId: string | null) => TreeData | null;
  isSubtreeInLibrary: (subtreeId: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ============ Provider ============

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, initialState);
  
  // Get the currently active tree
  const activeTree = state.activeTreeId === null 
    ? state.mainTree 
    : state.subtrees.get(state.activeTreeId) || null;
  
  // Get all subtree IDs (from current file)
  const allSubtreeIds = Array.from(state.subtrees.keys());
  
  // Get a specific tree by ID
  const getTree = useCallback((treeId: string | null): TreeData | null => {
    if (treeId === null) return state.mainTree;
    return state.subtrees.get(treeId) || null;
  }, [state.mainTree, state.subtrees]);
  
  // Check if a subtree is in the library
  const isSubtreeInLibrary = useCallback((subtreeId: string): boolean => {
    return state.librarySubtrees.has(subtreeId);
  }, [state.librarySubtrees]);
  
  const value: WorkspaceContextValue = {
    state,
    dispatch,
    activeTree,
    allSubtreeIds,
    getTree,
    isSubtreeInLibrary,
  };
  
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// ============ Hook ============

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// ============ Constants ============

export const SUBTREE_LIBRARY_FILENAME = 'subtree_library.xml';
