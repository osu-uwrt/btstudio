/**
 * Tests for expanded subtree management utilities.
 *
 * These tests verify:
 *   - Recursion detection and validation
 *   - Instance key generation and uniqueness
 *   - Hierarchy building and navigation
 *   - Cached state management
 *   - Duplicate expansion prevention
 */

import { describe, it, expect } from 'vitest';
import {
  isSubtreeRecursive,
  getReferencedSubtreeIds,
  validateSubtreeExpansion,
  generateInstanceKey,
  findExistingExpansion,
  removeExpandedInstance,
  generateBreadcrumbs,
  extendHierarchy,
  truncateHierarchy,
  getParentTreeId,
  createExpandedInstance,
  updateExpandedInstanceCache,
} from '../utils/expandedSubtrees';
import { ExpandedSubtreeLevel, AppNode, ExpandedSubtreeInstance } from '../types';
import { TreeData } from '../utils/xmlSerializer';

// ═══════════════════════════════════════════════════════════════════════════
// Test Data
// ═══════════════════════════════════════════════════════════════════════════

const createMockNode = (id: string, subtreeId?: string): AppNode => ({
  id,
  type: 'btNode',
  position: { x: 0, y: 0 },
  data: {
    id: id,
    type: subtreeId ? 'SubTree' : 'Sequence',
    category: subtreeId ? 'subtree' : 'control',
    name: subtreeId ? 'SubTree' : 'Sequence',
    description: 'Test node',
    fields: [],
    subtreeId,
    instanceId: id,
    color: '#666',
  },
});

const createMockTreeData = (id: string): TreeData => ({
  id,
  nodes: [createMockNode('root')],
  edges: [],
  variables: [],
});

// ═══════════════════════════════════════════════════════════════════════════
// Recursion Detection Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Recursion Detection', () => {
  it('should detect direct recursion in hierarchy', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [
      {
        subtreeId: 'Navigation',
        nodeInstanceId: 'node_1',
        parentTreeId: null,
      },
      {
        subtreeId: 'Movement',
        nodeInstanceId: 'node_2',
        parentTreeId: 'Navigation',
      },
    ];

    // Trying to expand Navigation again should be detected as recursive
    expect(isSubtreeRecursive('Navigation', hierarchy)).toBe(true);
    expect(isSubtreeRecursive('Movement', hierarchy)).toBe(true);
    expect(isSubtreeRecursive('PathFinding', hierarchy)).toBe(false);
  });

  it('should not detect recursion in empty hierarchy', () => {
    expect(isSubtreeRecursive('Navigation', [])).toBe(false);
  });

  it('should get referenced subtree IDs from nodes', () => {
    const nodes = [
      createMockNode('node_1', 'Navigation'),
      createMockNode('node_2', 'PathFinding'),
      createMockNode('node_3'), // Not a subtree
    ];

    const referenced = getReferencedSubtreeIds(nodes);
    expect(referenced.has('Navigation')).toBe(true);
    expect(referenced.has('PathFinding')).toBe(true);
    expect(referenced.size).toBe(2);
  });

  it('should validate subtree expansion and detect recursive loops', () => {
    const allSubtrees = new Map([
      ['Navigation', createMockTreeData('Navigation')],
      ['Movement', createMockTreeData('Movement')],
    ]);

    const hierarchy: ExpandedSubtreeLevel[] = [
      {
        subtreeId: 'Navigation',
        nodeInstanceId: 'node_1',
        parentTreeId: null,
      },
    ];

    // Can't expand Navigation inside itself
    const result1 = validateSubtreeExpansion('Navigation', 'Navigation', hierarchy, allSubtrees);
    expect(result1.isValid).toBe(false);

    // Can try to expand Movement
    const result2 = validateSubtreeExpansion('Movement', 'Navigation', hierarchy, allSubtrees);
    expect(result2.isValid).toBe(true);

    // Can't expand non-existent subtree
    const result3 = validateSubtreeExpansion('NonExistent', 'Navigation', hierarchy, allSubtrees);
    expect(result3.isValid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Instance Key Generation Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Instance Key Generation', () => {
  it('should generate unique instance keys for different hierarchies', () => {
    const hierarchy1: ExpandedSubtreeLevel[] = [
      { subtreeId: 'Nav1', nodeInstanceId: 'node_1', parentTreeId: null },
    ];

    const hierarchy2: ExpandedSubtreeLevel[] = [
      { subtreeId: 'Nav1', nodeInstanceId: 'node_1', parentTreeId: null },
      { subtreeId: 'Move1', nodeInstanceId: 'node_2', parentTreeId: 'Nav1' },
    ];

    const key1 = generateInstanceKey('node_1', 'Nav1', hierarchy1);
    const key2 = generateInstanceKey('node_1', 'Nav1', hierarchy2);

    // Keys should be different because they have different hierarchies
    expect(key1).not.toEqual(key2);
  });

  it('should generate same key for same node at root level', () => {
    const key1 = generateInstanceKey('node_1', 'Navigation', []);
    const key2 = generateInstanceKey('node_1', 'Navigation', []);
    expect(key1).toEqual(key2);
  });

  it('should generate different keys for different node instances', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [];
    const key1 = generateInstanceKey('node_1', 'Navigation', hierarchy);
    const key2 = generateInstanceKey('node_2', 'Navigation', hierarchy);
    expect(key1).not.toEqual(key2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate Detection Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Duplicate Instance Prevention', () => {
  it('should find existing expansion by subtree ID', () => {
    const instances = new Map<string, ExpandedSubtreeInstance>();
    const instance: ExpandedSubtreeInstance = {
      instanceKey: 'key_1',
      subtreeId: 'Navigation',
      nodeInstanceId: 'node_1',
      level: [],
      cachedState: {
        nodes: [],
        edges: [],
        variables: [],
      },
    };

    instances.set('key_1', instance);

    const found = findExistingExpansion('Navigation', instances);
    expect(found).toBe(instance);

    const notFound = findExistingExpansion('Movement', instances);
    expect(notFound).toBeNull();
  });

  it('should remove expanded instances', () => {
    const instances = new Map<string, ExpandedSubtreeInstance>([
      [
        'key_1',
        {
          instanceKey: 'key_1',
          subtreeId: 'Navigation',
          nodeInstanceId: 'node_1',
          level: [],
        },
      ],
      [
        'key_2',
        {
          instanceKey: 'key_2',
          subtreeId: 'Movement',
          nodeInstanceId: 'node_2',
          level: [],
        },
      ],
    ]);

    const newInstances = removeExpandedInstance('key_1', instances);
    expect(newInstances.has('key_1')).toBe(false);
    expect(newInstances.has('key_2')).toBe(true);
    expect(newInstances.size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Hierarchy Management Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Hierarchy Management', () => {
  it('should extend hierarchy by one level', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [];
    const extended = extendHierarchy(hierarchy, 'Navigation', 'node_1');

    expect(extended).toHaveLength(1);
    expect(extended[0].subtreeId).toEqual('Navigation');
    expect(extended[0].nodeInstanceId).toEqual('node_1');
    expect(extended[0].parentTreeId).toBeNull();
  });

  it('should extend hierarchy with multiple levels', () => {
    const level1: ExpandedSubtreeLevel = {
      subtreeId: 'Navigation',
      nodeInstanceId: 'node_1',
      parentTreeId: null,
    };

    const extended1 = extendHierarchy([], 'Navigation', 'node_1');
    const extended2 = extendHierarchy(extended1, 'Movement', 'node_2');

    expect(extended2).toHaveLength(2);
    expect(extended2[1].parentTreeId).toEqual('Navigation');
  });

  it('should truncate hierarchy to specific depth', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [
      { subtreeId: 'Nav', nodeInstanceId: 'node_1', parentTreeId: null },
      { subtreeId: 'Move', nodeInstanceId: 'node_2', parentTreeId: 'Nav' },
      { subtreeId: 'Path', nodeInstanceId: 'node_3', parentTreeId: 'Move' },
    ];

    const truncated1 = truncateHierarchy(hierarchy, 2);
    expect(truncated1).toHaveLength(2);

    const truncated2 = truncateHierarchy(hierarchy, 0);
    expect(truncated2).toHaveLength(0);

    const truncated3 = truncateHierarchy(hierarchy, 10); // More than length
    expect(truncated3).toEqual(hierarchy);
  });

  it('should get parent tree ID', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [
      { subtreeId: 'Navigation', nodeInstanceId: 'node_1', parentTreeId: null },
      { subtreeId: 'Movement', nodeInstanceId: 'node_2', parentTreeId: 'Navigation' },
    ];

    expect(getParentTreeId([])).toBeNull();
    expect(getParentTreeId(hierarchy)).toEqual('Movement');
  });

  it('should generate breadcrumbs', () => {
    const hierarchy: ExpandedSubtreeLevel[] = [
      { subtreeId: 'Navigation', nodeInstanceId: 'node_1', parentTreeId: null },
      { subtreeId: 'Movement', nodeInstanceId: 'node_2', parentTreeId: 'Navigation' },
    ];

    const breadcrumbs = generateBreadcrumbs(hierarchy);
    expect(breadcrumbs[0].id).toBeNull();
    expect(breadcrumbs[0].label).toEqual('MainTree');
    expect(breadcrumbs[1].id).toEqual('Navigation');
    expect(breadcrumbs[2].id).toEqual('Movement');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cached State Management Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Cached State Management', () => {
  it('should create expanded instance with cached state', () => {
    const nodes: AppNode[] = [createMockNode('node_1')];
    const edges = [];
    const variables = [];
    const hierarchy: ExpandedSubtreeLevel[] = [];

    const instance = createExpandedInstance('node_1', 'Navigation', hierarchy, nodes, edges, variables);

    expect(instance.subtreeId).toEqual('Navigation');
    expect(instance.nodeInstanceId).toEqual('node_1');
    expect(instance.cachedState?.nodes).toHaveLength(1);
  });

  it('should update cached state', () => {
    let instance: ExpandedSubtreeInstance = {
      instanceKey: 'key_1',
      subtreeId: 'Navigation',
      nodeInstanceId: 'node_1',
      level: [],
      cachedState: {
        nodes: [createMockNode('old')],
        edges: [],
        variables: [],
      },
    };

    const newNodes: AppNode[] = [createMockNode('new1'), createMockNode('new2')];
    instance = updateExpandedInstanceCache(instance, newNodes, [], []);

    expect(instance.cachedState?.nodes).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Integration Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Integration: Multi-level Expansion', () => {
  it('should handle multi-level expansion with hierarchy validation', () => {
    const subtrees = new Map([
      ['Navigation', createMockTreeData('Navigation')],
      ['Movement', createMockTreeData('Movement')],
      ['Pathfinding', createMockTreeData('Pathfinding')],
    ]);

    // Start at root and expand Navigation
    let hierarchy: ExpandedSubtreeLevel[] = [];
    let result = validateSubtreeExpansion('Navigation', null, hierarchy, subtrees);
    expect(result.isValid).toBe(true);

    hierarchy = extendHierarchy(hierarchy, 'Navigation', 'node_1');
    expect(hierarchy).toHaveLength(1);

    // Expand Movement inside Navigation
    result = validateSubtreeExpansion('Movement', 'Navigation', hierarchy, subtrees);
    expect(result.isValid).toBe(true);

    hierarchy = extendHierarchy(hierarchy, 'Movement', 'node_2');
    expect(hierarchy).toHaveLength(2);

    // Expand Pathfinding inside Movement
    result = validateSubtreeExpansion('Pathfinding', 'Movement', hierarchy, subtrees);
    expect(result.isValid).toBe(true);

    hierarchy = extendHierarchy(hierarchy, 'Pathfinding', 'node_3');
    expect(hierarchy).toHaveLength(3);

    // Verify we can't add Navigation again (would be recursive)
    result = validateSubtreeExpansion('Navigation', 'Pathfinding', hierarchy, subtrees);
    expect(result.isValid).toBe(false);

    // Navigate back to Movement level
    hierarchy = truncateHierarchy(hierarchy, 2);
    expect(hierarchy).toHaveLength(2);
    expect(hierarchy[1].subtreeId).toEqual('Movement');
  });

  it('should track multiple independent expansions without conflicts', () => {
    const hierarchy1: ExpandedSubtreeLevel[] = [
      { subtreeId: 'NavA', nodeInstanceId: 'node_A1', parentTreeId: null },
    ];

    const hierarchy2: ExpandedSubtreeLevel[] = [
      { subtreeId: 'NavB', nodeInstanceId: 'node_B1', parentTreeId: null },
    ];

    const key1 = generateInstanceKey('node_A1', 'NavA', hierarchy1);
    const key2 = generateInstanceKey('node_B1', 'NavB', hierarchy2);

    // Keys should be different
    expect(key1).not.toEqual(key2);

    // Both sides can have independent state
    const instances = new Map([
      [key1, { instanceKey: key1, subtreeId: 'NavA', nodeInstanceId: 'node_A1', level: hierarchy1 }],
      [key2, { instanceKey: key2, subtreeId: 'NavB', nodeInstanceId: 'node_B1', level: hierarchy2 }],
    ]);

    expect(instances.size).toBe(2);
  });
});
