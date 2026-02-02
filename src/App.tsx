import React, { useState, useCallback, useEffect, useRef } from 'react';
import NodePalette from './components/NodePalette';
import TreeEditor from './components/TreeEditor';
import VariableEditor from './components/VariableEditor';
import SubTreeTabBar from './components/SubTreeTabBar';
import WorkspaceToolbar from './components/WorkspaceToolbar';
import { WorkspaceProvider } from './store/workspaceStore';
import { Variable, BTNodeDefinition } from './types';
import './App.css';

// Inner app component that uses workspace context
function AppContent() {
  const [tabId] = useState(() => {
    if (typeof window === 'undefined') return 'server';
    const existing = sessionStorage.getItem('btstudio-tab-id');
    if (existing) return existing;
    const generated = window.crypto?.randomUUID?.() ?? `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('btstudio-tab-id', generated);
    return generated;
  });

  const [variables, setVariables] = useState<Variable[]>(() => {
    if (typeof window === 'undefined') return [];
    const stored = sessionStorage.getItem(`btstudio:variables:${tabId}`);
    if (stored) {
      try {
        return JSON.parse(stored) as Variable[];
      } catch {
        // fall through to defaults
      }
    }
    return [
      { name: 'counter', value: '0' },
      { name: 'message', value: 'Hello' },
      { name: 'isActive', value: 'true' },
    ];
  });

  // Callback ref to trigger DeclareVariable node creation from TreeEditor
  const addDeclareVariableNodeRef = useRef<((variable: Variable) => void) | null>(null);
  const deleteDeclareVariableNodeRef = useRef<((variableName: string) => void) | null>(null);
  const updateDeclareVariableNodeRef = useRef<((variableName: string, newValue: string) => void) | null>(null);

  useEffect(() => {
    sessionStorage.setItem(`btstudio:variables:${tabId}`, JSON.stringify(variables));
  }, [variables, tabId]);

  const handleAddVariable = useCallback((variable: Variable) => {
    setVariables(prev => [...prev, variable]);
    // Trigger creation of DeclareVariable node in TreeEditor
    if (addDeclareVariableNodeRef.current) {
      addDeclareVariableNodeRef.current(variable);
    }
  }, []);

  const handleUpdateVariable = useCallback((name: string, variable: Variable) => {
    setVariables(prev => prev.map(v => v.name === name ? variable : v));
  }, []);

  const handleDeleteVariable = useCallback((name: string) => {
    setVariables(prev => prev.filter(v => v.name !== name));
    // Trigger deletion of DeclareVariable node in TreeEditor
    if (deleteDeclareVariableNodeRef.current) {
      deleteDeclareVariableNodeRef.current(name);
    }
  }, []);

  const handleUpdateNodeField = useCallback((
    nodeId: string,
    fieldName: string,
    value: any,
    valueType: 'literal' | 'variable'
  ) => {
    // This would update the node's field in your state management
    console.log('Update node field:', { nodeId, fieldName, value, valueType });
  }, []);

  const handleNodeSelect = useCallback((node: BTNodeDefinition) => {
    console.log('Node selected from palette:', node);
  }, []);

  const handleAddDeclareVariableNode = useCallback((callback: (variable: Variable) => void) => {
    addDeclareVariableNodeRef.current = callback;
  }, []);

  const handleDeleteDeclareVariableNode = useCallback((callback: (variableName: string) => void) => {
    deleteDeclareVariableNodeRef.current = callback;
  }, []);

  const handleUpdateDeclareVariableNode = useCallback((callback: (variableName: string, newValue: string) => void) => {
    updateDeclareVariableNodeRef.current = callback;
  }, []);

  const handleUpdateDeclareVariableValue = useCallback((variableName: string, newValue: string) => {
    if (updateDeclareVariableNodeRef.current) {
      updateDeclareVariableNodeRef.current(variableName, newValue);
    }
  }, []);

  const handleSyncVariables = useCallback((syncedVariables: Variable[]) => {
    setVariables(syncedVariables);
  }, []);

  const isElectron = typeof window !== 'undefined' && window.isElectron === true;

  return (
    <div className="app">
      {/* Invisible component that handles Electron menu events */}
      {isElectron && <WorkspaceToolbar />}
      
      <div className="app-content">
        <NodePalette onNodeSelect={handleNodeSelect} />
        <div className="main-editor-area">
          {/* SubTreeTabBar only shows in Electron mode */}
          {isElectron && <SubTreeTabBar />}
          <TreeEditor 
            variables={variables}
            onUpdateNodeField={handleUpdateNodeField}
            onAddDeclareVariableNode={handleAddDeclareVariableNode}
            onDeleteDeclareVariableNode={handleDeleteDeclareVariableNode}
            onUpdateDeclareVariableNode={handleUpdateDeclareVariableNode}
            onSyncVariables={handleSyncVariables}
            tabId={tabId}
          />
        </div>
        <VariableEditor
          variables={variables}
          onAddVariable={handleAddVariable}
          onUpdateVariable={handleUpdateVariable}
          onDeleteVariable={handleDeleteVariable}
          onUpdateDeclareVariableNode={handleUpdateDeclareVariableValue}
        />
      </div>
    </div>
  );
}

// Main App component wraps with providers
function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

export default App;
