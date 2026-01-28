import { useState, memo } from 'react';
import {
  VStack,
  Text,
  HStack,
  Icon,
  Box,
  IconButton,
  EmptyState,
} from '@chakra-ui/react';
import { LuFileText, LuTrash2, LuGripVertical } from 'react-icons/lu';
import { PlanDocument } from '@/types/plan';
import { invokeReadFile } from '@/ipc';
import { deleteResources } from '@/ipc/artifacts';
import { useResource } from '@/shared/contexts/ResourceContext';
import { ResourceFile } from '@/types/resource';
import { toaster } from '@/shared/components/ui/toaster';
import { PlanDocumentContextMenu } from './PlanDocumentContextMenu';

// DnD Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PlanDocumentListProps {
  documents: PlanDocument[];
  selectedDocumentId?: string;
  onSelectDocument?: (document: PlanDocument) => void;
  onDocumentDeleted?: () => void;
  onReorder?: (documents: PlanDocument[]) => void;
  hideHeader?: boolean;
}

// Sortable Item Component
const SortableDocumentItem = ({
  document,
  isSelected,
  isDeleting,
  onClick,
  onContextMenu,
  onDelete,
  onReorder
}: {
  document: PlanDocument;
  isSelected: boolean;
  isDeleting: boolean;
  onClick: (doc: PlanDocument) => void;
  onContextMenu: (e: React.MouseEvent, doc: PlanDocument) => void;
  onDelete: (doc: PlanDocument) => void;
  onReorder?: (documents: PlanDocument[]) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : (isDeleting ? 0.5 : 1),
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Box
        cursor="pointer"
        onClick={() => onClick(document)}
        onContextMenu={(e) => onContextMenu(e, document)}
        role="group"
        px={2}
        py={1.5}
        borderRadius="6px"
        transition="all 0.15s ease"
        bg={isSelected ? 'rgba(var(--chakra-colors-primary-500) / 0.08)' : 'transparent'}
        _hover={{
          bg: isSelected ? 'rgba(var(--chakra-colors-primary-500) / 0.12)' : 'rgba(128, 128, 128, 0.05)',
          '& .drag-handle': { opacity: 1 },
          '& .delete-btn': { opacity: 1 },
        }}
      >
        <HStack justify="space-between" align="center" gap={2}>
          {/* Drag Handle */}
          {onReorder && (
            <Icon
              className="drag-handle"
              color="text.tertiary"
              cursor="grab"
              opacity={0}
              transition="opacity 0.15s"
              fontSize="xs"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <LuGripVertical />
            </Icon>
          )}

          <HStack gap={2} flex="1" minW={0}>
            <Icon color="text.secondary" fontSize="sm">
              <LuFileText />
            </Icon>
            <Text
              fontSize="13px"
              fontWeight="normal"
              lineClamp={1}
              title={document.fileName}
              color="text.primary"
            >
              {document.fileName}
            </Text>
          </HStack>

          <IconButton
            className="delete-btn"
            aria-label="Delete document"
            variant="ghost"
            size="2xs"
            colorPalette="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(document);
            }}
            disabled={isDeleting}
            css={{
              opacity: 0,
              transition: 'opacity 0.15s ease',
            }}
          >
            <Icon fontSize="xs">
              <LuTrash2 />
            </Icon>
          </IconButton>
        </HStack>
      </Box>
    </div>
  );
};

const PlanDocumentList = memo(function PlanDocumentList({
  documents,
  selectedDocumentId,
  onSelectDocument,
  onDocumentDeleted,
  onReorder,
  hideHeader = false,
}: PlanDocumentListProps) {
  const { setSelectedResource } = useResource();
  const [deletingDocument, setDeletingDocument] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    document: PlanDocument | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    document: null,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onReorder) {
      const oldIndex = documents.findIndex((d) => d.id === active.id);
      const newIndex = documents.findIndex((d) => d.id === over.id);
      const newDocuments = arrayMove(documents, oldIndex, newIndex);
      onReorder(newDocuments);
    }
  };


  // Handle document click - load in workstation
  const handleDocumentClick = async (document: PlanDocument) => {
    try {
      // Read file content
      const content = await invokeReadFile(document.filePath);

      // Create a ResourceFile from the document
      const resourceFile: ResourceFile = {
        path: document.filePath,
        name: document.fileName,
        frontMatter: {},
        resourceType: 'plan',
      };

      // Set in ResourceContext to display in workstation
      setSelectedResource(resourceFile, content, 'plan');

      // Notify parent if callback provided
      if (onSelectDocument) {
        onSelectDocument(document);
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to load document',
        description: String(error),
        closable: true,
      });
    }
  };

  // Handle delete document
  const handleDeleteDocument = async (document: PlanDocument) => {
    if (!confirm(`Are you sure you want to delete "${document.fileName}"?`)) {
      return;
    }

    setDeletingDocument(document.id);
    try {
      await deleteResources([document.filePath]);
      toaster.create({
        type: 'success',
        title: 'Document deleted',
        description: `Deleted ${document.fileName}`,
      });
      onDocumentDeleted?.();
    } catch (error) {
      console.error('Failed to delete document:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to delete document',
        description: String(error),
        closable: true,
      });
    } finally {
      setDeletingDocument(null);
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, document: PlanDocument) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      document,
    });
  };

  if (documents.length === 0) {
    return (
      <Box px={2} py={3}>
        <EmptyState.Root size="sm">
          <EmptyState.Content>
            <EmptyState.Description fontSize="xs" color="text.tertiary">
              No documents yet
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </Box>
    );
  }

  return (
    <VStack align="stretch" gap={0}>
      {!hideHeader && (
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">
          Documents ({documents.length})
        </Text>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={documents.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {documents.map((document) => (
            <SortableDocumentItem
              key={document.id}
              document={document}
              isSelected={selectedDocumentId === document.id}
              isDeleting={deletingDocument === document.id}
              onClick={handleDocumentClick}
              onContextMenu={handleContextMenu}
              onDelete={handleDeleteDocument}
              onReorder={onReorder}
            />
          ))}
        </SortableContext>
      </DndContext>

      <PlanDocumentContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        document={contextMenu.document}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
      />
    </VStack>
  );
}, (prevProps, nextProps) => {
  // Only re-render if documents or selectedDocumentId actually changed
  return (
    JSON.stringify(prevProps.documents) === JSON.stringify(nextProps.documents) &&
    prevProps.selectedDocumentId === nextProps.selectedDocumentId
  );
});

export default PlanDocumentList;

