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
import FeaturedTemplatesModal from './FeaturedTemplatesModal';
import AddBranchDialog from './AddBranchDialog';
import SelectTemplateModal from './SelectTemplateModal';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface TemplatesTabContentProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
  onDeselectTemplate: () => void;
  featuredTemplates: Template[];
  branches: Branch[];
  onAddBranch: (branch: Branch) => void;
  onSelectTemplateForBranch: (branchId: string, templateId: string) => void;
  availableTemplates: Template[];
  isFeaturedTemplatesModalOpen: boolean;
  onOpenFeaturedTemplatesModal: () => void;
  onCloseFeaturedTemplatesModal: () => void;
}

export default function TemplatesTabContent({
  selectedTemplate,
  onSelectTemplate,
  onDeselectTemplate,
  featuredTemplates,
  branches,
  onAddBranch,
  onSelectTemplateForBranch,
  availableTemplates,
  isFeaturedTemplatesModalOpen,
  onOpenFeaturedTemplatesModal,
  onCloseFeaturedTemplatesModal,
}: TemplatesTabContentProps) {
  const [isAddBranchDialogOpen, setIsAddBranchDialogOpen] = React.useState(false);
  const [isSelectTemplateModalOpen, setIsSelectTemplateModalOpen] = React.useState(false);
  const [selectedBranchForTemplate, setSelectedBranchForTemplate] = React.useState<string | null>(null);

  const selectedTemplateData = featuredTemplates.find(t => t.id === selectedTemplate);

  if (selectedTemplate) {
    return (
      <>
        <VStack align="stretch" gap={4}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselectTemplate}
            alignSelf="flex-start"
          >
            <HStack gap={2}>
              <LuArrowLeft />
              <Text>Back</Text>
            </HStack>
          </Button>
          
          <Heading size="lg">
            {selectedTemplateData?.name || 'Template'}
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
                    Add Templates in separately reusable Branches for your template
                  </Highlight>
                </EmptyState.Title>
                <EmptyState.Description>
                  Branches are separately reusable components for your template
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
                    {branch.templates.map((templateId) => (
                      <Card.Root
                        key={templateId}
                        variant="subtle"
                        minW="200px"
                      >
                        <CardBody>
                          <Text fontSize="sm">
                            {availableTemplates.find(t => t.id === templateId)?.name || 'Template'}
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
                        setSelectedBranchForTemplate(branch.id);
                        setIsSelectTemplateModalOpen(true);
                      }}
                    >
                      <CardBody>
                        <HStack gap={2} justify="center">
                          <Icon color="primary.700">
                            <LuPlus />
                          </Icon>
                          <Text color="primary.700" fontSize="sm" fontWeight="medium">
                            Add Template
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

        <SelectTemplateModal
          isOpen={isSelectTemplateModalOpen}
          onClose={() => {
            setIsSelectTemplateModalOpen(false);
            setSelectedBranchForTemplate(null);
          }}
          templates={availableTemplates}
          onSelect={(templateId) => {
            if (selectedBranchForTemplate) {
              onSelectTemplateForBranch(selectedBranchForTemplate, templateId);
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
            Featured Templates
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} gap={4} mb={4}>
            {featuredTemplates.map((template) => (
              <Card.Root
                key={template.id}
                variant="subtle"
                cursor="pointer"
                _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
                transition="all 0.2s"
                onClick={() => onSelectTemplate(template.id)}
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
          <Flex justify="flex-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenFeaturedTemplatesModal}
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
                query="Templates"
                styles={{
                  px: '1',
                  py: '0.5',
                  bg: 'primary.100',
                  color: 'primary.700',
                  borderRadius: 'sm',
                }}
              >
                Assign Kits as Templates to view here
              </Highlight>
            </EmptyState.Title>
            <EmptyState.Description>
              Templates are foundational starting points that are specifically meant to spin up entirely new apps
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      </VStack>

      <FeaturedTemplatesModal
        isOpen={isFeaturedTemplatesModalOpen}
        onClose={onCloseFeaturedTemplatesModal}
      />
    </>
  );
}

