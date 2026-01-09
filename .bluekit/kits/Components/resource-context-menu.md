---
id: resource-context-menu
alias: Resource Context Menu
type: kit
is_base: false
version: 2
tags:
  - ui
  - context-menu
  - tauri-windows
description: Right-click context menu for resource items with multi-window support, copy path, and editor integration
---
# Resource Context Menu Kit

## End State

After applying this kit, the application will have:

**Context menu component:**
- Appears at cursor position on right-click
- Displays menu items with icons aligned to the right
- Supports nested submenus that open on hover
- Closes automatically when an action is selected or user clicks outside

**Standard menu actions:**
- **Copy Path**: Copies the resource file path to clipboard with toast confirmation
- **Open in New Window**: Opens resource content in a separate Tauri window that can be moved to different monitors
- **Open (submenu)**: Nested menu with options to open resource in different editors

**Submenu functionality:**
- Opens on hover with no delay
- Displays chevron-down icon to indicate expandable menu
- Contains editor-specific options with appropriate icons
- Supports multiple editor integrations (Cursor, Claude, VS Code, etc.)

**UI/UX characteristics:**
- Menu positioned at exact cursor coordinates from right-click event
- Icons positioned on the right side of menu items
- Text aligned to the left
- Visual separators between logical action groups
- Proper spacing and typography using Chakra UI
- Portal rendering to avoid z-index issues

**Integration with IPC:**
- Calls backend commands for file operations (open in editor, create windows)
- Handles errors with toast notifications
- Configurable timeout for IPC operations
- Creates independent OS-level windows via Tauri WindowBuilder

**Multi-Window Support:**
- Each preview opens in a separate Tauri window
- Windows can be moved to different monitors
- Multiple preview windows can be open simultaneously
- Windows close independently without affecting main app
- Each window has unique label based on resource path

## Implementation Principles

**Context Menu UI:**
- Use Chakra UI Menu component for accessibility and theming consistency
- Render menu in Portal to avoid parent container z-index constraints
- Position menu using fixed positioning with x/y coordinates from mouse event
- Implement controlled menu state (isOpen, onClose) from parent component
- Use justify="space-between" on HStack to align text left and icons right
- Support nested Menu.Root components for submenus
- Use appropriate icons that match the app's design system
- Close menu after action completion to improve UX

**Multi-Window Implementation:**
- Generate unique window ID by sanitizing resource path: `resource.path.replace(/[^a-zA-Z0-9]/g, '-')`
- Call `invokeOpenResourceInWindow()` with resource details and window configuration
- Window label format: `preview-{windowId}` (backend automatically prefixes)
- Default window size: 1200x900 (customizable via width/height params)
- Backend checks for duplicate windows and returns error if window already exists
- Use `/preview` route that reads query parameters: `?resourceId={path}&resourceType={type}`
- Preview window loads minimal UI with Header + ResourceMarkdownViewer

**Error Handling:**
- Handle async operations (window creation, editor launching) with proper error handling
- Show user feedback via toast notifications for all actions
- Catch and display IPC errors with descriptive messages
- Handle duplicate window attempts gracefully

## Verification Criteria

After generation, verify:
- ✓ Right-clicking a resource opens context menu at cursor position
- ✓ Menu items display with text on left and icons on right
- ✓ "Copy Path" action copies file path to clipboard and shows success toast
- ✓ "Open in New Window" creates a separate OS window showing resource content
- ✓ Preview window can be moved to different monitors
- ✓ Multiple preview windows can be open simultaneously
- ✓ Preview window displays resource using app's consistent UI (Header + ResourceMarkdownViewer)
- ✓ Hovering over "Open" menu item reveals submenu with editor options
- ✓ Submenu shows chevron-down icon on parent item
- ✓ Selecting an editor option triggers IPC call to open file
- ✓ Menu closes after selecting any action
- ✓ Clicking outside menu closes it without taking action
- ✓ Error scenarios show error toasts with descriptive messages
- ✓ Trying to open same resource twice shows error toast
- ✓ Menu renders above other UI elements (proper z-index)

## Interface Contracts

**Provides:**
- Component: `<ResourceContextMenu>` - Reusable context menu for any resource type
- Props interface:
  ```typescript
  interface ResourceContextMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    resource: ResourceFile | null;
    onClose: () => void;
  }
  ```
- Actions: Copy path, open in new window, open in editor (cursor/claude/vscode)

**Requires:**
- Chakra UI: Menu, Portal, HStack, Icon, Text components
- React Icons: lu (Lucide) and ri (Remix Icon) icon libraries
- IPC functions: `invokeOpenResourceInWindow`, `invokeOpenFileInEditor`
- Toast notification system: `toaster.create()`
- TypeScript interfaces for resource metadata and PreviewWindowConfig
- Backend commands: `open_resource_in_window`, `open_file_in_editor`
- Preview route handler in App.tsx that renders PreviewWindowPage
- PreviewWindowPage component that reads query params and displays resource

**Compatible With:**
- Any list component displaying resources (Kits, Walkthroughs, Agents, Blueprints, etc.)
- Parent components managing context menu state via useState
- Mouse event handlers capturing clientX/clientY coordinates
- Different resource types with consistent metadata structure (path, name, frontMatter)
- Multiple editor integrations by extending the editor type union

## Usage Pattern

**Parent component integration:**
```typescript
const [contextMenu, setContextMenu] = useState<{
  isOpen: boolean;
  x: number;
  y: number;
  resource: ResourceFile | null;
}>({
  isOpen: false,
  x: 0,
  y: 0,
  resource: null,
});

const handleContextMenu = (e: React.MouseEvent, resource: ResourceFile) => {
  e.preventDefault();
  setContextMenu({
    isOpen: true,
    x: e.clientX,
    y: e.clientY,
    resource,
  });
};

return (
  <>
    <ResourceItem
      onContextMenu={(e) => handleContextMenu(e, resource)}
    />
    <ResourceContextMenu
      isOpen={contextMenu.isOpen}
      x={contextMenu.x}
      y={contextMenu.y}
      resource={contextMenu.resource}
      onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
    />
  </>
);
```

**Context Menu Component Implementation:**
```typescript
import { invokeOpenResourceInWindow } from '../../ipc/files';
import { invokeOpenFileInEditor } from '../../ipc/projects';
import { toaster } from '../ui/toaster';

const handleOpenInNewWindow = async () => {
  try {
    const displayName = resource.frontMatter?.alias || resource.name;

    // Generate unique window ID from resource path
    const windowId = resource.path.replace(/[^a-zA-Z0-9]/g, '-');

    // Open in Tauri window
    await invokeOpenResourceInWindow({
      windowId,
      resourceId: resource.path,
      resourceType: 'kit', // or 'plan', 'walkthrough', etc.
      title: displayName,
      width: 1200,
      height: 900,
    });

    toaster.create({
      type: 'success',
      title: 'Window opened',
      description: `${displayName} opened in new window`,
    });

    onClose();
  } catch (err) {
    console.error('Failed to open window:', err);
    toaster.create({
      type: 'error',
      title: 'Failed to open window',
      description: err instanceof Error ? err.message : 'Unknown error',
    });
  }
};
```

## Customization Points

**Context Menu:**
- Menu items can be extended with additional actions
- Submenu can include more editor options
- Icons can be swapped for brand consistency
- Toast notification styles follow app theme
- Menu width and styling via Chakra UI props
- Menu positioning logic can account for screen edges

**Preview Windows:**
- Window size customizable via width/height parameters (default: 1200x900)
- Window ID generation logic can be customized (must be unique)
- Resource type determines how content is displayed
- Preview page can be customized to show different components per resource type
- IPC timeout values configurable per action (default: 5s for window creation)
- Window properties (resizable, decorations, etc.) configurable in backend command

## Backend Requirements

**Rust Commands (src-tauri/src/commands.rs):**
```rust
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewWindowConfig {
    pub window_id: String,
    pub resource_id: String,
    pub resource_type: String,
    pub title: String,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[tauri::command]
pub async fn open_resource_in_window(
    app_handle: AppHandle,
    config: PreviewWindowConfig,
) -> Result<(), String> {
    use tauri::{WindowBuilder, WindowUrl, Manager};

    let window_label = format!("preview-{}", config.window_id);

    if app_handle.get_window(&window_label).is_some() {
        return Err(format!("Window '{}' already exists", window_label));
    }

    let url = format!(
        "/preview?resourceId={}&resourceType={}",
        urlencoding::encode(&config.resource_id),
        urlencoding::encode(&config.resource_type)
    );

    WindowBuilder::new(&app_handle, window_label, WindowUrl::App(url.into()))
        .title(&config.title)
        .inner_size(config.width.unwrap_or(1200.0), config.height.unwrap_or(900.0))
        .resizable(true)
        .decorations(true)
        .center()
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    Ok(())
}
```

**Frontend Route Handling (App.tsx):**
```typescript
// Check if this is a preview window
const isPreviewWindow = window.location.pathname === '/preview';

if (isPreviewWindow) {
  return (
    <ColorModeProvider>
      <FeatureFlagsProvider>
        <ResourceProvider>
          <PreviewWindowPage />
        </ResourceProvider>
      </FeatureFlagsProvider>
    </ColorModeProvider>
  );
}
```

**Preview Window Page (PreviewWindowPage.tsx):**
```typescript
export default function PreviewWindowPage() {
  const [resource, setResource] = useState<ResourceFile | null>(null);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resourceId = params.get('resourceId');
    const resourceType = params.get('resourceType');

    // Load file content via invokeReadFile
    // Parse front matter
    // Create ResourceFile object
    // Set state
  }, []);

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      <Box flexShrink={0}>
        <Header />
      </Box>
      <Box flex="1" minH={0} overflow="auto">
        <ResourceMarkdownViewer resource={resource} content={content} />
      </Box>
    </VStack>
  );
}
```
