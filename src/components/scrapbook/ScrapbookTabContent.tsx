import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  Text,
  Icon,
  HStack,
  Button,
} from '@chakra-ui/react';
import { LuFolder, LuFileText, LuArrowLeft } from 'react-icons/lu';
import {
  ScrapbookItem,
  ArtifactFile,
  invokeGetScrapbookItems,
  invokeGetFolderMarkdownFiles,
  invokeReadFile,
} from '../../ipc';
import { parseFrontMatter } from '../../utils/parseFrontMatter';

interface ScrapbookTabContentProps {
  projectPath: string;
  onViewKit: (kit: ArtifactFile) => void;
}

export default function ScrapbookTabContent({
  projectPath,
  onViewKit,
}: ScrapbookTabContentProps) {
  const [scrapbookItems, setScrapbookItems] = useState<ScrapbookItem[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<ScrapbookItem | null>(null);
  const [folderFiles, setFolderFiles] = useState<ArtifactFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load scrapbook items (extra folders/files not in kits/agents/walkthroughs/blueprints)
  const loadScrapbookItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await invokeGetScrapbookItems(projectPath);
      setScrapbookItems(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scrapbook items');
      console.error('Error loading scrapbook items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on a scrapbook item
  const handleItemClick = async (item: ScrapbookItem) => {
    if (item.is_folder) {
      // Load markdown files from the folder
      try {
        setLoading(true);
        const files = await invokeGetFolderMarkdownFiles(item.path);
        setFolderFiles(files);
        setSelectedFolder(item);
      } catch (err) {
        console.error('Error loading folder files:', err);
        setError(err instanceof Error ? err.message : 'Failed to load folder files');
      } finally {
        setLoading(false);
      }
    } else {
      // It's a loose markdown file, view it directly
      try {
        const content = await invokeReadFile(item.path);
        const frontMatter = parseFrontMatter(content);
        const kitFile: ArtifactFile = {
          name: item.name,
          path: item.path,
          frontMatter,
        };
        onViewKit(kitFile);
      } catch (err) {
        console.error('Error loading file:', err);
      }
    }
  };

  // Handle clicking on a file within a folder
  const handleFileClick = async (file: ArtifactFile) => {
    try {
      const content = await invokeReadFile(file.path);
      const frontMatter = parseFrontMatter(content);
      const kitFile: ArtifactFile = {
        ...file,
        frontMatter,
      };
      onViewKit(kitFile);
    } catch (err) {
      console.error('Error loading file:', err);
    }
  };

  // Go back to scrapbook list
  const handleBackToScrapbook = () => {
    setSelectedFolder(null);
    setFolderFiles([]);
    loadScrapbookItems();
  };

  // Load scrapbook items on mount
  useEffect(() => {
    loadScrapbookItems();
  }, [projectPath]);

  if (loading) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        Loading scrapbook items...
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={12} color="red.500">
        Error: {error}
      </Box>
    );
  }

  // Render file list (when inside a folder)
  if (selectedFolder) {
    return (
      <Box>
        <Flex align="center" gap={4} mb={6}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToScrapbook}
          >
            <HStack gap={2}>
              <Icon>
                <LuArrowLeft />
              </Icon>
              <Text>Back</Text>
            </HStack>
          </Button>
          <Heading size="md">{selectedFolder.name}</Heading>
        </Flex>

        {folderFiles.length === 0 ? (
          <Box textAlign="center" py={12} color="text.secondary">
            No markdown files found in this folder.
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {folderFiles.map((file) => (
              <Card.Root
                key={file.path}
                variant="subtle"
                borderWidth="1px"
                borderColor="border.subtle"
                cursor="pointer"
                onClick={() => handleFileClick(file)}
                _hover={{ borderColor: "primary.400", bg: "primary.hover.bg" }}
                transition="all 0.2s"
              >
                <CardHeader>
                  <Flex align="center" gap={2}>
                    <Icon boxSize={5} color="text.secondary">
                      <LuFileText />
                    </Icon>
                    <Heading size="md">{file.name}</Heading>
                  </Flex>
                </CardHeader>
                <CardBody display="flex" flexDirection="column" flex="1">
                  <Text fontSize="sm" color="text.secondary">
                    {file.path}
                  </Text>
                </CardBody>
              </Card.Root>
            ))}
          </SimpleGrid>
        )}
      </Box>
    );
  }

  // Render scrapbook item list (root view)
  if (scrapbookItems.length === 0) {
    return (
      <Box textAlign="center" py={12} color="text.secondary">
        No extra folders or files found in .bluekit directory.
        <Text fontSize="sm" mt={2}>
          Add custom folders to .bluekit to see them here.
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {scrapbookItems.map((item) => (
          <Card.Root
            key={item.path}
            variant="subtle"
            borderWidth="1px"
            borderColor="border.subtle"
            cursor="pointer"
            onClick={() => handleItemClick(item)}
            _hover={{ borderColor: "primary.400", bg: "primary.hover.bg" }}
            transition="all 0.2s"
          >
            <CardHeader>
              <HStack gap={2} align="center">
                <Icon boxSize={5} color={item.is_folder ? "primary.500" : "text.secondary"}>
                  {item.is_folder ? <LuFolder /> : <LuFileText />}
                </Icon>
                <Heading size="md">{item.name}</Heading>
              </HStack>
            </CardHeader>
            <CardBody display="flex" flexDirection="column" flex="1">
              <Text fontSize="sm" color="text.secondary" mb={4} flex="1">
                {item.path}
              </Text>
              <Text fontSize="xs" color="text.tertiary">
                {item.is_folder ? 'Folder' : 'File'}
              </Text>
            </CardBody>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Box>
  );
}
