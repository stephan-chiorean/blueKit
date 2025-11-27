import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  SimpleGrid,
  Card,
  CardHeader,
  CardBody,
  Heading,
  Text,
  Box,
} from '@chakra-ui/react';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface FeaturedTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Extended list of featured templates
const allFeaturedTemplates: Template[] = [
  { id: '1', name: 'React + TypeScript', description: 'Modern React app with TypeScript' },
  { id: '2', name: 'Next.js Starter', description: 'Full-stack Next.js application' },
  { id: '3', name: 'Vite + React', description: 'Fast Vite-based React setup' },
  { id: '4', name: 'Tauri Desktop', description: 'Cross-platform desktop app' },
  { id: '5', name: 'Express API', description: 'RESTful API with Express.js' },
  { id: '6', name: 'GraphQL Server', description: 'Apollo GraphQL server setup' },
  { id: '7', name: 'Vue 3 + Vite', description: 'Modern Vue 3 application' },
  { id: '8', name: 'SvelteKit', description: 'Full-stack Svelte framework' },
  { id: '9', name: 'Remix App', description: 'Full-stack React framework' },
  { id: '10', name: 'SolidJS', description: 'Reactive UI library' },
  { id: '11', name: 'Astro', description: 'Content-focused static site generator' },
  { id: '12', name: 'Electron App', description: 'Cross-platform desktop application' },
];

export default function FeaturedTemplatesModal({
  isOpen,
  onClose,
}: FeaturedTemplatesModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="1200px" maxH="80vh" overflowY="auto">
            <Dialog.Header>
              <Dialog.Title>Featured Templates</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Box py={4}>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap={4}>
                  {allFeaturedTemplates.map((template) => (
                    <Card.Root
                      key={template.id}
                      variant="subtle"
                      cursor="pointer"
                      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                      transition="all 0.2s"
                    >
                      <CardHeader>
                        <Heading size="sm">{template.name}</Heading>
                      </CardHeader>
                      <CardBody>
                        <Text fontSize="sm" color="text.secondary">
                          {template.description}
                        </Text>
                      </CardBody>
                    </Card.Root>
                  ))}
                </SimpleGrid>
              </Box>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Close</Button>
              </Dialog.ActionTrigger>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

