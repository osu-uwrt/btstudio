# BehaviorTree Studio - Project Documentation

This document describes the architecture, data flow, and implementation details for developers.

## Repository structure

```
BTstudio/
├── electron/                 # Electron main process and preload
│   ├── main.js
│   └── preload.js
├── public/
│   └── index.html
├── src/
│   ├── components/           # UI components
│   │   ├── BTNode.tsx
│   │   ├── NodePalette.tsx
│   │   ├── NodePropertiesPanel.tsx
│   │   ├── SubTreeTabBar.tsx
│   │   ├── TreeEditor.tsx
│   │   └── VariableEditor.tsx
│   ├── data/
│   │   └── nodeLibrary.ts     # Built-in node definitions
│   ├── hooks/
│   │   └── useWorkspaceOps.ts # Workspace workflows
│   ├── store/
│   │   └── workspaceStore.tsx # Workspace state and reducer
│   ├── types/
│   │   └── index.ts           # Shared types
│   ├── utils/
│   │   └── xmlSerializer.ts   # XML import/export
│   ├── App.tsx
│   └── index.tsx
├── package.json
└── tsconfig.json
```

## Runtime model

The app runs as an Electron shell hosting a React UI. The renderer communicates with the main process through a limited `electronAPI` exposed by the preload script.

### Electron main and preload

- `electron/main.js` creates the window, defines menus, and handles file I/O via IPC.
- `electron/preload.js` exposes `window.electronAPI` with file system and dialog methods.

The renderer never touches Node APIs directly; it calls the preload methods instead.

### IPC surface

The renderer relies on these capabilities:

- Open/save dialogs for files and folders
- Read/write file contents
- File existence checks and modification times
- Menu actions for open/save/export/new tree

These are implemented in `electron/main.js` and exposed by `electron/preload.js`.

## Data model

### TreeData
`TreeData` is the core shape used for main trees and subtrees:

- `id`: tree ID
- `nodes`, `edges`: ReactFlow data
- `variables`: array of local variables
- `description`: optional subtree description (stored as XML comment)
- `ports`: array of input/output port definitions for subtrees

The main tree is exported using the ID `main_tree_to_execute`.

### SubTree Ports

Subtrees use input/output ports to pass data without sharing the blackboard:

- Ports are defined in `SubTreePort` with `direction`, `type`, `defaultValue`, `required`
- Stored in XML under `<TreeNodesModel><SubTree ID="...">` with `<input_port>` and `<output_port>` elements
- When a subtree node is dropped, ports become editable fields on the node
- Required ports are marked with `required="true"` in XML

### Node fields

Fields are modeled by `NodeField` in [src/types/index.ts](src/types/index.ts). Each field stores:

- `type`: string, number, or boolean
- `valueType`: `literal` or `variable`
- `value`: raw value or a `{var}` reference

Node rendering and editing uses this contract in:

- [src/components/BTNode.tsx](src/components/BTNode.tsx)
- [src/components/NodePropertiesPanel.tsx](src/components/NodePropertiesPanel.tsx)

## State and workflows

### Workspace store

`workspaceStore.tsx` holds:

- Workspace folder and file list
- Active file path/name
- Main tree and subtrees
- Library subtrees and modified subtree tracking
- Dirty state and external file modified times

### Workspace operations

`useWorkspaceOps.ts` provides high-level actions:

- `openWorkspace()` loads the folder and `subtree_library.xml`
- `openTreeFile()` loads a multi-tree XML file and reconciles with the library
- `saveWorkspace()` saves the active file, updates the library, and updates other files in the workspace that reference the same subtrees
- `createNewTree()` creates a new file with the main tree ID set to `main_tree_to_execute`

### Save pipeline

The save operation performs three steps:

1. Write the active file with all embedded subtrees.
2. Update `subtree_library.xml` with all subtrees from the active file.
3. Update any other workspace files that reference those subtrees.

## XML import/export

`xmlSerializer.ts` implements BehaviorTree.cpp v4 handling:

- Multi-tree export uses `<root main_tree_to_execute="TreeId">` attribute to identify main tree
- Tree IDs are derived from filenames, not hardcoded to `main_tree_to_execute`
- Subtree descriptions are stored as XML comments preceding the `<BehaviorTree>` element (invisible to BT server)
- Port definitions are stored in `<TreeNodesModel>` with `<input_port>` and `<output_port>` elements
- Port definitions are persisted in both library and individual tree files
- Variables are derived from `SetBlackboard` nodes during import

Export functions:

- `exportMultiTreeToXML(mainTree, subtrees)`
- `exportSubtreeLibraryToXML(subtrees)`

Import functions:

- `importMultiTreeFromXML(xml)`
- `importSubtreeLibraryFromXML(xml)`

## UI components

### TreeEditor

[src/components/TreeEditor.tsx](src/components/TreeEditor.tsx) is the main canvas:

- Uses ReactFlow `useNodesState` / `useEdgesState`
- Enforces connection rules (single incoming edge, non-control nodes limited to one outgoing edge)
- Syncs active tree data to the workspace store
- Handles save via menu and Cmd+S/Ctrl+S
- Records history in `historyPast` / `historyFuture` for undo/redo

### NodePalette

[src/components/NodePalette.tsx](src/components/NodePalette.tsx) provides two modes:

- Nodes: built-in definitions from `nodeLibrary.ts`
- Library: dynamically loaded subtrees from `subtree_library.xml`

Dragging a library subtree into a tree inserts a `SubTree` node and ensures the subtree is present in the current file.

### SubTreeTabBar

[src/components/SubTreeTabBar.tsx](src/components/SubTreeTabBar.tsx) switches between main and subtrees and shows dirty indicators for modified trees.

### VariableEditor

[src/components/VariableEditor.tsx](src/components/VariableEditor.tsx) manages the local variable list for the active tree. Variables are serialized as `{varName}` in node fields.

## Build and scripts

Scripts in [package.json](package.json):

- `npm start` runs the React dev server (opens at http://localhost:3000)
- `npm run electron:dev` runs the Electron shell with the dev server
- `npm run build` builds production assets to build/ directory
- `npx serve -s build` serves the production build locally

There are no automated tests in the repository.

## Developer quick reference

### Adding a new SubTree

**Location:** [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts)

**Template:**
```typescript
{
  id: 'unique_id',
  type: 'NodeTypeName',
  category: 'subtree',
  name: 'Display Name',
  description: 'What this subtree does',
  subtreeId: 'ActualBehaviorTreeID', // Must match ID in XML
  ports: [
    { 
      name: 'input_param', 
      direction: 'input',  // 'input' | 'output'
      type: 'string',      // 'string' | 'number' | 'boolean'
      defaultValue: '',
      required: true,
      description: 'Parameter description' 
    },
    { 
      name: 'output_result', 
      direction: 'output',
      type: 'string',
      required: false,
      description: 'Output value' 
    },
  ],
  fields: [] // Fields are auto-generated from ports when dropped
}
```

### Modifying XML export format

**Location:** [src/utils/xmlSerializer.ts](src/utils/xmlSerializer.ts)

**Function to modify:** `serializeNodeRecursive()`

**Example - Add custom attribute:**
```typescript
// In serializeNodeRecursive(), find the attributes section:
const attributes: string[] = [];

// Add your custom attribute
if (data?.customField) {
  attributes.push(`customAttr="${data.customField}"`);
}

// Rest of the function...
```

### Modifying XML import format

**Location:** [src/utils/xmlSerializer.ts](src/utils/xmlSerializer.ts)

**Function to modify:** `parseNodeRecursive()`

**Example - Parse custom attribute:**
```typescript
// In parseNodeRecursive(), after creating the node:
const customValue = element.getAttribute('customAttr');
if (customValue) {
  // Add to node data
  node.data.customField = customValue;
}
```

### Adding a new node type

**1. Add to nodeLibrary** ([src/data/nodeLibrary.ts](src/data/nodeLibrary.ts)):
```typescript
{
  id: 'my_action',
  type: 'MyCustomAction',
  category: 'action', // or 'condition', 'control', 'decorator'
  name: 'My Custom Action',
  description: 'Does something custom',
  fields: [
    {
      name: 'parameter1',
      type: 'string',
      valueType: 'literal',
      value: 'default',
      description: 'First parameter'
    }
  ]
}
```

**2. (Optional) Create custom component**:
```typescript
// src/components/MyCustomNode.tsx
import React from 'react';
import { Handle, Position } from 'reactflow';

const MyCustomNode = ({ data }) => {
  return (
    <div style={{ background: data.color }}>
      <Handle type="target" position={Position.Top} />
      <div>{data.name}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default MyCustomNode;
```

**3. Register in TreeEditor** ([src/components/TreeEditor.tsx](src/components/TreeEditor.tsx)):
```typescript
import MyCustomNode from './MyCustomNode';

const nodeTypes = {
  btNode: BTNode,
  myCustom: MyCustomNode, // Add here
};

// In onDrop, conditionally use your type:
const newNode: Node = {
  id: `${nodeDef.type}_${Date.now()}`,
  type: nodeDef.id === 'my_action' ? 'myCustom' : 'btNode',
  // ...rest
};
```

### Variable reference syntax

**In XML:**
- Literal: `value="42"`
- Variable: `value="{myVariable}"`

**In Code:**
```typescript
// Check if value is a variable reference
const varMatch = value.match(/^\{(.+)\}$/);
if (varMatch) {
  const variableName = varMatch[1];
  // This is a variable reference
}
```

### Color scheme

**Function:** `getCategoryColor()` in [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts)

| Category | Color | Hex |
|----------|-------|-----|
| Root | Red | #F44336 |
| Action | Green | #4CAF50 |
| Condition | Blue | #2196F3 |
| Control | Orange | #FF9800 |
| Decorator | Purple | #9C27B0 |
| SubTree | Cyan | #00BCD4 |

### Connection rules

**Location:** [src/components/TreeEditor.tsx](src/components/TreeEditor.tsx) - `onConnect` callback

**Current Rules:**
- Max 1 incoming edge per node (except root)
- Control nodes: unlimited outgoing edges
- Other nodes: max 1 outgoing edge

**Modify:**
```typescript
const onConnect = useCallback((params: Connection) => {
  setEdges((eds) => {
    // Your custom validation logic here
    
    return addEdge(params, eds);
  });
}, [setEdges, nodes]);
```

### Undo/Redo implementation

**Location:** [src/components/TreeEditor.tsx](src/components/TreeEditor.tsx)

**Key Components:**
- `historyPast` - Stack of previous states
- `historyFuture` - Stack for redo
- `isTimeTravelRef` - Prevents recording during undo/redo
- `isDraggingRef` - Prevents recording during drag


### Import/Export hooks

**Export Hook:**
```typescript
// In TreeEditor.tsx
const handleExport = useCallback(() => {
  const xml = exportToXML(nodes, edges, variables);
  // Modify xml here if needed
  // ... download logic
}, [nodes, edges, variables]);
```

**Import Hook:**
```typescript
// In TreeEditor.tsx
const handleImport = useCallback(() => {
  // ... file selection
  const { nodes, edges } = importFromXML(xmlString);
  // Modify nodes/edges here if needed
  setNodes(nodes);
  setEdges(edges);
}, []);
```

### Common tasks

**Reset tree to root only:**
Delete all nodes except root, or import an empty XML:
```xml
<?xml version="1.0"?>
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
  </BehaviorTree>
</root>
```

**Export to different filename:**
Modify `handleExport()`:
```typescript
link.download = 'my_custom_tree.xml';
```

**Add validation before export:**
```typescript
const handleExport = useCallback(() => {
  // Validate tree
  const hasRoot = nodes.some(n => n.data?.category === 'root');
  if (!hasRoot) {
    alert('Tree must have a root node');
    return;
  }
  
  // Proceed with export
  const xml = exportToXML(nodes, edges, variables);
  // ...
}, [nodes, edges, variables]);
```

## Debugging tips

**Console Logging:**
```typescript
// In TreeEditor.tsx
console.log('Current nodes:', nodes);
console.log('Current edges:', edges);
```

**Inspect Node Data:**
```typescript
// In BTNode.tsx
console.log('Node data:', data);
```

**Check XML Output:**
```typescript
// In handleExport
const xml = exportToXML(nodes, edges, variables);
console.log('Generated XML:', xml);
```

**Validate Import:**
```typescript
// In handleImport
const { nodes, edges } = importFromXML(xmlString);
console.log('Imported nodes:', nodes);
console.log('Imported edges:', edges);
```

## Performance considerations

- **Large Trees**: Tree rendering uses ReactFlow which is optimized for performance
- **History Limit**: Currently 20 operations (`HISTORY_LIMIT = 20`)
- **Node Spacing**: Import uses fixed spacing (200px), may need adjustment for large trees

## Security notes

- XML parsing uses browser's `DOMParser` (safe)
- No server-side processing
- All operations are client-side only
- File downloads use Blob URLs (cleaned up after download)

## Release Process

BTstudio uses GitHub Actions for automated builds and releases. The CI pipeline builds platform-specific installers and supports auto-updates through electron-updater.

### Creating a New Release

1. **Update version in package.json**
   ```bash
   npm version patch  # or minor, or major
   ```
   This will update the version number and create a git commit.

2. **Push the version tag**
   ```bash
   git push && git push --tags
   ```
   Pushing a tag starting with `v` (e.g., `v1.1.1`) triggers the GitHub Actions workflow.

3. **Monitor the build**
   - Go to the [Actions tab](https://github.com/AdityaGupta0/BTstudio/actions) on GitHub
   - The workflow builds both macOS (Apple Silicon) and Linux (x86) packages
   - Build artifacts: `.dmg` for macOS, `.AppImage` for Linux

4. **Publish the release**
   - Once the workflow completes, go to [Releases](https://github.com/AdityaGupta0/BTstudio/releases)
   - Find the draft release created by the workflow
   - Edit the release notes as needed (auto-generated notes are provided)
   - Click "Publish release" to make it public


### Platform-Specific Notes

**macOS**
- Builds a `.dmg` universal installer
- Not code-signed (will show "unidentified developer" warning)
- Users must right-click → Open on first launch

**Linux**
- Builds an `.AppImage` for x86-64 architecture
- Users may need to make it executable: `chmod +x BTstudio-*.AppImage`
- No additional dependencies required

### Build Configuration

The build is configured in [package.json](package.json):
- `build.publish`: Points to this GitHub repository for auto-updates
- `build.mac`: Targets Apple Silicon (arm64) DMG
- `build.linux`: Targets x64 AppImage

Auto-update is implemented in [electron/main.js](electron/main.js) using `electron-updater`.
