/**
 * Core type definitions for BTstudio.
 *
 * These types define the data model shared across the editor, serializer,
 * and workspace store. Changes here must be reflected in:
 *   - BTNode.tsx (rendering)
 *   - NodePropertiesPanel.tsx (editing)
 *   - xmlSerializer.ts (import / export)
 */

import type { Node as XYFlowNode, Edge as XYFlowEdge } from '@xyflow/react';

// ---------------------------------------------------------------------------
// BehaviorTree Node Categories
// ---------------------------------------------------------------------------

/**
 * The six node categories supported by BehaviorTree.cpp v4.
 * - root:      Exactly one per tree; the execution entry point.
 * - control:   Has one or more children (Sequence, Fallback, Parallel, ...).
 * - decorator: Wraps exactly one child (Inverter, Retry, Repeat, ...).
 * - action:    Leaf node that performs work (no children).
 * - condition: Leaf node that performs a check (no children).
 * - subtree:   Reference to another BehaviorTree defined elsewhere.
 */
export type NodeCategory =
  | 'action'
  | 'condition'
  | 'control'
  | 'decorator'
  | 'subtree'
  | 'root';

// ---------------------------------------------------------------------------
// Field Value Types
// ---------------------------------------------------------------------------

/** Whether a field's value is a literal constant or a blackboard variable ref. */
export type FieldValueType = 'literal' | 'variable';

/**
 * A single editable field on a BT node.
 *
 * In the XML these become attributes on the node element, e.g.
 *   <PrintMessage message="Hello"/>          (literal)
 *   <PrintMessage message="{myVar}"/>        (variable)
 */
export interface NodeField {
  /** Attribute name in the BT XML. */
  name: string;
  /** Data type hint for the editor UI. */
  type: 'string' | 'number' | 'boolean';
  /** Whether the value is a literal constant or a blackboard variable reference. */
  valueType: FieldValueType;
  /** The field's current value. */
  value: string | number | boolean;
  /** Human-readable description shown in the properties panel. */
  description?: string;
  /** For subtree port fields: indicates port direction. */
  portDirection?: 'input' | 'output';
}

// ---------------------------------------------------------------------------
// SubTree Ports
// ---------------------------------------------------------------------------

/** Direction of data flow through a subtree port. */
export type SubTreePortDirection = 'input' | 'output' | 'inout';

/**
 * Definition of a single port on a subtree.
 * Ports appear in the <TreeNodesModel> section of BT XML and define
 * the interface for passing data into/out of subtrees.
 */
export interface SubTreePort {
  /** Port name (becomes an XML attribute on the SubTree element). */
  name: string;
  direction: SubTreePortDirection;
  type: 'string' | 'number' | 'boolean';
  /** Default value if the caller doesn't supply one. */
  defaultValue?: string;
  /** Whether the caller must provide a value for this port. */
  required?: boolean;
  /** Shown as a tooltip / label in the editor. */
  description?: string;
}

// ---------------------------------------------------------------------------
// Node Definitions (palette templates)
// ---------------------------------------------------------------------------

/**
 * A BT node definition as it appears in the node palette / library.
 * This is a *template*; dropping it onto the canvas creates a BTNodeInstance.
 */
export interface BTNodeDefinition {
  /** Unique identifier within the node library (e.g. 'sequence', 'action_delay'). */
  id: string;
  /** The BT XML tag name (e.g. 'Sequence', 'PrintMessage'). */
  type: string;
  category: NodeCategory;
  /** Human-readable display name. */
  name: string;
  description: string;
  /** Default fields every instance starts with. */
  fields: NodeField[];
  /** For subtree definitions: the ports interface. */
  ports?: SubTreePort[];
  /** For subtree nodes: the BehaviorTree ID this node references. */
  subtreeId?: string;
  /** Optional custom instance name (shown in the node header). */
  nodeName?: string;
}

// ---------------------------------------------------------------------------
// Node Instances (on the canvas)
// ---------------------------------------------------------------------------

/**
 * A concrete node instance placed on the canvas.
 * Extends the template definition with positional and identity data.
 */
export interface BTNodeInstance extends BTNodeDefinition {
  /** Overridable instance-level display name. */
  nodeName?: string;
  /** Unique runtime ID for this instance. */
  instanceId: string;
  position: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Variables (Blackboard)
// ---------------------------------------------------------------------------

/** A blackboard variable declaration (name + initial value string). */
export interface Variable {
  name: string;
  value: string;
}

// ---------------------------------------------------------------------------
// ReactFlow Node/Edge Aliases
// ---------------------------------------------------------------------------

/**
 * Data shape stored in each ReactFlow node's `data` property on the canvas.
 *
 * This is effectively `BTNodeDefinition` plus instance-specific fields
 * (`instanceId`, `color`) that are assigned when a node is dropped.
 * The index signature satisfies the `Record<string, unknown>` constraint
 * required by `@xyflow/react`'s `Node<T>` generic.
 */
export interface BTNodeData {
  [key: string]: unknown;
  /** Library node identifier. */
  id: string;
  /** BT XML tag name (e.g. 'Sequence', 'PrintMessage'). */
  type: string;
  category: NodeCategory;
  /** Display name shown in the node header. */
  name: string;
  description: string;
  fields: NodeField[];
  ports?: SubTreePort[];
  subtreeId?: string;
  nodeName?: string;
  /** Unique runtime instance ID. */
  instanceId: string;
  /** Display colour (hex or CSS colour). */
  color: string;
}

/** ReactFlow node carrying BTstudio-specific data. */
export type AppNode = XYFlowNode<BTNodeData>;

/** ReactFlow edge (no custom data needed). */
export type AppEdge = XYFlowEdge;

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------

/** High-level editor state (used by non-workspace-aware paths). */
export interface EditorState {
  nodes: BTNodeInstance[];
  variables: Variable[];
  selectedNode: string | null;
  selectedVariable: string | null;
}
