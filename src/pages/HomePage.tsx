import { useState, useEffect, useRef } from "react";
import {
  Box,
  Tabs,
  Flex,
  VStack,
  Text,
  IconButton,
  Icon,
  HStack,
  Button,
} from "@chakra-ui/react";
import { listen } from "@tauri-apps/api/event";
import {
  LuMenu,
  LuLibrary,
  LuFolder,
  LuWorkflow,
  LuListTodo,
  LuPlus,
} from "react-icons/lu";
import NavigationMenu from "../components/NavigationDrawer";
import Header from "../components/Header";
import ProjectsTabContent from "../components/projects/ProjectsTabContent";
import LibraryTabContent, { LibraryTabContentRef } from "../components/library/LibraryTabContent";
import WorkflowsTabContent from "../components/workflows/WorkflowsTabContent";
import TasksTabContent, {
  TasksTabContentRef,
} from "../components/tasks/TasksTabContent";
import NotebookBackground from "../components/shared/NotebookBackground";
import ResourceViewPage from "./ResourceViewPage";
import {
  invokeGetProjectRegistry,
  invokeGetProjectArtifacts,
  invokeGetChangedArtifacts,
  invokeWatchProjectArtifacts,
  invokeWatchProjectsDatabase,
  ArtifactFile,
  Project,
  TimeoutError,
} from "../ipc";
import { useSelection } from "../contexts/SelectionContext";
import { ResourceFile, ResourceType } from "../types/resource";

interface HomePageProps {
  onProjectSelect: (project: Project) => void;
  onNavigateToPlans?: (source: "claude" | "cursor") => void;
}

export default function HomePage({
  onProjectSelect,
  onNavigateToPlans,
}: HomePageProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [kits, setKits] = useState<ArtifactFile[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const { selectedItems } = useSelection();
  const [activeTab, setActiveTab] = useState("projects");
  const tasksTabRef = useRef<TasksTabContentRef>(null);
  const libraryTabRef = useRef<LibraryTabContentRef>(null);

  // Library resource viewing state
  const [viewingLibraryResource, setViewingLibraryResource] = useState<ResourceFile | null>(null);
  const [libraryResourceContent, setLibraryResourceContent] = useState<string>("");
  const [libraryResourceType, setLibraryResourceType] = useState<ResourceType | null>(null);

  const [, setResizeKey] = useState(0);

  // Handle window resize to fix layout cutoff issues
  useEffect(() => {
    const handleResize = () => {
      // Force a re-render to recalculate layout
      setResizeKey(prev => prev + 1);
    };

    window.addEventListener('resize', handleResize);
    // Also listen for Tauri window resize events if available
    if (window.addEventListener) {
      try {
        window.addEventListener('tauri://resize', handleResize);
      } catch (e) {
        // Tauri event might not be available in all contexts
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      try {
        window.removeEventListener('tauri://resize', handleResize);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  // Load projects from registry
  const loadProjects = async () => {
    // Add timeout protection to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setProjectsError(
        "Loading projects is taking longer than expected. The backend may be unresponsive."
      );
      setProjectsLoading(false);
    }, 30000); // 30 second timeout

    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const registryProjects = await invokeGetProjectRegistry();
      clearTimeout(timeoutId);
      setProjects(registryProjects);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[loadProjects] ERROR loading project registry:", error);
      console.error("[loadProjects] Error type:", typeof error);
      console.error(
        "[loadProjects] Error details:",
        JSON.stringify(error, null, 2)
      );

      let errorMessage = "Failed to load projects";
      if (error instanceof TimeoutError) {
        errorMessage =
          "Loading projects timed out. The backend may be unresponsive.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      console.error("[loadProjects] Error message:", errorMessage);
      setProjectsError(errorMessage);
    } finally {
      setProjectsLoading(false);
    }
  };

  // Load kits from all projects
  const loadAllKits = async () => {
    try {
      setKitsLoading(true);

      if (projects.length === 0) {
        setKits([]);
        setKitsLoading(false);
        return;
      }

      // Load kits from all projects in parallel
      const kitPromises = projects.map((project) =>
        invokeGetProjectArtifacts(project.path).catch((err) => {
          console.error(`Error loading kits from ${project.path}:`, err);
          return [] as ArtifactFile[];
        })
      );

      const allKitsArrays = await Promise.all(kitPromises);

      // Flatten and deduplicate kits by path
      const kitsMap = new Map<string, ArtifactFile>();
      allKitsArrays.flat().forEach((kit) => {
        kitsMap.set(kit.path, kit);
      });

      // Artifacts already have content and frontMatter from backend
      // Map front_matter to frontMatter for TypeScript compatibility
      const kitsWithFrontMatter = Array.from(kitsMap.values()).map(kit => ({
        ...kit,
        frontMatter: kit.frontMatter, // Already parsed by backend
      }));

      setKits(kitsWithFrontMatter);
    } catch (err) {
      console.error("Error loading kits:", err);
    } finally {
      setKitsLoading(false);
    }
  };

  useEffect(() => {
    // Load projects on mount
    loadProjects();
  }, []);

  // Set up database watcher to detect when projects are added/updated via CLI
  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    const setupDatabaseWatcher = async () => {
      try {
        // Start watching the database file
        await invokeWatchProjectsDatabase();

        // Listen for database change events
        const unlistenFn = await listen('projects-database-changed', () => {
          if (isMounted) {
            console.log('Projects database changed, reloading projects...');
            loadProjects();
          }
        });

        unlisten = unlistenFn;
      } catch (error) {
        console.error('Failed to set up database watcher:', error);
        if (error instanceof TimeoutError) {
          console.warn('Database watcher setup timed out - projects may not auto-refresh');
        }
      }
    };

    setupDatabaseWatcher();

    // Cleanup function
    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Reload kits when projects change
  useEffect(() => {
    loadAllKits();
  }, [projects]);

  // Incremental update for HomePage - handles multiple projects
  const updateKitsIncremental = async (changedPaths: string[], projectPath: string) => {
    if (changedPaths.length === 0) {
      return;
    }

    try {
      const changedArtifacts = await invokeGetChangedArtifacts(projectPath, changedPaths);

      // Map front_matter to frontMatter for TypeScript compatibility
      const artifactsWithFrontMatter = changedArtifacts.map((artifact: ArtifactFile) => ({
        ...artifact,
        frontMatter: artifact.frontMatter, // Already parsed by backend
      }));

      // Update kits - merge changed artifacts
      setKits(prev => {
        const updated = new Map(prev.map((kit: ArtifactFile) => [kit.path, kit]));
        
        artifactsWithFrontMatter.forEach((artifact: ArtifactFile) => {
          updated.set(artifact.path, artifact);
        });

        // Remove artifacts that were deleted
        changedPaths.forEach((path: string) => {
          if (!artifactsWithFrontMatter.some((a: ArtifactFile) => a.path === path)) {
            updated.delete(path);
          }
        });

        return Array.from(updated.values());
      });
    } catch (err) {
      console.error('Error updating kits incrementally:', err);
      // Fallback to full reload on error
      loadAllKits();
    }
  };

  // Set up file watchers for all projects
  useEffect(() => {
    if (projects.length === 0) return;

    let isMounted = true;
    const unlistenFunctions: (() => void)[] = [];

    const setupWatchers = async () => {
      for (const project of projects) {
        if (!isMounted) break; // Early exit if unmounted

        try {
          await invokeWatchProjectArtifacts(project.path);

          // Generate the event name (must match the Rust code)
          const sanitizedPath = project.path
            .replace(/\//g, "_")
            .replace(/\\/g, "_")
            .replace(/:/g, "_")
            .replace(/\./g, "_")
            .replace(/ /g, "_");
          const eventName = `project-artifacts-changed-${sanitizedPath}`;

          // Listen for file change events - receive changed file paths
          const unlisten = await listen<string[]>(eventName, (event) => {
            if (isMounted) {
              const changedPaths = event.payload;
              console.log(
                `Kits directory changed for ${project.path}, ${changedPaths.length} files changed`
              );
              if (changedPaths.length > 0) {
                updateKitsIncremental(changedPaths, project.path);
              } else {
                // If no paths provided, fallback to full reload
                loadAllKits();
              }
            }
          });

          unlistenFunctions.push(unlisten);
        } catch (error) {
          console.error(
            `Failed to set up file watcher for ${project.path}:`,
            error
          );
          if (error instanceof TimeoutError) {
            console.warn(
              "File watcher setup timed out - watchers may not work"
            );
          }
        }
      }
    };

    setupWatchers();

    // Synchronous cleanup
    return () => {
      isMounted = false;
      unlistenFunctions.forEach((unlisten) => unlisten());
    };
  }, [projects]);

  const selectedCount = selectedItems.length;

  // Handler for viewing a library variation
  const handleViewLibraryVariation = (resource: ResourceFile, content: string, resourceType: ResourceType) => {
    setViewingLibraryResource(resource);
    setLibraryResourceContent(content);
    setLibraryResourceType(resourceType);
  };

  // Handler for going back from resource view
  const handleBackFromLibraryResource = () => {
    setViewingLibraryResource(null);
    setLibraryResourceContent("");
    setLibraryResourceType(null);
  };

  // If viewing a library resource, show ResourceViewPage
  if (viewingLibraryResource && libraryResourceType && libraryResourceContent) {
    return (
      <ResourceViewPage
        resource={viewingLibraryResource}
        resourceContent={libraryResourceContent}
        resourceType={libraryResourceType}
        onBack={handleBackFromLibraryResource}
      />
    );
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header onNavigateToTasks={() => setActiveTab('tasks')} />
      </Box>

      {/* Full screen content area - no workstation until kit is selected */}
      <Box flex="1" minH={0} overflow="hidden" style={{ height: '100%', maxHeight: '100%' }}>
        <Box h="100%" p={6} position="relative" overflow="auto" style={{ height: '100%', maxHeight: '100%' }}>
          <NotebookBackground />
          <Box position="relative" zIndex={1}>
          <Tabs.Root
            defaultValue="projects"
            variant="enclosed"
            value={activeTab}
            onValueChange={(e) => setActiveTab(e.value as string)}
            css={{
              "& [data-selected]": {
                borderColor: "colors.primary.300",
              },
            }}
          >
            <Flex
              align="center"
              gap={4}
              mb={6}
              mt={3}
              position="relative"
              w="100%"
            >
              <NavigationMenu onNavigateToPlans={onNavigateToPlans}>
                {({ onOpen }) => (
                  <IconButton
                    variant="ghost"
                    size="lg"
                    aria-label="Open menu"
                    onClick={onOpen}
                    color="gray.600"
                    _hover={{ bg: "transparent" }}
                  >
                    <LuMenu />
                  </IconButton>
                )}
              </NavigationMenu>
              <Box
                position="absolute"
                left="50%"
                style={{ transform: "translateX(-50%)" }}
              >
                <Tabs.List>
                  <Tabs.Trigger value="projects">
                    <HStack gap={2}>
                      <Icon>
                        <LuFolder />
                      </Icon>
                      <Text>Projects</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="library">
                    <HStack gap={2}>
                      <Icon>
                        <LuLibrary />
                      </Icon>
                      <Text>Library</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="workflows">
                    <HStack gap={2}>
                      <Icon>
                        <LuWorkflow />
                      </Icon>
                      <Text>Workflows</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="tasks">
                    <HStack gap={2}>
                      <Icon>
                        <LuListTodo />
                      </Icon>
                      <Text>Tasks</Text>
                    </HStack>
                  </Tabs.Trigger>
                </Tabs.List>
              </Box>
              {activeTab === "tasks" && (
                <Box position="absolute" right={0}>
                  <Button
                    colorPalette="primary"
                    onClick={() => tasksTabRef.current?.openCreateDialog()}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuPlus />
                      </Icon>
                      <Text>Add Task</Text>
                    </HStack>
                  </Button>
                </Box>
              )}
              {activeTab === "library" && (
                <Box position="absolute" right={0}>
                  <Button
                    colorPalette="primary"
                    onClick={() => libraryTabRef.current?.openAddWorkspaceDialog()}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuPlus />
                      </Icon>
                      <Text>Add Workspace</Text>
                    </HStack>
                  </Button>
                </Box>
              )}
            </Flex>

            <Tabs.Content value="projects">
              <ProjectsTabContent
                projects={projects}
                projectsLoading={projectsLoading}
                error={projectsError}
                onProjectSelect={onProjectSelect}
                onProjectsChanged={loadProjects}
              />
            </Tabs.Content>
            <Tabs.Content value="library">
              <LibraryTabContent ref={libraryTabRef} onViewVariation={handleViewLibraryVariation} />
            </Tabs.Content>
            <Tabs.Content value="workflows">
              <WorkflowsTabContent />
            </Tabs.Content>
            <Tabs.Content value="tasks">
              <TasksTabContent
                ref={tasksTabRef}
                context="workspace"
                projects={projects}
              />
            </Tabs.Content>
          </Tabs.Root>
          </Box>
        </Box>
      </Box>
    </VStack>
  );
}
