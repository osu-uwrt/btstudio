import { BTNodeDefinition } from '../types';

// Predefined BehaviorTree node library
export const nodeLibrary: BTNodeDefinition[] = [
  // Root Node (special - only one allowed per tree)
  {
    id: 'root',
    type: 'Root',
    category: 'root',
    name: 'Root',
    description: 'Root node of the behavior tree',
    fields: []
  },
  
  // Control Nodes
  {
    id: 'sequence',
    type: 'Sequence',
    category: 'control',
    name: 'Sequence',
    description: 'Executes children in order until one fails',
    fields: []
  },
  {
    id: 'fallback',
    type: 'Fallback',
    category: 'control',
    name: 'Fallback',
    description: 'Executes children in order until one succeeds',
    fields: []
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
        description: 'Number of children that must succeed'
      }
    ]
  },
  {
    id: 'reactive_sequence',
    type: 'ReactiveSequence',
    category: 'control',
    name: 'Reactive Sequence',
    description: 'Like Sequence but re-evaluates from the start',
    fields: []
  },
  {
    id: 'reactive_fallback',
    type: 'ReactiveFallback',
    category: 'control',
    name: 'Reactive Fallback',
    description: 'Like Fallback but re-evaluates from the start',
    fields: []
  },
  
  // Decorator Nodes
  {
    id: 'inverter',
    type: 'Inverter',
    category: 'decorator',
    name: 'Inverter',
    description: 'Inverts the result of its child',
    fields: []
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
        description: 'Number of retry attempts'
      }
    ]
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
        description: 'Number of cycles to repeat'
      }
    ]
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
        description: 'Timeout in milliseconds'
      }
    ]
  },
  {
    id: 'force_success',
    type: 'ForceSuccess',
    category: 'decorator',
    name: 'Force Success',
    description: 'Always returns SUCCESS',
    fields: []
  },
  {
    id: 'force_failure',
    type: 'ForceFailure',
    category: 'decorator',
    name: 'Force Failure',
    description: 'Always returns FAILURE',
    fields: []
  },
  
  // Action Nodes
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
        description: 'Message to print'
      }
    ]
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
        description: 'Variable name'
      },
      {
        name: 'value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Initial value'
      }
    ]
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
        description: 'Variable name'
      },
      {
        name: 'value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Value to set'
      }
    ]
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
        description: 'Delay in milliseconds'
      }
    ]
  },
  
  // Condition Nodes 
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
        description: 'Variable to check'
      },
      {
        name: 'expected_value',
        type: 'string',
        valueType: 'literal',
        value: '',
        description: 'Expected value'
      }
    ]
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
        description: 'First value'
      },
      {
        name: 'operator',
        type: 'string',
        valueType: 'literal',
        value: '==',
        description: 'Comparison operator (==, !=, <, >, <=, >=)'
      },
      {
        name: 'value_b',
        type: 'number',
        valueType: 'literal',
        value: 0,
        description: 'Second value'
      }
    ]
  },
  
  // SubTree Nodes are loaded dynamically from the subtree library
];

export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'root':
      return '#F44336';
    case 'action':
      return '#4CAF50';
    case 'condition':
      return '#2196F3';
    case 'control':
      return '#FF9800';
    case 'decorator':
      return '#9C27B0';
    case 'subtree':
      return '#00BCD4';
    default:
      return '#757575';
  }
};
