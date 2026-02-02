import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import './BTNode.css';

interface BTNodeProps {
  data: {
    name: string;
    category: string;
    color: string;
    nodeName?: string; // Optional custom instance name
    subtreeId?: string; // For subtree nodes
    fields: Array<{
      name: string;
      value: string | number | boolean;
      valueType: 'literal' | 'variable';
      portDirection?: 'input' | 'output'; // For subtree port fields
    }>;
  };
  selected: boolean;
}

const BTNode: React.FC<BTNodeProps> = ({ data, selected }) => {
  // Display custom nodeName if set, otherwise show empty (category is visible in properties panel)
  const displayLabel = data.nodeName || '';
  const isSubtree = data.category === 'subtree';
  
  // Separate fields by port direction for subtrees
  const inputFields = isSubtree ? data.fields.filter(f => f.portDirection === 'input') : [];
  const outputFields = isSubtree ? data.fields.filter(f => f.portDirection === 'output') : [];
  const regularFields = isSubtree 
    ? data.fields.filter(f => !f.portDirection) 
    : data.fields;
  
  return (
    <div className={`bt-node ${selected ? 'selected' : ''} ${isSubtree ? 'subtree-node' : ''}`} style={{ borderColor: data.color }}>
      <Handle type="target" position={Position.Top} className="node-handle" />
      
      <div className="node-header" style={{ backgroundColor: data.color }}>
        <div className="node-title">{data.name}</div>
        {displayLabel && <div className="node-category">{displayLabel}</div>}
      </div>
      
      {/* Subtree input ports */}
      {isSubtree && inputFields.length > 0 && (
        <div className="node-fields port-fields input-ports">
          {inputFields.map((field, idx) => {
            const valueStr = field.value.toString();
            const hasBrackets = valueStr.startsWith('{') && valueStr.endsWith('}');
            let displayValue = valueStr;
            if (field.valueType === 'variable' && !hasBrackets) {
              displayValue = `{${valueStr}}`;
            }
            
            return (
              <div key={idx} className="node-field port-field">
                <span className="port-direction-label input">[IN]</span>
                <span className="field-name">{field.name}:</span>
                <span className={`field-value ${field.valueType === 'variable' || hasBrackets ? 'variable' : 'literal'}`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Regular fields (non-port) */}
      {regularFields.length > 0 && (
        <div className="node-fields">
          {regularFields.map((field, idx) => {
            // Check if value already has brackets (for output_key fields)
            const valueStr = field.value.toString();
            const hasBrackets = valueStr.startsWith('{') && valueStr.endsWith('}');
            
            let displayValue = valueStr;
            if (field.valueType === 'variable' && !hasBrackets) {
              displayValue = `{${valueStr}}`;
            }
            
            return (
              <div key={idx} className="node-field">
                <span className="field-name">{field.name}:</span>
                <span className={`field-value ${field.valueType === 'variable' || hasBrackets ? 'variable' : 'literal'}`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Subtree output ports */}
      {isSubtree && outputFields.length > 0 && (
        <div className="node-fields port-fields output-ports">
          {outputFields.map((field, idx) => {
            const valueStr = field.value.toString();
            const hasBrackets = valueStr.startsWith('{') && valueStr.endsWith('}');
            let displayValue = valueStr;
            if (field.valueType === 'variable' && !hasBrackets) {
              displayValue = `{${valueStr}}`;
            }
            
            return (
              <div key={idx} className="node-field port-field">
                <span className="port-direction-label output">[OUT]</span>
                <span className="field-name">{field.name}:</span>
                <span className={`field-value ${field.valueType === 'variable' || hasBrackets ? 'variable' : 'literal'}`}>
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      )}
      
      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
};

export default memo(BTNode);
