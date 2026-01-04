import { useState } from 'react';
import {
    Box,
    HStack,
    Icon,
    Text,
    Button,
    SimpleGrid,
    Portal,
} from '@chakra-ui/react';
import {
    LuArrowLeft,
    LuBookmark,
} from 'react-icons/lu';
import { CatalogWithVariations, LibraryVariation, LibraryCatalog } from '../../types/github';
import { LibraryCollection } from '../../ipc/library';
import { Project } from '../../ipc';
import { LibrarySelectionBar } from './LibrarySelectionBar';
import { CatalogCard } from './CatalogCard';
import { CatalogDetailModal } from './CatalogDetailModal';

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
    workspaceName: string;
    collection: LibraryCollection | null;
    catalogs: CatalogWithVariations[];
    selectedVariations: Map<string, SelectedVariation>;
    selectedCatalogs: Map<string, SelectedCatalog>;
    onCatalogToggle: (catalogWithVariations: CatalogWithVariations) => void;
    onVariationToggle: (variation: LibraryVariation, catalog: LibraryCatalog) => void;
    onMoveToCollection: (collectionId: string) => void;
    onRemoveFromCollection: () => void;
    onCreateCollection: () => void;
    onBulkPull: (projects: Project[]) => void;
    clearVariationSelection: () => void;
    projects: Project[];
    bulkPulling: boolean;
    allCollections: LibraryCollection[];
    onFetchVariationContent?: (variation: LibraryVariation, catalog: LibraryCatalog) => Promise<string>;
    onBack: () => void;
}

export default function CollectionView({
    workspaceName,
    collection,
    catalogs,
    selectedVariations,
    selectedCatalogs,
    onCatalogToggle,
    onVariationToggle,
    onMoveToCollection,
    onRemoveFromCollection,
    onCreateCollection,
    onBulkPull,
    clearVariationSelection,
    projects,
    bulkPulling,
    allCollections,
    onFetchVariationContent,
    onBack,
}: CollectionViewProps) {
    // View state
    const [viewingCatalog, setViewingCatalog] = useState<CatalogWithVariations | null>(null);

    // Check if there are any selections
    const hasSelections = selectedVariations.size > 0 || selectedCatalogs.size > 0;

    // Handle catalog click
    const handleCatalogClick = (catalogWithVariations: CatalogWithVariations) => {
        setViewingCatalog(catalogWithVariations);
    };

    if (!collection) return null;

    return (
        <Box width="100%" h="100%" overflowY="auto" pb={20}>
            {/* Header / Breadcrumbs */}
            <Box
                position="sticky"
                top={0}
                zIndex={100}
                bg="transparent"
                borderBottomWidth="1px"
                borderColor="border.subtle"
                px={6}
                py={3}
            >
                <HStack gap={2} align="center">
                    {/* Back button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        px={2}
                        _hover={{ bg: 'transparent' }}
                    >
                        <LuArrowLeft />
                    </Button>

                    {/* Collection name with bookmark icon */}
                    <HStack gap={2} align="center">
                        <Text fontWeight="bold" fontSize="md" color="fg">
                            {collection.name}
                        </Text>
                        <Icon color="text.secondary" boxSize={4}>
                            <LuBookmark />
                        </Icon>
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
                viewingCatalog && (
                    <CatalogDetailModal
                        isOpen={!!viewingCatalog}
                        onClose={() => setViewingCatalog(null)}
                        catalogWithVariations={viewingCatalog}
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
                    selectedCount={selectedVariations.size}
                    onClearSelection={clearVariationSelection}
                    onRemoveFromCollection={onRemoveFromCollection}
                    onMoveToCollection={onMoveToCollection}
                    onCreateCollection={onCreateCollection}
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
