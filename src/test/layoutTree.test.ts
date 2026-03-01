/**
 * Tests for the tree auto-arrange layout algorithm in layoutTree.ts.
 */

import { describe, it, expect } from 'vitest';
import { AppNode, AppEdge } from '../types';
import { layoutNodes, NODE_WIDTH, H_GAP, V_GAP } from '../utils/layoutTree';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeNode(id: string, x = 0, y = 0): AppNode {
  return {
    id,
    type: 'btNode',
    position: { x, y },
    data: {
      id: id.toLowerCase(),
      type: 'Action',
      category: 'action',
      name: id,
      description: '',
      fields: [],
      instanceId: id,
      color: '#888',
    },
  };
}

function makeEdge(source: string, target: string): AppEdge {
  return { id: `${source}-${target}`, source, target };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('layoutNodes', () => {
  it('returns empty array for empty input', () => {
    expect(layoutNodes([], [])).toEqual([]);
  });

  it('returns nodes unchanged if no root_node exists', () => {
    const nodes = [makeNode('a', 10, 20)];
    const result = layoutNodes(nodes, []);
    expect(result).toEqual(nodes);
  });

  it('places a single root node at origin', () => {
    const nodes = [makeNode('root_node', 999, 999)];
    const result = layoutNodes(nodes, []);
    expect(result[0].position.x).toBe(0);
    expect(result[0].position.y).toBe(0);
  });

  it('places a root with one child directly below, centered', () => {
    const nodes = [makeNode('root_node'), makeNode('child1')];
    const edges = [makeEdge('root_node', 'child1')];
    const result = layoutNodes(nodes, edges);
    const root = result.find((n) => n.id === 'root_node')!;
    const child = result.find((n) => n.id === 'child1')!;

    // Child should be one level below
    expect(child.position.y).toBe(V_GAP);
    // Root should be centered above the child
    expect(root.position.x).toBe(child.position.x);
  });

  it('places two children side by side without overlap', () => {
    const nodes = [makeNode('root_node'), makeNode('left', 0, 0), makeNode('right', 100, 0)];
    const edges = [makeEdge('root_node', 'left'), makeEdge('root_node', 'right')];
    const result = layoutNodes(nodes, edges);
    const left = result.find((n) => n.id === 'left')!;
    const right = result.find((n) => n.id === 'right')!;

    // Right child's left edge must be >= left child's right edge + gap
    expect(right.position.x).toBeGreaterThanOrEqual(left.position.x + NODE_WIDTH + H_GAP);
    // Both at same depth
    expect(left.position.y).toBe(right.position.y);
    expect(left.position.y).toBe(V_GAP);
  });

  it('centers parent above its children', () => {
    const nodes = [makeNode('root_node'), makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('root_node', 'a'), makeEdge('root_node', 'b'), makeEdge('root_node', 'c')];
    const result = layoutNodes(nodes, edges);
    const root = result.find((n) => n.id === 'root_node')!;
    const a = result.find((n) => n.id === 'a')!;
    const c = result.find((n) => n.id === 'c')!;

    const childrenCenter = (a.position.x + c.position.x + NODE_WIDTH) / 2;
    const parentCenter = root.position.x + NODE_WIDTH / 2;
    expect(Math.abs(parentCenter - childrenCenter)).toBeLessThan(1);
  });

  it('preserves left-to-right order based on original x-positions', () => {
    // "left" has smaller x, so it should stay on the left
    const nodes = [makeNode('root_node'), makeNode('left', 10, 0), makeNode('right', 200, 0)];
    const edges = [makeEdge('root_node', 'left'), makeEdge('root_node', 'right')];
    const result = layoutNodes(nodes, edges);
    const left = result.find((n) => n.id === 'left')!;
    const right = result.find((n) => n.id === 'right')!;
    expect(left.position.x).toBeLessThan(right.position.x);
  });

  it('handles a deep chain without overlaps', () => {
    const nodes = [makeNode('root_node'), makeNode('a'), makeNode('b'), makeNode('c')];
    const edges = [makeEdge('root_node', 'a'), makeEdge('a', 'b'), makeEdge('b', 'c')];
    const result = layoutNodes(nodes, edges);
    const root = result.find((n) => n.id === 'root_node')!;
    const a = result.find((n) => n.id === 'a')!;
    const b = result.find((n) => n.id === 'b')!;
    const c = result.find((n) => n.id === 'c')!;

    // Each level should be V_GAP apart
    expect(a.position.y).toBe(V_GAP);
    expect(b.position.y).toBe(2 * V_GAP);
    expect(c.position.y).toBe(3 * V_GAP);
    // All centered on same x since it's a chain
    expect(root.position.x).toBe(a.position.x);
    expect(a.position.x).toBe(b.position.x);
    expect(b.position.x).toBe(c.position.x);
  });

  it('no horizontal overlaps in a wide tree', () => {
    // Build: root -> [a, b, c] where a -> [d, e], b -> [f], c -> [g, h]
    const nodes = [
      makeNode('root_node'),
      makeNode('a', 0), makeNode('b', 200), makeNode('c', 400),
      makeNode('d', 0), makeNode('e', 100),
      makeNode('f', 200),
      makeNode('g', 400), makeNode('h', 500),
    ];
    const edges = [
      makeEdge('root_node', 'a'), makeEdge('root_node', 'b'), makeEdge('root_node', 'c'),
      makeEdge('a', 'd'), makeEdge('a', 'e'),
      makeEdge('b', 'f'),
      makeEdge('c', 'g'), makeEdge('c', 'h'),
    ];
    const result = layoutNodes(nodes, edges);

    // Gather nodes at each depth
    const byDepth = new Map<number, AppNode[]>();
    for (const n of result) {
      const y = n.position.y;
      if (!byDepth.has(y)) byDepth.set(y, []);
      byDepth.get(y)!.push(n);
    }

    // At each depth level, verify no overlapping x ranges
    for (const [, nodesAtDepth] of byDepth) {
      const sorted = nodesAtDepth.sort((a, b) => a.position.x - b.position.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].position.x - sorted[i - 1].position.x;
        expect(gap).toBeGreaterThanOrEqual(NODE_WIDTH);
      }
    }
  });

  it('handles orphan nodes (not connected to root)', () => {
    const nodes = [makeNode('root_node'), makeNode('child'), makeNode('orphan')];
    const edges = [makeEdge('root_node', 'child')];
    const result = layoutNodes(nodes, edges);
    const orphan = result.find((n) => n.id === 'orphan')!;
    const child = result.find((n) => n.id === 'child')!;

    // Orphan should be placed below the tree
    expect(orphan.position.y).toBeGreaterThan(child.position.y);
  });

  it('does not modify edge array', () => {
    const nodes = [makeNode('root_node'), makeNode('a')];
    const edges = [makeEdge('root_node', 'a')];
    const edgesCopy = JSON.parse(JSON.stringify(edges));
    layoutNodes(nodes, edges);
    expect(edges).toEqual(edgesCopy);
  });

  it('returns new node objects (immutable)', () => {
    const nodes = [makeNode('root_node'), makeNode('a')];
    const edges = [makeEdge('root_node', 'a')];
    const result = layoutNodes(nodes, edges);
    // Should be new object references
    expect(result[0]).not.toBe(nodes[0]);
  });

  it('handles a tree with a single branching level correctly', () => {
    // root -> [a, b]
    // Verify no edge crossings: a is left, b is right, parent centered
    const nodes = [makeNode('root_node'), makeNode('a', 0, 0), makeNode('b', 300, 0)];
    const edges = [makeEdge('root_node', 'a'), makeEdge('root_node', 'b')];
    const result = layoutNodes(nodes, edges);
    const root = result.find((n) => n.id === 'root_node')!;
    const a = result.find((n) => n.id === 'a')!;
    const b = result.find((n) => n.id === 'b')!;

    // Root x should be between a and b
    expect(root.position.x).toBeGreaterThanOrEqual(a.position.x);
    expect(root.position.x).toBeLessThanOrEqual(b.position.x);
  });
});
