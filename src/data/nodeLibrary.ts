/**
 * Static node library for BTstudio.
 *
 * These definitions populate the palette and provide default field templates
 * when a user drops a node onto the canvas. Subtree nodes are loaded
 * dynamically from the workspace's subtree_library.xml and are NOT defined
 * here.
 *
 * When adding a new built-in node:
 *   1. Add its BTNodeDefinition to `nodeLibrary`.
 *   2. If it has a new category, update `CATEGORY_COLORS`.
 *   3. Run the nodeLibrary tests to verify.
 */

import { BTNodeDefinition, NodeCategory } from '../types';

// ---------------------------------------------------------------------------
// Category colour map
// ---------------------------------------------------------------------------

/** Canonical colour for each node category. Used by both palette and canvas. */
const CATEGORY_COLORS: Record<NodeCategory | 'unknown', string> = {
  root:      '#F44336',
  action:    '#4CAF50',
  condition: '#2196F3',
  control:   '#FF9800',
  decorator: '#9C27B0',
  subtree:   '#00BCD4',
  unknown:   '#757575',
} as const;

/**
 * Return the hex colour associated with a node category.
 *
 * Accepts `string` for convenience when the category comes from parsed XML
 * data where the type may not be narrowed.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as NodeCategory] ?? CATEGORY_COLORS.unknown;
}

// ---------------------------------------------------------------------------
// Node library
// ---------------------------------------------------------------------------

/**
 * Predefined BehaviorTree.cpp v4 node definitions.
 *
 * Grouped by category for readability. Each entry becomes a template in the
 * node palette. Runtime subtree definitions are loaded separately from the
 * workspace library file.
 */
export const nodeLibrary: BTNodeDefinition[] = [
  // -- Root ------------------------------------------------------------------
  {
    id: 'root',
    type: 'Root',
    category: 'root',
    name: 'Root',
    description: 'Root node of the behavior tree',
    fields: [],
  },

  // -- Control ---------------------------------------------------------------
  {
    id: 'sequence',
    type: 'Sequence',
    category: 'control',
    name: 'Sequence',
    description: 'Executes children in order until one fails',
    fields: [],
  },
  {
    id: 'fallback',
    type: 'Fallback',
    category: 'control',
    name: 'Fallback',
    description: 'Executes children in order until one succeeds',
    fields: [],
  },
  {
    id: 'parallel',
    type: 'Parallel',
    category: 'control',
    name: 'Parallel',
    description: 'Executes all children in parallel',
    fields: [
      {
        name: 'success_threshold',
        type: 'number',
        valueType: 'literal',
        value: 1,
        description: 'Number of children that must succeed',
      },
    ],
  },
  {
    id: 'reactive_sequence',
    type: 'ReactiveSequence',
    category: 'control',
    name: 'Reactive Sequence',
    description: 'Like Sequence but re-evaluates from the start',
    fields: [],
  },
  {
    id: 'reactive_fallback',
    type: 'ReactiveFallback',
    category: 'control',
    name: 'Reactive Fallback',
    description: 'Like Fallback but re-evaluates from the start',
    fields: [],
  },

  // -- Decorator -------------------------------------------------------------
  {
    id: 'inverter',
    type: 'Inverter',
    category: 'decorator',
    name: 'Inverter',
    description: 'Inverts the result of its child',
    fields: [],
  },
  {
    id: 'retry',
    type: 'Retry',
    category: 'decorator',
    name: 'Retry',
    description: 'Retries the child node N times',
    fields: [
      {
        name: 'num_attempts',
        type: 'number',
        valueType: 'literal',
        value: 3,
        description: 'Number of retry attempts',
      },
    ],
  },
  {
    id: 'repeat',
    type: 'Repeat',
    category: 'decorator',
    name: 'Repeat',
    description: 'Repeats the child node N times',
    fields: [
      {
        name: 'num_cycles',
        type: 'number',
        valueType: 'literal',
        value: 1,
        description: 'Number of cycles to repeat',
      },
    ],
  },
  {
    id: 'timeout',
    type: 'Timeout',
    category: 'decorator',
    name: 'Timeout',
    description: 'Fails if child takes longer than timeout',
    fields: [
      {
        name: 'msec',
        type: 'number',
        valueType: 'literal',
        value: 1000,
        description: 'Timeout in milliseconds',
      },
    ],
  },
  {
    id: 'force_success',
    type: 'ForceSuccess',
    category: 'decorator',
    name: 'Force Success',
    description: 'Always returns SUCCESS',
    fields: [],
  },
  {
    id: 'force_failure',
    type: 'ForceFailure',
    category: 'decorator',
    name: 'Force Failure',
    description: 'Always returns FAILURE',
    fields: [],
  },

  // -- Action ----------------------------------------------------------------
  {
    id: 'action_print',
    type: 'PrintMessage',
    category: 'action',
    name: 'Print Message',
    description: 'Prints a message to console',
    fields: [
      {
        name: 'message',
        type: 'string',
        valueType: 'literal',
        value: 'Hello World',
        description: 'Message to print',
      },
    ],
  },
  {
    id: 'action_declare_variable',
    type: 'DeclareVariable',
    category: 'action',
    name: 'Declare Variable',
    description: 'Declares a variable with an initial value (first assignment)',
    fields: [
      {
        name: 'output_key',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Variable name',
      },
      {
        name: 'value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Initial value',
      },
    ],
  },
  {
    id: 'action_set_variable',
    type: 'SetBlackboard',
    category: 'action',
    name: 'Set Variable',
    description: 'Sets a variable value',
    fields: [
      {
        name: 'output_key',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Variable name',
      },
      {
        name: 'value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Value to set',
      },
    ],
  },
  {
    id: 'action_delay',
    type: 'Delay',
    category: 'action',
    name: 'Delay',
    description: 'Waits for a specified duration',
    fields: [
      {
        name: 'delay_msec',
        type: 'number',
        valueType: 'literal',
        value: 1000,
        description: 'Delay in milliseconds',
      },
    ],
  },

  // -- Condition -------------------------------------------------------------
  {
    id: 'condition_check',
    type: 'CheckVariable',
    category: 'condition',
    name: 'Check Variable',
    description: 'Checks if a variable meets a condition',
    fields: [
      {
        name: 'variable',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Variable to check',
      },
      {
        name: 'expected_value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Expected value',
      },
    ],
  },
  {
    id: 'condition_compare',
    type: 'CompareNumbers',
    category: 'condition',
    name: 'Compare Numbers',
    description: 'Compares two numeric values',
    fields: [
      {
        name: 'value_a',
        type: 'number',
        valueType: 'literal',
        value: 0,
        description: 'First value',
      },
      {
        name: 'operator',
        type: 'string',
        valueType: 'literal',
        value: '==',
        description: 'Comparison operator (==, !=, <, >, <=, >=)',
      },
      {
        name: 'value_b',
        type: 'number',
        valueType: 'literal',
        value: 0,
        description: 'Second value',
      },
    ],
  },

  // Subtree nodes are loaded dynamically from the workspace library.
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Map from BT XML tag name (e.g. "Sequence") to its NodeCategory.
 * Lazily built from `nodeLibrary` so it always stays in sync.
 */
const nodeTypeToCategory = new Map<string, NodeCategory>(
  nodeLibrary.map((def) => [def.type, def.category]),
);

/**
 * Infer the category of a BT node from its XML tag name.
 *
 * Checks the node library first, then falls back to naming heuristics
 * for user-defined nodes not in the library.
 */
export function inferCategoryFromType(nodeType: string): NodeCategory {
  const known = nodeTypeToCategory.get(nodeType);
  if (known) return known;

  // Heuristic fallback for unrecognised node types
  if (nodeType.startsWith('Check') || nodeType.startsWith('Is') || nodeType.startsWith('Has')) {
    return 'condition';
  }

  // Default unknown leaf nodes to action
  return 'action';
}

/**
 * Look up a node definition by its BT XML tag name (e.g. "Sequence").
 * Returns `undefined` for dynamically-loaded subtree nodes.
 */
export function findDefinitionByType(type: string): BTNodeDefinition | undefined {
  return nodeLibrary.find((def) => def.type === type);
}
