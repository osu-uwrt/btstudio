/**
 * Tests for src/data/nodeLibrary.ts
 *
 * Validates the static node library definitions and helper functions
 * (getCategoryColor, inferCategoryFromType, findDefinitionByType).
 * Ensures consistency with the type system and BehaviorTree.cpp conventions.
 */

import { describe, it, expect } from 'vitest';
import { nodeLibrary, getCategoryColor, inferCategoryFromType, findDefinitionByType } from '../data/nodeLibrary';

describe('nodeLibrary', () => {
  it('contains at least one node per required category', () => {
    const categories = new Set(nodeLibrary.map(n => n.category));
    // Must have root, control, decorator, action, condition
    expect(categories.has('root')).toBe(true);
    expect(categories.has('control')).toBe(true);
    expect(categories.has('decorator')).toBe(true);
    expect(categories.has('action')).toBe(true);
    expect(categories.has('condition')).toBe(true);
  });

  it('has exactly one root node', () => {
    const roots = nodeLibrary.filter(n => n.category === 'root');
    expect(roots.length).toBe(1);
    expect(roots[0].type).toBe('Root');
  });

  it('all nodes have unique IDs', () => {
    const ids = nodeLibrary.map(n => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all nodes have non-empty name and description', () => {
    nodeLibrary.forEach(node => {
      expect(node.name.length).toBeGreaterThan(0);
      expect(node.description.length).toBeGreaterThan(0);
    });
  });

  it('field definitions use valid valueType', () => {
    nodeLibrary.forEach(node => {
      node.fields.forEach(field => {
        expect(['literal', 'variable']).toContain(field.valueType);
      });
    });
  });

  it('field definitions use valid type', () => {
    nodeLibrary.forEach(node => {
      node.fields.forEach(field => {
        expect(['string', 'number', 'boolean']).toContain(field.type);
      });
    });
  });

  it('DeclareVariable has output_key and value fields', () => {
    const decl = nodeLibrary.find(n => n.type === 'DeclareVariable');
    expect(decl).toBeDefined();
    expect(decl?.fields.find(f => f.name === 'output_key')).toBeDefined();
    expect(decl?.fields.find(f => f.name === 'value')).toBeDefined();
  });

  it('SetBlackboard has output_key and value fields', () => {
    const sb = nodeLibrary.find(n => n.type === 'SetBlackboard');
    expect(sb).toBeDefined();
    expect(sb?.fields.find(f => f.name === 'output_key')).toBeDefined();
    expect(sb?.fields.find(f => f.name === 'value')).toBeDefined();
  });

  it('Parallel has success_threshold field', () => {
    const par = nodeLibrary.find(n => n.type === 'Parallel');
    expect(par).toBeDefined();
    expect(par?.fields.find(f => f.name === 'success_threshold')).toBeDefined();
  });
});

describe('getCategoryColor', () => {
  const expectedColors: Record<string, string> = {
    root: '#F44336',
    action: '#4CAF50',
    condition: '#2196F3',
    control: '#FF9800',
    decorator: '#9C27B0',
    subtree: '#00BCD4',
  };

  Object.entries(expectedColors).forEach(([category, color]) => {
    it(`returns ${color} for '${category}'`, () => {
      expect(getCategoryColor(category)).toBe(color);
    });
  });

  it('returns grey for unknown categories', () => {
    expect(getCategoryColor('unknown')).toBe('#757575');
  });
});

describe('inferCategoryFromType', () => {
  it('returns correct category for known control nodes', () => {
    expect(inferCategoryFromType('Sequence')).toBe('control');
    expect(inferCategoryFromType('Fallback')).toBe('control');
    expect(inferCategoryFromType('Parallel')).toBe('control');
    expect(inferCategoryFromType('ReactiveSequence')).toBe('control');
    expect(inferCategoryFromType('ReactiveFallback')).toBe('control');
  });

  it('returns correct category for known decorator nodes', () => {
    expect(inferCategoryFromType('Inverter')).toBe('decorator');
    expect(inferCategoryFromType('Retry')).toBe('decorator');
    expect(inferCategoryFromType('Repeat')).toBe('decorator');
    expect(inferCategoryFromType('Timeout')).toBe('decorator');
    expect(inferCategoryFromType('ForceSuccess')).toBe('decorator');
    expect(inferCategoryFromType('ForceFailure')).toBe('decorator');
  });

  it('returns correct category for known action nodes', () => {
    expect(inferCategoryFromType('PrintMessage')).toBe('action');
    expect(inferCategoryFromType('SetBlackboard')).toBe('action');
    expect(inferCategoryFromType('DeclareVariable')).toBe('action');
    expect(inferCategoryFromType('Delay')).toBe('action');
  });

  it('returns correct category for known condition nodes', () => {
    expect(inferCategoryFromType('CheckVariable')).toBe('condition');
    expect(inferCategoryFromType('CompareNumbers')).toBe('condition');
  });

  it('falls back to condition for Check/Is/Has prefixed unknown types', () => {
    expect(inferCategoryFromType('CheckBattery')).toBe('condition');
    expect(inferCategoryFromType('IsReady')).toBe('condition');
    expect(inferCategoryFromType('HasTarget')).toBe('condition');
  });

  it('falls back to action for completely unknown types', () => {
    expect(inferCategoryFromType('DoSomethingCustom')).toBe('action');
    expect(inferCategoryFromType('MySpecialNode')).toBe('action');
  });

  it('returns root for Root type', () => {
    expect(inferCategoryFromType('Root')).toBe('root');
  });
});

describe('findDefinitionByType', () => {
  it('finds definitions for known types', () => {
    const seq = findDefinitionByType('Sequence');
    expect(seq).toBeDefined();
    expect(seq?.category).toBe('control');
    expect(seq?.id).toBe('sequence');
  });

  it('returns undefined for unknown types', () => {
    expect(findDefinitionByType('NonExistentNode')).toBeUndefined();
  });

  it('returns undefined for subtree types (dynamically loaded)', () => {
    expect(findDefinitionByType('MyCustomSubtree')).toBeUndefined();
  });
});
