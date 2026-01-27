import { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  VStack,
  HStack,
  Text,
  Portal,
  CloseButton,
  Card,
  CardBody,
  Icon,
  Flex,
  Spinner,
  Input,
  InputGroup,
  Field,
  IconButton,
} from '@chakra-ui/react';
import { LuFileText, LuX } from 'react-icons/lu';
import { invokeLinkBrainstormToPlan } from '@/ipc';
import { invokeGetPlansFiles } from '@/ipc/artifacts';
import { ArtifactFile } from '@/ipc/types';
import { toaster } from '@/shared/components/ui/toaster';

interface LinkBrainstormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  onLinked: () => void;
}

type SourceFilter = 'claude' | 'cursor';

export default function LinkBrainstormDialog({
  isOpen,
  onClose,
  planId,
  onLinked,
}: LinkBrainstormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [claudePlans, setClaudePlans] = useState<ArtifactFile[]>([]);
  const [cursorPlans, setCursorPlans] = useState<ArtifactFile[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceFilter | null>(null);
  const [filterText, setFilterText] = useState('');

  // Load plans from both sources
  useEffect(() => {
    if (!isOpen) return;

    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        const [claude, cursor] = await Promise.all([
          invokeGetPlansFiles('claude'),
          invokeGetPlansFiles('cursor'),
        ]);

        setClaudePlans(claude);
        setCursorPlans(cursor);
      } catch (error) {
        console.error('Failed to load plans:', error);
        toaster.create({
          type: 'error',
          title: 'Failed to load plans',
          description: String(error),
          closable: true,
        });
      } finally {
        setLoadingPlans(false);
      }
    };

    loadPlans();
  }, [isOpen]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPath(null);
      setSelectedSource(null);
      setFilterText('');
    }
  }, [isOpen]);

  // Get plans for selected source
  const getPlansForSource = (source: SourceFilter): ArtifactFile[] => {
    return source === 'claude' ? claudePlans : cursorPlans;
  };

  // Filter plans by search text
  const filteredPlans = selectedSource
    ? getPlansForSource(selectedSource).filter(plan => {
        if (filterText) {
          const lowerFilter = filterText.toLowerCase();
          return plan.name.toLowerCase().includes(lowerFilter) ||
                 plan.path.toLowerCase().includes(lowerFilter);
        }
        return true;
      })
    : [];

  const handleLink = async () => {
    if (!selectedPath) {
      toaster.create({
        type: 'error',
        title: 'No file selected',
        description: 'Please select a plan file to link',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await invokeLinkBrainstormToPlan(planId, selectedPath);

      toaster.create({
        type: 'success',
        title: 'Plan linked',
        description: 'Successfully linked plan file to this plan',
      });

      onLinked();
      onClose();
    } catch (error) {
      console.error('Failed to link plan:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to link plan',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSourceSelect = (source: SourceFilter) => {
    setSelectedSource(source);
    setSelectedPath(null);
    setFilterText('');
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="700px">
            <Dialog.Header>
              <Dialog.Title>Link Plan</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                {!selectedSource ? (
                  <>
                    <Text fontSize="sm" color="text.secondary">
                      Select a source to browse plans:
                    </Text>
                    <HStack gap={4} align="stretch">
                      <Card.Root
                        variant="outline"
                        cursor="pointer"
                        onClick={() => handleSourceSelect('claude')}
                        borderWidth="2px"
                        borderColor="border.subtle"
                        _hover={{
                          borderColor: 'primary.300',
                          bg: 'primary.50',
                        }}
                        flex="1"
                      >
                        <CardBody p={6}>
                          <VStack gap={3}>
                            <Text fontSize="lg" fontWeight="semibold">
                              Claude
                            </Text>
                            <Text fontSize="sm" color="text.secondary" textAlign="center">
                              {claudePlans.length} plan{claudePlans.length !== 1 ? 's' : ''} available
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card.Root>

                      <Card.Root
                        variant="outline"
                        cursor="pointer"
                        onClick={() => handleSourceSelect('cursor')}
                        borderWidth="2px"
                        borderColor="border.subtle"
                        _hover={{
                          borderColor: 'primary.300',
                          bg: 'primary.50',
                        }}
                        flex="1"
                      >
                        <CardBody p={6}>
                          <VStack gap={3}>
                            <Text fontSize="lg" fontWeight="semibold">
                              Cursor
                            </Text>
                            <Text fontSize="sm" color="text.secondary" textAlign="center">
                              {cursorPlans.length} plan{cursorPlans.length !== 1 ? 's' : ''} available
                            </Text>
                          </VStack>
                        </CardBody>
                      </Card.Root>
                    </HStack>
                  </>
                ) : (
                  <>
                    <Flex justify="space-between" align="center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedSource(null);
                          setSelectedPath(null);
                          setFilterText('');
                        }}
                      >
                        ← Back
                      </Button>
                      <Text fontSize="sm" fontWeight="medium" textTransform="capitalize">
                        {selectedSource} Plans
                      </Text>
                      <Text fontSize="sm" color="text.secondary">
                        {filteredPlans.length} plan{filteredPlans.length !== 1 ? 's' : ''}
                      </Text>
                    </Flex>

                    {/* Search Filter */}
                    <Field.Root>
                      <InputGroup
                        endElement={
                          filterText ? (
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Clear filter"
                              onClick={() => setFilterText('')}
                            >
                              <Icon>
                                <LuX />
                              </Icon>
                            </IconButton>
                          ) : undefined
                        }
                      >
                        <Input
                          placeholder="Search plans by name or path..."
                          value={filterText}
                          onChange={(e) => setFilterText(e.target.value)}
                          size="sm"
                        />
                      </InputGroup>
                    </Field.Root>

                    {/* Plans List */}
                    {loadingPlans ? (
                      <Flex justify="center" py={6}>
                        <Spinner size="sm" />
                      </Flex>
                    ) : filteredPlans.length === 0 ? (
                      <Text fontSize="sm" color="text.tertiary" textAlign="center" py={6}>
                        {getPlansForSource(selectedSource).length === 0
                          ? `No ${selectedSource} plans found`
                          : 'No plans match the search'}
                      </Text>
                    ) : (
                      <VStack align="stretch" gap={2} maxH="400px" overflowY="auto">
                        {filteredPlans.map((plan) => (
                          <Card.Root
                            key={plan.path}
                            variant="outline"
                            cursor="pointer"
                            onClick={() => setSelectedPath(plan.path)}
                            borderWidth="1px"
                            borderColor={
                              selectedPath === plan.path ? 'primary.500' : 'border.subtle'
                            }
                            bg={selectedPath === plan.path ? 'primary.50' : 'transparent'}
                            _hover={{
                              borderColor: 'primary.300',
                            }}
                          >
                            <CardBody p={3}>
                              <HStack gap={2}>
                                <Icon color="primary.500">
                                  <LuFileText />
                                </Icon>
                                <VStack align="start" gap={0} flex="1" minW={0}>
                                  <Text
                                    fontSize="sm"
                                    fontWeight="medium"
                                    noOfLines={1}
                                    title={plan.name}
                                  >
                                    {plan.name}
                                  </Text>
                                  <Text
                                    fontSize="xs"
                                    color="text.tertiary"
                                    fontFamily="mono"
                                    noOfLines={1}
                                    title={plan.path}
                                  >
                                    {plan.path}
                                  </Text>
                                </VStack>
                              </HStack>
                            </CardBody>
                          </Card.Root>
                        ))}
                      </VStack>
                    )}
                  </>
                )}
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2} justify="flex-end">
                <Button variant="ghost" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                {selectedSource && (
                  <Button
                    colorPalette="primary"
                    onClick={handleLink}
                    loading={loading}
                    loadingText="Linking..."
                    disabled={!selectedPath}
                  >
                    Link
                  </Button>
                )}
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
