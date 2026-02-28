/**
 * TreeEditor Component
 *
 * The main canvas for editing behavior trees. Wraps ReactFlow and wires up:
 * - Node drag-and-drop from the palette (via `application/reactflow` payload)
 * - Connection validation (single-incoming, control vs. non-control outgoing limits)
 * - Undo/redo history (snapshot-based, with `isTimeTravelRef` guard)
 * - Session persistence through `sessionStorage`
 * - Bi-directional sync between local ReactFlow state and the workspace store
 * - DeclareVariable node lifecycle (add/delete/update driven by VariableEditor callbacks)
 * - Keyboard shortcuts (Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo, Ctrl/Cmd+S save)
 * - Electron menu event integration (save, export)
 *
 * Data flow:
 *   Palette  -->  onDrop  -->  setNodes  --sync-->  workspaceStore
 *   workspaceStore.activeTree  --load-->  setNodes/setEdges
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  ConnectionMode,
  Panel,
  type NodeChange,
  type ReactFlowInstance,
  SelectionMode,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BoxSelect, Copy, ClipboardPaste, Trash2 } from 'lucide-react';
import { AppNode, AppEdge, BTNodeDefinition, NodeField, Variable } from '../types';
import { getCategoryColor, nodeLibrary } from '../data/nodeLibrary';
import { exportToXML, exportMultiTreeToXML } from '../utils/xmlSerializer';
import {
  getContainedEdges,
  buildPastedNodes,
  remapEdges,
  getDeleteableNodeIds,
  ClipboardData,
} from '../utils/selectionHelpers';
import { useWorkspace } from '../store/workspaceStore';
import { useWorkspaceOps } from '../hooks/useWorkspaceOps';
import BTNode from './BTNode';
import NodePropertiesPanel from './NodePropertiesPanel';
import './TreeEditor.css';

/** Module-level clipboard so it persists across subtree tab switches. */
let canvasClipboard: ClipboardData | null = null;

interface TreeEditorProps {
  variables: Variable[];
  onUpdateNodeField: (nodeId: string, fieldName: string, value: string | number | boolean, valueType: 'literal' | 'variable') => void;
  onAddDeclareVariableNode: (callback: (variable: Variable) => void) => void;
  onDeleteDeclareVariableNode: (callback: (variableName: string) => void) => void;
  onUpdateDeclareVariableNode: (callback: (variableName: string, newValue: string) => void) => void;
  onSyncVariables: (variables: Variable[]) => void;
  tabId: string;
}

const nodeTypes = {
  btNode: BTNode,
};



const TreeEditor: React.FC<TreeEditorProps> = ({ 
  variables, 
  onUpdateNodeField, 
  onAddDeclareVariableNode,
  onDeleteDeclareVariableNode,
  onUpdateDeclareVariableNode,
  onSyncVariables,
  tabId 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<AppNode, AppEdge> | null>(null);
  const [lastImportedFile, setLastImportedFile] = useState<string>('behavior_tree.xml');
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  // Box-select mode
  const [boxSelectMode, setBoxSelectMode] = useState(false);
  const selectedNodesRef = useRef<AppNode[]>([]);
  const selectedEdgesRef = useRef<AppEdge[]>([]);

  // Workspace integration
  const { state: workspaceState, dispatch: workspaceDispatch, activeTree } = useWorkspace();
  const { saveWorkspace, isElectron } = useWorkspaceOps();
  const isLoadingFromWorkspaceRef = useRef(false);

  /**
   * Determine the display color for a node definition.
   * Subtree nodes use their custom color (from library/file) if available,
   * otherwise fall back to the category default.
   */
  const getSubtreeColor = useCallback((nodeDef: BTNodeDefinition): string => {
    if (nodeDef.category === 'subtree' && nodeDef.subtreeId) {
      const libColor = workspaceState.librarySubtrees.get(nodeDef.subtreeId)?.color;
      if (libColor) return libColor;
      const fileColor = workspaceState.subtrees.get(nodeDef.subtreeId)?.color;
      if (fileColor) return fileColor;
    }
    return getCategoryColor(nodeDef.category);
  }, [workspaceState.librarySubtrees, workspaceState.subtrees]);

  // Initialize with root node on first load
  const hasInitializedRef = useRef(false);

  // Set up callbacks for adding/deleting DeclareVariable nodes
  useEffect(() => {
    onAddDeclareVariableNode((variable: Variable) => {
      // Create a DeclareVariable node
      const declareNodeDef = nodeLibrary.find(n => n.type === 'DeclareVariable');
      if (!declareNodeDef) return;

      const newNode: AppNode = {
        id: `DeclareVariable_${variable.name}_${Date.now()}`,
        type: 'btNode',
        position: { x: 100 + nodes.length * 20, y: 150 + nodes.length * 20 }, // Offset position
        data: {
          ...declareNodeDef,
          instanceId: `DeclareVariable_${variable.name}_${Date.now()}`,
          color: getCategoryColor(declareNodeDef.category),
          fields: [
            {
              name: 'output_key',
              type: 'string',
              valueType: 'literal',
              value: `{${variable.name}}`,
              description: 'Variable name'
            },
            {
              name: 'value',
              type: 'string',
              valueType: 'literal',
              value: variable.value,
              description: 'Initial value'
            }
          ]
        },
      };

      setNodes((nds) => nds.concat(newNode));
    });

    onDeleteDeclareVariableNode((variableName: string) => {
      // Remove DeclareVariable nodes for this variable
      setNodes((prevNodes) => 
        prevNodes.filter((node) => {
          if (node.data?.type === 'DeclareVariable') {
            const outputKeyField = node.data.fields?.find((f: NodeField) => f.name === 'output_key');
            // Strip brackets for comparison
            const fieldValue = String(outputKeyField?.value || '').replace(/^\{|\}$/g, '');
            return fieldValue !== variableName;
          }
          return true;
        })
      );
    });

    onUpdateDeclareVariableNode((variableName: string, newValue: string) => {
      // Update the value field of the DeclareVariable node
      setNodes((prevNodes) => 
        prevNodes.map((node) => {
          if (node.data?.type === 'DeclareVariable') {
            const outputKeyField = node.data.fields?.find((f: NodeField) => f.name === 'output_key');
            // Strip brackets for comparison
            const fieldValue = String(outputKeyField?.value || '').replace(/^\{|\}$/g, '');
            if (fieldValue === variableName) {
              const updatedFields = node.data.fields?.map((f: NodeField) => {
                if (f.name === 'value') {
                  return { ...f, value: newValue };
                }
                return f;
              });
              return {
                ...node,
                data: {
                  ...node.data,
                  fields: updatedFields
                }
              };
            }
          }
          return node;
        })
      );
    });
  }, [onAddDeclareVariableNode, onDeleteDeclareVariableNode, onUpdateDeclareVariableNode, setNodes, nodes.length]);

  // Sync variables from DeclareVariable nodes whenever nodes change
  useEffect(() => {
    const declareVariables: Variable[] = [];
    
    nodes.forEach((node) => {
      if (node.data?.type === 'DeclareVariable') {
        const outputKeyField = node.data.fields?.find((f: NodeField) => f.name === 'output_key');
        const valueField = node.data.fields?.find((f: NodeField) => f.name === 'value');
        
        if (outputKeyField && valueField) {
                    // Strip brackets from output_key for variable name
                    const variableName = String(outputKeyField.value).replace(/^\{|\}$/g, '');
          declareVariables.push({
            name: variableName,
            value: String(valueField.value)
          });
        }
      }
    });
    
    onSyncVariables(declareVariables);
  }, [nodes, onSyncVariables]);

  // Load persisted tree for this tab
  useEffect(() => {
    const stored = sessionStorage.getItem(`btstudio:tree:${tabId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          nodes: AppNode[];
          edges: AppEdge[];
          lastImportedFile?: string;
        };
        if (parsed.nodes?.length) {
          setNodes(parsed.nodes);
          setEdges(parsed.edges ?? []);
          if (parsed.lastImportedFile) {
            setLastImportedFile(parsed.lastImportedFile);
          }
          hasInitializedRef.current = true;
        }
      } catch {
        // ignore corrupted session data
      }
    }
    setIsSessionChecked(true);
  }, [setNodes, setEdges, tabId]);

  // Load from workspace active tree when it changes
  useEffect(() => {
    if (activeTree && isElectron) {
      isLoadingFromWorkspaceRef.current = true;
      setNodes(activeTree.nodes);
      setEdges(activeTree.edges);
      hasInitializedRef.current = true;
      // Allow state updates to settle before recording history
      setTimeout(() => {
        isLoadingFromWorkspaceRef.current = false;
      }, 100);
    }
  }, [activeTree, setNodes, setEdges, isElectron]);

  // Sync local state changes to workspace store
  useEffect(() => {
    if (isLoadingFromWorkspaceRef.current || !workspaceState.mainTree) return;
    
    // Only update workspace if we have nodes and the change originated locally
    if (nodes.length > 0 && hasInitializedRef.current && isElectron) {
      workspaceDispatch({
        type: 'UPDATE_TREE',
        treeId: workspaceState.activeTreeId,
        nodes,
        edges,
        variables,
      });
    }
  }, [nodes, edges, variables, workspaceState.activeTreeId, workspaceState.mainTree, workspaceDispatch, isElectron]);

  useEffect(() => {
    if (!isSessionChecked) return;
    // Only add root node if tree is empty and not yet initialized
    if (!hasInitializedRef.current && nodes.length === 0) {
      const rootNodeDef = nodeLibrary.find(n => n.category === 'root');
      if (rootNodeDef) {
        const rootNode: AppNode = {
          id: 'root_node',
          type: 'btNode',
          position: { x: 250, y: 50 },
          data: {
            ...rootNodeDef,
            instanceId: 'root_node',
            color: getCategoryColor(rootNodeDef.category),
          },
        };
        setNodes([rootNode]);
        hasInitializedRef.current = true;
      }
    }
  }, [isSessionChecked, nodes.length, setNodes]);

  // Undo/Redo history
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_historyPast, setHistoryPast] = useState<{ nodes: AppNode[]; edges: AppEdge[] }[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_historyFuture, setHistoryFuture] = useState<{ nodes: AppNode[]; edges: AppEdge[] }[]>([]);
  const isTimeTravelRef = useRef(false);
  const isDraggingRef = useRef(false);
  const nodesRef = useRef<AppNode[]>(nodes);
  const edgesRef = useRef<AppEdge[]>(edges);
  const prevSnapshotRef = useRef<{ nodes: AppNode[]; edges: AppEdge[] }>({ nodes, edges });
  const HISTORY_LIMIT = 20;

  // keep refs updated
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  // Persist tree per tab on change
  useEffect(() => {
    sessionStorage.setItem(
      `btstudio:tree:${tabId}`,
      JSON.stringify({ nodes, edges, lastImportedFile })
    );
  }, [nodes, edges, lastImportedFile, tabId]);

  // record history on change (unless caused by undo/redo)
  useEffect(() => {
    if (isTimeTravelRef.current || isDraggingRef.current) {
      prevSnapshotRef.current = { nodes, edges };
      return;
    }

    setHistoryPast((past) => {
      const next = [...past, prevSnapshotRef.current].slice(-HISTORY_LIMIT);
      return next;
    });
    setHistoryFuture([]); // clear redo stack on new user change
    prevSnapshotRef.current = { nodes, edges };
  }, [nodes, edges]);

    // Custom nodes change handler to detect drag start/end
  const handleNodesChange = useCallback(
    (changes: NodeChange<AppNode>[]) => {
      // Check if any change is a drag start
      const hasDragStart = changes.some((change) => change.type === 'position' && change.dragging === true);
      // Check if any change is a drag end
      const hasDragEnd = changes.some((change) => change.type === 'position' && change.dragging === false);

      if (hasDragStart) {
        isDraggingRef.current = true;
      }
      
      if (hasDragEnd) {
        isDraggingRef.current = false;
      }

      // Pass changes through to reactflow
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const undo = useCallback(() => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];

      // push current state to future
      setHistoryFuture((f) => [...f, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-HISTORY_LIMIT));

      // apply previous snapshot
      isTimeTravelRef.current = true;
      setNodes(previous.nodes);
      setEdges(previous.edges);
      // allow history recording to resume after React updates
      setTimeout(() => { isTimeTravelRef.current = false; }, 0);

      return past.slice(0, -1);
    });
  }, [setNodes, setEdges]);

  const redo = useCallback(() => {
    setHistoryFuture((future) => {
      if (future.length === 0) return future;
      const next = future[future.length - 1];

      // push current state to past
      setHistoryPast((p) => [...p, { nodes: nodesRef.current, edges: edgesRef.current }].slice(-HISTORY_LIMIT));

      // apply next snapshot
      isTimeTravelRef.current = true;
      setNodes(next.nodes);
      setEdges(next.edges);
      setTimeout(() => { isTimeTravelRef.current = false; }, 0);

      return future.slice(0, -1);
    });
  }, [setNodes, setEdges]);

  // keyboard shortcuts for undo and redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // ─── Selection tracking (for box-select copy/paste/delete) ────────────
  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams<AppNode, AppEdge>) => {
    selectedNodesRef.current = selNodes;
    selectedEdgesRef.current = selEdges;
  }, []);

  /** Copy selected nodes and their contained edges to the clipboard. */
  const copySelection = useCallback(() => {
    const selNodes = selectedNodesRef.current;
    if (selNodes.length === 0) return;

    const selectedIds = new Set(selNodes.map(n => n.id));
    const contained = getContainedEdges(selectedIds, edges);

    canvasClipboard = {
      nodes: JSON.parse(JSON.stringify(selNodes)),
      edges: JSON.parse(JSON.stringify(contained)),
    };
  }, [edges]);

  /** Paste nodes from the clipboard, offsetting positions. */
  const pasteSelection = useCallback(() => {
    if (!canvasClipboard || canvasClipboard.nodes.length === 0) return;

    const { nodes: pastedNodes, idMap } = buildPastedNodes(canvasClipboard.nodes, Date.now());
    const pastedEdges = remapEdges(canvasClipboard.edges, idMap);

    // Deselect existing nodes before adding pasted ones
    setNodes(nds => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...pastedNodes,
    ]);
    setEdges(eds => [...eds, ...pastedEdges]);
  }, [setNodes, setEdges]);

  /** Delete selected nodes and their contained edges. */
  const deleteSelection = useCallback(() => {
    const selNodes = selectedNodesRef.current;
    if (selNodes.length === 0) return;

    const toDelete = getDeleteableNodeIds(new Set(selNodes.map(n => n.id)));
    if (toDelete.size === 0) return;

    // Remove selected nodes
    setNodes(nds => nds.filter(n => !toDelete.has(n.id)));
    // Remove edges where either endpoint was deleted
    setEdges(eds => eds.filter(e => !toDelete.has(e.source) && !toDelete.has(e.target)));
  }, [setNodes, setEdges]);

  /** Toggle box-select mode on/off. */
  const toggleBoxSelect = useCallback(() => {
    setBoxSelectMode(prev => !prev);
  }, []);

  // Keyboard shortcuts for copy/paste/delete and box-select toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;

      // Shift+B: toggle box-select mode
      if (e.key.toLowerCase() === 'b' && isMod) {
        e.preventDefault();
        toggleBoxSelect();
        return;
      }

      // Copy: Ctrl/Cmd+C (only when nodes are selected)
      if (isMod && e.key.toLowerCase() === 'c' && selectedNodesRef.current.length > 0) {
        e.preventDefault();
        copySelection();
        return;
      }

      // Paste: Ctrl/Cmd+V
      if (isMod && e.key.toLowerCase() === 'v' && canvasClipboard) {
        e.preventDefault();
        pasteSelection();
        return;
      }

      // Delete/Backspace: delete selected nodes
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodesRef.current.length > 0) {
        // Don't intercept if the user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        e.preventDefault();
        deleteSelection();
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleBoxSelect, copySelection, pasteSelection, deleteSelection]);

  // Activate box-select mode while Shift is held
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setBoxSelectMode(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setBoxSelectMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);


  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        if (!params.target || !params.source) return eds;

        // Reject if target already has an incoming connection
        const incoming = eds.filter((e) => e.target === params.target);
        if (incoming.length >= 1) {
          return eds;
        }

        // Find the source node and check its category
        const sourceNode = nodes.find((n) => n.id === params.source);
        const isControl = sourceNode?.data?.category === 'control';

        // If source is NOT a control node, allow only one outgoing connection
        if (!isControl) {
          const outgoing = eds.filter((e) => e.source === params.source);
          if (outgoing.length >= 1) {
            // reject additional outgoing connection for non-control nodes
            return eds;
          }
        }

        return addEdge(params, eds);
      });
    },
    [setEdges, nodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData('application/reactflow');
      if (!data) return;

      const nodeDef: BTNodeDefinition & { _isFromLibrary?: boolean } = JSON.parse(data);
      
      // Prevent adding more than one root node
      if (nodeDef.category === 'root') {
        const hasRoot = nodes.some(n => n.data?.category === 'root');
        if (hasRoot) {
          alert('Only one root node is allowed per tree');
          return;
        }
      }
      
      // If this is a library subtree, add it to the current file's subtrees
      if (nodeDef._isFromLibrary && nodeDef.subtreeId && isElectron) {
        if (!workspaceState.subtrees.has(nodeDef.subtreeId)) {
          workspaceDispatch({ type: 'ADD_SUBTREE_FROM_LIBRARY', subtreeId: nodeDef.subtreeId });
        }
      }
      
      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }) ?? { x: event.clientX, y: event.clientY };

      // Clean up internal flags before creating node
      const { _isFromLibrary, ...cleanNodeDef } = nodeDef;
      
      // For subtree nodes, create fields from ports
      let nodeFields = cleanNodeDef.fields || [];
      if (cleanNodeDef.category === 'subtree' && cleanNodeDef.ports && cleanNodeDef.ports.length > 0) {
        nodeFields = cleanNodeDef.ports.map(port => ({
          name: port.name,
          type: port.type || 'string',
          valueType: 'literal' as const,
          value: port.defaultValue || '',
          description: port.description || `${port.direction === 'input' ? 'Input' : 'Output'} port`,
          portDirection: port.direction === 'input' ? 'input' : 'output',
        }));
      }
      
      const newNode: AppNode = {
        id: `${cleanNodeDef.type}_${Date.now()}`,
        type: 'btNode',
        position,
        data: {
          ...cleanNodeDef,
          fields: nodeFields,
          instanceId: `${cleanNodeDef.type}_${Date.now()}`,
          color: getSubtreeColor(cleanNodeDef),
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, nodes, isElectron, workspaceState.subtrees, workspaceDispatch]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: AppNode) => {
    setSelectedNode(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNodeField = useCallback(
    (nodeId: string, fieldName: string, value: string | number | boolean, valueType: 'literal' | 'variable') => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id !== nodeId) return node;

          const existingFields: NodeField[] = (node.data && node.data.fields) ? [...node.data.fields] : [];

          let found = false;
          const updatedFields = existingFields.map((f: NodeField) => {
            if (f.name === fieldName) {
              found = true;
              return { ...f, value, valueType };
            }
            return f;
          });

          if (!found) {
            updatedFields.push({ name: fieldName, type: 'string', value, valueType });
          }

          return {
            ...node,
            data: {
              ...node.data,
              fields: updatedFields,
            },
          };
        })
      );

      // forward to external handler if provided
      if (onUpdateNodeField) {
        onUpdateNodeField(nodeId, fieldName, value, valueType);
      }
    },
    [setNodes, onUpdateNodeField]
  );

  // Update node name
  const handleUpdateNodeName = useCallback(
    (nodeId: string, nodeName: string) => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          if (node.id !== nodeId) return node;
          return {
            ...node,
            data: {
              ...node.data,
              nodeName: nodeName || undefined, // Clear if empty
            },
          };
        })
      );
    },
    [setNodes]
  );

  // Export tree to XML with file picker (shows save dialog in Electron and writes a copy — does NOT open the file)
  const handleExport = useCallback(async () => {
    try {
      // Prefer multi-tree export when editing a workspace-backed file
      const xml = (isElectron && workspaceState.mainTree)
        ? exportMultiTreeToXML(workspaceState.mainTree, workspaceState.subtrees)
        : exportToXML(nodes, edges, variables);

      // Electron: show native save dialog and write the file (export = copy, do NOT change active file)
      if (isElectron && window.electronAPI) {
        const defaultPath = workspaceState.workspacePath
          ? `${workspaceState.workspacePath}/${workspaceState.activeFileName}`
          : workspaceState.activeFileName || lastImportedFile;

        const filePath = await window.electronAPI.saveFile({
          title: 'Export Tree File',
          defaultPath,
        });

        if (!filePath) return; // user cancelled

        await window.electronAPI.writeFile(filePath, xml);
        return;
      }

      // Web: use File System Access API when available, otherwise fall back to download
      if ('showSaveFilePicker' in window) {
        const options = {
          suggestedName: lastImportedFile,
          types: [{ description: 'BehaviorTree XML', accept: { 'text/xml': ['.xml'] } }]
        };

        const handle = await (window as any).showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(xml);
        await writable.close();
        return;
      }

      // Fallback: trigger browser download
      fallbackDownload(xml, lastImportedFile);
    } catch (error) {
      console.error('Export failed:', error);
      if (isElectron && window.electronAPI) {
        await window.electronAPI.showWarning({
          title: 'Export Failed',
          message: 'Failed to export tree',
          detail: error instanceof Error ? error.message : String(error),
        });
      } else {
        alert('Failed to export tree: ' + (error instanceof Error ? error.message : String(error)));
      }
    }
  }, [nodes, edges, variables, lastImportedFile, isElectron, workspaceState]);

  // Handle workspace save (Ctrl+S)
  const handleSave = useCallback(async () => {
    if (isElectron) {
      await saveWorkspace();
    } else {
      await handleExport();
    }
  }, [isElectron, saveWorkspace, handleExport]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Listen for menu save/export events from Electron
  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.electronAPI.onMenuSave(() => {
        handleSave();
      })
    );

    cleanups.push(
      window.electronAPI.onMenuExport(() => {
        handleExport();
      })
    );

    return () => cleanups.forEach(c => c());
  }, [isElectron, handleSave, handleExport]);

  // Fallback download method
  const fallbackDownload = (xml: string, filename: string) => {
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="tree-editor">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        selectionOnDrag={boxSelectMode}
        selectionMode={SelectionMode.Partial}
        panOnDrag={!boxSelectMode}
        onSelectionChange={onSelectionChange}
        fitView
      >
        <Background />
        <Controls />

        {/* Box-select toolbar */}
        <Panel position="top-right" className="box-select-panel">
          <button
            className={`box-select-btn ${boxSelectMode ? 'active' : ''}`}
            onClick={toggleBoxSelect}
            title="Toggle box select (hold Shift or Ctrl/Cmd+B)"
          >
            <BoxSelect size={16} />
          </button>
          <button
            className="box-select-action-btn"
            onClick={copySelection}
            title="Copy selection (Ctrl/Cmd+C)"
            disabled={selectedNodesRef.current.length === 0}
          >
            <Copy size={14} />
          </button>
          <button
            className="box-select-action-btn"
            onClick={pasteSelection}
            title="Paste (Ctrl/Cmd+V)"
            disabled={!canvasClipboard}
          >
            <ClipboardPaste size={14} />
          </button>
          <button
            className="box-select-action-btn danger"
            onClick={deleteSelection}
            title="Delete selection (Delete/Backspace)"
            disabled={selectedNodesRef.current.length === 0}
          >
            <Trash2 size={14} />
          </button>
        </Panel>

        {/* Show current tree indicator when in Electron */}
        {isElectron && workspaceState.activeTreeId !== null && (
          <Panel position="top-center" className="tree-indicator-panel">
            <span className="editing-subtree-label">
              Editing Subtree: <strong>{workspaceState.activeTreeId}</strong>
            </span>
          </Panel>
        )}
      </ReactFlow>

      {selectedNode && selectedNodeData && (
        <NodePropertiesPanel
          node={selectedNodeData}
          variables={variables}
          onUpdateField={handleUpdateNodeField}
          onUpdateName={handleUpdateNodeName}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

export default TreeEditor;
