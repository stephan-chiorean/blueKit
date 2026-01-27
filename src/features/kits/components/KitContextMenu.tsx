import { Menu, Portal, HStack, Icon, Text } from '@chakra-ui/react';
import { LuExternalLink, LuCopy, LuChevronDown, LuCode } from 'react-icons/lu';
import { RiClaudeFill } from 'react-icons/ri';
import { ArtifactFile, invokeOpenFileInEditor } from '@/ipc';
import { invokeOpenResourceInWindow } from '@/ipc/files';
import { toaster } from '@/shared/components/ui/toaster';

interface KitContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  kit: ArtifactFile | null;
  onClose: () => void;
}

export function KitContextMenu({ isOpen, x, y, kit, onClose }: KitContextMenuProps) {
  if (!isOpen || !kit) return null;

  const handleOpenInNewWindow = async () => {
    try {
      const displayName = kit.frontMatter?.alias || kit.name;

      // Generate unique window ID from kit path (sanitize special characters)
      const windowId = kit.path.replace(/[^a-zA-Z0-9]/g, '-');

      // Open in Tauri window
      await invokeOpenResourceInWindow({
        windowId,
        resourceId: kit.path,
        resourceType: 'kit',
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
      console.error('Failed to open kit in new window:', err);
      toaster.create({
        type: 'error',
        title: 'Failed to open window',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(kit.path);
      toaster.create({
        type: 'success',
        title: 'Path copied',
        description: 'Kit file path copied to clipboard',
      });
      onClose();
    } catch (err) {
      toaster.create({
        type: 'error',
        title: 'Failed to copy',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleOpenInEditor = async (editor: 'cursor' | 'claude') => {
    try {
      await invokeOpenFileInEditor(kit.path, editor);
      toaster.create({
        type: 'success',
        title: 'Opening in editor',
        description: `Opening ${kit.frontMatter?.alias || kit.name} in ${editor === 'cursor' ? 'Cursor' : 'Claude'}`,
      });
      onClose();
    } catch (err) {
      toaster.create({
        type: 'error',
        title: 'Failed to open editor',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <Portal>
      <Menu.Root open={isOpen} onOpenChange={({ open }) => !open && onClose()}>
        <Menu.Positioner>
          <Menu.Content
            minW="220px"
            style={{
              position: 'fixed',
              left: `${x}px`,
              top: `${y}px`,
            }}
          >
            <Menu.Item value="open-window" onSelect={handleOpenInNewWindow}>
              <HStack gap={2} width="100%" justify="space-between">
                <Text fontSize="md">Open in new window</Text>
                <Icon>
                  <LuExternalLink />
                </Icon>
              </HStack>
            </Menu.Item>

            <Menu.Item value="copy-path" onSelect={handleCopyPath}>
              <HStack gap={2} width="100%" justify="space-between">
                <Text fontSize="md">Copy kit path</Text>
                <Icon>
                  <LuCopy />
                </Icon>
              </HStack>
            </Menu.Item>

            <Menu.Separator />

            <Menu.Root positioning={{ placement: 'right-start', gutter: 2 }}>
              <Menu.TriggerItem value="open-submenu">
                <HStack gap={2} width="100%" justify="space-between">
                  <Text fontSize="md">Open</Text>
                  <Icon>
                    <LuChevronDown />
                  </Icon>
                </HStack>
              </Menu.TriggerItem>
              <Menu.Content minW="180px">
                <Menu.Item value="open-cursor" onSelect={() => handleOpenInEditor('cursor')}>
                  <HStack gap={2} width="100%" justify="space-between">
                    <Text fontSize="md">Cursor</Text>
                    <Icon>
                      <LuCode />
                    </Icon>
                  </HStack>
                </Menu.Item>

                <Menu.Item value="open-claude" onSelect={() => handleOpenInEditor('claude')}>
                  <HStack gap={2} width="100%" justify="space-between">
                    <Text fontSize="md">Claude</Text>
                    <Icon>
                      <RiClaudeFill />
                    </Icon>
                  </HStack>
                </Menu.Item>
              </Menu.Content>
            </Menu.Root>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </Portal>
  );
}
