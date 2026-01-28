import {
  Box,
  VStack,
  Button,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import MermaidDiagramViewer from '@/features/workstation/components/MermaidDiagramViewer';
import { ArtifactFile } from '@/ipc';

interface DiagramViewPageProps {
  diagram: ArtifactFile;
  diagramContent: string;
  onBack: () => void;
}

export default function DiagramViewPage({ diagram, diagramContent, onBack }: DiagramViewPageProps) {
  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Back button */}
      <Box p={4} borderBottomWidth="1px" borderColor="border.subtle">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
        >
          <HStack gap={2}>
            <Icon>
              <LuArrowLeft />
            </Icon>
            <Text>Back</Text>
          </HStack>
        </Button>
      </Box>
      
      {/* Diagram viewer */}
      <Box flex="1" minH={0} overflow="hidden">
        <MermaidDiagramViewer diagram={diagram} content={diagramContent} />
      </Box>
    </VStack>
  );
}
