import React, { useState } from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { Variable } from '../types';
import './VariableEditor.css';

interface VariableEditorProps {
  variables: Variable[];
  onAddVariable: (variable: Variable) => void;
  onUpdateVariable: (name: string, variable: Variable) => void;
  onDeleteVariable: (name: string) => void;
  onUpdateDeclareVariableNode?: (variableName: string, newValue: string) => void;
}

const VariableEditor: React.FC<VariableEditorProps> = ({
  variables,
  onAddVariable,
  onUpdateVariable,
  onDeleteVariable,
  onUpdateDeclareVariableNode
}) => {
  const [editingVar, setEditingVar] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const handleAddVariable = () => {
    if (!newVarName.trim()) return;

    onAddVariable({
      name: newVarName,
      value: newVarValue
    });

    setNewVarName('');
    setNewVarValue('');
  };

  const handleUpdateValue = (varName: string, newValue: string) => {
    const variable = variables.find(v => v.name === varName);
    if (!variable) return;

    onUpdateVariable(varName, { ...variable, value: newValue });
    
    // Also update the DeclareVariable node if callback is provided
    if (onUpdateDeclareVariableNode) {
      onUpdateDeclareVariableNode(varName, newValue);
    }
    
    setEditingVar(null);
  };

  return (
    <div className="variable-editor">
      <div className="editor-header">
        <h2>Variables</h2>
      </div>

      <div className="add-variable-section">
        <h3>Add Variable</h3>
        <input
          type="text"
          placeholder="Variable name"
          value={newVarName}
          onChange={(e) => setNewVarName(e.target.value)}
          className="var-input"
        />
        <input
          type="text"
          placeholder="Initial value"
          value={newVarValue}
          onChange={(e) => setNewVarValue(e.target.value)}
          className="var-input"
        />
        <button onClick={handleAddVariable} className="add-btn">
          <Plus size={16} />
          Add Variable
        </button>
      </div>

      <div className="variables-list">
        <h3>
          Variables
          <span className="count">({variables.length})</span>
        </h3>
        {variables.length === 0 ? (
          <div className="empty-state">No variables declared</div>
        ) : (
          variables.map(variable => (
            <div key={variable.name} className="variable-item">
              <div className="var-header">
                <span className="var-name">{variable.name}</span>
                <div className="var-actions">
                  <button
                    onClick={() => setEditingVar(variable.name)}
                    className="icon-btn"
                    title="Edit value"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteVariable(variable.name)}
                    className="icon-btn delete"
                    title="Delete variable"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {editingVar === variable.name ? (
                <input
                  type="text"
                  defaultValue={variable.value}
                  onBlur={(e) => handleUpdateValue(variable.name, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateValue(variable.name, (e.target as HTMLInputElement).value);
                    }
                  }}
                  autoFocus
                  className="var-input-inline"
                />
              ) : (
                <div className="var-value">{variable.value}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VariableEditor;
