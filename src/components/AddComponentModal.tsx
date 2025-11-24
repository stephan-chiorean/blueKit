import {
  Dialog,
  Button,
  Portal,
  CloseButton,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading,
  HStack,
  Icon,
} from '@chakra-ui/react';
import { LuPackage, LuLayers, LuBookOpen, LuCode } from 'react-icons/lu';

interface AddComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: 'Kits' | 'Collections' | 'Walkthroughs' | 'Custom') => void;
}

export default function AddComponentModal({
  isOpen,
  onClose,
  onSelectCategory,
}: AddComponentModalProps) {
  const categories = [
    { name: 'Kits', icon: LuPackage },
    { name: 'Collections', icon: LuLayers },
    { name: 'Walkthroughs', icon: LuBookOpen },
    { name: 'Custom', icon: LuCode },
  ] as const;

  const handleSelect = (category: typeof categories[number]['name']) => {
    if (category === 'Custom') {
      onSelectCategory(category);
      onClose();
    }
    // Other categories will be implemented later
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px">
            <Dialog.Header>
              <Dialog.Title>Add Component</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
                {categories.map((category) => (
                  <Card.Root
                    key={category.name}
                    variant="subtle"
                    cursor="pointer"
                    transition="all 0.2s"
                    _hover={{
                      transform: 'scale(1.02)',
                      bg: 'primary.50',
                    }}
                    onClick={() => handleSelect(category.name)}
                    opacity={category.name !== 'Custom' ? 0.5 : 1}
                  >
                    <CardHeader>
                      <HStack gap={3}>
                        <Icon size="lg">
                          <category.icon />
                        </Icon>
                        <Heading size="md">{category.name}</Heading>
                      </HStack>
                    </CardHeader>
                    <CardBody>
                    </CardBody>
                  </Card.Root>
                ))}
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

