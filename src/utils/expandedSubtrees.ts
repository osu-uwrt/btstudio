/**
 * Manages expanded subtrees and their state.
 *
 * Features:
 *   - Detects recursive subtree references to prevent infinite loops
 *   - Tracks multiple expansion levels (nesting depth)
 *   - Generates unique instance keys to prevent duplicate expansions
 *   - Manages cached state for expanded subtrees (in-memory only)
 *   - Provides breadcrumb navigation data
 *
 * Data structure:
 *   expandedInstances: Map<instanceKey, ExpandedSubtreeInstance>
 *   This allows O(1) lookup and deduplication by instance key.
 */

import { AppNode, AppEdge, Variable, ExpandedSubtreeLevel, ExpandedSubtreeInstance } from '../types';
import { TreeData } from './xmlSerializer';

// ═══════════════════════════════════════════════════════════════════════════
// Recursion Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if expanding a subtree at a given level would create a recursive loop.
 *
 * Returns true if the subtree to expand is already in the hierarchy above it.
 *
 * Example:
 *   - MainTree > Navigation (expanded)
 *   - User tries to expand Navigation from within Navigation
 *   - This would be recursive and should be prevented
 *
 * @param subtreeIdToExpand The subtree ID the user wants to expand
 * @param currentHierarchy The current expansion hierarchy (parent levels)
 * @returns true if this would create a recursive loop
 */
export function isSubtreeRecursive(
  subtreeIdToExpand: string,
  currentHierarchy: ExpandedSubtreeLevel[],
): boolean {
  // Check if any level in the hierarchy has the same subtree ID
  return currentHierarchy.some((level) => level.subtreeId === subtreeIdToExpand);
}

/**
 * Get all subtree IDs referenced by the given nodes (both as direct nodes and nested).
 *
 * This is used to detect if a subtree references itself directly.
 *
 * @param nodes The nodes to scan
 * @returns Set of subtree IDs referenced by these nodes
 */
export function getReferencedSubtreeIds(nodes: AppNode[]): Set<string> {
  const referenced = new Set<string>();
  nodes.forEach((node) => {
    if (node.data.category === 'subtree' && node.data.subtreeId) {
      referenced.add(node.data.subtreeId);
    }
  });
  return referenced;
}

/**
 * Validate that expanding a subtree is safe (won't create recursion).
 *
 * @param subtreeIdToExpand The subtree ID being expanded
 * @param parentTreeId The parent tree context (null for main tree)
 * @param currentHierarchy Current expansion hierarchy
 * @param allSubtrees Map of all available subtrees
 * @returns { isValid: boolean; reason?: string }
 */
export function validateSubtreeExpansion(
  subtreeIdToExpand: string,
  parentTreeId: string | null,
  currentHierarchy: ExpandedSubtreeLevel[],
  allSubtrees: Map<string, TreeData>,
): { isValid: boolean; reason?: string } {
  // Check hierarchy recursion
  if (isSubtreeRecursive(subtreeIdToExpand, currentHierarchy)) {
    return {
      isValid: false,
      reason: `Cannot expand '${subtreeIdToExpand}' - it would create a recursive loop.`,
    };
  }

  // Check if subtree exists
  if (!allSubtrees.has(subtreeIdToExpand)) {
    return {
      isValid: false,
      reason: `Subtree '${subtreeIdToExpand}' not found in workspace.`,
    };
  }

  // Check if the subtree directly references itself
  const subtreeData = allSubtrees.get(subtreeIdToExpand);
  if (subtreeData) {
    const referencedSubtrees = getReferencedSubtreeIds(subtreeData.nodes);
    if (referencedSubtrees.has(subtreeIdToExpand)) {
      return {
        isValid: false,
        reason: `Subtree '${subtreeIdToExpand}' references itself directly.`,
      };
    }
  }

  return { isValid: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Instance Key Generation and Deduplication
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique instance key for an expanded subtree.
 *
 * The key incorporates the full hierarchy path to uniquely identify each expansion,
 * allowing the same subtree to be open in different contexts (e.g., in MainTree
 * and in another expanded subtree) without conflict.
 *
 * Format: "nodeInstanceId_parentTreeId_hierarchyPath"
 * Example: "node_123_null_MainTree"
 *          "node_456_Navigation_MainTree/Navigation/Movement"
 *
 * @param nodeInstanceId The instance ID of the subtree node being expanded
 * @param subtreeId The subtree ID being expanded
 * @param hierarchy The current expansion hierarchy
 * @returns Unique instance key
 */
export function generateInstanceKey(
  nodeInstanceId: string,
  subtreeId: string,
  hierarchy: ExpandedSubtreeLevel[],
): string {
  const hierarchyPath = hierarchy.length === 0
    ? 'root'
    : hierarchy.map((l) => l.subtreeId).join('/');
  return `${nodeInstanceId}_${hierarchyPath}_${subtreeId}`;
}

/**
 * Find if a subtree is already expanded anywhere in the expansion hierarchy.
 *
 * This checks if the user is trying to open the same subtree that's already open elsewhere.
 * For example, if Navigation is already expanded in MainTree, trying to expand it again
 * (from another context or a different node) would be a duplicate.
 *
 * @param subtreeIdToExpand The subtree ID being opened
 * @param expandedInstances All currently expanded subtree instances
 * @returns The existing instance if found, null otherwise
 */
export function findExistingExpansion(
  subtreeIdToExpand: string,
  expandedInstances: Map<string, ExpandedSubtreeInstance>,
): ExpandedSubtreeInstance | null {
  for (const instance of expandedInstances.values()) {
    if (instance.subtreeId === subtreeIdToExpand) {
      return instance;
    }
  }
  return null;
}

/**
 * Remove an expanded subtree instance by its key.
 *
 * @param instanceKey The unique instance key
 * @param expandedInstances Current map of expanded instances
 * @returns New map with the instance removed
 */
export function removeExpandedInstance(
  instanceKey: string,
  expandedInstances: Map<string, ExpandedSubtreeInstance>,
): Map<string, ExpandedSubtreeInstance> {
  const newMap = new Map(expandedInstances);
  newMap.delete(instanceKey);
  return newMap;
}

// ═══════════════════════════════════════════════════════════════════════════
// Breadcrumb and Navigation Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate breadcrumb data for the current navigation path.
 *
 * Used to display a navigation trail like: MainTree > Navigation > MovementHandler
 *
 * @param hierarchy Current expansion hierarchy
 * @param activeSubtreeId The currently active/expanded subtree (if any)
 * @returns Array of breadcrumb items
 */
export function generateBreadcrumbs(
  hierarchy: ExpandedSubtreeLevel[],
  activeSubtreeId?: string,
): Array<{ id: string | null; label: string }> {
  const breadcrumbs: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'MainTree' },
  ];

  hierarchy.forEach((level) => {
    breadcrumbs.push({
      id: level.subtreeId,
      label: level.subtreeId,
    });
  });

  // Add the current active subtree if it's not in the hierarchy yet
  if (activeSubtreeId && !hierarchy.some((l) => l.subtreeId === activeSubtreeId)) {
    breadcrumbs.push({
      id: activeSubtreeId,
      label: activeSubtreeId,
    });
  }

  return breadcrumbs;
}

/**
 * Build a new hierarchy by adding a level to the current hierarchy.
 *
 * @param currentHierarchy The existing hierarchy
 * @param subtreeId The subtree being expanded
 * @param nodeInstanceId The instance ID of the subtree node
 * @returns New hierarchy array with the level added
 */
export function extendHierarchy(
  currentHierarchy: ExpandedSubtreeLevel[],
  subtreeId: string,
  nodeInstanceId: string,
): ExpandedSubtreeLevel[] {
  const parentTreeId = currentHierarchy.length === 0
    ? null
    : currentHierarchy[currentHierarchy.length - 1].subtreeId;

  return [
    ...currentHierarchy,
    {
      subtreeId,
      nodeInstanceId,
      parentTreeId,
    },
  ];
}

/**
 * Build a new hierarchy by removing levels from the current one.
 *
 * Used when collapsing a subtree.
 *
 * @param currentHierarchy The existing hierarchy
 * @param depth The number of levels to keep (0 = back to main, 1 = one level deep, etc.)
 * @returns Truncated hierarchy
 */
export function truncateHierarchy(
  currentHierarchy: ExpandedSubtreeLevel[],
  depth: number,
): ExpandedSubtreeLevel[] {
  return currentHierarchy.slice(0, Math.max(0, depth));
}

/**
 * Get the parent tree ID for a given hierarchy level.
 *
 * @param hierarchy Current hierarchy
 * @returns null for main tree, or the subtree ID of the parent
 */
export function getParentTreeId(hierarchy: ExpandedSubtreeLevel[]): string | null {
  if (hierarchy.length === 0) return null;
  return hierarchy[hierarchy.length - 1].subtreeId;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cached State Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a new ExpandedSubtreeInstance with cached state.
 *
 * @param nodeInstanceId The instance ID of the subtree node
 * @param subtreeId The subtree ID
 * @param hierarchy The expansion hierarchy
 * @param nodes Initial cached nodes
 * @param edges Initial cached edges
 * @param variables Initial cached variables
 * @returns New expanded instance
 */
export function createExpandedInstance(
  nodeInstanceId: string,
  subtreeId: string,
  hierarchy: ExpandedSubtreeLevel[],
  nodes: AppNode[],
  edges: AppEdge[],
  variables: Variable[],
): ExpandedSubtreeInstance {
  return {
    instanceKey: generateInstanceKey(nodeInstanceId, subtreeId, hierarchy),
    subtreeId,
    nodeInstanceId,
    level: hierarchy,
    cachedState: {
      nodes,
      edges,
      variables,
    },
  };
}

/**
 * Update the cached state of an expanded instance.
 *
 * @param instance The instance to update
 * @param nodes New cached nodes
 * @param edges New cached edges
 * @param variables New cached variables
 * @returns Updated instance
 */
export function updateExpandedInstanceCache(
  instance: ExpandedSubtreeInstance,
  nodes: AppNode[],
  edges: AppEdge[],
  variables: Variable[],
): ExpandedSubtreeInstance {
  return {
    ...instance,
    cachedState: {
      nodes,
      edges,
      variables,
    },
  };
}

/**
 * Get cached state for a specific expansion instance.
 *
 * @param instance The expanded instance
 * @returns Cached state or null if not available
 */
export function getCachedState(
  instance: ExpandedSubtreeInstance,
): { nodes: AppNode[]; edges: AppEdge[]; variables: Variable[] } | null {
  return instance.cachedState || null;
}
