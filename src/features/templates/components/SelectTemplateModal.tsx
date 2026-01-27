import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  SimpleGrid,
  Card,
  CardBody,
  Heading,
  Text,
  VStack,
  EmptyState,
} from '@chakra-ui/react';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface SelectTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onSelect: (templateId: string) => void;
}

export default function SelectTemplateModal({
  isOpen,
  onClose,
  templates,
  onSelect,
}: SelectTemplateModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="800px" maxH="80vh" overflowY="auto">
            <Dialog.Header>
              <Dialog.Title>Select Template</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {templates.length === 0 ? (
                <EmptyState.Root>
                  <EmptyState.Content>
                    <EmptyState.Title>No templates available</EmptyState.Title>
                  </EmptyState.Content>
                </EmptyState.Root>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={4} py={4}>
                  {templates.map((template) => (
                    <Card.Root
                      key={template.id}
                      variant="subtle"
                      cursor="pointer"
                      _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                      transition="all 0.2s"
                      onClick={() => {
                        onSelect(template.id);
                        onClose();
                      }}
                    >
                      <CardBody>
                        <VStack align="stretch" gap={2}>
                          <Heading size="sm" mb={1}>{template.name}</Heading>
                          {template.description && (
                            <Text fontSize="sm" color="text.secondary">
                              {template.description}
                            </Text>
                          )}
                        </VStack>
                      </CardBody>
                    </Card.Root>
                  ))}
                </SimpleGrid>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
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

