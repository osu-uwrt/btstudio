/**
 * layoutTree.ts
 *
 * Computes overlap-free tree positions for a set of @xyflow/react nodes and edges.
 *
 * Uses a bottom-up / top-down (Reingold-Tilford-inspired) approach:
 *   1. Build an adjacency tree from edges (respecting left-to-right child order).
 *   2. Recursively measure each subtree width (leaves get a fixed width).
 *   3. Assign x positions so siblings are packed tightly (no overlaps) and each
 *      parent is centered above its children.
 *   4. Assign y positions by depth level with uniform vertical spacing.
 *
 * The algorithm is pure (no side-effects) and operates only on id/position data,
 * making it straightforward to test independently of React or the DOM.
 */

import type { AppNode, AppEdge } from '../types';

// ── Layout constants ────────────────────────────────────────────────────
/** Assumed node width (px).  Matches BTNode CSS min-width with some padding. */
export const NODE_WIDTH = 200;

/** Horizontal gap between sibling subtrees (px). */
export const H_GAP = 40;

/** Vertical distance between depth levels (px). */
export const V_GAP = 120;

// ── Internal tree representation ────────────────────────────────────────
interface TreeNode {
  id: string;
  children: TreeNode[];
  /** Subtree width in px (populated bottom-up). */
  width: number;
  /** Assigned position. */
  x: number;
  y: number;
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Return a new node array with updated `position` values so the tree is
 * neatly arranged without overlaps or edge crossings.
 *
 * Nodes that are not reachable from the root are stacked below the tree.
 */
export function layoutNodes(nodes: AppNode[], edges: AppEdge[]): AppNode[] {
  if (nodes.length === 0) return [];

  // 1. Find root
  const rootNode = nodes.find((n) => n.id === 'root_node');
  if (!rootNode) return nodes; // nothing to layout

  // 2. Build child adjacency, preserving current left-to-right order
  const childrenMap = buildChildrenMap(nodes, edges);

  // 3. Build recursive tree structure
  const visited = new Set<string>();
  const tree = buildTree(rootNode.id, childrenMap, visited);

  // 4. Measure subtree widths bottom-up
  measureWidths(tree);

  // 5. Assign positions top-down
  assignPositions(tree, 0, 0);

  // 6. Build id -> position lookup
  const positionMap = new Map<string, { x: number; y: number }>();
  collectPositions(tree, positionMap);

  // 7. Handle orphaned nodes (not reachable from root)
  const orphans = nodes.filter((n) => !visited.has(n.id));
  let orphanY = (maxDepth(tree) + 1) * V_GAP + V_GAP;
  let orphanX = 0;
  for (const orphan of orphans) {
    positionMap.set(orphan.id, { x: orphanX, y: orphanY });
    orphanX += NODE_WIDTH + H_GAP;
    if (orphanX > 1200) {
      orphanX = 0;
      orphanY += V_GAP;
    }
  }

  // 8. Map back to AppNode[] with updated positions
  return nodes.map((n) => {
    const pos = positionMap.get(n.id);
    if (pos) {
      return { ...n, position: { x: pos.x, y: pos.y } };
    }
    return n;
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a map of parentId -> ordered child node ids.
 * Children are sorted by their current x-position to preserve visual order.
 */
function buildChildrenMap(nodes: AppNode[], edges: AppEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const edge of edges) {
    if (!map.has(edge.source)) map.set(edge.source, []);
    map.get(edge.source)!.push(edge.target);
  }

  // Sort child lists by current x-position (preserves user intent)
  for (const [, children] of map) {
    children.sort((a, b) => {
      const ax = nodeMap.get(a)?.position?.x ?? 0;
      const bx = nodeMap.get(b)?.position?.x ?? 0;
      return ax - bx;
    });
  }

  return map;
}

function buildTree(
  id: string,
  childrenMap: Map<string, string[]>,
  visited: Set<string>,
): TreeNode {
  visited.add(id);
  const childIds = childrenMap.get(id) ?? [];
  const children: TreeNode[] = [];
  for (const cid of childIds) {
    if (!visited.has(cid)) {
      children.push(buildTree(cid, childrenMap, visited));
    }
  }
  return { id, children, width: 0, x: 0, y: 0 };
}

/** Compute subtree width bottom-up. */
function measureWidths(node: TreeNode): void {
  if (node.children.length === 0) {
    node.width = NODE_WIDTH;
    return;
  }
  for (const child of node.children) {
    measureWidths(child);
  }
  const totalChildWidth = node.children.reduce((sum, c) => sum + c.width, 0);
  const gaps = (node.children.length - 1) * H_GAP;
  node.width = Math.max(NODE_WIDTH, totalChildWidth + gaps);
}

/** Assign x/y positions top-down. `left` is the left boundary of this subtree. */
function assignPositions(node: TreeNode, left: number, depth: number): void {
  node.y = depth * V_GAP;

  if (node.children.length === 0) {
    // Leaf: center within allocated width
    node.x = left + (node.width - NODE_WIDTH) / 2;
    return;
  }

  // Lay out children left-to-right
  let cursor = left;
  const totalChildWidth = node.children.reduce((sum, c) => sum + c.width, 0);
  const gaps = (node.children.length - 1) * H_GAP;
  const childBlockWidth = totalChildWidth + gaps;
  // If parent is wider than children block, offset children so they are centered
  const childOffset = (node.width - childBlockWidth) / 2;
  cursor += childOffset;

  for (const child of node.children) {
    assignPositions(child, cursor, depth + 1);
    cursor += child.width + H_GAP;
  }

  // Center parent over children
  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  const childrenCenter = (firstChild.x + lastChild.x + NODE_WIDTH) / 2;
  node.x = childrenCenter - NODE_WIDTH / 2;
}

function collectPositions(node: TreeNode, map: Map<string, { x: number; y: number }>): void {
  map.set(node.id, { x: node.x, y: node.y });
  for (const child of node.children) {
    collectPositions(child, map);
  }
}

function maxDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(maxDepth));
}
