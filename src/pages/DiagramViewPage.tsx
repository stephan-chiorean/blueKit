import {
  Box,
  VStack,
  Button,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { LuArrowLeft } from 'react-icons/lu';
import Header from '../components/Header';
import MermaidDiagramViewer from '../components/workstation/MermaidDiagramViewer';
import { KitFile } from '../ipc';

interface DiagramViewPageProps {
  diagram: KitFile;
  diagramContent: string;
  onBack: () => void;
}

export default function DiagramViewPage({ diagram, diagramContent, onBack }: DiagramViewPageProps) {
  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header />
      </Box>
      
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

