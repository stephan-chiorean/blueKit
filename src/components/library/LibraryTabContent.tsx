import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  SimpleGrid,
  Spinner,
  Tag,
  Text,
  VStack,
  Badge,
  Separator,
  Accordion,
} from '@chakra-ui/react';
import {
  LuLibrary,
  LuPlus,
  LuRefreshCw,
  LuDownload,
  LuPackage,
  LuBookOpen,
  LuBot,
  LuNetwork,
  LuGithub,
  LuChevronDown,
  LuTrash2,
  LuExternalLink,
} from 'react-icons/lu';
import { open } from '@tauri-apps/api/shell';
import { toaster } from '../ui/toaster';
import {
  invokeLibraryListWorkspaces,
  invokeLibraryCreateWorkspace,
  invokeLibraryDeleteWorkspace,
  invokeSyncWorkspaceCatalog,
  invokeListWorkspaceCatalogs,
  invokePullVariation,
} from '../../ipc/library';
import {
  LibraryWorkspace,
  CatalogWithVariations,
  LibraryVariation,
  GitHubUser,
} from '../../types/github';
import { ProjectEntry, invokeGetProjectRegistry } from '../../ipc';
import { invokeGitHubGetUser } from '../../ipc/github';

type ViewMode = 'loading' | 'no-auth' | 'no-workspaces' | 'browse';

const artifactTypeIcon: Record<string, React.ReactNode> = {
  kit: <LuPackage />,
  walkthrough: <LuBookOpen />,
  agent: <LuBot />,
  diagram: <LuNetwork />,
};

export default function LibraryTabContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [workspaces, setWorkspaces] = useState<LibraryWorkspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<LibraryWorkspace | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogWithVariations[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);

  // GitHub auth state
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Create workspace form state
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newGithubRepo, setNewGithubRepo] = useState('');
  const [creating, setCreating] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    checkGitHubAuth();
    loadProjects();
  }, []);

  const checkGitHubAuth = async () => {
    try {
      const user = await invokeGitHubGetUser();
      setGithubUser(user);
      loadWorkspaces();
    } catch (error) {
      console.error('Not authenticated with GitHub:', error);
      setGithubUser(null);
      setViewMode('no-auth');
    }
  };

  const loadWorkspaces = async () => {
    try {
      const ws = await invokeLibraryListWorkspaces();
      setWorkspaces(ws);
      if (ws.length === 0) {
        setViewMode('no-workspaces');
      } else {
        setSelectedWorkspace(ws[0]);
        setViewMode('browse');
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: 'Failed to load library workspaces',
      });
      setViewMode('no-workspaces');
    }
  };

  const loadProjects = async () => {
    try {
      const p = await invokeGetProjectRegistry();
      setProjects(p);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  // Load catalogs when workspace changes
  useEffect(() => {
    if (selectedWorkspace) {
      loadCatalogs(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  const loadCatalogs = async (workspaceId: string) => {
    try {
      const cats = await invokeListWorkspaceCatalogs(workspaceId);
      setCatalogs(cats);
    } catch (error) {
      console.error('Failed to load catalogs:', error);
      setCatalogs([]);
    }
  };

  const handleSync = async () => {
    if (!selectedWorkspace) return;
    setSyncing(true);
    try {
      const result = await invokeSyncWorkspaceCatalog(selectedWorkspace.id);
      toaster.create({
        type: 'success',
        title: 'Sync complete',
        description: `Created ${result.catalogs_created} catalogs, ${result.variations_created} variations`,
      });
      await loadCatalogs(selectedWorkspace.id);
    } catch (error) {
      console.error('Sync failed:', error);
      toaster.create({
        type: 'error',
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!githubUser || !newWorkspaceName.trim() || !newGithubRepo.trim()) {
      return;
    }
    setCreating(true);
    try {
      const workspace = await invokeLibraryCreateWorkspace(
        newWorkspaceName.trim(),
        githubUser.login,
        newGithubRepo.trim()
      );
      setWorkspaces((prev) => [...prev, workspace]);
      setSelectedWorkspace(workspace);
      setViewMode('browse');
      setNewWorkspaceName('');
      setNewGithubRepo('');
      toaster.create({
        type: 'success',
        title: 'Workspace created',
        description: `Created workspace "${workspace.name}"`,
      });
    } catch (error) {
      console.error('Failed to create workspace:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create workspace',
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePullVariation = useCallback(
    async (variation: LibraryVariation, projectId: string, projectPath: string) => {
      try {
        await invokePullVariation(variation.id, projectId, projectPath, false);
        toaster.create({
          type: 'success',
          title: 'Pulled successfully',
          description: `Added to project`,
        });
      } catch (error) {
        console.error('Pull failed:', error);
        toaster.create({
          type: 'error',
          title: 'Pull failed',
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    []
  );

  const handleDeleteWorkspace = async (workspace: LibraryWorkspace) => {
    if (!confirm(`Delete workspace "${workspace.name}"? This will remove it from BlueKit but won't delete the GitHub repository.`)) {
      return;
    }
    try {
      await invokeLibraryDeleteWorkspace(workspace.id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspace.id));
      if (selectedWorkspace?.id === workspace.id) {
        const remaining = workspaces.filter((w) => w.id !== workspace.id);
        setSelectedWorkspace(remaining.length > 0 ? remaining[0] : null);
        if (remaining.length === 0) {
          setViewMode('no-workspaces');
        }
      }
      toaster.create({
        type: 'success',
        title: 'Workspace deleted',
        description: `Deleted workspace "${workspace.name}"`,
      });
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      toaster.create({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete workspace',
      });
    }
  };

  const openGitHubRepo = async (workspace: LibraryWorkspace) => {
    await open(`https://github.com/${workspace.github_owner}/${workspace.github_repo}`);
  };

  // Loading state
  if (viewMode === 'loading') {
    return (
      <Flex justify="center" align="center" minH="200px">
        <Spinner size="lg" />
      </Flex>
    );
  }

  // Not authenticated with GitHub
  if (viewMode === 'no-auth') {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="gray.400">
              <LuGithub />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>Connect to GitHub</EmptyState.Title>
          <EmptyState.Description>
            Sign in with GitHub to access the library and publish resources.
          </EmptyState.Description>
          <Text fontSize="sm" color="text.secondary" mt={2}>
            Go to Settings to connect your GitHub account.
          </Text>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // No workspaces - show create form
  if (viewMode === 'no-workspaces') {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Indicator>
            <Icon size="xl" color="primary.500">
              <LuLibrary />
            </Icon>
          </EmptyState.Indicator>
          <EmptyState.Title>No Library Workspaces</EmptyState.Title>
          <EmptyState.Description>
            Create a workspace to publish and share kits, walkthroughs, and agents via GitHub.
            The GitHub repository must already exist.
          </EmptyState.Description>

          <Box mt={6} w="full" maxW="400px">
            <VStack gap={4} align="stretch">
              <Field.Root>
                <Field.Label>Workspace Name</Field.Label>
                <Input
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="My Team Library"
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>GitHub Owner</Field.Label>
                <Input
                  value={githubUser?.login || ''}
                  disabled
                  bg="bg.subtle"
                />
                <Field.HelperText>Using your GitHub account</Field.HelperText>
              </Field.Root>
              <Field.Root>
                <Field.Label>GitHub Repository</Field.Label>
                <Input
                  value={newGithubRepo}
                  onChange={(e) => setNewGithubRepo(e.target.value)}
                  placeholder="bluekit-library"
                />
                <Field.HelperText>Repository must already exist on GitHub</Field.HelperText>
              </Field.Root>
              <Button
                colorPalette="primary"
                onClick={handleCreateWorkspace}
                disabled={
                  creating ||
                  !newWorkspaceName.trim() ||
                  !newGithubRepo.trim()
                }
              >
                <HStack gap={2}>
                  {creating ? <Spinner size="sm" /> : <LuPlus />}
                  <Text>Create Workspace</Text>
                </HStack>
              </Button>
            </VStack>
          </Box>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // Browse catalogs
  return (
    <VStack align="stretch" gap={4}>
      {/* Workspace selector and sync button */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
        <HStack gap={2}>
          {workspaces.map((ws) => (
            <Tag.Root
              key={ws.id}
              cursor="pointer"
              colorPalette={selectedWorkspace?.id === ws.id ? 'primary' : 'gray'}
              variant={selectedWorkspace?.id === ws.id ? 'solid' : 'subtle'}
              onClick={() => setSelectedWorkspace(ws)}
            >
              <Tag.Label>{ws.name}</Tag.Label>
            </Tag.Root>
          ))}
          <Tag.Root
            cursor="pointer"
            colorPalette="gray"
            variant="outline"
            onClick={() => setViewMode('no-workspaces')}
          >
            <LuPlus />
            <Tag.Label>Add</Tag.Label>
          </Tag.Root>
        </HStack>

        <HStack gap={2}>
          {selectedWorkspace && (
            <>
              <HStack
                gap={1}
                cursor="pointer"
                onClick={() => openGitHubRepo(selectedWorkspace)}
                _hover={{ color: 'primary.500' }}
              >
                <Icon as={LuGithub} fontSize="sm" />
                <Text fontSize="xs" color="text.secondary" _hover={{ color: 'primary.500', textDecoration: 'underline' }}>
                  {selectedWorkspace.github_owner}/{selectedWorkspace.github_repo}
                </Text>
                <Icon as={LuExternalLink} fontSize="xs" color="text.secondary" />
              </HStack>
              <Button
                size="xs"
                variant="ghost"
                colorPalette="red"
                onClick={() => handleDeleteWorkspace(selectedWorkspace)}
              >
                <LuTrash2 />
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <HStack gap={2}>
              {syncing ? <Spinner size="sm" /> : <LuRefreshCw />}
              <Text>Sync</Text>
            </HStack>
          </Button>
        </HStack>
      </Flex>

      <Separator />

      {/* Catalogs grid */}
      {catalogs.length === 0 ? (
        <EmptyState.Root>
          <EmptyState.Content>
            <EmptyState.Indicator>
              <Icon size="lg" color="gray.400">
                <LuLibrary />
              </Icon>
            </EmptyState.Indicator>
            <EmptyState.Title>No catalogs yet</EmptyState.Title>
            <EmptyState.Description>
              Sync to fetch catalogs from GitHub, or publish resources to this workspace.
            </EmptyState.Description>
          </EmptyState.Content>
        </EmptyState.Root>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
          {catalogs.map((catWithVars) => (
            <CatalogCard
              key={catWithVars.catalog.id}
              catalogWithVariations={catWithVars}
              projects={projects}
              onPull={handlePullVariation}
            />
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}

interface CatalogCardProps {
  catalogWithVariations: CatalogWithVariations;
  projects: ProjectEntry[];
  onPull: (variation: LibraryVariation, projectId: string, projectPath: string) => void;
}

function CatalogCard({ catalogWithVariations, projects, onPull }: CatalogCardProps) {
  const { catalog, variations } = catalogWithVariations;
  const [expanded, setExpanded] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectEntry | null>(
    projects.length > 0 ? projects[0] : null
  );

  const icon = artifactTypeIcon[catalog.artifact_type] || <LuPackage />;
  const tags = catalog.tags ? JSON.parse(catalog.tags) : [];

  return (
    <Card.Root variant="subtle">
      <CardHeader pb={2}>
        <Flex justify="space-between" align="start">
          <HStack gap={2}>
            <Icon color="primary.500">{icon}</Icon>
            <Heading size="sm">{catalog.name}</Heading>
          </HStack>
          <Badge size="sm" colorPalette="gray">
            {variations.length} version{variations.length !== 1 ? 's' : ''}
          </Badge>
        </Flex>
      </CardHeader>
      <CardBody pt={0}>
        {catalog.description && (
          <Text fontSize="sm" color="text.secondary" mb={2}>
            {catalog.description}
          </Text>
        )}
        {tags.length > 0 && (
          <HStack gap={1} mb={2} wrap="wrap">
            {tags.map((tag: string) => (
              <Tag.Root key={tag} size="sm" colorPalette="gray" variant="subtle">
                <Tag.Label>{tag}</Tag.Label>
              </Tag.Root>
            ))}
          </HStack>
        )}

        <Accordion.Root
          collapsible
          value={expanded ? ['variations'] : []}
          onValueChange={(details) => setExpanded(details.value.includes('variations'))}
        >
          <Accordion.Item value="variations">
            <Accordion.ItemTrigger>
              <HStack gap={1}>
                <Text fontSize="sm">Versions</Text>
                <LuChevronDown />
              </HStack>
            </Accordion.ItemTrigger>
            <Accordion.ItemContent>
              <VStack align="stretch" gap={2} mt={2}>
                {variations.map((v) => (
                  <Flex
                    key={v.id}
                    justify="space-between"
                    align="center"
                    p={2}
                    bg="bg.subtle"
                    borderRadius="md"
                  >
                    <VStack align="start" gap={0}>
                      <Text fontSize="xs" fontWeight="medium">
                        {v.version_tag || `v${new Date(v.published_at * 1000).toLocaleDateString()}`}
                      </Text>
                      {v.publisher_name && (
                        <Text fontSize="xs" color="text.secondary">
                          by {v.publisher_name}
                        </Text>
                      )}
                    </VStack>
                    {selectedProject && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onPull(v, selectedProject.id, selectedProject.path)}
                      >
                        <LuDownload />
                      </Button>
                    )}
                  </Flex>
                ))}
                {projects.length > 0 && (
                  <Box mt={2}>
                    <Text fontSize="xs" color="text.secondary" mb={1}>
                      Pull to:
                    </Text>
                    <HStack gap={1} wrap="wrap">
                      {projects.slice(0, 3).map((p) => (
                        <Tag.Root
                          key={p.id}
                          size="sm"
                          cursor="pointer"
                          colorPalette={selectedProject?.id === p.id ? 'primary' : 'gray'}
                          variant={selectedProject?.id === p.id ? 'solid' : 'subtle'}
                          onClick={() => setSelectedProject(p)}
                        >
                          <Tag.Label>{p.title}</Tag.Label>
                        </Tag.Root>
                      ))}
                    </HStack>
                  </Box>
                )}
              </VStack>
            </Accordion.ItemContent>
          </Accordion.Item>
        </Accordion.Root>
      </CardBody>
    </Card.Root>
  );
}

