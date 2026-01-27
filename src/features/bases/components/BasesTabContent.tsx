import React from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  SimpleGrid,
  Flex,
  VStack,
  Text,
  HStack,
  Separator,
  EmptyState,
  Highlight,
  Group,
  Icon,
  Tag,
} from '@chakra-ui/react';
import { LuArrowLeft, LuArrowRight, LuPlus } from 'react-icons/lu';
import { ImTree } from 'react-icons/im';
import { PiTreeStructure } from 'react-icons/pi';
import { Branch } from './AddBranchDialog';
import FeaturedBasesModal from './FeaturedBasesModal';
import AddBranchDialog from './AddBranchDialog';
import SelectBlueprintModal from '@/features/blueprints/components/SelectBlueprintModal';

interface Base {
  id: string;
  name: string;
  description: string;
}

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

interface BasesTabContentProps {
  selectedBase: string | null;
  onSelectBase: (baseId: string) => void;
  onDeselectBase: () => void;
  featuredBases: Base[];
  branches: Branch[];
  onAddBranch: (branch: Branch) => void;
  onSelectBlueprint: (branchId: string, blueprintId: string) => void;
  blueprints: Blueprint[];
  isFeaturedBasesModalOpen: boolean;
  onOpenFeaturedBasesModal: () => void;
  onCloseFeaturedBasesModal: () => void;
}

export default function BasesTabContent({
  selectedBase,
  onSelectBase,
  onDeselectBase,
  featuredBases,
  branches,
  onAddBranch,
  onSelectBlueprint,
  blueprints,
  isFeaturedBasesModalOpen,
  onOpenFeaturedBasesModal,
  onCloseFeaturedBasesModal,
}: BasesTabContentProps) {
  const [isAddBranchDialogOpen, setIsAddBranchDialogOpen] = React.useState(false);
  const [isSelectBlueprintModalOpen, setIsSelectBlueprintModalOpen] = React.useState(false);
  const [selectedBranchForBlueprint, setSelectedBranchForBlueprint] = React.useState<string | null>(null);

  const selectedBaseData = featuredBases.find(b => b.id === selectedBase);

  if (selectedBase) {
    return (
      <>
        <VStack align="stretch" gap={4}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselectBase}
            alignSelf="flex-start"
          >
            <HStack gap={2}>
              <LuArrowLeft />
              <Text>Back</Text>
            </HStack>
          </Button>
          
          <Heading size="lg">
            {selectedBaseData?.name || 'Base'}
          </Heading>

          {branches.length === 0 ? (
            <EmptyState.Root>
              <EmptyState.Content>
                <EmptyState.Indicator>
                  <Icon size="xl" color="primary.500">
                    <ImTree />
                  </Icon>
                </EmptyState.Indicator>
                <EmptyState.Title>
                  <Highlight
                    query="Branches"
                    styles={{
                      px: '1',
                      py: '0.5',
                      bg: 'primary.100',
                      color: 'primary.700',
                      borderRadius: 'sm',
                    }}
                  >
                    Add Blueprints in separately reusable Branches for your base
                  </Highlight>
                </EmptyState.Title>
                <EmptyState.Description>
                  Branches are separately reusable components for your base
                </EmptyState.Description>
                <Button
                  colorPalette="primary"
                  onClick={() => setIsAddBranchDialogOpen(true)}
                  mt={4}
                >
                  <HStack gap={2}>
                    <ImTree />
                    <Text>Add Branch</Text>
                  </HStack>
                </Button>
              </EmptyState.Content>
            </EmptyState.Root>
          ) : (
            <VStack align="stretch" gap={6}>
              {branches.map((branch) => (
                <Box key={branch.id}>
                  <Flex align="center" justify="space-between" mb={3}>
                    <HStack gap={2}>
                      <Icon color="primary.500">
                        <PiTreeStructure />
                      </Icon>
                      <Heading size="md">
                        {branch.name}
                      </Heading>
                    </HStack>
                    <Tag.Root
                      cursor="pointer"
                      colorPalette="primary"
                      variant="subtle"
                      onClick={() => {
                        console.log('Add branch to project:', branch.id);
                      }}
                      _hover={{ bg: 'primary.100' }}
                    >
                      <Tag.Label>Add to Project</Tag.Label>
                    </Tag.Root>
                  </Flex>
                  <Group>
                    {branch.blueprints.map((blueprintId) => (
                      <Card.Root
                        key={blueprintId}
                        variant="subtle"
                        minW="200px"
                      >
                        <CardBody>
                          <Text fontSize="sm">
                            {blueprints.find(b => b.id === blueprintId)?.name || 'Blueprint'}
                          </Text>
                        </CardBody>
                      </Card.Root>
                    ))}
                    <Card.Root
                      borderWidth="1px"
                      borderColor="primary.600"
                      bg="primary.100"
                      cursor="pointer"
                      _hover={{ bg: 'primary.200' }}
                      transition="all 0.2s"
                      minW="200px"
                      onClick={() => {
                        setSelectedBranchForBlueprint(branch.id);
                        setIsSelectBlueprintModalOpen(true);
                      }}
                    >
                      <CardBody>
                        <HStack gap={2} justify="center">
                          <Icon color="primary.700">
                            <LuPlus />
                          </Icon>
                          <Text color="primary.700" fontSize="sm" fontWeight="medium">
                            Add Blueprint
                          </Text>
                        </HStack>
                      </CardBody>
                    </Card.Root>
                  </Group>
                </Box>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddBranchDialogOpen(true)}
                alignSelf="flex-start"
              >
                <HStack gap={2}>
                  <ImTree />
                  <Text>Add Branch</Text>
                </HStack>
              </Button>
            </VStack>
          )}
        </VStack>

        <AddBranchDialog
          isOpen={isAddBranchDialogOpen}
          onClose={() => setIsAddBranchDialogOpen(false)}
          onAdd={onAddBranch}
        />

        <SelectBlueprintModal
          isOpen={isSelectBlueprintModalOpen}
          onClose={() => {
            setIsSelectBlueprintModalOpen(false);
            setSelectedBranchForBlueprint(null);
          }}
          blueprints={blueprints}
          onSelect={(blueprintId) => {
            if (selectedBranchForBlueprint) {
              onSelectBlueprint(selectedBranchForBlueprint, blueprintId);
            }
          }}
        />
      </>
    );
  }

  return (
    <>
      <VStack align="stretch" gap={6}>
        <Box>
          <Heading size="md" mb={4}>
            Featured Bases
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4} mb={4}>
            {featuredBases.map((base) => (
              <Card.Root
                key={base.id}
                variant="subtle"
                cursor="pointer"
                _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                transition="all 0.2s"
                onClick={() => onSelectBase(base.id)}
              >
                <CardHeader>
                  <Heading size="sm">{base.name}</Heading>
                </CardHeader>
                <CardBody>
                  <Text fontSize="sm" color="text.secondary">
                    {base.description}
                  </Text>
                </CardBody>
              </Card.Root>
            ))}
          </SimpleGrid>
          <Flex justify="flex-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenFeaturedBasesModal}
            >
              <HStack gap={2}>
                <Text>See More</Text>
                <LuArrowRight />
              </HStack>
            </Button>
          </Flex>
        </Box>

        <Separator />

        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Title>
              <Highlight
                query="Bases"
                styles={{
                  px: '1',
                  py: '0.5',
                  bg: 'primary.100',
                  color: 'primary.700',
                  borderRadius: 'sm',
                }}
              >
                Assign Kits as Bases to view here
              </Highlight>
            </EmptyState.Title>
            <EmptyState.Description>
              Bases are foundational templates that are specifically meant to spin up entirely new apps
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </VStack>

      <FeaturedBasesModal
        isOpen={isFeaturedBasesModalOpen}
        onClose={onCloseFeaturedBasesModal}
      />
    </>
  );
}

