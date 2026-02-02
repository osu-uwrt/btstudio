# Customization and Extension

This document focuses on extending BehaviorTree Studio and running it locally in a development environment.

## Run locally (development)

### Prerequisites
- Node.js 18+ recommended
- npm (ships with Node.js)

### Install dependencies
```bash
npm install
```

### Start the Electron dev environment
```bash
npm run electron:dev
```

This starts the React dev server and the Electron shell together.

### Optional: run the web UI only
```bash
npm start
```

The web UI can export XML via downloads, but workspace file operations require the Electron shell.

## Add or edit built-in nodes

Built-in node definitions live in [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts). These definitions populate the Node Palette in the Nodes view.

### Step-by-step

1. Open [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts).
2. Add a new object to the `nodeLibrary` array.
3. Save the file and reload the app if the dev server does not hot reload the palette.

### Example: simple action node

```typescript
{
  id: 'move_to_target',
  type: 'MoveToTarget',
  category: 'action',
  name: 'Move To Target',
  description: 'Moves the agent to a target position',
  fields: [
    {
      name: 'target_x',
      type: 'number',
      valueType: 'literal',
      value: 0,
      description: 'X coordinate of target'
    },
    {
      name: 'target_y',
      type: 'number',
      valueType: 'literal',
      value: 0,
      description: 'Y coordinate of target'
    }
  ]
}
```

### Notes

- `type` is the XML tag name that will be used on export.
- `category` controls palette filtering and color.
- `fields` describe editable parameters shown in the Node Properties panel.

## Create and edit subtrees

Subtrees are not defined in `nodeLibrary.ts`. They come from the workspace library file `subtree_library.xml`.

### Create a new subtree

1. Open a workspace.
2. Switch to the Subtree Library tab in the Node Palette.
3. Click New Subtree, then provide a name and optional description.

The new subtree is added to the library and becomes available in the current file.

### Edit an existing subtree

1. Open the Subtree Library tab.
2. Click a subtree to open it in the editor.
3. Modify nodes or variables as needed.
4. Save to propagate updates to the library and all referencing files.

## Node naming system

Nodes support custom instance names that replace the category label in the node display.

### How it works
- **Default Behavior**: Nodes show their category (e.g., "control", "action") by default
- **Custom Names**: When you assign a name to a node, it replaces the category label
- **Empty Names**: Clearing the name returns to showing the category

### Usage
1. Select a node by clicking on it
2. In the Node Properties panel (right side), find the "Node Name" section
3. Enter a custom name or leave blank to show category
4. The name updates immediately on the node

### XML export
Node names are properly exported as the `name` attribute in BehaviorTree.cpp XML format:
```xml
<Sequence name="MainLoop">
  <Action name="MoveForward"/>
  <Condition name="CheckObstacle"/>
</Sequence>
```

This is fully compatible with BehaviorTree.cpp and Groot2.

### Best practices for node naming

✅ **Good Use Cases:**
- Distinguish multiple instances of the same node type
- Document the purpose of specific nodes
- Make complex trees more readable
- Match naming conventions from Groot2 projects

❌ **Avoid:**
- Naming every single node (clutters the display)
- Using very long names (truncates in display)
- Duplicating information already in node type

### Examples

**Before (showing category):**
```
Sequence
└─ control
```

**After (with descriptive name):**
```
Sequence
└─ MainLoop
```

**Complex Tree:**
```
Sequence (MainBehavior)
├─ Fallback (SafetyCheck)
│  ├─ Condition (BatteryOK)
│  └─ Action (ReturnToBase)
└─ SubTree (PatrolRoute)
```

### Type system updates
```typescript
// Node data now includes optional nodeName
interface BTNodeData {
  // ... existing fields
  nodeName?: string; // Custom instance name
}
```

### Implementation details
- Node names are stored in the node's data object
- Updated through `onUpdateName` callback in NodePropertiesPanel
- Persisted through undo/redo operations
- **Export**: `name` attribute is written first (before other attributes)
- **Import**: `name` attribute is parsed and stored separately from regular fields
- **SubTrees**: Also support the `name` attribute

## Enhanced export functionality

The export system provides better file management:

### Features
- **Remember Import Source**: If you imported a file, exporting defaults to that filename
- **File Save Dialog**: On supported browsers, you can choose where to save the file
- **Overwrite Protection**: When saving to the same location, you'll be prompted to confirm
- **Fallback Support**: On older browsers, falls back to traditional download

### Browser support
- **Modern Browsers** (Chrome 86+, Edge 86+): Full file picker support
- **Other Browsers**: Traditional download with suggested filename

### Usage

**Export with Modern API:**
1. Click "📤 Export" button
2. Choose location and filename in the save dialog
3. Confirm to save or overwrite

**Export with Fallback:**
1. Click "📤 Export" button
2. File downloads to your default downloads folder
3. Filename is based on the last imported file or defaults to `behavior_tree.xml`

**After Import:**
- If you imported `my_tree.xml`, exports will default to `my_tree.xml`
- This makes it easy to edit and save back to the same file

## BehaviorTree.cpp compatibility

### XML format compliance
All features maintain full compatibility with BehaviorTree.cpp version 4.x:

**Node Name Attribute:**
- The `name` attribute is a standard BehaviorTree.cpp feature
- Groot2 uses this same format
- Names are optional and can be omitted

**Example Compatibility:**
```xml
<?xml version="1.0"?>
<root BTCPP_format="4">
  <BehaviorTree ID="MainTree">
    <Sequence name="PatrolSequence">
      <SubTree ID="MoveToWaypoint" name="GoToPoint1" waypoint="{wp1}"/>
      <Action name="Wait" duration="5000"/>
      <Condition name="CheckBattery" threshold="20"/>
    </Sequence>
  </BehaviorTree>
</root>
```

### Groot2 import/export
Files created in Groot2 can be imported into BTstudio and vice versa:

**Import from Groot2:**
- Node names are preserved
- All attributes are maintained
- Tree structure is retained

**Export to Groot2:**
- BTstudio XML can be opened in Groot2
- Node names will appear correctly
- Full compatibility maintained

### XML attribute ordering
BehaviorTree.cpp doesn't require specific attribute ordering, but BTstudio follows this convention:
1. `name` attribute (if present)
2. Other attributes in order they appear in node definition
3. Port mappings for SubTrees

## Migration from previous versions

### Existing trees
- **No Breaking Changes**: All existing trees work without modification
- **Default Behavior**: Nodes without names continue showing category
- **Gradual Adoption**: Add names only where needed

### Updating workflow
1. **Import Old Files**: Works seamlessly
2. **Add Names**: Optional - only where it improves clarity
3. **Export**: New format is backward compatible

## Add a custom node component

If you want a specialized node UI beyond the default `BTNode`:

1. Create a component in `src/components/`.
2. Register it in the `nodeTypes` map in [src/components/TreeEditor.tsx](src/components/TreeEditor.tsx).
3. Set the `type` of the ReactFlow node to your new component key.

This is optional; most custom nodes only require a `nodeLibrary` definition.

## Add new field types or behaviors

If you add a new `NodeField` type or change how values are handled:

1. Update `NodeField` in [src/types/index.ts](src/types/index.ts).
2. Update rendering in [src/components/BTNode.tsx](src/components/BTNode.tsx).
3. Update editing logic in [src/components/NodePropertiesPanel.tsx](src/components/NodePropertiesPanel.tsx).

## Styling and theming

Each component has a dedicated CSS file under `src/components/`. Global styles are in [src/App.css](src/App.css) and [src/index.css](src/index.css).

### Change category colors

Edit `getCategoryColor` in [src/data/nodeLibrary.ts](src/data/nodeLibrary.ts).

```typescript
export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'action':
      return '#4CAF50';
    case 'condition':
      return '#2196F3';
    case 'control':
      return '#FF9800';
    case 'decorator':
      return '#9C27B0';
    case 'subtree':
      return '#00BCD4';
    default:
      return '#757575';
  }
};
```

## Troubleshooting customizations

### File save dialog not appearing
**Issue**: Export downloads instead of showing save dialog  
**Reason**: Browser doesn't support File System Access API  
**Solution**: This is expected behavior - file will download normally

### Node name not showing
**Issue**: Entered name doesn't appear on node  
**Reason**: Name might be cleared or node not selected  
**Solution**:
1. Click the node to select it
2. Check Node Properties panel
3. Re-enter name and verify it's saved

### Export filename wrong
**Issue**: Export uses wrong filename  
**Reason**: Filename is based on last import  
**Solution**:
1. Modern browsers: Choose filename in save dialog
2. Other browsers: Rename file after download

### Groot2 import issues
**Issue**: Some nodes don't import correctly  
**Reason**: May use unsupported BehaviorTree.cpp features  
**Solution**:
1. Check that node types exist in `nodeLibrary.ts`
2. Add custom nodes if needed
3. Report unsupported features

## Future enhancements

Potential improvements for future versions:

1. **Keyboard Shortcuts**: Add Ctrl+S/Cmd+S for quick save (already implemented in TreeEditor)
2. **Auto-save**: Periodic automatic exports
3. **Name Suggestions**: Auto-generate descriptive names based on node configuration
4. **Bulk Naming**: Apply naming conventions to multiple nodes
5. **Name Templates**: Pre-defined naming patterns for common use cases

## Technical notes

### File System Access API
The export uses the modern [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) when available:

```typescript
if ('showSaveFilePicker' in window) {
  // Use modern API
} else {
  // Fallback to download
}
```

### Browser compatibility matrix

| Browser | Save Dialog | Default Filename | Notes |
|---------|-------------|------------------|-------|
| Chrome 86+ | ✅ Yes | ✅ Yes | Full support |
| Edge 86+ | ✅ Yes | ✅ Yes | Full support |
| Firefox | ❌ No | ✅ Yes | Uses download |
| Safari | ❌ No | ✅ Yes | Uses download |
