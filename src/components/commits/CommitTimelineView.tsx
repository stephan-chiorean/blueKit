import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Text,
  HStack,
  VStack,
  Button,
  EmptyState,
  Timeline,
  Spinner,
  Box,
  Icon,
  Flex,
  Badge,
} from "@chakra-ui/react";
import { toaster } from "../ui/toaster";
import {
  LuGitBranch,
  LuExternalLink,
  LuTrash2,
  LuFolderPlus,
  LuRefreshCw,
} from "react-icons/lu";
import { RiFlag2Fill } from "react-icons/ri";
import type { GitHubCommit, Checkpoint } from "../../ipc/types";
import {
  invokeFetchProjectCommits,
  invokeOpenCommitInGitHub,
  invokeInvalidateCommitCache,
} from "../../ipc/commits";
import { invokeConnectProjectGit } from "../../ipc/projects";
import {
  invokeGetProjectCheckpoints,
  invokeUnpinCheckpoint,
  invokeCreateProjectFromCheckpoint,
} from "../../ipc/checkpoints";
import {
  getCheckpointTypeColor,
  getCheckpointTypeLabel,
  getCheckpointTypeIcon,
  getCheckpointTypeColorPalette,
} from "../../utils/checkpointUtils";
import PinCheckpointModal from "./PinCheckpointModal";
import { open } from "@tauri-apps/api/dialog";

interface CommitTimelineViewProps {
  projectId: string;
  gitUrl?: string;
  gitConnected: boolean;
  onGitConnected?: () => void;
}

type ViewMode = "commits" | "checkpoints";

export default function CommitTimelineView({
  projectId,
  gitUrl,
  gitConnected,
  onGitConnected,
}: CommitTimelineViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("commits");
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [connectingGit, setConnectingGit] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(
    null
  );
  const perPage = 30;

  // Load commits
  const loadCommits = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const fetchedCommits = await invokeFetchProjectCommits(
        projectId,
        undefined, // use project's current branch
        pageNum,
        perPage
      );

      if (append) {
        setCommits((prev) => [...prev, ...fetchedCommits]);
      } else {
        setCommits(fetchedCommits);
      }

      // If we got fewer commits than requested, there are no more
      setHasMore(fetchedCommits.length === perPage);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load commits";
      setError(errorMessage);
      console.error("Error loading commits:", err);

      toaster.create({
        title: "Failed to load commits",
        description: errorMessage,
        type: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Load checkpoints
  const loadCheckpoints = async () => {
    if (!projectId) return;

    try {
      setLoadingCheckpoints(true);
      const loadedCheckpoints = await invokeGetProjectCheckpoints(projectId);
      setCheckpoints(loadedCheckpoints);
    } catch (err) {
      console.error("Error loading checkpoints:", err);
      toaster.create({
        title: "Failed to load checkpoints",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
        duration: 5000,
      });
    } finally {
      setLoadingCheckpoints(false);
    }
  };

  // Load commits on mount
  useEffect(() => {
    if (gitConnected) {
      loadCommits(1);
    } else {
      setLoading(false);
    }
  }, [projectId, gitConnected]);

  // Load checkpoints when switching to checkpoints view or when project changes
  useEffect(() => {
    if (viewMode === "checkpoints" && projectId) {
      loadCheckpoints();
    }
  }, [viewMode, projectId]);

  // Handle pin checkpoint
  const handlePinCheckpoint = (commit: GitHubCommit) => {
    setSelectedCommit(commit);
    setPinModalOpen(true);
  };

  // Handle checkpoint pinned
  const handleCheckpointPinned = () => {
    loadCheckpoints();
    // If we're in checkpoints view, refresh it
    if (viewMode === "checkpoints") {
      loadCheckpoints();
    }
  };

  // Check if a commit is already pinned
  const isCommitPinned = (commitSha: string): boolean => {
    return checkpoints.some((cp) => cp.gitCommitSha === commitSha);
  };

  // Get checkpoint for a commit SHA
  const getCheckpointForCommit = (
    commitSha: string
  ): Checkpoint | undefined => {
    return checkpoints.find((cp) => cp.gitCommitSha === commitSha);
  };

  // Handle load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadCommits(nextPage, true);
  };

  // Handle sync/refresh commits
  const handleSync = async () => {
    try {
      // Invalidate cache to force fresh fetch
      await invokeInvalidateCommitCache(projectId);
      // Reset pagination state
      setPage(1);
      setHasMore(true);
      // Reload commits from page 1
      await loadCommits(1, false);
    } catch (err) {
      console.error("Error syncing commits:", err);
      toaster.create({
        title: "Failed to sync commits",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
        duration: 5000,
      });
    }
  };

  // Handle connecting to git
  const handleConnectGit = async () => {
    if (!projectId) {
      toaster.create({
        title: "No project ID",
        description: "Cannot connect git: missing project ID",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      setConnectingGit(true);
      await invokeConnectProjectGit(projectId);

      toaster.create({
        title: "Git connected",
        description: "Successfully connected project to git",
        type: "success",
        duration: 3000,
      });

      // Notify parent to reload
      if (onGitConnected) {
        onGitConnected();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to connect git";
      toaster.create({
        title: "Failed to connect git",
        description: errorMessage,
        type: "error",
        duration: 5000,
      });
    } finally {
      setConnectingGit(false);
    }
  };

  // Handle opening commit in GitHub
  const handleViewDiff = async (commit: GitHubCommit) => {
    if (!gitUrl) {
      toaster.create({
        title: "No git URL",
        description: "Cannot open commit: project has no git URL",
        type: "error",
        duration: 3000,
      });
      return;
    }

    try {
      await invokeOpenCommitInGitHub(gitUrl, commit.sha);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to open commit";
      toaster.create({
        title: "Failed to open commit",
        description: errorMessage,
        type: "error",
        duration: 3000,
      });
    }
  };

  // Format date to human-readable form
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Empty state: not connected to git
  if (!gitConnected) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>Not connected to git</EmptyState.Title>
          <EmptyState.Description>
            Connect this project to git to view commit history
          </EmptyState.Description>
          <Button
            variant="outline"
            onClick={handleConnectGit}
            loading={connectingGit}
            loadingText="Connecting..."
          >
            Connect Git
          </Button>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // Loading state
  if (loading) {
    return (
      <VStack align="center" justify="center" py={12} gap={4}>
        <Spinner size="lg" />
        <Text fontSize="sm" color="fg.muted">
          Loading commits...
        </Text>
      </VStack>
    );
  }

  // Error state
  if (error && commits.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>Failed to load commits</EmptyState.Title>
          <EmptyState.Description>{error}</EmptyState.Description>
          <Button onClick={() => loadCommits(1)}>Try Again</Button>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // Empty commits list
  if (commits.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>No commits found</EmptyState.Title>
          <EmptyState.Description>
            This repository has no commits yet
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  // View mode switcher
  const renderViewModeSwitcher = () => (
    <Flex justify="space-between" align="center" mb={4}>
      {viewMode === "commits" && (
        <Button
          onClick={handleSync}
          variant="outline"
          size="sm"
          loading={loading}
          loadingText="Syncing..."
        >
          <HStack gap={2}>
            <Icon>
              <LuRefreshCw />
            </Icon>
            <Text>Sync</Text>
          </HStack>
        </Button>
      )}
      <HStack
        gap={0}
        borderRadius="md"
        overflow="hidden"
        bg="bg.subtle"
        shadow="sm"
        ml="auto"
      >
        <Button
          onClick={() => setViewMode("commits")}
          variant="ghost"
          borderRadius={0}
          borderRightWidth="1px"
          borderRightColor="border.subtle"
          bg={viewMode === "commits" ? "bg.surface" : "transparent"}
          color={viewMode === "commits" ? "text.primary" : "text.secondary"}
          _hover={{ bg: viewMode === "commits" ? "bg.surface" : "bg.subtle" }}
          size="sm"
        >
          <HStack gap={2}>
            <Icon>
              <LuGitBranch />
            </Icon>
            <Text>Commits</Text>
          </HStack>
        </Button>
        <Button
          onClick={() => setViewMode("checkpoints")}
          variant="ghost"
          borderRadius={0}
          bg={viewMode === "checkpoints" ? "bg.surface" : "transparent"}
          color={viewMode === "checkpoints" ? "text.primary" : "text.secondary"}
          _hover={{
            bg: viewMode === "checkpoints" ? "bg.surface" : "bg.subtle",
          }}
          size="sm"
        >
          <HStack gap={2}>
            <Icon>
              <RiFlag2Fill />
            </Icon>
            <Text>Checkpoints</Text>
          </HStack>
        </Button>
      </HStack>
    </Flex>
  );

  // Commit timeline
  return (
    <VStack align="stretch" gap={4} py={4}>
      {renderViewModeSwitcher()}

      {viewMode === "commits" ? (
        <>
          <Box
            css={{
              // Target all possible connector selectors with maximum specificity
              '& [data-part="connector"]': {
                borderColor: "#4287f5 !important",
                borderWidth: "2px !important",
                borderStyle: "solid !important",
                opacity: "1 !important",
                display: "block !important",
                visibility: "visible !important",
              },
              '& [data-part="connector-line"]': {
                borderColor: "#4287f5 !important",
                borderWidth: "2px !important",
                borderStyle: "solid !important",
                opacity: "1 !important",
                display: "block !important",
                visibility: "visible !important",
              },
              // Target by class if Chakra uses classes
              "& .chakra-timeline__connector": {
                borderColor: "#4287f5 !important",
                borderWidth: "2px !important",
                borderStyle: "solid !important",
                opacity: "1 !important",
                display: "block !important",
                visibility: "visible !important",
              },
              // More generic selector for any connector element
              '& [class*="connector"]': {
                borderColor: "#4287f5 !important",
                borderWidth: "2px !important",
                borderStyle: "solid !important",
                opacity: "1 !important",
                display: "block !important",
                visibility: "visible !important",
              },
              // Target any element that might be the connector line
              '& [class*="timeline"] [class*="connector"]': {
                borderColor: "#4287f5 !important",
                borderWidth: "2px !important",
                borderStyle: "solid !important",
                opacity: "1 !important",
                display: "block !important",
                visibility: "visible !important",
              },
            }}
          >
            <Timeline.Root variant="subtle" colorPalette="blue">
              {commits.map((commit, index) => {
                const commitMessage = commit.commit.message.split("\n")[0]; // First line only
                const commitBody = commit.commit.message
                  .split("\n")
                  .slice(1)
                  .join("\n")
                  .trim();
                const pinnedCheckpoint = getCheckpointForCommit(commit.sha);
                const isPinned = !!pinnedCheckpoint;
                const checkpointTypeColor = pinnedCheckpoint
                  ? getCheckpointTypeColor(pinnedCheckpoint.checkpointType)
                  : undefined;

                return (
                  <Timeline.Item key={commit.sha}>
                    <Timeline.Indicator
                      bg={checkpointTypeColor || undefined}
                      color={isPinned ? "white" : undefined}
                    >
                      {isPinned ? <RiFlag2Fill /> : <LuGitBranch />}
                    </Timeline.Indicator>
                    <Timeline.Content>
                      <Card.Root
                        borderWidth={isPinned ? "1px" : undefined}
                        borderColor={checkpointTypeColor || undefined}
                      >
                        <CardHeader pb={2}>
                          <HStack justify="space-between" align="start">
                            <VStack align="start" gap={1} flex={1}>
                              <Text
                                fontWeight="semibold"
                                fontSize="sm"
                                color="blue.700"
                                _dark={{ color: "inherit" }}
                              >
                                {commitMessage}
                              </Text>
                              <HStack gap={2} fontSize="xs" color="fg.muted">
                                <Text>{commit.commit.author.name}</Text>
                                <Text>•</Text>
                                <Text>
                                  {formatDate(commit.commit.author.date)}
                                </Text>
                              </HStack>
                            </VStack>
                            <HStack gap={2}>
                              {!isPinned && (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => handlePinCheckpoint(commit)}
                                >
                                  <RiFlag2Fill />
                                  Pin
                                </Button>
                              )}
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => handleViewDiff(commit)}
                              >
                                <LuExternalLink />
                                View Diff
                              </Button>
                            </HStack>
                          </HStack>
                        </CardHeader>
                        <CardBody pt={2}>
                          {commitBody && (
                            <Text
                              fontSize="xs"
                              mb={2}
                              whiteSpace="pre-wrap"
                              _dark={{ color: "blue.300" }}
                            >
                              {commitBody}
                            </Text>
                          )}
                          <Text
                            fontSize="xs"
                            fontFamily="mono"
                            color="blue.700"
                            _dark={{ color: "inherit" }}
                          >
                            {commit.sha.substring(0, 7)}
                          </Text>
                        </CardBody>
                      </Card.Root>
                    </Timeline.Content>
                  </Timeline.Item>
                );
              })}
            </Timeline.Root>
          </Box>

          {/* Load More Button */}
          {hasMore && (
            <Button
              variant="outline"
              onClick={handleLoadMore}
              loading={loadingMore}
              loadingText="Loading more commits..."
            >
              Load More
            </Button>
          )}

          {/* End of commits message */}
          {!hasMore && commits.length > 0 && (
            <Text fontSize="sm" textAlign="center" color="fg.muted" py={4}>
              End of commit history
            </Text>
          )}
        </>
      ) : (
        // Checkpoints view
        <CheckpointsView
          projectId={projectId}
          gitUrl={gitUrl}
          checkpoints={checkpoints}
          loading={loadingCheckpoints}
          onCheckpointsUpdated={loadCheckpoints}
        />
      )}

      {/* Pin Checkpoint Modal */}
      <PinCheckpointModal
        isOpen={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setSelectedCommit(null);
        }}
        projectId={projectId}
        commit={selectedCommit}
        gitBranch={undefined} // TODO: Get from project
        gitUrl={gitUrl}
        onCheckpointPinned={handleCheckpointPinned}
      />
    </VStack>
  );
}

// Checkpoints View Component
interface CheckpointsViewProps {
  projectId: string;
  gitUrl?: string;
  checkpoints: Checkpoint[];
  loading: boolean;
  onCheckpointsUpdated: () => void;
}

function CheckpointsView({
  gitUrl,
  checkpoints,
  loading,
  onCheckpointsUpdated,
}: CheckpointsViewProps) {
  const handleUnpin = async (checkpointId: string) => {
    try {
      await invokeUnpinCheckpoint(checkpointId);
      toaster.create({
        title: "Checkpoint Unpinned",
        description: "Checkpoint has been removed",
        type: "success",
        duration: 3000,
      });
      onCheckpointsUpdated();
    } catch (err) {
      toaster.create({
        title: "Failed to Unpin Checkpoint",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
        duration: 5000,
      });
    }
  };

  const handleCreateProject = async (checkpoint: Checkpoint) => {
    try {
      // Open directory picker
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Parent Directory for New Project",
      });

      if (!selectedPath || typeof selectedPath !== "string") {
        return;
      }

      // Create project name from checkpoint name
      const projectDirName = checkpoint.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const targetPath = `${selectedPath}/${projectDirName}`;

      const result = await invokeCreateProjectFromCheckpoint(
        checkpoint.id,
        targetPath,
        checkpoint.name,
        true // Register project
      );

      toaster.create({
        title: "Project Created",
        description: result,
        type: "success",
        duration: 5000,
      });
    } catch (err) {
      toaster.create({
        title: "Failed to Create Project",
        description: err instanceof Error ? err.message : "Unknown error",
        type: "error",
        duration: 5000,
      });
    }
  };
  if (loading) {
    return (
      <VStack align="center" justify="center" py={12} gap={4}>
        <Spinner size="lg" />
        <Text fontSize="sm" color="fg.muted">
          Loading checkpoints...
        </Text>
      </VStack>
    );
  }

  if (checkpoints.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Content>
          <EmptyState.Title>No checkpoints yet</EmptyState.Title>
          <EmptyState.Description>
            Pin commits from the Commits view to create checkpoints
          </EmptyState.Description>
        </EmptyState.Content>
      </EmptyState.Root>
    );
  }

  return (
    <Box
      css={{
        '& [data-part="connector"]': {
          borderColor: "#4287f5 !important",
          borderWidth: "2px !important",
          borderStyle: "solid !important",
          opacity: "1 !important",
          display: "block !important",
          visibility: "visible !important",
        },
      }}
    >
      <Timeline.Root variant="subtle" colorPalette="blue">
        {checkpoints.map((checkpoint, index) => {
          const typeIcon = getCheckpointTypeIcon(checkpoint.checkpointType);
          const typeColor = getCheckpointTypeColor(checkpoint.checkpointType);
          const typeColorPalette = getCheckpointTypeColorPalette(
            checkpoint.checkpointType
          );
          return (
            <Timeline.Item key={checkpoint.id}>
              <Timeline.Indicator bg={`${typeColor}`} color="white">
                <RiFlag2Fill />
              </Timeline.Indicator>
              <Timeline.Content>
                <Card.Root>
                  <CardHeader pb={2}>
                    <HStack justify="space-between" align="start">
                      <VStack align="start" gap={1} flex={1}>
                        <HStack gap={2} flexWrap="wrap">
                          <Text fontWeight="semibold" fontSize="sm">
                            {checkpoint.name}
                          </Text>
                          {(() => {
                            const typeIcon = getCheckpointTypeIcon(
                              checkpoint.checkpointType
                            );
                            const typeLabel = getCheckpointTypeLabel(
                              checkpoint.checkpointType
                            );
                            const typeColorPalette =
                              getCheckpointTypeColorPalette(
                                checkpoint.checkpointType
                              );
                            return typeIcon && typeLabel && typeColorPalette ? (
                              <Badge
                                size="sm"
                                variant="outline"
                                colorPalette={typeColorPalette}
                              >
                                <HStack gap={1}>
                                  <Icon color={typeIcon.color} boxSize={3}>
                                    <typeIcon.icon />
                                  </Icon>
                                  <Text>{typeLabel}</Text>
                                </HStack>
                              </Badge>
                            ) : null;
                          })()}
                        </HStack>
                        {checkpoint.description && (
                          <Text fontSize="xs" color="fg.muted">
                            {checkpoint.description}
                          </Text>
                        )}
                      </VStack>
                      <HStack gap={2}>
                        {gitUrl && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              invokeOpenCommitInGitHub(
                                gitUrl,
                                checkpoint.gitCommitSha
                              ).catch(console.error);
                            }}
                          >
                            <LuExternalLink />
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="green"
                          onClick={() => handleCreateProject(checkpoint)}
                        >
                          <LuFolderPlus />
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          colorPalette="red"
                          onClick={() => handleUnpin(checkpoint.id)}
                        >
                          <LuTrash2 />
                        </Button>
                      </HStack>
                    </HStack>
                  </CardHeader>
                  <CardBody pt={2}>
                    <Text fontSize="xs" fontFamily="mono" color="fg.subtle">
                      {checkpoint.gitCommitSha.substring(0, 7)}
                    </Text>
                  </CardBody>
                </Card.Root>
              </Timeline.Content>
            </Timeline.Item>
          );
        })}
      </Timeline.Root>
    </Box>
  );
}
