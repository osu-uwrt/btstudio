# BehaviorTree Studio

BehaviorTree Studio is a visual editor for BehaviorTree.cpp XML. It uses a workspace-based workflow, a shared subtree library, and an interactive canvas for building and editing behavior trees.

## What this app does

- Creates and edits BehaviorTree.cpp v4 XML files
- Maintains a shared subtree library for reuse across tree files
- Provides a drag-and-drop editor with node properties and variables
- Supports undo/redo and switching between the main tree and subtrees

## Core concepts

### Workspace
Open a workspace folder that contains tree XML files. The app also uses a shared library file named `subtree_library.xml` inside the workspace to store reusable subtrees.

### Main tree and subtrees
Each file contains a main tree plus optional subtrees. The main tree is exported with the ID `main_tree_to_execute` to match BehaviorTree.cpp expectations. Subtrees are referenced by name and are defined as additional `<BehaviorTree>` elements in the same file.

### Subtree library
The library is the source of truth for shared subtrees. When you save, the current file is saved, the library is updated, and any other files that reference those subtrees are updated as well.

## System requirements

- Node.js 18+ recommended
- npm (ships with Node.js)

## Getting started

### Install
```bash
npm install
```

### Run (development)
```bash
npm run electron:dev
```

This starts the React app and the Electron shell together. The app will open automatically.

### Build
```bash
npm run build
```

### Optional: run the web UI only
```bash
npm start
```

The web UI opens at `http://localhost:3000` and can export XML via downloads, but workspace file operations require the Electron shell.

## Basic usage

### Open a workspace
1. Use File → Open Workspace.
2. Choose a folder that contains tree XML files.
3. The app will load or create `subtree_library.xml` in that folder.

### Open or create a tree file
- Use File → Open Tree to open an existing XML file.
- Use File → New Tree to create a new tree file. The main tree ID is set to `main_tree_to_execute` automatically.

### Edit trees
- Drag nodes from the Node Palette (left) onto the canvas.
- Click a node to edit its fields and optional node name.
- Use the Variables panel (right) to manage local variables for the active tree.

### Work with subtrees
- Switch to the Subtree Library tab in the palette to view and create subtrees.
- Drag a subtree onto the canvas to insert it into the active tree.
- Click a subtree in the library to edit it.

### Save
- Use File → Save or the standard shortcut (Cmd+S / Ctrl+S).
- Saving writes the current file, updates the subtree library, and updates other files that reference the same subtrees.

### Use variables
1. Right sidebar → Add variable (e.g., "counter", number, 0)
2. Drag "Set Variable" to canvas
3. Click node → Set variable_name field
4. Toggle "value" field to Variable mode
5. Select variable from dropdown

## Component guide

### NodePalette (Left Sidebar)
- Search bar: Filter nodes by name/description
- Category buttons: Filter by node type
- Drag nodes onto canvas to add them
- **Nodes tab**: Nodes and subtree nodes
- **Library tab**: Workspace subtrees

### TreeEditor (Main Canvas)  
- Drop zone for nodes from palette
- Connect nodes by dragging handles
- Zoom/pan controls in bottom-left corner
- Click nodes to select and edit

### VariableEditor (Right Sidebar)
- Toggle Global/Local scope
- Add new variables with type
- Edit values inline
- Delete unwanted variables

### NodePropertiesPanel (Floating)
- Appears when node selected
- Shows node info (type, category, ID)
- Edit field values
- Toggle Literal ↔ Variable
- Set custom node names

## Navigation and shortcuts

### Canvas navigation
- **Zoom**: Mouse wheel or controls in bottom-left
- **Pan**: Click and drag on background
- **Select node**: Click on node
- **Delete**: Select node and press Delete key
- **Deselect**: Click on background

### Keyboard shortcuts
- Save: Cmd+S / Ctrl+S
- Undo: Cmd+Z / Ctrl+Z
- Redo: Cmd+Shift+Z / Ctrl+Shift+Z
- Delete: Delete key (removes selected node)

## Node categories

- 🟥 **Root** (Red): Entry point for behavior tree
- 🟧 **Control** (Orange): Sequence, Fallback, Parallel
- 🟪 **Decorator** (Purple): Inverter, Retry, Repeat, Timeout
- 🟩 **Action** (Green): PrintMessage, SetVariable, Delay  
- 🟦 **Condition** (Blue): CheckVariable, CompareNumbers
- 🟦 **SubTree** (Cyan): Reusable subtree instances


### Node names in XML
Node names are exported as the `name` attribute in BehaviorTree.cpp XML format:
```xml
<Sequence name="MainLoop">
  <Action name="MoveForward"/>
  <Condition name="CheckObstacle"/>
</Sequence>
```

## Notes

- This app targets BehaviorTree.cpp v4 format and is compatible with Groot2 XML files.
- This does not interoperate with Groot2 projects.
- There is no automatic save; use File → Save.
- Node names use the standard BehaviorTree.cpp `name` attribute.
- Variables use `{varName}` syntax in XML.
- Blackboard is NOT shared between subtrees; use ports for data passing.

## More documentation

- Developer details: [PROJECT.md](PROJECT.md)
- Extending the app: [CUSTOMIZATION.md](CUSTOMIZATION.md)
