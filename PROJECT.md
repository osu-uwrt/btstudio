# BehaviorTree Studio - Project Documentation

This document describes the architecture, data flow, and implementation details for developers contributing to BehaviorTree Studio. The application is a visual editor for BehaviorTree.cpp v4, built with Electron, React, TypeScript, and ReactFlow.

## Repository structure

```
btstudio/
├── electron/                 # Electron main process and preload
│   ├── main.js              # IPC handlers, menus, file operations
│   └── preload.js           # Exposes window.electronAPI to renderer
├── public/
│   └── index.html           # HTML entry point
├── src/
│   ├── components/          # React UI components
│   │   ├── App.tsx          # Root app component with context setup
│   │   ├── TreeEditor.tsx   # ReactFlow canvas and tree editing logic
│   │   ├── BTNode.tsx       # Node component (rendered in canvas)
│   │   ├── NodePalette.tsx  # Palette with nodes and library subtrees
│   │   ├── NodePropertiesPanel.tsx # Node field editor panel
│   │   ├── SubTreeTabBar.tsx       # Tabs for main tree and subtrees
│   │   ├── VariableEditor.tsx      # Variable list and editor
│   │   ├── WelcomeModal.tsx        # Blocking startup modal
│   │   └── WorkspaceToolbar.tsx    # (Invisible) Electron menu listener
│   ├── data/
│   │   └── nodeLibrary.ts   # Built-in node definitions and colors
│   ├── hooks/
│   │   └── useWorkspaceOps.ts # Workspace operations (open/save/create)
│   ├── store/
│   │   └── workspaceStore.tsx # Redux-like state management
│   ├── types/
│   │   ├── index.ts         # Shared TypeScript types
│   │   └── electron.d.ts    # Electron preload type definitions
│   ├── utils/
│   │   └── xmlSerializer.ts # BehaviorTree.cpp XML parsing and export
│   ├── App.tsx              # Main app wrapper
│   ├── App.css              # App-level styles
│   ├── index.tsx            # React entry point
│   └── index.css            # Global styles
├── build/                   # Production build output (generated)
├── package.json
├── tsconfig.json
├── PROJECT.md               # This file
├── CUSTOMIZATION.md         # Customization and extension guide
└── README.md                # User-facing documentation
```

## Runtime model

The app runs as an Electron shell hosting a React UI. The renderer communicates exclusively with the main process through `window.electronAPI` (exposed by the preload script). No file system operations happen directly in the renderer.

### Electron main and preload

- **`electron/main.js`**: Creates the window, defines app menus (File, Edit, etc.), and implements IPC handlers for file I/O, dialogs, and directory scanning.
- **`electron/preload.js`**: Exposes `window.electronAPI` with file system and dialog methods. This is the only bridge between renderer and Node.

### IPC surface

The renderer uses these capabilities via `window.electronAPI`:

- `openFolder()`, `openFile()` - native file/folder selection dialogs
- `readFile(path)`, `writeFile(path, content)` - file I/O
- `showConfirm()`, `showWarning()`, `showError()` - dialog messages
- `listFiles(path)` - directory scanning
- `getFileStats(path)` - modification times for external change detection
- `onMenuOpenWorkspace()`, `onMenuOpenTree()`, `onMenuNewTree()`, `onMenuExport()` - menu event listeners

Handlers are registered in `electron/main.js` and consumed by components (primarily `WorkspaceToolbar` and `TreeEditor`).

Export Tree (developer notes)

- Flow: menu -> `menu:export` IPC -> `preload.onMenuExport` -> renderer `TreeEditor.handleExport`.
- Electron behavior: `handleExport` shows a native save dialog (`saveFile` IPC) and writes the XML via `writeFile` without changing the active file.
- Code locations: `electron/main.js` (menu), `electron/preload.js` (onMenuExport), `src/components/TreeEditor.tsx` (handleExport + menu listener), `src/hooks/useWorkspaceOps.ts` + `src/utils/xmlSerializer.ts` (`exportMultiTreeToXML` / `exportToXML`).

## Data model

### TreeData

`TreeData` is the core shape for main trees and subtrees:

```typescript
interface TreeData {
  id: string;                      // Tree ID (e.g., "MainTree", "NavigationSubtree")
  nodes: Node[];                   // ReactFlow nodes
  edges: Edge[];                   // ReactFlow edges
  variables: Variable[];           // Local variables in this tree
  description?: string;            // Optional subtree description (stored as XML comment)
  ports?: SubTreePort[];           // Input/output port definitions for subtrees
}
```

The `id` field is:
- For main tree: the filename's stem (e.g., "NavigationTree" from "NavigationTree.xml")
- For subtrees: any unique string (e.g., "CheckGoal", "MoveRobot")

### Node shape (ReactFlow)

Nodes have this structure in the canvas:

```typescript
interface Node {
  id: string;                      // Unique instance ID (e.g., "Sequence_12345")
  type: 'btNode';                  // Always 'btNode' (single node type for all BT nodes)
  position: { x: number; y: number };
  data: {
    name: string;                  // Display name (e.g., "Sequence", "PrintMessage")
    category: NodeCategory;        // 'root' | 'action' | 'condition' | 'control' | 'decorator' | 'subtree'
    type: string;                  // XML node type (e.g., "Sequence", "PrintMessage")
    color: string;                 // Hex color from getCategoryColor()
    nodeName?: string;             // Optional custom instance name
    subtreeId?: string;            // For subtree nodes, the referenced subtree ID
    fields: NodeField[];           // Editable parameters (name, type, value, valueType)
    instanceId: string;            // Same as node.id
  };
}
```

All BT node types use the same ReactFlow node type (`'btNode'`) and are differentiated by `data.category` and `data.type`.

### Node fields

Fields are parameters on a node:

```typescript
interface NodeField {
  name: string;                    // Field name (e.g., "message", "num_attempts")
  type: 'string' | 'number' | 'boolean';
  valueType: 'literal' | 'variable';  // How the value is interpreted
  value: string | number | boolean;   // The actual value
  description?: string;            // Tooltip/help text
  portDirection?: 'input' | 'output'; // For subtree port fields only
}
```

- **Literal**: `valueType = 'literal'`, value is used as-is
- **Variable**: `valueType = 'variable'`, value is wrapped in `{...}` in XML (e.g., `value = "myVar"` becomes `{myVar}`)

### Subtree ports

Ports define the input/output interface of a subtree:

```typescript
interface SubTreePort {
  name: string;                    // Port name (e.g., "target_x", "result")
  direction: 'input' | 'output' | 'inout';
  type: 'string' | 'number' | 'boolean';
  defaultValue?: string;           // Default value if not connected
  required?: boolean;              // True = must be provided by parent
  description?: string;
}
```

When a subtree node is placed in the canvas, its ports become fields on the node instance. This allows passing data to and from the subtree.

## State and workflows

### Workspace store

`workspaceStore.tsx` uses a React Context + Reducer pattern to manage global state. The store holds:

- **Workspace info**: Folder path and list of XML files in the workspace
- **Active file**: Path and name of the currently open tree file
- **Main tree**: The primary `TreeData` (nodes, edges, variables)
- **Subtrees**: Map of subtrees (`id` → `TreeData`) embedded in the active file
- **Library subtrees**: Map of subtrees from `subtree_library.xml` (source of truth for all subtrees in the workspace)
- **Library modified time**: Used to detect external changes
- **Dirty state**: Whether the active file has unsaved changes
- **Modified subtree tracking**: Set of subtree IDs that changed since last save (used for workspace-wide sync)
- **File modification times**: Per-file timestamps for external change detection

The context provides `useWorkspace()` hook for access to `state`, `dispatch`, and helper accessors like `activeTree` and `allSubtreeIds`.

### Workspace operations

`useWorkspaceOps.ts` is a custom hook providing high-level operations:

- **`openWorkspace(openFileAfter?: boolean)`**: Prompts for a folder, loads it and `subtree_library.xml`. If `openFileAfter=true`, immediately shows file picker to avoid dialog races.
  
- **`openTreeFile(filePath?: string)`**: Loads a multi-tree XML file, parses it with `importMultiTreeFromXML()`, and reconciles subtrees against the library. If discrepancies are found, the library version is used as the source of truth.

- **`saveWorkspace()`**: Three-step save:
  1. Export the active file with all embedded subtrees (main + subtrees) to XML
  2. Update `subtree_library.xml` with all subtrees from the active file
  3. Update any other workspace files that reference modified subtrees (auto-reconciliation)

- **`createNewTree()`**: Prompts for a filename, creates a new file with a blank main tree (ID = `main_tree_to_execute`), and opens it.

- **`createNewSubtree(name, description?, ports?)`**: Creates a subtree in memory with optional ports. It can be persisted by saving.

- **`importTreeAsSubtree(filePath, subtreeName, ports)`**: Imports an XML file as a new subtree in the current file.

The hook manages all Electron file dialogs and IPC calls. Logic is async-friendly to handle long file operations.


### Save pipeline

Save is triggered by:
- Menu "File > Save" (Electron) or keyboard shortcut `Cmd+S`/`Ctrl+S`
- The handler calls `saveWorkspace()` from `useWorkspaceOps.ts`

The three-step process:

1. **Export active file**: Call `exportMultiTreeToXML(mainTree, subtrees)` to generate XML with all embedded subtrees
2. **Update library**: Call `exportSubtreeLibraryToXML(allSubtrees)` and write `subtree_library.xml`
3. **Reconcile other files**: For each workspace file that references a modified subtree, reload it, replace the subtree version with the library version, and re-export it

After save completes, the workspace state is marked clean (`isDirty = false`) and the modified subtree tracking is cleared.

### Variable system

Variables in BTstudio are editor-side parameters distinct from BehaviorTree.cpp's blackboard:

- Variables are stored in `sessionStorage` per browser tab (survives page reload within the same tab)
- When a variable is created, a `DeclareVariable` node can optionally be added to the tree
- `DeclareVariable` nodes have two fields:
  - `output_key`: The variable name (stored as `{varName}`)
  - `value`: The initial value
- Variable references in other nodes use `{varName}` syntax; the editor enforces this with the variable type toggle
- The VariableEditor component syncs with DeclareVariable nodes via callback refs

## XML import/export

`xmlSerializer.ts` implements BehaviorTree.cpp v4 handling. It is the only module that knows about XML structure.

### Format overview

- **Root element**: `<root BTCPP_format="4" main_tree_to_execute="MainTreeId">`
- **Trees**: `<BehaviorTree ID="TreeId">...</BehaviorTree>` elements
- **Tree descriptions**: Optional XML comments immediately before `<BehaviorTree>` (not parsed by BT server)
- **Nodes**: `<Action type="NodeType" name="instanceName">...</Action>` (or Condition, Control, etc.)
- **Port definitions**: `<TreeNodesModel>` contains `<SubTree ID="...">` with `<input_port>` and `<output_port>` children
- **Variables**: Derived from `SetBlackboard` nodes during import (not stored directly)

### Subtree ports

Input/output ports are defined in `<TreeNodesModel>`:

```xml
<TreeNodesModel>
  <SubTree ID="MySubtree">
    <input_port name="input_param" type="string" default="value" required="true" />
    <output_port name="output_result" type="number" required="false" />
  </SubTree>
</TreeNodesModel>
```

Port definitions are persisted in **both**:
- `subtree_library.xml` (library copy)
- Individual tree files that contain the subtree (working copy)

When a subtree is loaded or reconciled, ports become editable fields on subtree node instances.

### Key functions

**Export:**
- `exportToXML(nodes, edges, variables)` - Single-tree export
- `exportMultiTreeToXML(mainTree, subtrees)` - Multi-tree export (main + embedded subtrees)
- `exportSubtreeLibraryToXML(subtrees)` - Library export

**Import:**
- `importFromXML(xmlString)` - Single-tree import (returns `TreeData`)
- `importMultiTreeFromXML(xmlString)` - Multi-tree import (returns `{ mainTree, subtrees, treeOrder }`)
- `importSubtreeLibraryFromXML(xmlString)` - Library import

**Utilities:**
- `getReferencedSubtreeIds(nodes)` - Lists all subtree IDs referenced by nodes in a tree
- Variable extraction is automatic during import (scans for `SetBlackboard` nodes)

## UI components

### App.tsx

The root app component sets up:
- `WorkspaceProvider` context for global state management
- `AppContent` with session-based variable storage (stored in `sessionStorage`)
- Refs for cross-component communication (e.g., adding DeclareVariable nodes from the VariableEditor)
- Passes variables, handlers, and tab ID down to child components

The app uses React Context API to share workspace state and provides callback refs for operations that need to communicate between distant components (e.g., adding a DeclareVariable node when a new variable is created).

### TreeEditor.tsx

The main canvas using ReactFlow. Responsibilities:

- **Node and edge management**: Maintains ReactFlow state (`useNodesState`, `useEdgesState`)
- **Connection rules**: Enforces single-input edges per node; control nodes allow multiple outputs, others max one
- **History/undo-redo**: Maintains `historyPast` and `historyFuture` stacks; uses `isTimeTravelRef` to avoid recording during undo/redo
- **XML import/export**: Handles `Cmd+S`/`Ctrl+S` saves and menu-triggered exports
- **Workspace sync**: Syncs active tree to `workspaceStore` on node/edge changes
- **Variable integration**: Manages DeclareVariable nodes when variables are added/removed
- **DeclareVariable node creation**: Uses callback ref from App to create nodes in response to VariableEditor actions
- **Session persistence**: Stores tree state in `sessionStorage` per tab ID to survive reloads

Key methods:
- `onNodesChange` / `onEdgesChange` - ReactFlow change handlers
- `onConnect` - Custom connection validation
- `onDrop` - Creates nodes from palette drops (sets `Node.type` to `'btNode'`)
- `handleSave` - Exports to XML and writes file
- `handleExport` - Shows native save dialog, exports without changing active file
- `undo()` / `redo()` - History navigation

### BTNode.tsx

The ReactFlow node component. Renders:

- **Header** with node name and optional custom instance name (`nodeName`)
- **Fields** with values and value-type indicators (literal vs. variable)
- **Handles** (top and bottom) for connections
- **Port fields** (for subtree nodes): input ports and output ports are displayed with directional labels

The component is memoized to prevent unnecessary re-renders during canvas interactions. Fields are displayed differently for subtree nodes (input ports at top, output ports at bottom).

### NodePropertiesPanel.tsx

Right-side panel for editing the selected node. Features:

- **Node name editing**: Custom instance name (`nodeName`)
- **Field editing**: Text, number, boolean, and variable reference editors
- **Value type toggle**: Switch between literal and variable references (`{varName}` syntax)
- **Port editing** (subtree nodes): Edit input/output port definitions
- **Real-time sync**: Updates `TreeEditor` state via `onUpdateNodeField` callback

When a subtree node is selected, ports become editable fields. Changing port definitions updates both the node instance and the library.

### NodePalette.tsx

Left-side palette with two modes:

- **Nodes**: Built-in node definitions from `nodeLibrary.ts`, grouped by category
- **Library**: Dynamically loaded subtrees from `subtree_library.xml`, with search/filter

Features:

- **Category colors**: Each node type is color-coded (root=red, action=green, etc.)
- **Port editor UI**: For subtree creation, allows defining input/output ports inline
- **Drag-and-drop**: `onDragStart` sets `application/reactflow` payload with node definition
- **Library subtree insertion**: Dragging a library subtree auto-ensures it's present in the current file

### SubTreeTabBar.tsx

Horizontal tabs for switching between main tree and subtrees. Features:

- **Main tree tab**: Always visible (shows main tree ID, e.g., `main_tree_to_execute`)
- **Subtree tabs**: One per subtree in the current file
- **Dirty indicators**: Visual marker (dot or highlight) for modified subtrees
- **Search/filter**: Type to quickly find a subtree
- **Port display**: When editing a subtree, shows its input/output port definitions
- **Click to switch**: Calls `dispatch({ type: 'SET_ACTIVE_TREE', treeId })`

### VariableEditor.tsx

Right-side panel for managing variables. Features:

- **Add variable**: Input fields for name and value
- **Edit variable**: Click to edit name or value
- **Delete variable**: Remove a variable (triggers DeclareVariable node deletion if applicable)
- **Sync with DeclareVariable nodes**: When a variable is updated, the corresponding node is also updated

Variables are persisted in `sessionStorage` per tab and are distinct from the blackboard (BehaviorTree.cpp concept). Variables are used for editor-side parameter management and are serialized in the XML.

### WelcomeModal.tsx

Blocking modal shown when there is no active file. Features:

- **Non-dismissible**: Cannot be closed without a successful action
- **Background blur**: Parent blurs the editor when modal is active
- **Three actions**: 
  - "Create New Tree" - Creates a new file with a blank main tree
  - "Open Workspace" - Selects a folder, then immediately shows file picker
  - "Open File" - Shows file picker (if workspace is already open)

The modal uses `openWorkspace(true)` to avoid UI races when chaining folder + file dialogs.

### WorkspaceToolbar.tsx

An invisible component that registers Electron menu event listeners (`onMenuOpenWorkspace`, etc.). It has no visual UI but dispatches workspace operations in response to menu actions. This separation keeps menu handling out of the visible UI layer.

## Build and scripts

### Development

- **`npm start`** - Start React dev server (usually http://localhost:3000)
- **`npm run electron:dev`** - Concurrently run React dev server and Electron shell. Electron will automatically reload when files change.
- **`npm test`** - Run tests (using react-scripts test)

### Production

- **`npm run build`** - Build React production bundle to `build/` directory
- **`npm run electron:build`** - Build production React bundle and package as Electron installers (macOS `.dmg`, Linux `.AppImage`)
- **`npm run electron:pack`** - Package for current platform only (no installer)

### Release process

Releases are automated via GitHub Actions when a version tag is pushed:

1. Update `version` in `package.json`: `npm version patch|minor|major`
2. Push the commit and tag: `git push && git push --tags`
3. GitHub Actions builds both macOS (Apple Silicon universal) and Linux (x64) installers
4. Draft release is auto-created; edit release notes and publish

See `package.json` build config for platform-specific details (code signing, target architectures, etc.).

**Important**: Auto-update is configured in `electron/main.js` using `electron-updater` and points to GitHub releases.

## Developer quick reference

### Adding a new built-in node type

**Location:** [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts)

Edit the `nodeLibrary` array:

```typescript
{
  id: 'unique_id',
  type: 'MyCustomAction',      // XML node type
  category: 'action',          // 'root' | 'action' | 'condition' | 'control' | 'decorator' | 'subtree'
  name: 'My Custom Action',    // Display name
  description: 'What it does',
  fields: [
    {
      name: 'param1',
      type: 'string',
      valueType: 'literal',
      value: 'default_value',
      description: 'A parameter'
    }
  ]
}
```

The node will automatically:
- Appear in the Nodes palette (grouped by category)
- Be draggable onto the canvas
- Show its fields in the properties panel
- Serialize/deserialize correctly in XML

### Adding a new subtree to the library

Use the palette's **Library tab** → "Create New Subtree":

1. Enter subtree name (becomes the tree ID)
2. Add optional description
3. Define input/output ports
4. Save to `subtree_library.xml`

The subtree can then be:
- Dragged from the Library palette onto any canvas
- Edited in the SubTreeTabBar
- Referenced by multiple files in the workspace

### Adding a new component

1. Create `src/components/MyComponent.tsx`
2. Import and use in the parent component
3. If it needs workspace state, call `useWorkspace()` from `workspaceStore`
4. If it needs file operations, call `useWorkspaceOps()` from the hook

### Modifying XML format

All XML parsing/generation happens in `xmlSerializer.ts`. To add a custom attribute:

**To export:**
```typescript
// In exportToXML() or serializeNodeRecursive():
if (node.data.myField) {
  attributes.push(`myAttr="${node.data.myField}"`);
}
```

**To import:**
```typescript
// In importFromXML() or parseNodeRecursive():
const myValue = element.getAttribute('myAttr');
if (myValue) {
  node.data.myField = myValue;
}
```

### Connection rules

Enforced in `TreeEditor.tsx` `onConnect` callback:

- **Max 1 incoming edge**: Any non-root node accepts only one parent
- **Control nodes**: Sequence, Fallback, etc. → unlimited children
- **Other nodes**: Action, Condition, Decorator → max 1 child

To modify, edit the validation logic in `onConnect`.

### Node colors

Defined by `getCategoryColor()` in `nodeLibrary.ts`:

| Category | Color |
|----------|-------|
| root | #F44336 (red) |
| action | #4CAF50 (green) |
| condition | #2196F3 (blue) |
| control | #FF9800 (orange) |
| decorator | #9C27B0 (purple) |
| subtree | #00BCD4 (cyan) |

### Undo/redo

In `TreeEditor.tsx`:

- **Record state**: After `onNodesChange`, `onEdgesChange`, call `addToHistory()`
- **Undo**: `undo()` pops from `historyPast`, pushes current to `historyFuture`
- **Redo**: `redo()` pops from `historyFuture`, pushes current to `historyPast`
- **Prevent during time travel**: Use `isTimeTravelRef.current = true` to skip recording

History limit is `HISTORY_LIMIT = 20` (configurable).

### Keyboard shortcuts

- **Cmd+S / Ctrl+S**: Save active file (calls `TreeEditor.handleSave()`)
- **Cmd+Z / Ctrl+Z**: Undo
- **Cmd+Shift+Z / Ctrl+Shift+Z**: Redo
- **Escape**: Deselect node (in canvas)

Shortcuts are registered in `TreeEditor.tsx` via `useEffect` and window event listeners.

### Testing patterns

The app has no automated test suite. For manual testing:

1. **Tree import/export**: Modify an XML file, open it, save it, check the file contents
2. **Workspace sync**: Edit a subtree in one file, save it, open another file that references it—the library version should appear
3. **Variable sync**: Add a variable, edit its value, verify DeclareVariable nodes update
4. **External changes**: Modify `subtree_library.xml` externally, reload the app, check for warning dialog

### Common debugging

Print debug info:

```typescript
// In TreeEditor.tsx
console.log('Current nodes:', nodes);
console.log('Current edges:', edges);
console.log('Workspace state:', workspaceState);

// In xmlSerializer.ts
console.log('Generated XML:', exportToXML(nodes, edges, variables));
```

Use React DevTools to inspect component state and Redux DevTools to inspect workspace reducer actions.
