import { useState, useEffect, useMemo, useRef, useTransition, useDeferredValue } from 'react';
import {
  Box,
  Tabs,
  Flex,
  VStack,
  Text,
  Icon,
  HStack,
  Button,
  Select,
  Portal,
  createListCollection,
} from '@chakra-ui/react';
import { listen } from '@tauri-apps/api/event';
import { LuArrowLeft, LuPackage, LuBookOpen, LuFolder, LuBot, LuNotebook, LuNetwork, LuCopy, LuListTodo, LuPlus, LuGitBranch, LuMap } from 'react-icons/lu';
import { BsStack } from 'react-icons/bs';
import Header from '../components/Header';
import KitsTabContent from '../components/kits/KitsTabContent';
import WalkthroughsTabContent from '../components/walkthroughs/WalkthroughsTabContent';
import BlueprintsTabContent from '../components/blueprints/BlueprintsTabContent';
import AgentsTabContent from '../components/agents/AgentsTabContent';
import ScrapbookTabContent from '../components/scrapbook/ScrapbookTabContent';
import DiagramsTabContent from '../components/diagrams/DiagramsTabContent';
import ClonesTabContent from '../components/clones/ClonesTabContent';
import CommitTimelineView from '../components/commits/CommitTimelineView';
import TasksTabContent, { TasksTabContentRef } from '../components/tasks/TasksTabContent';
import PlansTabContent, { PlansTabContentRef } from '../components/plans/PlansTabContent';
import NotebookBackground from '../components/shared/NotebookBackground';
import ResourceViewPage from './ResourceViewPage';
import { invokeGetProjectArtifacts, invokeGetChangedArtifacts, invokeWatchProjectArtifacts, invokeStopWatcher, invokeReadFile, invokeGetProjectRegistry, invokeGetBlueprintTaskFile, invokeDbGetProjects, invokeGetProjectPlans, ArtifactFile, ProjectEntry, Project, TimeoutError } from '../ipc';
import { ResourceFile, ResourceType } from '../types/resource';
import { Plan } from '../types/plan';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';

interface ProjectDetailPageProps {
  project: ProjectEntry;
  onBack: () => void;
  onProjectSelect?: (project: ProjectEntry) => void;
}

export default function ProjectDetailPage({ project, onBack, onProjectSelect }: ProjectDetailPageProps) {
  // Feature flags
  const { flags } = useFeatureFlags();
  
  // Separate artifacts and loading state for better performance
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectEntry[]>([]);
  const [currentTab, setCurrentTab] = useState<string>("tasks");
  const tasksTabRef = useRef<TasksTabContentRef>(null);
  const plansTabRef = useRef<PlansTabContentRef>(null);

  // Database project (for git metadata)
  const [dbProject, setDbProject] = useState<Project | null>(null);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Use transition for non-urgent updates (file watching updates)
  const [isPending, startTransition] = useTransition();
  
  // Defer artifact updates to prevent blocking UI
  const deferredArtifacts = useDeferredValue(artifacts);

  // Generic resource view state - for viewing any resource type
  const [viewingResource, setViewingResource] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);

  // Duplicate detection: Track last load timestamp to prevent rapid duplicate calls
  const lastLoadTimestampRef = useRef(0);

  // Load all projects for the dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projects = await invokeGetProjectRegistry();
        setAllProjects(projects);
      } catch (err) {
        // Failed to load projects
      }
    };
    loadProjects();
  }, []);

  // Load database project for git metadata
  useEffect(() => {
    const loadDbProject = async () => {
      try {
        const projects = await invokeDbGetProjects();
        // Find project by matching path
        const matchingProject = projects.find(p => p.path === project.path);
        setDbProject(matchingProject || null);
      } catch (err) {
        console.error('Failed to load database project:', err);
        setDbProject(null);
      }
    };
    loadDbProject();
  }, [project.path]);

  // Load plans for this project
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      const projectPlans = await invokeGetProjectPlans(project.id);
      setPlans(projectPlans);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  // Load plans on mount and when project changes
  useEffect(() => {
    loadPlans();
  }, [project.id]);

  // Switch to a default tab if current tab is disabled by feature flags
  useEffect(() => {
    if (currentTab === 'blueprints' && !flags.blueprints) {
      setCurrentTab('tasks');
    } else if (currentTab === 'scrapbook' && !flags.scrapbook) {
      setCurrentTab('tasks');
    }
  }, [currentTab, flags.blueprints, flags.scrapbook]);

  // Load all artifacts from this project
  // This loads EVERYTHING from .bluekit/ (kits, walkthroughs, agents, diagrams, etc.)
  // Frontend filters by type later - see kitsOnly, walkthroughs, agents, blueprints memos below
  const loadProjectArtifacts = async () => {
    // Duplicate detection: Skip if called within 100ms window
    const now = Date.now();
    if (now - lastLoadTimestampRef.current < 100) {
      return;
    }
    lastLoadTimestampRef.current = now;

    try {
      // Only show loading on initial load
      setArtifactsLoading(true);
      setError(null);

      const projectArtifacts = await invokeGetProjectArtifacts(project.path);

      // Atomic update: set both artifacts and loading in one state update
      setArtifacts(projectArtifacts);
      setArtifactsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
      setArtifactsLoading(false);
    }
  };

  // Incremental update - only reload changed files
  // Uses transition to mark as non-urgent, preventing UI blocking
  const updateArtifactsIncremental = async (changedPaths: string[]) => {
    if (changedPaths.length === 0) {
      return;
    }

    try {
      const changedArtifacts = await invokeGetChangedArtifacts(project.path, changedPaths);

      // Use transition for non-urgent update - prevents blocking UI
      startTransition(() => {
        // Merge into existing state - update existing, add new, remove deleted
        setArtifacts(prev => {
          const updated = new Map(prev.map(a => [a.path, a]));
          
          // Track which paths we've seen in the results
          const seenPaths = new Set<string>();
          
          // Process changed artifacts
          changedArtifacts.forEach(newArtifact => {
            seenPaths.add(newArtifact.path);
            
            // Check if this is a moved file (same name, different path)
            // First, try to find by old path in changedPaths (standard move detection)
            let oldPath = Array.from(updated.keys()).find(oldPath => {
              const oldArtifact = updated.get(oldPath);
              return oldArtifact && 
                     oldArtifact.name === newArtifact.name && 
                     oldPath !== newArtifact.path &&
                     changedPaths.includes(oldPath);
            });
            
            // If not found, check if there's an artifact with predicted path (from optimistic update)
            // The predicted path would be: folderPath + "/" + fileName
            // We can detect this by matching filename and checking if current path doesn't match newPath
            if (!oldPath) {
              oldPath = Array.from(updated.keys()).find(currentPath => {
                const currentArtifact = updated.get(currentPath);
                if (!currentArtifact || currentArtifact.name !== newArtifact.name) {
                  return false;
                }
                // Check if this is a predicted path (same filename, different full path)
                // and the newPath is the actual path we want
                return currentPath !== newArtifact.path && 
                       currentPath.endsWith(`/${newArtifact.name}`);
              });
            }
            
            if (oldPath) {
              // File was moved - remove old path (or predicted path)
              updated.delete(oldPath);
            }
            
            // Add/update with new artifact data (includes full frontMatter)
            updated.set(newArtifact.path, newArtifact);
          });

          // Remove artifacts that were deleted (in changedPaths but not in results)
          changedPaths.forEach(path => {
            if (!seenPaths.has(path) && updated.has(path)) {
              // Check if this file was moved (exists with same name but different path)
              const oldArtifact = updated.get(path);
              const wasMoved = oldArtifact && changedArtifacts.some(a => 
                a.name === oldArtifact.name && a.path !== path
              );
              
              if (!wasMoved) {
                // File was actually deleted, not moved
                updated.delete(path);
              }
            }
          });

          const finalArtifacts = Array.from(updated.values());
          return finalArtifacts;
        });
        // No loading state for incremental updates - they happen silently
      });
    } catch (err) {
      // Fallback to full reload on error
      loadProjectArtifacts();
    }
  };

  useEffect(() => {
    // Load artifacts on mount (direct call, no debounce)
    loadProjectArtifacts();

    let isMounted = true;
    let unlisten: (() => void) | null = null;

    // Set up file watcher for this project
    const setupWatcher = async () => {
      try {
        await invokeWatchProjectArtifacts(project.path);

        // Generate the event name (must match the Rust code)
        const sanitizedPath = project.path
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .replace(/:/g, '_')
          .replace(/\./g, '_')
          .replace(/ /g, '_');
        const eventName = `project-artifacts-changed-${sanitizedPath}`;

        // Listen for file change events - receive changed file paths
        unlisten = await listen<string[]>(eventName, (event) => {
          if (isMounted) {
            const changedPaths = event.payload;
            if (changedPaths.length > 0) {
              updateArtifactsIncremental(changedPaths);
            } else {
              // If no paths provided, fallback to full reload
              loadProjectArtifacts();
            }
          }
        });
      } catch (error) {
        if (error instanceof TimeoutError) {
          // File watcher setup timed out - watchers may not work
        }
      }
    };

    setupWatcher();

    // Cleanup function - called when component unmounts or project changes
    return () => {
      isMounted = false;
      if (unlisten) unlisten();

      // Stop the backend watcher to prevent resource leaks
      const sanitizedPath = project.path
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .replace(/:/g, '_')
        .replace(/\./g, '_')
        .replace(/ /g, '_');
      const eventName = `project-artifacts-changed-${sanitizedPath}`;

      invokeStopWatcher(eventName).catch(err => {
        console.warn('Failed to stop backend watcher:', err);
      });
    };
  }, [project.path]);

  // Track artifacts that are currently moving (for loading indicators)
  const [movingArtifacts, setMovingArtifacts] = useState<Set<string>>(new Set());

  // Optimistic update function for moving artifacts
  // Immediately updates UI, then confirms with backend
  const handleOptimisticMove = useMemo(() => {
    return (artifactPath: string, targetFolderPath: string): (() => void) => {
      // Find the artifact
      const artifact = artifacts.find(a => a.path === artifactPath);
      if (!artifact) {
        return () => {}; // No-op rollback
      }

      // Calculate new path (backend will do this, but we need to predict it)
      const fileName = artifactPath.split('/').pop() || '';
      const predictedNewPath = `${targetFolderPath}/${fileName}`;

      // Store original state for rollback
      const originalArtifacts = [...artifacts];
      const originalMoving = new Set(movingArtifacts);

      // Mark as moving
      setMovingArtifacts(prev => new Set(prev).add(predictedNewPath));

      // Optimistically update: remove from old location, add to new with predicted path
      startTransition(() => {
        setArtifacts(prev => {
          // Remove from old location
          const filtered = prev.filter(a => a.path !== artifactPath);
          
          // Add to new location with predicted path
          filtered.push({
            ...artifact,
            path: predictedNewPath,
          });

          return filtered;
        });
      });

      // Return rollback function
      return () => {
        setArtifacts(originalArtifacts);
        setMovingArtifacts(originalMoving);
      };
    };
  }, [artifacts, movingArtifacts]);

  // Confirm optimistic move (called after backend succeeds)
  const handleConfirmMove = useMemo(() => {
    return (oldPath: string, newPath: string) => {
      startTransition(() => {
        // Calculate the predicted path (same as in optimistic update)
        // The predicted path is: targetFolderPath + "/" + fileName
        // Since newPath is the actual path from backend, we can derive the folder path
        const fileName = oldPath.split('/').pop() || '';
        const folderPath = newPath.substring(0, newPath.lastIndexOf('/'));
        const predictedPath = `${folderPath}/${fileName}`;

        // Update artifact path to actual new path and remove moving flag
        setArtifacts(prev => {
          return prev.map(artifact => {
            // Match by predicted path (set in optimistic update) or by old path
            // The optimistic update changed the path to predictedPath, so we match that
            if (artifact.path === predictedPath || artifact.path === oldPath) {
              return {
                ...artifact,
                path: newPath, // Update to actual path from backend
              };
            }
            return artifact;
          });
        });

        // Remove from moving set - remove predicted path
        setMovingArtifacts(prev => {
          const next = new Set(prev);
          next.delete(predictedPath);
          return next;
        });
      });
    };
  }, []);

  // Filter artifacts by type using deferred value to prevent blocking
  // This is where we separate the "load everything" approach into type-specific lists
  const kitsOnly = useMemo(() => {
    return deferredArtifacts.filter(artifact => {
      const type = artifact.frontMatter?.type;
      // Only include .md files that aren't other types
      return artifact.path.endsWith('.md') &&
             (!type || (type !== 'walkthrough' && type !== 'blueprint' && type !== 'agent' && type !== 'task'));
    });
  }, [deferredArtifacts]);

  const walkthroughs = useMemo(() => {
    return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'walkthrough');
  }, [deferredArtifacts]);

  const blueprints = useMemo(() => {
    return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'blueprint');
  }, [deferredArtifacts]);

  const agents = useMemo(() => {
    return deferredArtifacts.filter(artifact => artifact.frontMatter?.type === 'agent');
  }, [deferredArtifacts]);

  const diagrams = useMemo(() => {
    // Filter for diagram files (.mmd or .mermaid extensions)
    return deferredArtifacts.filter(artifact =>
      artifact.path.endsWith('.mmd') || artifact.path.endsWith('.mermaid')
    );
  }, [deferredArtifacts]);

  // Generic handler to view any resource type
  const handleViewResource = async (resource: ResourceFile, type: ResourceType) => {
    try {
      const content = await invokeReadFile(resource.path);
      setViewingResource(resource);
      setResourceContent(content);
      setResourceType(type);
    } catch (error) {
      // Failed to load resource content
    }
  };

  // Convenience handlers for different resource types (backwards compatibility)
  const handleViewKit = async (artifact: ArtifactFile) => {
    await handleViewResource(artifact, (artifact.frontMatter?.type as ResourceType) || 'kit');
  };

  const handleViewDiagram = async (diagram: ArtifactFile) => {
    await handleViewResource(diagram, 'diagram');
  };

  const handleViewTask = async (blueprintPath: string, taskFile: string, taskDescription: string) => {
    try {
      const content = await invokeGetBlueprintTaskFile(blueprintPath, taskFile);

      // Create a ResourceFile object for the task
      const taskResource: ResourceFile = {
        name: taskFile.replace('.md', ''),
        path: `${blueprintPath}/${taskFile}`,
        frontMatter: {
          alias: taskDescription,
          type: 'task',
        },
        resourceType: 'task',
      };

      setViewingResource(taskResource);
      setResourceContent(content);
      setResourceType('task');
    } catch (error) {
      // Failed to load task content
    }
  };

  const handleViewPlan = async (plan: Plan) => {
    // Create a ResourceFile object for the plan
    const planResource: ResourceFile & { id?: string } = {
      id: plan.id, // Add plan ID to resource
      name: plan.name,
      path: plan.folderPath,
      frontMatter: {
        id: plan.id, // Also add to frontMatter for fallback
        alias: plan.name,
        type: 'plan',
        description: plan.description,
      },
      resourceType: 'plan',
    };

    // For now, set empty content - plan view will load its own data
    setViewingResource(planResource);
    setResourceContent(''); // Plan content is loaded separately
    setResourceType('plan');
  };

  // Handler to go back from resource view
  const handleBackFromResourceView = () => {
    setViewingResource(null);
    setResourceContent(null);
    setResourceType(null);
  };

  // Create collection for Select component
  const projectsCollection = useMemo(() => {
    return createListCollection({
      items: allProjects,
      itemToString: (item) => item.title,
      itemToValue: (item) => item.id,
    });
  }, [allProjects]);

  // Handler for project selection from dropdown
  const handleProjectChange = (details: { value: string[] }) => {
    const selectedProjectId = details.value[0];
    const selectedProject = allProjects.find(p => p.id === selectedProjectId);
    if (selectedProject && onProjectSelect) {
      onProjectSelect(selectedProject);
    }
  };

  // If viewing any resource, show the generic resource view page
  // For plans, resourceContent can be empty (plans load their own data)
  if (viewingResource && resourceType) {
    // Determine view mode based on resource type
    const viewMode = resourceType === 'plan' ? 'plan' : undefined;

    // For plans, we allow empty content (they load their own data)
    // For other resources, require content
    if (resourceType === 'plan' || resourceContent) {
      return (
        <ResourceViewPage
          resource={viewingResource}
          resourceContent={resourceContent || ''}
          resourceType={resourceType}
          viewMode={viewMode}
          onBack={handleBackFromResourceView}
        />
      );
    }
  }

  return (
    <VStack align="stretch" h="100vh" gap={0} overflow="hidden">
      {/* Header above everything */}
      <Box flexShrink={0}>
        <Header 
          currentProject={project}
          onNavigateToTasks={() => setCurrentTab('tasks')}
        />
      </Box>
      
      {/* Full screen content area */}
      <Box flex="1" minH={0} overflow="hidden" width="100%">
        <Box h="100%" p={6} position="relative" overflow="auto" width="100%" maxW="100%">
          <NotebookBackground />
          <Box position="relative" zIndex={1} width="100%" maxW="100%">
          <Tabs.Root
            value={currentTab}
            onValueChange={(details) => setCurrentTab(details.value)}
            variant="enclosed"
            css={{
              '& [data-selected]': {
                borderColor: 'colors.primary.300',
              },
            }}
          >
            {/* Back button, project title, and tabs all on the same row */}
            <Flex align="center" gap={4} mb={6} mt={3} position="relative" w="100%" maxW="100%">
              {/* Left side: Back button and project title */}
              <Flex align="center" gap={4}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                >
                  <HStack gap={2}>
                    <Icon>
                      <LuArrowLeft />
                    </Icon>
                    <Text>Back</Text>
                  </HStack>
                </Button>
                <Select.Root
                  collection={projectsCollection}
                  value={[project.id]}
                  onValueChange={handleProjectChange}
                  size="sm"
                  variant="subtle"
                  width="auto"
                  minW="180px"
                >
                  <Select.HiddenSelect />
                  <Select.Control cursor="pointer">
                    <Select.Trigger>
                      <HStack gap={2} align="center">
                        <Icon boxSize={4} color="primary.500">
                          <LuFolder />
                        </Icon>
                        <Select.ValueText />
                      </HStack>
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {projectsCollection.items.map((item) => (
                          <Select.Item item={item} key={item.id}>
                            <HStack gap={2} align="center">
                              <Icon boxSize={4} color="primary.500">
                                <LuFolder />
                              </Icon>
                              <Select.ItemText>{item.title}</Select.ItemText>
                            </HStack>
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </Flex>
              
              {/* Centered: Tabs with horizontal scroll */}
              <Box 
                position="absolute" 
                left="50%" 
                style={{ transform: 'translateX(-50%)' }}
                maxW="min(700px, calc(100vw - 450px))"
                overflowX="auto"
                overflowY="hidden"
                css={{
                  '&::-webkit-scrollbar': {
                    height: '4px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: 'transparent',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'colors.gray.300',
                    borderRadius: '2px',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: 'colors.gray.400',
                  },
                  // Enable momentum scrolling on iOS
                  WebkitOverflowScrolling: 'touch',
                  // Smooth scrolling
                  scrollBehavior: 'smooth',
                }}
              >
                <Tabs.List
                  display="flex"
                  flexWrap="nowrap"
                  gap={0}
                  minW="fit-content"
                >
                  <Tabs.Trigger value="tasks" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuListTodo />
                      </Icon>
                      <Text>Tasks</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="plans" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuMap />
                      </Icon>
                      <Text>Plans</Text>
                    </HStack>
                  </Tabs.Trigger>
                  {flags.scrapbook && (
                    <Tabs.Trigger value="scrapbook" flexShrink={0}>
                      <HStack gap={2}>
                        <Icon>
                          <LuNotebook />
                        </Icon>
                        <Text>Scrapbook</Text>
                      </HStack>
                    </Tabs.Trigger>
                  )}
                  <Tabs.Trigger value="diagrams" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuNetwork />
                      </Icon>
                      <Text>Diagrams</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="walkthroughs" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuBookOpen />
                      </Icon>
                      <Text>Walkthroughs</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="kits" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuPackage />
                      </Icon>
                      <Text>Kits</Text>
                    </HStack>
                  </Tabs.Trigger>
                  {flags.blueprints && (
                    <Tabs.Trigger value="blueprints" flexShrink={0}>
                      <HStack gap={2}>
                        <Icon>
                          <BsStack />
                        </Icon>
                        <Text>Blueprints</Text>
                      </HStack>
                    </Tabs.Trigger>
                  )}
                  <Tabs.Trigger value="agents" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuBot />
                      </Icon>
                      <Text>Agents</Text>
                    </HStack>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="timeline" flexShrink={0}>
                    <HStack gap={2}>
                      <Icon>
                        <LuGitBranch />
                      </Icon>
                      <Text>Timeline</Text>
                    </HStack>
                  </Tabs.Trigger>
                </Tabs.List>
              </Box>
              {currentTab === 'tasks' && (
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
              {currentTab === 'plans' && (
                <Box position="absolute" right={0}>
                  <Button
                    colorPalette="primary"
                    onClick={() => plansTabRef.current?.openCreateDialog()}
                  >
                    <HStack gap={2}>
                      <Icon>
                        <LuPlus />
                      </Icon>
                      <Text>Add Plan</Text>
                    </HStack>
                  </Button>
                </Box>
              )}
            </Flex>

            <Tabs.Content value="kits" key="kits">
              <KitsTabContent
                kits={kitsOnly}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                projectPath={project.path}
                projectId={project.id}
                onViewKit={handleViewKit}
                onReload={loadProjectArtifacts}
                onOptimisticMove={handleOptimisticMove}
                onConfirmMove={handleConfirmMove}
                movingArtifacts={movingArtifacts}
              />
            </Tabs.Content>
            {flags.blueprints && (
              <Tabs.Content value="blueprints">
                <BlueprintsTabContent
                  projectPath={project.path}
                  projectsCount={1}
                  onViewTask={handleViewTask}
                />
              </Tabs.Content>
            )}
            <Tabs.Content value="walkthroughs" key="walkthroughs">
              <WalkthroughsTabContent
                kits={walkthroughs}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                projectPath={project.path}
                projectId={project.id}
                onViewKit={handleViewKit}
                onReload={loadProjectArtifacts}
                onOptimisticMove={handleOptimisticMove}
                onConfirmMove={handleConfirmMove}
                movingArtifacts={movingArtifacts}
              />
            </Tabs.Content>
            <Tabs.Content value="agents" key="agents">
              <AgentsTabContent
                kits={agents}
                kitsLoading={artifactsLoading}
                error={error}
                projectsCount={1}
                projectPath={project.path}
                projectId={project.id}
                onViewKit={handleViewKit}
              />
            </Tabs.Content>
            {flags.scrapbook && (
              <Tabs.Content value="scrapbook">
                <ScrapbookTabContent
                  projectPath={project.path}
                  onViewKit={handleViewKit}
                />
              </Tabs.Content>
            )}
            <Tabs.Content value="diagrams" key="diagrams">
              <DiagramsTabContent
                diagrams={diagrams}
                diagramsLoading={artifactsLoading}
                error={error}
                projectPath={project.path}
                projectId={project.id}
                onViewDiagram={handleViewDiagram}
                onReload={loadProjectArtifacts}
                onOptimisticMove={handleOptimisticMove}
                onConfirmMove={handleConfirmMove}
                movingArtifacts={movingArtifacts}
              />
            </Tabs.Content>
            <Tabs.Content value="timeline">
              <CommitTimelineView
                projectId={dbProject?.id || ''}
                gitUrl={dbProject?.gitUrl}
                gitConnected={dbProject?.gitConnected || false}
                onGitConnected={() => {
                  // Reload database project to get updated git metadata
                  invokeDbGetProjects().then(projects => {
                    const matchingProject = projects.find(p => p.path === project.path);
                    setDbProject(matchingProject || null);
                  });
                }}
              />
            </Tabs.Content>
            <Tabs.Content value="tasks">
              <TasksTabContent
                ref={tasksTabRef}
                context={project}
                projects={allProjects}
              />
            </Tabs.Content>
            <Tabs.Content value="plans">
              <PlansTabContent
                ref={plansTabRef}
                plans={plans}
                plansLoading={plansLoading}
                onViewPlan={handleViewPlan}
                projectId={project.id}
                projectPath={project.path}
                onPlansChanged={loadPlans}
              />
            </Tabs.Content>
          </Tabs.Root>
          </Box>
        </Box>
      </Box>
    </VStack>
  );
}

