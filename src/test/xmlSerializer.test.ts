/**
 * Tests for src/utils/xmlSerializer.ts
 *
 * Covers:
 *   - Single-tree import/export round-trips
 *   - Multi-tree import/export
 *   - Subtree library import/export
 *   - Port definitions (TreeNodesModel)
 *   - Variable / SetBlackboard handling
 *   - DeclareVariable first-assignment detection
 *   - XML escaping
 *   - Error handling for malformed XML
 *   - getReferencedSubtreeIds utility
 *   - updateSubtreeInXML utility
 *   - Child ordering by x-position
 */

import { describe, it, expect } from 'vitest';
import {
  exportToXML,
  exportMultiTreeToXML,
  exportSubtreeLibraryToXML,
  importFromXML,
  importMultiTreeFromXML,
  importSubtreeLibraryFromXML,
  getReferencedSubtreeIds,
  updateSubtreeInXML,
  TreeData,
} from '../utils/xmlSerializer';
import type { AppNode, AppEdge, NodeField } from '../types';
import {
  MINIMAL_TREE_XML,
  TREE_WITH_VARIABLES_XML,
  MULTI_TREE_XML,
  SUBTREE_LIBRARY_XML,
  DECORATOR_TREE_XML,
  EMPTY_TREE_XML,
  DECLARE_VARIABLE_TREE_XML,
  SPECIAL_CHARS_XML,
  SUBTREE_LIBRARY_WITH_COLORS_XML,
  MULTI_TREE_WITH_COLOR_XML,
} from './fixtures/xmlFixtures';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal root AppNode */
function makeRootNode(id = 'root_node', x = 250, y = 50): AppNode {
  return {
    id,
    type: 'btNode',
    position: { x, y },
    data: {
      id: 'root',
      type: 'Root',
      category: 'root',
      name: 'Root',
      description: 'Root node',
      fields: [],
      instanceId: id,
      color: '#F44336',
    },
  };
}

/** Build a simple action AppNode */
function makeActionNode(
  id: string,
  nodeType: string,
  fields: NodeField[] = [],
  x = 250,
  y = 150,
  nodeName?: string,
): AppNode {
  return {
    id,
    type: 'btNode',
    position: { x, y },
    data: {
      id: nodeType.toLowerCase(),
      type: nodeType,
      category: 'action',
      name: nodeType,
      description: `${nodeType} node`,
      fields,
      instanceId: id,
      color: '#4CAF50',
      ...(nodeName ? { nodeName } : {}),
    },
  };
}

/** Build a subtree reference AppNode */
function makeSubtreeNode(
  id: string,
  subtreeId: string,
  fields: NodeField[] = [],
  x = 250,
  y = 150,
): AppNode {
  return {
    id,
    type: 'btNode',
    position: { x, y },
    data: {
      id: subtreeId.toLowerCase(),
      type: subtreeId,
      category: 'subtree',
      name: subtreeId,
      description: `SubTree: ${subtreeId}`,
      fields,
      subtreeId,
      instanceId: id,
      color: '#00BCD4',
    },
  };
}

function edge(source: string, target: string): AppEdge {
  return { id: `${source}-${target}`, source, target };
}

// ---------------------------------------------------------------------------
// Tests: Single-Tree Export
// ---------------------------------------------------------------------------

describe('exportToXML', () => {
  it('exports a minimal tree with a root and one action child', () => {
    const root = makeRootNode();
    const action = makeActionNode('a1', 'PrintMessage', [
      { name: 'message', type: 'string', valueType: 'literal', value: 'hello' },
    ]);
    const nodes = [root, action];
    const edges = [edge('root_node', 'a1')];

    const xml = exportToXML(nodes, edges, [], 'TestTree');

    expect(xml).toContain('BTCPP_format="4"');
    expect(xml).toContain('main_tree_to_execute="TestTree"');
    expect(xml).toContain('<BehaviorTree ID="TestTree">');
    expect(xml).toContain('<PrintMessage message="hello"/>');
    expect(xml).toContain('</root>');
  });

  it('includes the name attribute when nodeName is set', () => {
    const root = makeRootNode();
    const action = makeActionNode('a1', 'PrintMessage', [
      { name: 'message', type: 'string', valueType: 'literal', value: 'hi' },
    ], 250, 150, 'greet');
    const xml = exportToXML([root, action], [edge('root_node', 'a1')], [], 'T');

    expect(xml).toContain('name="greet"');
  });

  it('wraps variable references in {braces}', () => {
    const root = makeRootNode();
    const action = makeActionNode('a1', 'PrintMessage', [
      { name: 'message', type: 'string', valueType: 'variable', value: 'myVar' },
    ]);
    const xml = exportToXML([root, action], [edge('root_node', 'a1')], [], 'T');

    expect(xml).toContain('message="{myVar}"');
  });

  it('converts DeclareVariable nodes to SetBlackboard in export', () => {
    const root = makeRootNode();
    const decl = makeActionNode('d1', 'DeclareVariable', [
      { name: 'output_key', type: 'string', valueType: 'literal', value: '{counter}' },
      { name: 'value', type: 'string', valueType: 'literal', value: '0' },
    ]);
    const xml = exportToXML([root, decl], [edge('root_node', 'd1')], [], 'T');

    expect(xml).toContain('<SetBlackboard');
    expect(xml).not.toContain('<DeclareVariable');
    // output_key should be exported without curly braces
    expect(xml).toContain('output_key="counter"');
  });

  it('exports an empty tree (root with no children) without crashing', () => {
    const root = makeRootNode();
    const xml = exportToXML([root], [], [], 'EmptyT');

    expect(xml).toContain('<BehaviorTree ID="EmptyT">');
    expect(xml).toContain('</BehaviorTree>');
  });

  it('escapes XML special characters in attribute values', () => {
    const root = makeRootNode();
    const action = makeActionNode('a1', 'PrintMessage', [
      { name: 'message', type: 'string', valueType: 'literal', value: 'a & b < c' },
    ]);
    const xml = exportToXML([root, action], [edge('root_node', 'a1')], [], 'T');

    expect(xml).toContain('a &amp; b &lt; c');
  });

  it('serializes subtree nodes with SubTree tag and ID attribute', () => {
    const root = makeRootNode();
    const sub = makeSubtreeNode('s1', 'CheckBattery', [
      { name: 'threshold', type: 'number', valueType: 'variable', value: 'min_battery' },
    ]);
    const xml = exportToXML([root, sub], [edge('root_node', 's1')], [], 'T');

    expect(xml).toContain('<SubTree ID="CheckBattery"');
    expect(xml).toContain('threshold="{min_battery}"');
    expect(xml).toContain('/>');
  });
});

// ---------------------------------------------------------------------------
// Tests: Multi-Tree Export
// ---------------------------------------------------------------------------

describe('exportMultiTreeToXML', () => {
  it('exports main tree followed by subtrees', () => {
    const mainTree: TreeData = {
      id: 'Main',
      nodes: [makeRootNode(), makeActionNode('a1', 'PrintMessage', [
        { name: 'message', type: 'string', valueType: 'literal', value: 'hi' },
      ])],
      edges: [edge('root_node', 'a1')],
      variables: [],
    };

    const subtrees = new Map<string, TreeData>();
    subtrees.set('Sub1', {
      id: 'Sub1',
      nodes: [makeRootNode('sub_root'), makeActionNode('sa1', 'Delay', [
        { name: 'delay_msec', type: 'number', valueType: 'literal', value: 500 },
      ])],
      edges: [edge('sub_root', 'sa1')],
      variables: [],
      description: 'A test subtree',
      ports: [
        { name: 'input1', direction: 'input', type: 'string', required: true },
        { name: 'output1', direction: 'output', type: 'number' },
      ],
    });

    const xml = exportMultiTreeToXML(mainTree, subtrees);

    expect(xml).toContain('main_tree_to_execute="Main"');
    expect(xml).toContain('<BehaviorTree ID="Main">');
    expect(xml).toContain('<BehaviorTree ID="Sub1">');
    // Description as comment
    expect(xml).toContain('<!-- A test subtree -->');
    // TreeNodesModel
    expect(xml).toContain('<TreeNodesModel>');
    expect(xml).toContain('<SubTree ID="Sub1">');
    expect(xml).toContain('<input_port name="input1"');
    expect(xml).toContain('required="true"');
    expect(xml).toContain('<output_port name="output1"');
  });
});

// ---------------------------------------------------------------------------
// Tests: Subtree Library Export
// ---------------------------------------------------------------------------

describe('exportSubtreeLibraryToXML', () => {
  it('exports library without main_tree_to_execute attribute', () => {
    const subtrees = new Map<string, TreeData>();
    subtrees.set('LibSub', {
      id: 'LibSub',
      nodes: [makeRootNode('ls_root')],
      edges: [],
      variables: [],
      ports: [],
    });

    const xml = exportSubtreeLibraryToXML(subtrees);

    expect(xml).toContain('BTCPP_format="4"');
    expect(xml).not.toContain('main_tree_to_execute');
    expect(xml).toContain('<BehaviorTree ID="LibSub">');
    expect(xml).toContain('BTstudio Subtree Library');
  });
});

// ---------------------------------------------------------------------------
// Tests: Import
// ---------------------------------------------------------------------------

describe('importFromXML', () => {
  it('parses a minimal single-tree XML', () => {
    const result = importFromXML(MINIMAL_TREE_XML);

    // Should have root + Sequence + 2 actions = 4 nodes
    expect(result.nodes.length).toBe(4);
    expect(result.edges.length).toBe(3); // root->Seq, Seq->Print, Seq->Delay

    // Root node exists
    const rootNode = result.nodes.find(n => n.data?.category === 'root');
    expect(rootNode).toBeDefined();

    // Sequence control node
    const seqNode = result.nodes.find(n => n.data?.type === 'Sequence');
    expect(seqNode).toBeDefined();
    expect(seqNode?.data?.category).toBe('control');

    // PrintMessage action
    const printNode = result.nodes.find(n => n.data?.type === 'PrintMessage');
    expect(printNode).toBeDefined();
    const msgField = printNode?.data?.fields?.find((f: any) => f.name === 'message');
    expect(msgField?.value).toBe('Hello');
  });

  it('parses variable references with {braces}', () => {
    const result = importFromXML(TREE_WITH_VARIABLES_XML);
    const printNode = result.nodes.find(n => n.data?.type === 'PrintMessage');
    expect(printNode).toBeDefined();

    const msgField = printNode?.data?.fields?.find((f: any) => f.name === 'message');
    expect(msgField?.valueType).toBe('variable');
    expect(msgField?.value).toBe('counter');
  });

  it('restores the node name attribute', () => {
    const result = importFromXML(TREE_WITH_VARIABLES_XML);
    const printNode = result.nodes.find(n => n.data?.type === 'PrintMessage');
    expect(printNode?.data?.nodeName).toBe('greet');
  });

  it('converts first SetBlackboard to DeclareVariable and extracts variable', () => {
    const result = importFromXML(DECLARE_VARIABLE_TREE_XML);

    // First SetBlackboard should become DeclareVariable
    const declNode = result.nodes.find(n => n.data?.type === 'DeclareVariable');
    expect(declNode).toBeDefined();

    // Second SetBlackboard should remain SetBlackboard
    const setNodes = result.nodes.filter(n => n.data?.type === 'SetBlackboard');
    expect(setNodes.length).toBe(1);

    // Variable should be extracted
    expect(result.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'my_var', value: '42' }),
      ])
    );
  });

  it('throws on invalid XML', () => {
    expect(() => importFromXML('<not>valid xml<')).toThrow();
  });

  it('throws when root element is missing', () => {
    expect(() => importFromXML('<?xml version="1.0"?><notroot/>')).toThrow(
      /missing root element/i,
    );
  });

  it('throws when BehaviorTree element is missing', () => {
    expect(() =>
      importFromXML('<?xml version="1.0"?><root BTCPP_format="4"></root>'),
    ).toThrow(/missing BehaviorTree element/i);
  });
});

// ---------------------------------------------------------------------------
// Tests: Multi-Tree Import
// ---------------------------------------------------------------------------

describe('importMultiTreeFromXML', () => {
  it('identifies main tree by main_tree_to_execute attribute', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);

    expect(result.mainTree.id).toBe('NavigationTree');
    expect(result.subtrees.has('CheckBattery')).toBe(true);
    expect(result.treeOrder).toContain('NavigationTree');
    expect(result.treeOrder).toContain('CheckBattery');
  });

  it('parses subtree descriptions from XML comments', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const checkBattery = result.subtrees.get('CheckBattery');

    expect(checkBattery?.description).toBe(
      'Checks whether battery level is sufficient',
    );
  });

  it('parses port definitions from TreeNodesModel', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const checkBattery = result.subtrees.get('CheckBattery');

    expect(checkBattery?.ports).toBeDefined();
    expect(checkBattery?.ports?.length).toBe(2);

    const inputPort = checkBattery?.ports?.find(p => p.direction === 'input');
    expect(inputPort?.name).toBe('threshold');
    expect(inputPort?.type).toBe('number');
    expect(inputPort?.required).toBe(true);
    expect(inputPort?.description).toBe('Minimum battery level');

    const outputPort = checkBattery?.ports?.find(p => p.direction === 'output');
    expect(outputPort?.name).toBe('status');
    expect(outputPort?.type).toBe('string');
  });

  it('parses SubTree reference nodes in the main tree', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const subNode = result.mainTree.nodes.find(n => n.data?.category === 'subtree');

    expect(subNode).toBeDefined();
    expect(subNode?.data?.subtreeId).toBe('CheckBattery');

    // Port mapping attribute
    const threshField = subNode?.data?.fields?.find((f: any) => f.name === 'threshold');
    expect(threshField?.valueType).toBe('variable');
    expect(threshField?.value).toBe('min_battery');
  });

  it('annotates SubTree reference node fields with portDirection on import', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const subNode = result.mainTree.nodes.find(n => n.data?.category === 'subtree');
    expect(subNode).toBeDefined();

    // The 'threshold' field should have portDirection='input' based on TreeNodesModel
    const threshField = subNode?.data?.fields?.find((f: any) => f.name === 'threshold');
    expect(threshField?.portDirection).toBe('input');

    // The node data should also carry ports from TreeNodesModel
    expect(subNode?.data?.ports).toBeDefined();
    expect(subNode?.data?.ports?.length).toBeGreaterThanOrEqual(1);
  });

  it('preserves portDirection through multi-tree round-trip', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const reExported = exportMultiTreeToXML(result.mainTree, result.subtrees);
    const reimported = importMultiTreeFromXML(reExported);

    const subNode = reimported.mainTree.nodes.find(n => n.data?.category === 'subtree');
    expect(subNode).toBeDefined();

    const threshField = subNode?.data?.fields?.find((f: any) => f.name === 'threshold');
    expect(threshField?.portDirection).toBe('input');
  });
});

// ---------------------------------------------------------------------------
// Tests: Subtree Library Import
// ---------------------------------------------------------------------------

describe('importSubtreeLibraryFromXML', () => {
  it('parses library subtrees', () => {
    const subtrees = importSubtreeLibraryFromXML(SUBTREE_LIBRARY_XML);

    expect(subtrees.has('CheckBattery')).toBe(true);
    const cb = subtrees.get('CheckBattery')!;
    expect(cb.description).toBe('Checks whether battery level is sufficient');

    // Ports
    expect(cb.ports?.length).toBe(2);
  });

  it('returns empty map for empty library', () => {
    const xml = '<?xml version="1.0"?><root BTCPP_format="4"></root>';
    const subtrees = importSubtreeLibraryFromXML(xml);
    expect(subtrees.size).toBe(0);
  });

  it('returns empty map for non-root XML', () => {
    const subtrees = importSubtreeLibraryFromXML('<something/>');
    expect(subtrees.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Decorator Tree
// ---------------------------------------------------------------------------

describe('decorator tree import', () => {
  it('parses nested decorators correctly', () => {
    const result = importFromXML(DECORATOR_TREE_XML);

    const inverter = result.nodes.find(n => n.data?.type === 'Inverter');
    expect(inverter).toBeDefined();
    expect(inverter?.data?.category).toBe('decorator');

    const retry = result.nodes.find(n => n.data?.type === 'Retry');
    expect(retry).toBeDefined();
    const attemptsField = retry?.data?.fields?.find((f: any) => f.name === 'num_attempts');
    expect(attemptsField?.value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tests: Special Characters
// ---------------------------------------------------------------------------

describe('XML escaping', () => {
  it('round-trips special characters through import', () => {
    const result = importFromXML(SPECIAL_CHARS_XML);
    const printNode = result.nodes.find(n => n.data?.type === 'PrintMessage');
    const msgField = printNode?.data?.fields?.find((f: any) => f.name === 'message');

    // After parsing, the value should be the unescaped string
    expect(msgField?.value).toBe('a & b < c');
  });
});

// ---------------------------------------------------------------------------
// Tests: getReferencedSubtreeIds
// ---------------------------------------------------------------------------

describe('getReferencedSubtreeIds', () => {
  it('returns unique subtree IDs referenced in nodes', () => {
    const nodes: AppNode[] = [
      makeSubtreeNode('s1', 'SubA'),
      makeSubtreeNode('s2', 'SubB'),
      makeSubtreeNode('s3', 'SubA'), // duplicate
      makeActionNode('a1', 'PrintMessage'),
    ];

    const ids = getReferencedSubtreeIds(nodes);
    expect(ids).toEqual(expect.arrayContaining(['SubA', 'SubB']));
    expect(ids.length).toBe(2);
  });

  it('returns empty array when no subtrees are present', () => {
    const nodes: AppNode[] = [makeRootNode(), makeActionNode('a1', 'Delay')];
    expect(getReferencedSubtreeIds(nodes)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: updateSubtreeInXML
// ---------------------------------------------------------------------------

describe('updateSubtreeInXML', () => {
  it('replaces an existing subtree in the XML', () => {
    const newSubtreeData: TreeData = {
      id: 'CheckBattery',
      nodes: [
        makeRootNode('cb_root'),
        makeActionNode('cb_a1', 'PrintMessage', [
          { name: 'message', type: 'string', valueType: 'literal', value: 'updated' },
        ]),
      ],
      edges: [edge('cb_root', 'cb_a1')],
      variables: [],
    };

    const updated = updateSubtreeInXML(MULTI_TREE_XML, 'CheckBattery', newSubtreeData);

    expect(updated).toContain('message="updated"');
    // Main tree should still be intact
    expect(updated).toContain('NavigationTree');
  });

  it('adds a new subtree if ID not found', () => {
    const newSubtreeData: TreeData = {
      id: 'NewSub',
      nodes: [makeRootNode('ns_root')],
      edges: [],
      variables: [],
    };

    const updated = updateSubtreeInXML(MULTI_TREE_XML, 'NewSub', newSubtreeData);
    expect(updated).toContain('ID="NewSub"');
  });
});

// ---------------------------------------------------------------------------
// Tests: Round-Trip Fidelity
// ---------------------------------------------------------------------------

describe('round-trip fidelity', () => {
  it('import then export preserves tree structure (minimal tree)', () => {
    const imported = importFromXML(MINIMAL_TREE_XML);
    const reExported = exportToXML(
      imported.nodes,
      imported.edges,
      imported.variables,
      'MainTree',
    );

    // Key elements should survive the round trip
    expect(reExported).toContain('BTCPP_format="4"');
    expect(reExported).toContain('<Sequence>');
    expect(reExported).toContain('message="Hello"');
    expect(reExported).toContain('delay_msec="1000"');
  });

  it('multi-tree import then export preserves subtree ports', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_XML);
    const reExported = exportMultiTreeToXML(result.mainTree, result.subtrees);

    expect(reExported).toContain('<TreeNodesModel>');
    expect(reExported).toContain('<input_port name="threshold"');
    expect(reExported).toContain('required="true"');
    expect(reExported).toContain('<output_port name="status"');
  });

  it('subtree library round-trip preserves descriptions and ports', () => {
    const subtrees = importSubtreeLibraryFromXML(SUBTREE_LIBRARY_XML);
    const reExported = exportSubtreeLibraryToXML(subtrees);

    expect(reExported).toContain('Checks whether battery level is sufficient');
    expect(reExported).toContain('<input_port name="threshold"');
    expect(reExported).toContain('<output_port name="status"');
  });
});

// ---------------------------------------------------------------------------
// Tests: Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty tree XML without children', () => {
    const result = importFromXML(EMPTY_TREE_XML);
    // Should have only the root node
    expect(result.nodes.length).toBe(1);
    expect(result.nodes[0].data?.category).toBe('root');
    expect(result.edges.length).toBe(0);
  });

  it('handles tree with no variables gracefully', () => {
    const result = importFromXML(MINIMAL_TREE_XML);
    expect(result.variables).toEqual([]);
  });

  it('exportToXML with no nodes produces valid XML wrapper', () => {
    const xml = exportToXML([], [], [], 'Empty');
    expect(xml).toContain('<?xml version="1.0"?>');
    expect(xml).toContain('<root BTCPP_format="4"');
    expect(xml).toContain('</root>');
  });
});

// ---------------------------------------------------------------------------
// Tests: Subtree Color Support
// ---------------------------------------------------------------------------

describe('subtree color support', () => {
  it('imports color from BTstudio:color comment in library XML', () => {
    const subtrees = importSubtreeLibraryFromXML(SUBTREE_LIBRARY_WITH_COLORS_XML);

    const checkBattery = subtrees.get('CheckBattery');
    expect(checkBattery).toBeDefined();
    expect(checkBattery?.color).toBe('#FF5722');

    // Navigate has no color comment
    const navigate = subtrees.get('Navigate');
    expect(navigate).toBeDefined();
    expect(navigate?.color).toBeUndefined();
  });

  it('imports color from BTstudio:color comment in multi-tree XML', () => {
    const result = importMultiTreeFromXML(MULTI_TREE_WITH_COLOR_XML);

    const checkBattery = result.subtrees.get('CheckBattery');
    expect(checkBattery).toBeDefined();
    expect(checkBattery?.color).toBe('#E91E63');

    // Main tree should not have a color
    expect(result.mainTree.color).toBeUndefined();
  });

  it('exports color as BTstudio:color comment in multi-tree XML', () => {
    const mainTree: TreeData = {
      id: 'Main',
      nodes: [makeRootNode()],
      edges: [],
      variables: [],
    };

    const subtrees = new Map<string, TreeData>();
    subtrees.set('ColoredSub', {
      id: 'ColoredSub',
      nodes: [makeRootNode('cs_root')],
      edges: [],
      variables: [],
      description: 'A colored subtree',
      color: '#9C27B0',
    });
    subtrees.set('PlainSub', {
      id: 'PlainSub',
      nodes: [makeRootNode('ps_root')],
      edges: [],
      variables: [],
    });

    const xml = exportMultiTreeToXML(mainTree, subtrees);

    // Colored subtree should have the meta comment
    expect(xml).toContain('<!-- BTstudio:color=#9C27B0 -->');
    // Description should also be present
    expect(xml).toContain('<!-- A colored subtree -->');
    // PlainSub should NOT have a color comment
    const plainSubIdx = xml.indexOf('ID="PlainSub"');
    const colorCommentBeforePlain = xml.lastIndexOf('BTstudio:color=', plainSubIdx);
    // The color comment should belong to ColoredSub, not PlainSub
    if (colorCommentBeforePlain !== -1) {
      const textBetween = xml.substring(colorCommentBeforePlain, plainSubIdx);
      expect(textBetween).toContain('ID="ColoredSub"');
    }
  });

  it('exports color in subtree library XML', () => {
    const subtrees = new Map<string, TreeData>();
    subtrees.set('MySub', {
      id: 'MySub',
      nodes: [makeRootNode('ms_root')],
      edges: [],
      variables: [],
      color: '#FF9800',
    });

    const xml = exportSubtreeLibraryToXML(subtrees);
    expect(xml).toContain('<!-- BTstudio:color=#FF9800 -->');
  });

  it('round-trips subtree color through library export/import', () => {
    const subtrees = new Map<string, TreeData>();
    subtrees.set('RoundTripSub', {
      id: 'RoundTripSub',
      nodes: [makeRootNode('rt_root')],
      edges: [],
      variables: [],
      description: 'Round trip test',
      color: '#3F51B5',
    });

    const xml = exportSubtreeLibraryToXML(subtrees);
    const reimported = importSubtreeLibraryFromXML(xml);

    const sub = reimported.get('RoundTripSub');
    expect(sub).toBeDefined();
    expect(sub?.color).toBe('#3F51B5');
    expect(sub?.description).toBe('Round trip test');
  });

  it('does not set color on description comment (no false positive)', () => {
    // Verify that a plain description comment is not mistaken for a color
    const subtrees = importSubtreeLibraryFromXML(SUBTREE_LIBRARY_XML);
    const checkBattery = subtrees.get('CheckBattery');
    expect(checkBattery?.color).toBeUndefined();
  });
});
