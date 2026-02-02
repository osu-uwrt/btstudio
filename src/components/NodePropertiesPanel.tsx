import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Node } from 'reactflow';
import { Variable } from '../types';
import './NodePropertiesPanel.css';

interface NodePropertiesPanelProps {
  node: Node;
  variables: Variable[];
  onUpdateField: (nodeId: string, fieldName: string, value: any, valueType: 'literal' | 'variable') => void;
  onUpdateName?: (nodeId: string, name: string) => void;
  onClose: () => void;
}

const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({
  node,
  variables,
  onUpdateField,
  onUpdateName,
  onClose
}) => {
  const [fieldEdits, setFieldEdits] = useState<Record<string, { value: any; valueType: 'literal' | 'variable' }>>({});
  const [nodeName, setNodeName] = useState<string>(node.data?.nodeName || '');

  const handleFieldChange = (fieldName: string, value: any) => {
    const currentEdit = fieldEdits[fieldName] || { valueType: 'literal' };
    const updated = { ...currentEdit, value };
    setFieldEdits({ ...fieldEdits, [fieldName]: updated });
    onUpdateField(node.id, fieldName, value, currentEdit.valueType);
  };

  const handleValueTypeChange = (fieldName: string, valueType: 'literal' | 'variable') => {
    const currentEdit = fieldEdits[fieldName] || { value: '' };
    const updated = { ...currentEdit, valueType };
    setFieldEdits({ ...fieldEdits, [fieldName]: updated });
    onUpdateField(node.id, fieldName, currentEdit.value, valueType);
  };

  const handleNameChange = (newName: string) => {
    setNodeName(newName);
    if (onUpdateName) {
      onUpdateName(node.id, newName);
    }
  };

  const fields = node.data?.fields || [];

  return (
    <div className="node-properties-panel">
      <div className="panel-header">
        <h3>Node Properties</h3>
        <button onClick={onClose} className="close-btn">
          <X size={18} />
        </button>
      </div>

      <div className="panel-content">
        <div className="node-info">
          <div className="info-row">
            <span className="info-label">Type:</span>
            <span className="info-value">{node.data?.name || 'Unknown'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Category:</span>
            <span className="info-value">{node.data?.category || 'Unknown'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">ID:</span>
            <span className="info-value mono">{node.id}</span>
          </div>
        </div>

        <div className="name-section">
          <h4>Node Name</h4>
          <input
            type="text"
            value={nodeName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="No name"
            className="field-input"
          />
        </div>

        {fields.length > 0 && (
          <div className="fields-section">
            <h4>Fields</h4>
            {fields.map((field: any, idx: number) => {
              const currentEdit = fieldEdits[field.name] || {
                value: field.value,
                valueType: field.valueType || 'literal'
              };

              // Special handling for output_key in SetBlackboard and DeclareVariable
              const isSetBlackboard = node.data?.type === 'SetBlackboard';
              const isDeclareVariable = node.data?.type === 'DeclareVariable';
              const isOutputKey = field.name === 'output_key';
              const portDirection = field.portDirection;

              // For display purposes, strip brackets if they exist in the value
              const displayValue = typeof currentEdit.value === 'string' 
                ? currentEdit.value.replace(/^\{|\}$/g, '') 
                : currentEdit.value;

              // Port direction label for subtree fields
              const portLabel = portDirection === 'input' ? '[IN] ' : portDirection === 'output' ? '[OUT] ' : '';

              return (
                <div key={idx} className={`field-editor ${portDirection ? `port-field-${portDirection}` : ''}`}>
                  <label className="field-label">
                    {portDirection && <span className={`port-badge ${portDirection}`}>{portLabel}</span>}
                    {field.name}
                  </label>
                  <div className="field-description">{field.description}</div>
                  
                  {/* Hide value type selector for output_key in SetBlackboard and DeclareVariable */}
                  {!(isOutputKey && (isSetBlackboard || isDeclareVariable)) && (
                    <div className="value-type-selector">
                      <button
                        className={`type-btn ${currentEdit.valueType === 'literal' ? 'active' : ''}`}
                        onClick={() => handleValueTypeChange(field.name, 'literal')}
                      >
                        Literal
                      </button>
                      <button
                        className={`type-btn ${currentEdit.valueType === 'variable' ? 'active' : ''}`}
                        onClick={() => handleValueTypeChange(field.name, 'variable')}
                      >
                        Variable
                      </button>
                    </div>
                  )}

                  {/* SetBlackboard output_key: dropdown of existing variables */}
                  {isSetBlackboard && isOutputKey ? (
                    <select
                      value={displayValue.toString()}
                      onChange={(e) => handleFieldChange(field.name, `{${e.target.value}}`)}
                      className="field-input variable-select"
                    >
                      <option value="">Select variable...</option>
                      {variables.map(v => (
                        <option key={v.name} value={v.name}>
                          {`{${v.name}}`}
                        </option>
                      ))}
                    </select>
                  ) : isDeclareVariable && isOutputKey ? (
                    /* DeclareVariable output_key: text input with bracket display */
                    <div className="blackboard-input-wrapper">
                      <span className="bracket-prefix">{'{'}</span>
                      <input
                        type="text"
                        value={displayValue.toString()}
                        onChange={(e) => handleFieldChange(field.name, `{${e.target.value}}`)}
                        className="field-input blackboard-input"
                        placeholder="variable_name"
                      />
                      <span className="bracket-suffix">{'}'}</span>
                    </div>
                  ) : currentEdit.valueType === 'literal' ? (
                    field.type === 'boolean' ? (
                      <select
                        value={currentEdit.value.toString()}
                        onChange={(e) => handleFieldChange(field.name, e.target.value === 'true')}
                        className="field-input"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={currentEdit.value.toString()}
                        onChange={(e) => {
                          const val = field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                          handleFieldChange(field.name, val);
                        }}
                        className="field-input"
                      />
                    )
                  ) : (
                    <select
                      value={currentEdit.value.toString()}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="field-input variable-select"
                    >
                      <option value="">Select variable...</option>
                      {variables.map(v => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NodePropertiesPanel;
