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
  Carousel,
  Image,
  IconButton,
  SegmentGroup,
} from '@chakra-ui/react';
import { LuArrowLeft, LuArrowRight, LuPlus, LuChevronLeft, LuChevronRight, LuStar, LuUser } from 'react-icons/lu';
import { BiMinusFront } from 'react-icons/bi';
import { ImTree } from 'react-icons/im';
import { PiTreeStructure } from 'react-icons/pi';
import { Branch } from './AddBranchDialog';
import FeaturedTemplatesModal from './FeaturedTemplatesModal';
import AddBranchDialog from './AddBranchDialog';
import SelectTemplateModal from './SelectTemplateModal';
import featuredPic1 from '@/assets/featured-pic-1.png';
import featuredPic2 from '@/assets/featured-pic-2.avif';
import featuredPic3 from '@/assets/featured-pic-3.png';

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
  const [viewMode, setViewMode] = React.useState<'featured' | 'personal'>('featured');

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

  // Featured template images - using 3 unique images + 1 duplicate to make 4 total
  const featuredImages = [
    featuredPic1,
    featuredPic2,
    featuredPic3,
    featuredPic1, // Duplicate first image
  ];

  return (
    <>
      <VStack align="stretch" gap={6}>
        <Box width="fit-content">
          <SegmentGroup.Root
            value={viewMode}
            onValueChange={(e) => setViewMode(e.value as 'featured' | 'personal')}
            mb={4}
          >
            <SegmentGroup.Indicator />
            <SegmentGroup.Items
              items={[
                {
                  value: 'featured',
                  label: (
                    <HStack gap={2}>
                      <LuStar />
                      <Text>Featured</Text>
                    </HStack>
                  ),
                },
                {
                  value: 'personal',
                  label: (
                    <HStack gap={2}>
                      <LuUser />
                      <Text>Personal</Text>
                    </HStack>
                  ),
                },
              ]}
            />
          </SegmentGroup.Root>
        </Box>

        {viewMode === 'featured' ? (
          <Box flex="1">
            <Carousel.Root slideCount={featuredImages.length} mb={4} gap={4}>
              <Carousel.Control justifyContent="center" gap={4} width="full">
                <Carousel.PrevTrigger asChild>
                  <IconButton size="sm" variant="ghost" aria-label="Previous">
                    <LuChevronLeft />
                  </IconButton>
                </Carousel.PrevTrigger>

                <Carousel.ItemGroup width="full">
                  {featuredImages.map((imageSrc, index) => (
                    <Carousel.Item key={index} index={index}>
                      <Box
                        position="relative"
                        w="100%"
                        h="500px"
                        borderRadius="lg"
                        overflow="hidden"
                        cursor="pointer"
                        _hover={{ transform: 'scale(1.02)', transition: 'transform 0.2s' }}
                        onClick={() => {
                          // Map image index to template index (cycling through templates)
                          const templateIndex = index % featuredTemplates.length;
                          onSelectTemplate(featuredTemplates[templateIndex].id);
                        }}
                      >
                        <Image
                          src={imageSrc}
                          alt={`Featured template ${index + 1}`}
                          w="100%"
                          h="100%"
                          fit="cover"
                        />
                        <Box
                          position="absolute"
                          bottom={0}
                          left={0}
                          right={0}
                          bg="linear-gradient(to top, rgba(0,0,0,0.7), transparent)"
                          p={4}
                        >
                          <Heading size="sm" color="white">
                            {featuredTemplates[index % featuredTemplates.length]?.name}
                          </Heading>
                          <Text fontSize="sm" color="white" mt={1}>
                            {featuredTemplates[index % featuredTemplates.length]?.description}
                          </Text>
                        </Box>
                      </Box>
                    </Carousel.Item>
                  ))}
                </Carousel.ItemGroup>

                <Carousel.NextTrigger asChild>
                  <IconButton size="sm" variant="ghost" aria-label="Next">
                    <LuChevronRight />
                  </IconButton>
                </Carousel.NextTrigger>
              </Carousel.Control>

              <Carousel.Indicators />
            </Carousel.Root>
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
        ) : (
          <EmptyState.Root>
            <EmptyState.Content>
              <EmptyState.Indicator>
                <Icon size="xl" color="primary.500">
                  <BiMinusFront />
                </Icon>
              </EmptyState.Indicator>
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
        )}
      </VStack>

      <FeaturedTemplatesModal
        isOpen={isFeaturedTemplatesModalOpen}
        onClose={onCloseFeaturedTemplatesModal}
      />
    </>
  );
}

