/**
 * Tests for src/store/workspaceStore.tsx
 *
 * Tests the workspace reducer logic in isolation, without rendering
 * React components. Covers all action types and state transitions.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { WorkspaceProvider, useWorkspace, SUBTREE_LIBRARY_FILENAME } from '../store/workspaceStore';
import type { TreeData } from '../utils/xmlSerializer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal tree data for testing */
function makeTreeData(id: string, nodeCount = 1): TreeData {
  return {
    id,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `${id}_node_${i}`,
      type: 'btNode',
      position: { x: 100 * i, y: 50 },
      data: {
        id: 'action',
        type: 'PrintMessage',
        category: 'action' as const,
        name: 'PrintMessage',
        description: 'test',
        fields: [],
        instanceId: `${id}_node_${i}`,
        color: '#4CAF50',
      },
    })),
    edges: [],
    variables: [],
  };
}

/** Render the useWorkspace hook inside a WorkspaceProvider */
function renderWorkspaceHook() {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WorkspaceProvider>{children}</WorkspaceProvider>
  );
  return renderHook(() => useWorkspace(), { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('workspaceStore', () => {
  describe('initial state', () => {
    it('starts with no workspace and no active file', () => {
      const { result } = renderWorkspaceHook();
      const { state } = result.current;

      expect(state.workspacePath).toBeNull();
      expect(state.activeFilePath).toBeNull();
      expect(state.mainTree).toBeNull();
      expect(state.subtrees.size).toBe(0);
      expect(state.librarySubtrees.size).toBe(0);
      expect(state.isDirty).toBe(false);
    });

    it('computes activeTree as null when no main tree', () => {
      const { result } = renderWorkspaceHook();
      expect(result.current.activeTree).toBeNull();
    });
  });

  describe('SET_WORKSPACE_PATH', () => {
    it('sets workspace path and files', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_WORKSPACE_PATH',
          path: '/test/workspace',
          files: [
            { path: '/test/workspace/tree.xml', name: 'tree.xml', modifiedTime: '2025-01-01' },
          ],
        });
      });

      expect(result.current.state.workspacePath).toBe('/test/workspace');
      expect(result.current.state.workspaceFiles).toHaveLength(1);
    });
  });

  describe('SET_ACTIVE_FILE', () => {
    it('sets active file and resets dirty state', () => {
      const { result } = renderWorkspaceHook();
      const mainTree = makeTreeData('MainTree', 2);
      const subtrees = new Map([['Sub1', makeTreeData('Sub1')]]);

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/test/tree.xml',
          name: 'tree.xml',
          mainTree,
          subtrees,
        });
      });

      expect(result.current.state.activeFilePath).toBe('/test/tree.xml');
      expect(result.current.state.activeFileName).toBe('tree.xml');
      expect(result.current.state.mainTree?.id).toBe('MainTree');
      expect(result.current.state.subtrees.size).toBe(1);
      expect(result.current.state.isDirty).toBe(false);
      expect(result.current.state.activeTreeId).toBeNull();
    });
  });

  describe('SET_ACTIVE_TREE', () => {
    it('switches active tree and updates computed activeTree', () => {
      const { result } = renderWorkspaceHook();
      const sub = makeTreeData('MySub');

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/test/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map([['MySub', sub]]),
        });
      });

      // Default: main tree
      expect(result.current.activeTree?.id).toBe('Main');

      act(() => {
        result.current.dispatch({ type: 'SET_ACTIVE_TREE', treeId: 'MySub' });
      });

      expect(result.current.state.activeTreeId).toBe('MySub');
      expect(result.current.activeTree?.id).toBe('MySub');
    });
  });

  describe('UPDATE_TREE', () => {
    it('updates main tree when treeId is null', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map(),
        });
      });

      act(() => {
        result.current.dispatch({
          type: 'UPDATE_TREE',
          treeId: null,
          nodes: [{ id: 'new', type: 'btNode', position: { x: 0, y: 0 }, data: {
            id: 'action', type: 'PrintMessage', category: 'action' as const,
            name: 'PrintMessage', description: 'test', fields: [],
            instanceId: 'new', color: '#4CAF50',
          } }],
          edges: [],
          variables: [],
        });
      });

      expect(result.current.state.mainTree?.nodes).toHaveLength(1);
      expect(result.current.state.isDirty).toBe(true);
    });

    it('updates a subtree and marks it modified', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map([['Sub1', makeTreeData('Sub1')]]),
        });
      });

      act(() => {
        result.current.dispatch({
          type: 'UPDATE_TREE',
          treeId: 'Sub1',
          nodes: [],
          edges: [],
          variables: [],
        });
      });

      expect(result.current.state.modifiedSubtreeIds.has('Sub1')).toBe(true);
      expect(result.current.state.isDirty).toBe(true);
    });
  });

  describe('library subtrees', () => {
    it('SET_LIBRARY_SUBTREES stores library data', () => {
      const { result } = renderWorkspaceHook();
      const lib = new Map([['LibSub', makeTreeData('LibSub')]]);

      act(() => {
        result.current.dispatch({
          type: 'SET_LIBRARY_SUBTREES',
          subtrees: lib,
          modifiedTime: '2025-01-01',
        });
      });

      expect(result.current.state.librarySubtrees.size).toBe(1);
      expect(result.current.isSubtreeInLibrary('LibSub')).toBe(true);
      expect(result.current.isSubtreeInLibrary('Missing')).toBe(false);
    });

    it('ADD_SUBTREE_FROM_LIBRARY copies library subtree into file', () => {
      const { result } = renderWorkspaceHook();
      const libTree = makeTreeData('LibSub', 3);

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map(),
        });
      });

      act(() => {
        result.current.dispatch({
          type: 'SET_LIBRARY_SUBTREES',
          subtrees: new Map([['LibSub', libTree]]),
          modifiedTime: null,
        });
      });

      act(() => {
        result.current.dispatch({ type: 'ADD_SUBTREE_FROM_LIBRARY', subtreeId: 'LibSub' });
      });

      expect(result.current.state.subtrees.has('LibSub')).toBe(true);
      // Should be a deep copy, not the same reference
      expect(result.current.state.subtrees.get('LibSub')).not.toBe(libTree);
    });

    it('ADD_NEW_SUBTREE_TO_LIBRARY adds to library and marks modified', () => {
      const { result } = renderWorkspaceHook();
      const newSub = makeTreeData('NewSub');

      act(() => {
        result.current.dispatch({ type: 'ADD_NEW_SUBTREE_TO_LIBRARY', subtree: newSub });
      });

      expect(result.current.state.librarySubtrees.has('NewSub')).toBe(true);
      expect(result.current.state.modifiedSubtreeIds.has('NewSub')).toBe(true);
    });
  });

  describe('dirty tracking', () => {
    it('CLEAR_MODIFIED_SUBTREES resets dirty state', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map([['S', makeTreeData('S')]]),
        });
      });

      // Make dirty
      act(() => {
        result.current.dispatch({ type: 'MARK_SUBTREE_MODIFIED', subtreeId: 'S' });
      });
      expect(result.current.state.isDirty).toBe(true);

      act(() => {
        result.current.dispatch({ type: 'CLEAR_MODIFIED_SUBTREES' });
      });
      expect(result.current.state.isDirty).toBe(false);
      expect(result.current.state.modifiedSubtreeIds.size).toBe(0);
    });
  });

  describe('CLEAR_WORKSPACE', () => {
    it('resets all state to initial values', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map(),
        });
      });

      act(() => {
        result.current.dispatch({ type: 'CLEAR_WORKSPACE' });
      });

      expect(result.current.state.workspacePath).toBeNull();
      expect(result.current.state.mainTree).toBeNull();
      expect(result.current.state.activeFilePath).toBeNull();
    });
  });

  describe('getTree helper', () => {
    it('returns main tree for null, subtree for string ID', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map([['Sub', makeTreeData('Sub')]]),
        });
      });

      expect(result.current.getTree(null)?.id).toBe('Main');
      expect(result.current.getTree('Sub')?.id).toBe('Sub');
      expect(result.current.getTree('Missing')).toBeNull();
    });
  });

  describe('allSubtreeIds', () => {
    it('lists all subtree IDs from current file', () => {
      const { result } = renderWorkspaceHook();

      act(() => {
        result.current.dispatch({
          type: 'SET_ACTIVE_FILE',
          path: '/t.xml',
          name: 't.xml',
          mainTree: makeTreeData('Main'),
          subtrees: new Map([
            ['Sub1', makeTreeData('Sub1')],
            ['Sub2', makeTreeData('Sub2')],
          ]),
        });
      });

      expect(result.current.allSubtreeIds).toEqual(
        expect.arrayContaining(['Sub1', 'Sub2']),
      );
      expect(result.current.allSubtreeIds.length).toBe(2);
    });
  });

  describe('constants', () => {
    it('exports SUBTREE_LIBRARY_FILENAME', () => {
      expect(SUBTREE_LIBRARY_FILENAME).toBe('subtree_library.xml');
    });
  });
});
