/**
 * BTNode - Custom ReactFlow node component for BehaviorTree nodes.
 *
 * Renders the node header (type + optional instance name), field values,
 * and subtree port labels. Used as the `btNode` custom node type in the
 * ReactFlow canvas.
 *
 * Data shape comes from BTNodeInstance, but ReactFlow passes it as
 * `data: Record<string, any>`, so we define a narrowed `BTNodeData`
 * interface here.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import './BTNode.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Subset of NodeField used for display purposes. */
interface DisplayField {
  name: string;
  value: string | number | boolean;
  valueType: 'literal' | 'variable';
  portDirection?: 'input' | 'output';
}

interface BTNodeData {
  name: string;
  category: string;
  color: string;
  nodeName?: string;
  subtreeId?: string;
  fields: DisplayField[];
}

interface BTNodeProps {
  data: BTNodeData;
  selected: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a field value for display.
 *
 * Variable references and `output_key` values may already include braces
 * (`{varName}`). This helper normalises the display so variables always
 * show braces and literals never do.
 */
function formatDisplayValue(field: DisplayField): string {
  const raw = String(field.value);
  const hasBrackets = raw.startsWith('{') && raw.endsWith('}');
  if (field.valueType === 'variable' && !hasBrackets) return `{${raw}}`;
  return raw;
}

/** Determine the CSS class for a field value (variable refs are highlighted). */
function valueClassName(field: DisplayField): string {
  const raw = String(field.value);
  const isVariable = field.valueType === 'variable' || (raw.startsWith('{') && raw.endsWith('}'));
  return `field-value ${isVariable ? 'variable' : 'literal'}`;
}

/** Render a single field row (shared by regular fields and port fields). */
function FieldRow({ field, portLabel }: { field: DisplayField; portLabel?: string }) {
  return (
    <div className={`node-field${portLabel ? ' port-field' : ''}`}>
      {portLabel && <span className={`port-direction-label ${portLabel === '[IN]' ? 'input' : 'output'}`}>{portLabel}</span>}
      <span className="field-name">{field.name}:</span>
      <span className={valueClassName(field)}>{formatDisplayValue(field)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BTNode: React.FC<BTNodeProps> = ({ data, selected }) => {
  const displayLabel = data.nodeName || '';
  const isSubtree = data.category === 'subtree';
  const isRoot = data.category === 'root';

  // Partition fields for subtree port display
  const inputFields = isSubtree ? data.fields.filter((f) => f.portDirection === 'input') : [];
  const outputFields = isSubtree ? data.fields.filter((f) => f.portDirection === 'output') : [];
  const regularFields = isSubtree ? data.fields.filter((f) => !f.portDirection) : data.fields;

  return (
    <div
      className={`bt-node ${selected ? 'selected' : ''} ${isSubtree ? 'subtree-node' : ''}`}
      style={{ borderColor: data.color }}
    >
      {/* Root nodes have no target (incoming) handle */}
      {!isRoot && <Handle type="target" position={Position.Top} className="node-handle" />}

      <div className="node-header" style={{ backgroundColor: data.color }}>
        <div className="node-title">{data.name}</div>
        {displayLabel && <div className="node-category">{displayLabel}</div>}
      </div>

      {/* Subtree input ports */}
      {isSubtree && inputFields.length > 0 && (
        <div className="node-fields port-fields input-ports">
          {inputFields.map((field, idx) => (
            <FieldRow key={idx} field={field} portLabel="[IN]" />
          ))}
        </div>
      )}

      {/* Regular fields */}
      {regularFields.length > 0 && (
        <div className="node-fields">
          {regularFields.map((field, idx) => (
            <FieldRow key={idx} field={field} />
          ))}
        </div>
      )}

      {/* Subtree output ports */}
      {isSubtree && outputFields.length > 0 && (
        <div className="node-fields port-fields output-ports">
          {outputFields.map((field, idx) => (
            <FieldRow key={idx} field={field} portLabel="[OUT]" />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
};

export default memo(BTNode);
