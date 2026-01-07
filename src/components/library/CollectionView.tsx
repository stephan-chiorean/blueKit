import { useState, useEffect } from 'react';
import {
    Box,
    HStack,
    Icon,
    Text,
    Button,
    SimpleGrid,
    Portal,
    VStack,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
} from 'react-icons/lu';
import { BsBookmarkFill } from 'react-icons/bs';
import { CatalogWithVariations, LibraryVariation, LibraryCatalog } from '../../types/github';
import { LibraryCollection } from '../../ipc/library';
import { Project } from '../../ipc';
import { LibrarySelectionBar } from './LibrarySelectionBar';
import { CatalogCard } from './CatalogCard';
import { CatalogDetailModal } from './CatalogDetailModal';
import { useColorMode } from '../../contexts/ColorModeContext';

// Types for selected items
interface SelectedVariation {
    variation: LibraryVariation;
    catalog: LibraryCatalog;
}

interface SelectedCatalog {
    catalog: LibraryCatalog;
    variations: LibraryVariation[];
}

interface CollectionViewProps {
    collection: LibraryCollection | null;
    catalogs: CatalogWithVariations[];
    selectedVariations: Map<string, SelectedVariation>;
    selectedCatalogs: Map<string, SelectedCatalog>;
    onCatalogToggle: (catalogWithVariations: CatalogWithVariations) => void;
    onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
    onMoveToCollection: (collectionId: string) => void;
    onRemoveFromCollection: () => void;
    onBulkPull: (projects: Project[]) => void;
    clearVariationSelection: () => void;
    projects: Project[];
    bulkPulling: boolean;
    allCollections: LibraryCollection[];
    onFetchVariationContent?: (variation: LibraryVariation, catalog: LibraryCatalog) => Promise<string>;
    onBack: () => void;
}

export default function CollectionView({
    collection,
    catalogs,
    selectedVariations,
    selectedCatalogs,
    onCatalogToggle,
    onVariationToggle,
    onMoveToCollection,
    onRemoveFromCollection,
    onBulkPull,
    clearVariationSelection,
    projects,
    bulkPulling,
    allCollections,
    onFetchVariationContent,
    onBack,
}: CollectionViewProps) {
    const { colorMode } = useColorMode();
    // View state
    const [viewingCatalog, setViewingCatalog] = useState<CatalogWithVariations | null>(null);
    const [lastViewingCatalog, setLastViewingCatalog] = useState<CatalogWithVariations | null>(null);

    // Keep track of the last valid catalog to allow exit animations
    useEffect(() => {
        if (viewingCatalog) {
            setLastViewingCatalog(viewingCatalog);
        }
    }, [viewingCatalog]);

    // Check if there are any selections
    const hasSelections = selectedVariations.size > 0 || selectedCatalogs.size > 0;

    // Handle catalog click
    const handleCatalogClick = (catalogWithVariations: CatalogWithVariations) => {
        setViewingCatalog(catalogWithVariations);
    };

    if (!collection) return null;

    return (
        <Box
            width="100%"
            h="100%"
            overflowY="auto"
            pb={20}
        >
            {/* Header / Breadcrumbs */}
            <Box
                position="sticky"
                top={0}
                zIndex={100}
                bg="transparent"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                px={8}
                py={4}
            >
                <HStack gap={4} align="center">
                    {/* Back button */}
                    <Button
                        variant="ghost"
                        size="md"
                        onClick={onBack}
                        px={2}
                        borderRadius="full"
                        _hover={{ bg: colorMode === 'light' ? 'blackAlpha.50' : 'whiteAlpha.100' }}
                    >
                        <LuArrowLeft size={20} />
                    </Button>

                    {/* Collection name with bookmark icon */}
                    <HStack gap={3} align="center">
                        <Box
                            p={2}
                            borderRadius="lg"
                            bg={colorMode === 'light' ? 'blue.50' : 'blue.900/30'}
                            color="blue.500"
                        >
                            <Icon boxSize={5}>
                                <BsBookmarkFill />
                            </Icon>
                        </Box>
                        <VStack align="start" gap={0}>
                            <Text fontSize="xs" color="fg.muted" fontWeight="medium" textTransform="uppercase" letterSpacing="wider">
                                Collection
                            </Text>
                            <Text fontWeight="bold" fontSize="xl" color="fg">
                                {collection.name}
                            </Text>
                        </VStack>
                    </HStack>
                </HStack>
            </Box>

            <Box p={6}>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4} p={1}>
                    {catalogs.map((catWithVars) => (
                        <CatalogCard
                            key={catWithVars.catalog.id}
                            catalogWithVariations={catWithVars}
                            isSelected={selectedCatalogs.has(catWithVars.catalog.id)}
                            onCatalogToggle={() => onCatalogToggle(catWithVars)}
                            onCardClick={() => handleCatalogClick(catWithVars)}
                        />
                    ))}
                    {catalogs.length === 0 && (
                        <Text color="text.secondary" textAlign="center" py={10}>No catalogs in this collection.</Text>
                    )}
                </SimpleGrid>
            </Box>

            {/* Catalog Detail Modal */}
            {
                (viewingCatalog || lastViewingCatalog) && (
                    <CatalogDetailModal
                        isOpen={!!viewingCatalog}
                        onClose={() => setViewingCatalog(null)}
                        catalogWithVariations={(viewingCatalog || lastViewingCatalog)!}
                        onFetchVariationContent={onFetchVariationContent || (async () => "")}
                        selectedVariations={selectedVariations}
                        onVariationToggle={onVariationToggle}
                        projects={projects}
                        onBulkPull={onBulkPull}
                        bulkPulling={bulkPulling}
                    />
                )
            }

            {/* Floating Action Bar */}
            <Portal>
                <LibrarySelectionBar
                    isOpen={hasSelections} // Show even if drilling down
                    selectedVariations={Array.from(selectedVariations.values())}
                    onClearSelection={clearVariationSelection}
                    onRemoveFromCollection={onRemoveFromCollection}
                    onMoveToCollection={onMoveToCollection}
                    onBulkPull={onBulkPull}
                    projects={projects}
                    collections={allCollections}
                    isLoading={bulkPulling}
                    position="fixed"
                />
            </Portal>
        </Box >
    );
}
