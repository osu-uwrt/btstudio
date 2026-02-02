/**
 * SubTreeTabBar Component
 * 
 * Displays searchable tabs for navigating between the main tree and subtrees
 * in the current file. Features:
 * - Search/filter input for quick subtree access
 * - Visual indicators for dirty state
 * - Click to switch active tree
 * - Display port information when editing a subtree
 */

import React, { useState, useMemo } from 'react';
import { Search, TreeDeciduous, GitBranch, Circle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useWorkspace } from '../store/workspaceStore';
import './SubTreeTabBar.css';

interface SubTreeTabBarProps {
  onTreeSelect?: (treeId: string | null) => void;
}

export const SubTreeTabBar: React.FC<SubTreeTabBarProps> = ({ onTreeSelect }) => {
  const { state, dispatch, allSubtreeIds } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get active subtree data for port display
  const activeSubtreeData = useMemo(() => {
    if (state.activeTreeId === null) return null;
    return state.subtrees.get(state.activeTreeId) || state.librarySubtrees.get(state.activeTreeId) || null;
  }, [state.activeTreeId, state.subtrees, state.librarySubtrees]);
  
  // Filter subtrees based on search
  const filteredSubtreeIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return allSubtreeIds;
    }
    const term = searchTerm.toLowerCase();
    return allSubtreeIds.filter(id => id.toLowerCase().includes(term));
  }, [allSubtreeIds, searchTerm]);
  
  // Check if main tree matches search
  const mainTreeVisible = useMemo(() => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const mainTreeName = state.mainTree?.id || 'MainTree';
    return mainTreeName.toLowerCase().includes(term) || 'main'.includes(term);
  }, [searchTerm, state.mainTree]);
  
  const handleTabClick = (treeId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_TREE', treeId });
    onTreeSelect?.(treeId);
  };
  
  const isSubtreeModified = (subtreeId: string) => {
    return state.modifiedSubtreeIds.has(subtreeId);
  };
  
  // Don't render if no trees loaded
  if (!state.mainTree) {
    return null;
  }
  
  const hasSubtrees = allSubtreeIds.length > 0;
  const inputPorts = activeSubtreeData?.ports?.filter(p => p.direction === 'input') || [];
  const outputPorts = activeSubtreeData?.ports?.filter(p => p.direction === 'output') || [];
  
  return (
    <div className="subtree-tab-bar-container">
      <div className="subtree-tab-bar">
        {/* Search input - only show if there are subtrees */}
        {hasSubtrees && (
          <div className="tab-search">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search trees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="tab-search-input"
            />
          </div>
        )}
        
        {/* Tab container */}
        <div className="tabs-container">
          {/* Main tree tab - always first */}
          {mainTreeVisible && (
            <button
              className={`tree-tab ${state.activeTreeId === null ? 'active' : ''}`}
              onClick={() => handleTabClick(null)}
              title={state.mainTree.id || 'MainTree'}
            >
              <TreeDeciduous size={14} className="tab-icon" />
              <span className="tab-label">
                {state.mainTree.id || 'MainTree'}
              </span>
              {state.isDirty && (
                <Circle size={8} className="dirty-indicator" fill="currentColor" />
              )}
            </button>
          )}
          
          {/* Subtree tabs */}
          {filteredSubtreeIds.map(subtreeId => (
            <button
              key={subtreeId}
              className={`tree-tab subtree-tab ${state.activeTreeId === subtreeId ? 'active' : ''}`}
              onClick={() => handleTabClick(subtreeId)}
              title={subtreeId}
            >
              <GitBranch size={14} className="tab-icon" />
              <span className="tab-label">{subtreeId}</span>
              {isSubtreeModified(subtreeId) && (
                <Circle size={8} className="dirty-indicator" fill="currentColor" />
              )}
            </button>
          ))}
          
          {/* No results message */}
          {searchTerm && !mainTreeVisible && filteredSubtreeIds.length === 0 && (
            <div className="no-results">No matching trees</div>
          )}
        </div>
        
        {/* File info */}
        <div className="file-info">
          <span className="file-name" title={state.activeFilePath || undefined}>
            {state.activeFileName}
            {state.isDirty && ' *'}
          </span>
        </div>
      </div>
      
      {/* Port info panel - shown when editing a subtree with ports */}
      {activeSubtreeData && (inputPorts.length > 0 || outputPorts.length > 0) && (
        <div className="subtree-ports-panel">
          <span className="ports-label">Subtree Ports:</span>
          {inputPorts.length > 0 && (
            <div className="port-group">
              <ArrowDownCircle size={12} className="port-icon input" />
              {inputPorts.map((port, idx) => (
                <span key={idx} className="port-tag input" title={port.description || port.name}>
                  {port.name}
                  {port.required && <span className="required-indicator">*</span>}
                </span>
              ))}
            </div>
          )}
          {outputPorts.length > 0 && (
            <div className="port-group">
              <ArrowUpCircle size={12} className="port-icon output" />
              {outputPorts.map((port, idx) => (
                <span key={idx} className="port-tag output" title={port.description || port.name}>
                  {port.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubTreeTabBar;
