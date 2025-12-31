import { useState, memo } from 'react';
import {
  VStack,
  Text,
  HStack,
  Icon,
  Card,
  CardBody,
  Badge,
  IconButton,
  EmptyState,
} from '@chakra-ui/react';
import { LuFileText, LuTrash2 } from 'react-icons/lu';
import { PlanDocument, PlanPhase } from '../../types/plan';
import { invokeReadFile } from '../../ipc';
import { deleteResources } from '../../ipc/artifacts';
import { useResource } from '../../contexts/ResourceContext';
import { ResourceFile } from '../../types/resource';
import { toaster } from '../ui/toaster';
import { PlanDocumentContextMenu } from './PlanDocumentContextMenu';

interface PlanDocumentListProps {
  documents: PlanDocument[];
  phases: PlanPhase[];
  selectedDocumentId?: string;
  onSelectDocument?: (document: PlanDocument) => void;
  onDocumentDeleted?: () => void;
}

const PlanDocumentList = memo(function PlanDocumentList({
  documents,
  phases,
  selectedDocumentId,
  onSelectDocument,
  onDocumentDeleted,
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

  // Get phase name for a document
  const getPhaseName = (phaseId?: string) => {
    if (!phaseId) return null;
    const phase = phases.find((p) => p.id === phaseId);
    return phase?.name || null;
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
      <Card.Root variant="subtle">
        <CardBody>
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Title>No Documents</EmptyState.Title>
              <EmptyState.Description>
                Add markdown files to the plan folder to see them here
              </EmptyState.Description>
            </EmptyState.Content>
          </EmptyState.Root>
        </CardBody>
      </Card.Root>
    );
  }

  return (
    <VStack align="stretch" gap={2}>
      <Text fontSize="sm" fontWeight="medium" color="text.secondary">
        Documents ({documents.length})
      </Text>

      {documents.map((document) => {
        const phaseName = getPhaseName(document.phaseId);
        const isSelected = selectedDocumentId === document.id;
        const isDeleting = deletingDocument === document.id;

        return (
          <Card.Root
            key={document.id}
            variant="subtle"
            borderWidth="1px"
            borderColor={isSelected ? 'primary.500' : 'border.subtle'}
            opacity={isDeleting ? 0.5 : 1}
            cursor="pointer"
            onClick={() => handleDocumentClick(document)}
            onContextMenu={(e) => handleContextMenu(e, document)}
            transition="all 0.2s ease-in-out"
            _hover={{
              transform: 'translateY(-2px)',
              shadow: 'sm',
            }}
            role="group"
          >
            <CardBody>
              <HStack justify="space-between" align="start" gap={3}>
                <HStack gap={2} flex="1" minW={0}>
                  <Icon color="primary.500">
                    <LuFileText />
                  </Icon>
                  <VStack align="start" gap={1} flex="1" minW={0}>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      noOfLines={1}
                      title={document.fileName}
                    >
                      {document.fileName}
                    </Text>
                    {phaseName && (
                      <Badge size="sm" variant="subtle" colorPalette="primary">
                        {phaseName}
                      </Badge>
                    )}
                  </VStack>
                </HStack>

                <IconButton
                  aria-label="Delete document"
                  variant="ghost"
                  size="xs"
                  colorPalette="red"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(document);
                  }}
                  disabled={isDeleting}
                  css={{
                    opacity: 0,
                    transition: 'opacity 0.2s ease-in-out',
                    '[role="group"]:hover &': {
                      opacity: 1,
                    },
                  }}
                >
                  <Icon>
                    <LuTrash2 />
                  </Icon>
                </IconButton>
              </HStack>
            </CardBody>
          </Card.Root>
        );
      })}

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
  // Only re-render if documents, phases, or selectedDocumentId actually changed
  return (
    JSON.stringify(prevProps.documents) === JSON.stringify(nextProps.documents) &&
    JSON.stringify(prevProps.phases) === JSON.stringify(nextProps.phases) &&
    prevProps.selectedDocumentId === nextProps.selectedDocumentId
  );
});

export default PlanDocumentList;

