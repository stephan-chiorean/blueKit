import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  VStack,
  Text,
  Card,
  CardBody,
  Heading,
} from '@chakra-ui/react';

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

interface SelectBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprints: Blueprint[];
  onSelect: (blueprintId: string) => void;
}

export default function SelectBlueprintModal({
  isOpen,
  onClose,
  blueprints,
  onSelect,
}: SelectBlueprintModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Select Blueprint</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={2}>
                {blueprints.length === 0 ? (
                  <Text color="text.secondary" textAlign="center" py={4}>
                    No blueprints available
                  </Text>
                ) : (
                  blueprints.map((blueprint) => (
                    <Card.Root
                      key={blueprint.id}
                      variant="subtle"
                      cursor="pointer"
                      _hover={{ bg: 'primary.50', borderColor: 'primary.300' }}
                      borderWidth="1px"
                      borderColor="border.subtle"
                      onClick={() => {
                        onSelect(blueprint.id);
                        onClose();
                      }}
                    >
                      <CardBody>
                        <Heading size="sm" mb={1}>{blueprint.name}</Heading>
                        {blueprint.description && (
                          <Text fontSize="sm" color="text.secondary">
                            {blueprint.description}
                          </Text>
                        )}
                      </CardBody>
                    </Card.Root>
                  ))
                )}
              </VStack>
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






