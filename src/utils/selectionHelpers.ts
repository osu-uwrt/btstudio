/**
 * Pure helper functions for box-select copy/paste/delete operations.
 *
 * Extracted from TreeEditor so the logic is unit-testable without React hooks.
 */

import type { Node, Edge } from 'reactflow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return edges that are fully contained within a set of selected node IDs.
 * An edge is "contained" when both its source AND target are in the set.
 */
export function getContainedEdges(selectedNodeIds: Set<string>, allEdges: Edge[]): Edge[] {
  return allEdges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
}

/**
 * Build a new set of nodes from clipboard data with remapped IDs and an
 * offset applied to their positions.
 *
 * @returns The pasted nodes and a mapping from old ID -> new ID.
 */
export function buildPastedNodes(
  clipboardNodes: Node[],
  timestamp: number,
  offset = 50,
): { nodes: Node[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();

  const nodes: Node[] = clipboardNodes.map((node, idx) => {
    const newId = `${node.data?.type || 'node'}_paste_${timestamp}_${idx}`;
    idMap.set(node.id, newId);

    return {
      ...node,
      id: newId,
      position: {
        x: node.position.x + offset,
        y: node.position.y + offset,
      },
      selected: true,
      data: {
        ...node.data,
        instanceId: newId,
      },
    };
  });

  return { nodes, idMap };
}

/**
 * Re-map clipboard edge source/target using the provided ID mapping.
 * Only edges whose source AND target are both present in the map are returned.
 */
export function remapEdges(clipboardEdges: Edge[], idMap: Map<string, string>): Edge[] {
  return clipboardEdges
    .filter(e => idMap.has(e.source) && idMap.has(e.target))
    .map(e => ({
      ...e,
      id: `${idMap.get(e.source)}-${idMap.get(e.target)}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));
}

/**
 * Determine which node IDs should be deleted from a selection.
 * The root node (`root_node`) is always protected.
 */
export function getDeleteableNodeIds(selectedNodeIds: Set<string>): Set<string> {
  const result = new Set(selectedNodeIds);
  result.delete('root_node');
  return result;
}
