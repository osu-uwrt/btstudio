/**
 * Tests for the pure box-select helper functions in selectionHelpers.ts.
 */

import { describe, it, expect } from 'vitest';
import { AppNode, AppEdge } from '../types';
import {
  getContainedEdges,
  buildPastedNodes,
  remapEdges,
  getDeleteableNodeIds,
} from '../utils/selectionHelpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, x = 0, y = 0, type = 'Sequence', category: 'action' | 'control' | 'root' | 'decorator' | 'condition' | 'subtree' = 'action'): AppNode {
  return {
    id,
    type: 'btNode',
    position: { x, y },
    data: {
      id: type.toLowerCase(),
      type,
      category,
      name: type,
      description: '',
      fields: [],
      instanceId: id,
      color: '#4CAF50',
    },
  };
}

function makeEdge(source: string, target: string): AppEdge {
  return { id: `${source}-${target}`, source, target };
}

// ---------------------------------------------------------------------------
// getContainedEdges
// ---------------------------------------------------------------------------

describe('getContainedEdges', () => {
  it('returns edges where both endpoints are in the selection', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')];
    const selected = new Set(['a', 'b']);

    const result = getContainedEdges(selected, edges);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a-b');
  });

  it('returns empty array when no edges are fully contained', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')];
    const selected = new Set(['a', 'c']);

    expect(getContainedEdges(selected, edges)).toHaveLength(0);
  });

  it('returns all edges when all nodes are selected', () => {
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('a', 'c')];
    const selected = new Set(['a', 'b', 'c']);

    expect(getContainedEdges(selected, edges)).toHaveLength(3);
  });

  it('handles empty selection', () => {
    const edges = [makeEdge('a', 'b')];
    expect(getContainedEdges(new Set(), edges)).toHaveLength(0);
  });

  it('handles empty edge list', () => {
    expect(getContainedEdges(new Set(['a', 'b']), [])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildPastedNodes
// ---------------------------------------------------------------------------

describe('buildPastedNodes', () => {
  it('generates new IDs and offsets positions', () => {
    const original = [makeNode('n1', 100, 200, 'Action'), makeNode('n2', 300, 400, 'Condition')];
    const ts = 1000;

    const { nodes, idMap } = buildPastedNodes(original, ts, 50);

    expect(nodes).toHaveLength(2);
    expect(idMap.size).toBe(2);

    // Positions should be offset
    expect(nodes[0].position).toEqual({ x: 150, y: 250 });
    expect(nodes[1].position).toEqual({ x: 350, y: 450 });

    // IDs should be new
    expect(nodes[0].id).toBe('Action_paste_1000_0');
    expect(nodes[1].id).toBe('Condition_paste_1000_1');

    // idMap should map old -> new
    expect(idMap.get('n1')).toBe('Action_paste_1000_0');
    expect(idMap.get('n2')).toBe('Condition_paste_1000_1');
  });

  it('marks pasted nodes as selected', () => {
    const { nodes } = buildPastedNodes([makeNode('n1')], 0);
    expect(nodes[0].selected).toBe(true);
  });

  it('updates data.instanceId to new ID', () => {
    const { nodes } = buildPastedNodes([makeNode('n1', 0, 0, 'Fallback')], 42);
    expect(nodes[0].data.instanceId).toBe(nodes[0].id);
  });

  it('uses "node" as type prefix when data.type is missing', () => {
    const bare = { id: 'x', type: 'btNode', position: { x: 0, y: 0 }, data: {
      id: 'unknown',
      type: '',
      category: 'action' as const,
      name: 'Unknown',
      description: '',
      fields: [],
      instanceId: 'x',
      color: '#999',
    } } satisfies AppNode;
    const { nodes } = buildPastedNodes([bare], 99);
    expect(nodes[0].id).toBe('node_paste_99_0');
  });

  it('applies custom offset', () => {
    const { nodes } = buildPastedNodes([makeNode('n1', 10, 20)], 0, 100);
    expect(nodes[0].position).toEqual({ x: 110, y: 120 });
  });

  it('filters out root nodes from pasted set', () => {
    const root = makeNode('root_node', 0, 0, 'Root', 'root');
    const action = makeNode('a1', 100, 100, 'PrintMessage');
    const { nodes, idMap } = buildPastedNodes([root, action], 2000);

    // Only the action should be pasted
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.type).toBe('PrintMessage');

    // Root should NOT be in the idMap
    expect(idMap.has('root_node')).toBe(false);
    // Action should be in the idMap
    expect(idMap.has('a1')).toBe(true);
  });

  it('returns empty when only root nodes are in clipboard', () => {
    const root = makeNode('root_node', 0, 0, 'Root', 'root');
    const { nodes, idMap } = buildPastedNodes([root], 3000);

    expect(nodes).toHaveLength(0);
    expect(idMap.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// remapEdges
// ---------------------------------------------------------------------------

describe('remapEdges', () => {
  it('remaps source and target using the ID map', () => {
    const clipboardEdges = [makeEdge('old_a', 'old_b')];
    const idMap = new Map([['old_a', 'new_a'], ['old_b', 'new_b']]);

    const result = remapEdges(clipboardEdges, idMap);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('new_a');
    expect(result[0].target).toBe('new_b');
    expect(result[0].id).toBe('new_a-new_b');
  });

  it('drops edges whose source or target is not in the map', () => {
    const clipboardEdges = [makeEdge('a', 'b'), makeEdge('a', 'c')];
    const idMap = new Map([['a', 'x'], ['b', 'y']]);
    // only a->b should survive; a->c has unmapped target

    const result = remapEdges(clipboardEdges, idMap);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('x');
    expect(result[0].target).toBe('y');
  });

  it('returns empty array for empty input', () => {
    expect(remapEdges([], new Map())).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDeleteableNodeIds
// ---------------------------------------------------------------------------

describe('getDeleteableNodeIds', () => {
  it('removes root_node from the set', () => {
    const selected = new Set(['root_node', 'n1', 'n2']);
    const result = getDeleteableNodeIds(selected);

    expect(result.has('root_node')).toBe(false);
    expect(result.has('n1')).toBe(true);
    expect(result.has('n2')).toBe(true);
    expect(result.size).toBe(2);
  });

  it('returns all IDs when root_node is not selected', () => {
    const selected = new Set(['n1', 'n2']);
    const result = getDeleteableNodeIds(selected);
    expect(result.size).toBe(2);
  });

  it('returns empty set when only root_node is selected', () => {
    const result = getDeleteableNodeIds(new Set(['root_node']));
    expect(result.size).toBe(0);
  });

  it('does not mutate the original set', () => {
    const original = new Set(['root_node', 'n1']);
    getDeleteableNodeIds(original);
    expect(original.has('root_node')).toBe(true);
  });
});
