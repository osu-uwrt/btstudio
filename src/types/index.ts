// BehaviorTree Node Types
export type NodeCategory = 'action' | 'condition' | 'control' | 'decorator' | 'subtree' | 'root';

export type FieldValueType = 'literal' | 'variable';

export interface NodeField {
  name: string;
  type: 'string' | 'number' | 'boolean';
  valueType: FieldValueType;
  value: string | number | boolean;
  description?: string;
  // For subtree ports: direction indicator
  portDirection?: 'input' | 'output';
}

// SubTree port definition (input/output parameters)
export type SubTreePortDirection = 'input' | 'output' | 'inout';

export interface SubTreePort {
  name: string;
  direction: SubTreePortDirection;
  type: 'string' | 'number' | 'boolean';
  defaultValue?: string;
  required?: boolean;
  description?: string;
}

export interface BTNodeDefinition {
  id: string;
  type: string;
  category: NodeCategory;
  name: string;
  description: string;
  fields: NodeField[];
  // For subtrees: define input/output ports
  ports?: SubTreePort[];
  // For subtrees: reference to the subtree ID
  subtreeId?: string;
  // Optional custom name for the node instance (displayed instead of category)
  nodeName?: string;
}

export interface BTNodeInstance extends BTNodeDefinition {
  // Instance-level custom name (overrides default)
  nodeName?: string;
  instanceId: string;
  position: { x: number; y: number };
}

// Variable Types
export interface Variable {
  name: string;
  value: string;
}

// Application State
export interface EditorState {
  nodes: BTNodeInstance[];
  variables: Variable[];
  selectedNode: string | null;
  selectedVariable: string | null;
}
