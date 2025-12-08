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
import CollectionsTabContent from "../components/collections/CollectionsTabContent";
import WorkflowsTabContent from "../components/workflows/WorkflowsTabContent";
import TasksTabContent, {
  TasksTabContentRef,
} from "../components/tasks/TasksTabContent";
import {
  invokeGetProjectRegistry,
  invokeGetProjectArtifacts,
  invokeWatchProjectArtifacts,
  invokeReadFile,
  ArtifactFile,
  ProjectEntry,
  TimeoutError,
} from "../ipc";
import { parseFrontMatter } from "../utils/parseFrontMatter";
import { useSelection } from "../contexts/SelectionContext";
import { Collection } from "../components/collections/AddCollectionDialog";

interface HomePageProps {
  onProjectSelect: (project: ProjectEntry) => void;
  onNavigateToPlans?: (source: "claude" | "cursor") => void;
}

export default function HomePage({
  onProjectSelect,
  onNavigateToPlans,
}: HomePageProps) {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [kits, setKits] = useState<ArtifactFile[]>([]);
  const [kitsLoading, setKitsLoading] = useState(true);
  const { selectedItems } = useSelection();
  const [activeTab, setActiveTab] = useState("projects");
  const tasksTabRef = useRef<TasksTabContentRef>(null);

  // Collections state - store selectedItemIds with each collection
  interface CollectionWithItems extends Collection {
    selectedItemIds: string[];
  }
  const [collections, setCollections] = useState<CollectionWithItems[]>([]);

  const handleCollectionCreated = (
    collection: Collection,
    selectedItemIds: string[]
  ) => {
    setCollections([...collections, { ...collection, selectedItemIds }]);
  };

  const handleCollectionUpdated = (
    collection: Collection,
    selectedItemIds: string[]
  ) => {
    setCollections(
      collections.map((c) =>
        c.id === collection.id ? { ...collection, selectedItemIds } : c
      )
    );
  };

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
      console.log("[loadProjects] Starting to load projects from registry...");
      const registryProjects = await invokeGetProjectRegistry();
      clearTimeout(timeoutId);
      console.log(
        "[loadProjects] Successfully loaded projects:",
        registryProjects
      );
      console.log(
        "[loadProjects] Number of projects:",
        registryProjects.length
      );
      setProjects(registryProjects);
      console.log("[loadProjects] State updated with projects");
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
      console.log(
        "[loadProjects] Loading complete, projectsLoading set to false"
      );
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

      // Read file contents and parse front matter for each kit
      const kitsWithFrontMatter = await Promise.all(
        Array.from(kitsMap.values()).map(async (kit) => {
          try {
            const content = await invokeReadFile(kit.path);
            const frontMatter = parseFrontMatter(content);
            return {
              ...kit,
              frontMatter,
            };
          } catch (err) {
            console.error(`Error reading kit file ${kit.path}:`, err);
            return kit; // Return kit without front matter if read fails
          }
        })
      );

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

    // Set up file watcher event listener for registry changes
    let unlistenFn: (() => void) | null = null;

    const setupFileWatcher = async () => {
      const unlisten = await listen("project-registry-changed", () => {
        // Reload projects when registry file changes
        loadProjects();
      });
      unlistenFn = unlisten;
    };

    setupFileWatcher();

    // Cleanup: unlisten when component unmounts
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  // Reload kits when projects change
  useEffect(() => {
    loadAllKits();
  }, [projects]);

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
          const eventName = `project-kits-changed-${sanitizedPath}`;

          // Listen for file change events
          const unlisten = await listen(eventName, () => {
            if (isMounted) {
              console.log(
                `Kits directory changed for ${project.path}, reloading...`
              );
              loadAllKits();
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
  console.log(
    "[HomePage] Render - selectedCount:",
    selectedCount,
    "selectedItems:",
    selectedItems
  );

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header />
      </Box>

      {/* Full screen content area - no workstation until kit is selected */}
      <Box flex="1" minH={0} overflow="hidden">
        <Box h="100%" p={6} position="relative" overflow="auto">
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
            </Flex>

            <Tabs.Content value="projects">
              <ProjectsTabContent
                projects={projects}
                projectsLoading={projectsLoading}
                error={projectsError}
                onProjectSelect={onProjectSelect}
              />
            </Tabs.Content>
            <Tabs.Content value="library">
              <CollectionsTabContent
                collections={collections}
                onAddCollection={handleCollectionCreated}
                onUpdateCollection={handleCollectionUpdated}
                kits={kits}
                kitsLoading={kitsLoading}
              />
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
    </VStack>
  );
}
