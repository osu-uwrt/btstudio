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

## Building behavior trees

### Quick workflow
1. **Drag** a node from the left palette onto the canvas
2. **Connect** nodes by dragging from bottom handle to top handle
3. **Click** a node to edit its properties
4. **Set fields** as literals or variables using the properties panel

### Create a simple tree
1. Drag "Sequence" to canvas
2. Drag "Print Message" below it
3. Connect Sequence → Print Message
4. Click Print Message → Edit message field

### Use variables
1. Right sidebar → Add variable (e.g., "counter", number, 0)
2. Drag "Set Variable" to canvas
3. Click node → Set variable_name field
4. Toggle "value" field to Variable mode
5. Select variable from dropdown

### Build complex trees
1. Start with root control node (Sequence/Fallback)
2. Add decorator nodes for flow control
3. Add condition nodes for branching
4. Add action nodes for behavior
5. Use variables for shared state

## Component guide

### NodePalette (Left Sidebar)
- Search bar: Filter nodes by name/description
- Category buttons: Filter by node type
- Drag nodes onto canvas to add them
- **Nodes tab**: Built-in node definitions
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

## Keyboard shortcuts

- Save: Cmd+S / Ctrl+S
- Undo: Cmd+Z / Ctrl+Z
- Redo: Cmd+Shift+Z / Ctrl+Shift+Z

## Node naming

Nodes can have custom instance names that appear in place of the category label:

- **Default Behavior**: Nodes show their category (e.g., "control", "action")
- **Custom Names**: Assign a name to display it instead of the category
- **Empty Names**: Clearing the name returns to showing the category

### How to name nodes
1. Select a node by clicking on it
2. In the Node Properties panel, find the "Node Name" section
3. Enter a custom name or leave blank to show category
4. The name updates immediately on the node

### Node names in XML
Node names are exported as the `name` attribute in BehaviorTree.cpp XML format:
```xml
<Sequence name="MainLoop">
  <Action name="MoveForward"/>
  <Condition name="CheckObstacle"/>
</Sequence>
```

This is fully compatible with BehaviorTree.cpp and Groot2.

## Troubleshooting

### Can't connect nodes?
- Drag from source (bottom handle) to target (top handle)
- Each node can only have one incoming connection
- Non-control nodes can only have one outgoing connection

### Variable not in dropdown?  
- Check that variable type matches field type
- Ensure variable was created in the Variables panel

### Node palette empty?
- Check category filter buttons
- Clear search box

### Node name not showing?
- Click the node to select it
- Check Node Properties panel
- Re-enter name and verify it's saved

### Export filename wrong?
- Modern browsers: Choose filename in save dialog
- Other browsers: Rename file after download

### Groot2 import issues?
- Check that node types exist in node library
- Some custom nodes may need to be added

## Notes

- This app targets BehaviorTree.cpp v4 format and is compatible with Groot2 XML files.
- There is no automatic save; use File → Save.
- Node names use the standard BehaviorTree.cpp `name` attribute.
- Variables use `{varName}` syntax in XML.
- Blackboard is NOT shared between subtrees; use ports for data passing.

## More documentation

- Developer details: [PROJECT.md](PROJECT.md)
- Extending the app: [CUSTOMIZATION.md](CUSTOMIZATION.md)
