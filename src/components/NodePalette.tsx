import React, { useState, useMemo } from 'react';
import { Search, Boxes, Library, GitBranch, FolderOpen, Plus, X, ArrowDownCircle, ArrowUpCircle, FileInput } from 'lucide-react';
import { nodeLibrary, getCategoryColor } from '../data/nodeLibrary';
import { BTNodeDefinition, SubTreePort } from '../types';
import { useWorkspace } from '../store/workspaceStore';
import { useWorkspaceOps } from '../hooks/useWorkspaceOps';
import './NodePalette.css';

type PaletteView = 'nodes' | 'library';

interface NodePaletteProps {
  onNodeSelect: (node: BTNodeDefinition) => void;
}

interface PortEditorProps {
  ports: SubTreePort[];
  onPortsChange: (ports: SubTreePort[]) => void;
}

const PortEditor: React.FC<PortEditorProps> = ({ ports, onPortsChange }) => {
  const addPort = (direction: 'input' | 'output') => {
    const newPort: SubTreePort = {
      name: '',
      direction,
      type: 'string',
      defaultValue: '',
      required: false,
      description: '',
    };
    onPortsChange([...ports, newPort]);
  };

  const updatePort = (index: number, field: keyof SubTreePort, value: any) => {
    const updated = [...ports];
    updated[index] = { ...updated[index], [field]: value };
    onPortsChange(updated);
  };

  const removePort = (index: number) => {
    onPortsChange(ports.filter((_, i) => i !== index));
  };

  const inputPorts = ports.filter(p => p.direction === 'input');
  const outputPorts = ports.filter(p => p.direction === 'output');

  return (
    <div className="port-editor">
      <div className="port-section">
        <div className="port-section-header">
          <ArrowDownCircle size={14} className="port-icon input" />
          <span>Input Ports</span>
          <button type="button" className="add-port-btn" onClick={() => addPort('input')}>
            <Plus size={12} /> Add
          </button>
        </div>
        {inputPorts.map((port, idx) => {
          const globalIdx = ports.findIndex(p => p === port);
          return (
            <div key={globalIdx} className="port-row">
              <input
                type="text"
                placeholder="Port name"
                value={port.name}
                onChange={(e) => updatePort(globalIdx, 'name', e.target.value)}
                className="port-name-input"
              />
              <select
                value={port.type}
                onChange={(e) => updatePort(globalIdx, 'type', e.target.value)}
                className="port-type-select"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
              </select>
              <input
                type="text"
                placeholder="Default"
                value={port.defaultValue || ''}
                onChange={(e) => updatePort(globalIdx, 'defaultValue', e.target.value)}
                className="port-default-input"
              />
              <label className="port-required-label">
                <input
                  type="checkbox"
                  checked={port.required || false}
                  onChange={(e) => updatePort(globalIdx, 'required', e.target.checked)}
                />
                Req
              </label>
              <button type="button" className="remove-port-btn" onClick={() => removePort(globalIdx)}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="port-section">
        <div className="port-section-header">
          <ArrowUpCircle size={14} className="port-icon output" />
          <span>Output Ports</span>
          <button type="button" className="add-port-btn" onClick={() => addPort('output')}>
            <Plus size={12} /> Add
          </button>
        </div>
        {outputPorts.map((port) => {
          const globalIdx = ports.findIndex(p => p === port);
          return (
            <div key={globalIdx} className="port-row">
              <input
                type="text"
                placeholder="Port name"
                value={port.name}
                onChange={(e) => updatePort(globalIdx, 'name', e.target.value)}
                className="port-name-input"
              />
              <select
                value={port.type}
                onChange={(e) => updatePort(globalIdx, 'type', e.target.value)}
                className="port-type-select"
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
              </select>
              <input
                type="text"
                placeholder="Default"
                value={port.defaultValue || ''}
                onChange={(e) => updatePort(globalIdx, 'defaultValue', e.target.value)}
                className="port-default-input"
              />
              <label className="port-required-label">
                <input
                  type="checkbox"
                  checked={port.required || false}
                  onChange={(e) => updatePort(globalIdx, 'required', e.target.checked)}
                />
                Req
              </label>
              <button type="button" className="remove-port-btn" onClick={() => removePort(globalIdx)}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface NewSubtreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, ports: SubTreePort[]) => void;
}

const NewSubtreeModal: React.FC<NewSubtreeModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ports, setPorts] = useState<SubTreePort[]>([]);

  const handleCreate = () => {
    if (name.trim()) {
      // Filter out ports with empty names
      const validPorts = ports.filter(p => p.name.trim());
      onCreate(name.trim(), description.trim(), validPorts);
      setName('');
      setDescription('');
      setPorts([]);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim() && e.target instanceof HTMLInputElement && e.target.id === 'subtree-name') {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content subtree-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h3>New Subtree</h3>
        <label htmlFor="subtree-name">Name</label>
        <input
          id="subtree-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="MySubtree"
          autoFocus
        />
        <label htmlFor="subtree-description">Description (optional)</label>
        <textarea
          id="subtree-description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What does this subtree do?"
        />
        
        <div className="ports-section">
          <h4>Ports (Input/Output Parameters)</h4>
          <p className="ports-hint">Define ports to pass data in and out of this subtree. Blackboard is not shared.</p>
          <PortEditor ports={ports} onPortsChange={setPorts} />
        </div>
        
        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="create-btn" onClick={handleCreate} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

interface ImportTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceFiles: { path: string; name: string }[];
  onImport: (filePath: string, subtreeName: string, ports: SubTreePort[]) => void;
}

const ImportTreeModal: React.FC<ImportTreeModalProps> = ({ isOpen, onClose, workspaceFiles, onImport }) => {
  const [selectedFile, setSelectedFile] = useState('');
  const [subtreeName, setSubtreeName] = useState('');
  const [ports, setPorts] = useState<SubTreePort[]>([]);

  const xmlFiles = workspaceFiles.filter(f => f.name.endsWith('.xml') && !f.name.includes('subtree_library'));

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    // Auto-generate subtree name from filename
    const file = xmlFiles.find(f => f.path === filePath);
    if (file) {
      const baseName = file.name.replace('.xml', '').replace(/[^a-zA-Z0-9_]/g, '_');
      setSubtreeName(baseName);
    }
  };

  const handleImport = () => {
    if (selectedFile && subtreeName.trim()) {
      const validPorts = ports.filter(p => p.name.trim());
      onImport(selectedFile, subtreeName.trim(), validPorts);
      setSelectedFile('');
      setSubtreeName('');
      setPorts([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content subtree-modal import-modal" onClick={e => e.stopPropagation()}>
        <h3>Import Existing Tree as Subtree</h3>
        
        <label>Select Tree File</label>
        <div className="file-list">
          {xmlFiles.length > 0 ? (
            xmlFiles.map(file => (
              <div
                key={file.path}
                className={`file-item ${selectedFile === file.path ? 'selected' : ''}`}
                onClick={() => handleFileSelect(file.path)}
              >
                <FileInput size={14} />
                <span>{file.name}</span>
              </div>
            ))
          ) : (
            <div className="no-files">No XML files found in workspace</div>
          )}
        </div>
        
        {selectedFile && (
          <>
            <label htmlFor="import-subtree-name">Subtree Name</label>
            <input
              id="import-subtree-name"
              type="text"
              value={subtreeName}
              onChange={e => setSubtreeName(e.target.value)}
              placeholder="SubtreeName"
            />
            
            <div className="ports-section">
              <h4>Define Ports</h4>
              <p className="ports-hint">Add ports to expose data from the imported tree. Blackboard is not shared.</p>
              <PortEditor ports={ports} onPortsChange={setPorts} />
            </div>
          </>
        )}
        
        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button 
            className="create-btn" 
            onClick={handleImport} 
            disabled={!selectedFile || !subtreeName.trim()}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

const NodePalette: React.FC<NodePaletteProps> = ({ onNodeSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paletteView, setPaletteView] = useState<PaletteView>('nodes');
  const [showNewSubtreeModal, setShowNewSubtreeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const { state, dispatch } = useWorkspace();
  const { createNewSubtree, importTreeAsSubtree } = useWorkspaceOps();

  const categories = ['all', 'control', 'decorator', 'action', 'condition', 'subtree'];

  // Create dynamic subtree nodes from library
  const librarySubtreeNodes = useMemo((): BTNodeDefinition[] => {
    const nodes: BTNodeDefinition[] = [];
    
    state.librarySubtrees.forEach((treeData, subtreeId) => {
      // Check if this subtree is already in the static library
      const existsInStatic = nodeLibrary.some(
        n => n.category === 'subtree' && n.subtreeId === subtreeId
      );
      
      if (!existsInStatic) {
        nodes.push({
          id: `subtree_lib_${subtreeId}`,
          type: subtreeId,
          category: 'subtree',
          name: subtreeId,
          description: treeData.description || `Subtree: ${subtreeId}`,
          subtreeId: subtreeId,
          fields: [], // Fields are populated when node is dropped
          ports: treeData.ports || [], // Use actual ports from tree data
        });
      }
    });
    
    return nodes;
  }, [state.librarySubtrees]);

  // Combine static library with dynamic library subtrees for the nodes view
  const combinedNodeLibrary = useMemo(() => {
    return [...nodeLibrary, ...librarySubtreeNodes];
  }, [librarySubtreeNodes]);

  const filteredNodes = combinedNodeLibrary.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || node.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Filter library subtrees for the library view
  const filteredLibrarySubtrees = useMemo(() => {
    const subtrees = Array.from(state.librarySubtrees.entries());
    if (!searchTerm.trim()) return subtrees;
    
    const term = searchTerm.toLowerCase();
    return subtrees.filter(([id]) => id.toLowerCase().includes(term));
  }, [state.librarySubtrees, searchTerm]);

  const handleDragStart = (event: React.DragEvent, node: BTNodeDefinition) => {
    // When dragging a library subtree, we need to ensure the subtree is added to current file
    const nodeData = {
      ...node,
      _isFromLibrary: state.librarySubtrees.has(node.subtreeId || ''),
    };
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleLibrarySubtreeDragStart = (event: React.DragEvent, subtreeId: string) => {
    // Create a node definition for the subtree
    const treeData = state.librarySubtrees.get(subtreeId);
    if (!treeData) return;
    
    const nodeData: BTNodeDefinition & { _isFromLibrary: boolean } = {
      id: `subtree_lib_${subtreeId}`,
      type: subtreeId,
      category: 'subtree',
      name: subtreeId,
      description: treeData.description || `Library SubTree: ${subtreeId}`,
      subtreeId: subtreeId,
      fields: [],
      ports: treeData.ports || [], // Use actual ports
      _isFromLibrary: true,
    };
    
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleLibrarySubtreeClick = (subtreeId: string) => {
    // If the subtree isn't in the current file, add it first
    if (!state.subtrees.has(subtreeId)) {
      dispatch({ type: 'ADD_SUBTREE_FROM_LIBRARY', subtreeId });
    }
    // Switch to editing that subtree
    dispatch({ type: 'SET_ACTIVE_TREE', treeId: subtreeId });
  };

  return (
    <div className="node-palette">
      <div className="palette-header">
        <h2>{paletteView === 'nodes' ? 'Node Palette' : 'Subtree Library'}</h2>
        <div className="view-toggle">
          <button
            className={`view-btn ${paletteView === 'nodes' ? 'active' : ''}`}
            onClick={() => setPaletteView('nodes')}
            title="Node Palette"
          >
            <Boxes size={16} />
          </button>
          <button
            className={`view-btn ${paletteView === 'library' ? 'active' : ''}`}
            onClick={() => setPaletteView('library')}
            title="Subtree Library"
          >
            <Library size={16} />
          </button>
        </div>
      </div>

      <div className="search-container">
        <Search size={18} />
        <input
          type="text"
          placeholder={paletteView === 'nodes' ? 'Search nodes...' : 'Search subtrees...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Category filters - only for nodes view */}
      {paletteView === 'nodes' && (
        <div className="category-filters">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Nodes view */}
      {paletteView === 'nodes' && (
        <div className="nodes-list">
          {filteredNodes.map(node => (
            <div
              key={node.id}
              className="node-item"
              draggable
              onDragStart={(e) => handleDragStart(e, node)}
              onClick={() => onNodeSelect(node)}
              style={{ borderLeftColor: getCategoryColor(node.category) }}
            >
              <div className="node-item-header">
                <span className="node-name">{node.name}</span>
                <span 
                  className="node-category"
                  style={{ backgroundColor: getCategoryColor(node.category) }}
                >
                  {node.category}
                </span>
              </div>
              <div className="node-description">{node.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Library view */}
      {paletteView === 'library' && (
        <div className="library-content">
          {state.workspacePath ? (
            <>
              <div className="workspace-info">
                <FolderOpen size={14} />
                <span className="workspace-path" title={state.workspacePath}>
                  {state.workspacePath.split('/').pop()}
                </span>
              </div>
              
              <div className="library-actions">
                <button
                  className="new-subtree-btn"
                  onClick={() => setShowNewSubtreeModal(true)}
                >
                  <Plus size={16} />
                  New Subtree
                </button>
                <button
                  className="import-tree-btn"
                  onClick={() => setShowImportModal(true)}
                >
                  <FileInput size={16} />
                  Import Tree
                </button>
              </div>
              
              {filteredLibrarySubtrees.length > 0 ? (
                <div className="library-list">
                  {filteredLibrarySubtrees.map(([subtreeId, treeData]) => {
                    const inputPorts = (treeData.ports || []).filter(p => p.direction === 'input');
                    const outputPorts = (treeData.ports || []).filter(p => p.direction === 'output');
                    
                    return (
                      <div
                        key={subtreeId}
                        className={`library-item ${state.subtrees.has(subtreeId) ? 'in-file' : ''}`}
                        draggable
                        onDragStart={(e) => handleLibrarySubtreeDragStart(e, subtreeId)}
                        onClick={() => handleLibrarySubtreeClick(subtreeId)}
                      >
                        <GitBranch size={16} className="library-item-icon" />
                        <div className="library-item-info">
                          <span className="library-item-name">{subtreeId}</span>
                          {treeData.description && (
                            <span className="library-item-description" title={treeData.description}>
                              {treeData.description}
                            </span>
                          )}
                          {(inputPorts.length > 0 || outputPorts.length > 0) && (
                            <div className="library-item-ports">
                              {inputPorts.map((port, i) => (
                                <span key={`in-${i}`} className="port-tag input" title={`Input: ${port.name} (${port.type})${port.required ? ' - required' : ''}`}>
                                  <span className="port-dir">{'\u2192'}</span>
                                  <span className="port-name">{port.name}</span>
                                  <span className="port-type">{port.type.charAt(0)}</span>
                                  {port.required && <span className="port-req">*</span>}
                                </span>
                              ))}
                              {outputPorts.map((port, i) => (
                                <span key={`out-${i}`} className="port-tag output" title={`Output: ${port.name} (${port.type})${port.required ? ' - required' : ''}`}>
                                  <span className="port-dir">{'\u2190'}</span>
                                  <span className="port-name">{port.name}</span>
                                  <span className="port-type">{port.type.charAt(0)}</span>
                                  {port.required && <span className="port-req">*</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {state.subtrees.has(subtreeId) && (
                          <span className="in-file-badge">In File</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-library">
                  {searchTerm ? 'No matching subtrees' : 'No subtrees in library'}
                </div>
              )}
            </>
          ) : (
            <div className="no-workspace">
              <FolderOpen size={32} className="no-workspace-icon" />
              <p>No workspace open</p>
              <p className="hint">Open a workspace folder to access the subtree library</p>
            </div>
          )}
        </div>
      )}
      
      <NewSubtreeModal
        isOpen={showNewSubtreeModal}
        onClose={() => setShowNewSubtreeModal(false)}
        onCreate={createNewSubtree}
      />
      
      <ImportTreeModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        workspaceFiles={state.workspaceFiles}
        onImport={importTreeAsSubtree}
      />
    </div>
  );
};

export default NodePalette;
