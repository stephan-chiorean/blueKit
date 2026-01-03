import { useState, useEffect, useMemo, useRef } from "react";
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
  Tag,
} from "@chakra-ui/react";
import { toaster } from "../ui/toaster";
import {
  LuGitBranch,
  LuExternalLink,
  LuTrash2,
  LuRefreshCw,
  LuFilter,
} from "react-icons/lu";
import { TbCopyPlus } from "react-icons/tb";
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
} from "../../ipc/checkpoints";
import {
  getCheckpointTypeColor,
  getCheckpointTypeLabel,
  getCheckpointTypeIcon,
  getCheckpointTypeColorPalette,
  parseCheckpointTags,
} from "../../utils/checkpointUtils";
import PinCheckpointModal from "./PinCheckpointModal";
import BranchOffModal from "./BranchOffModal";
import { FilterPanel } from "../shared/FilterPanel";

interface TimelineTabContentProps {
  projectId: string;
  gitUrl?: string;
  gitConnected: boolean;
  onGitConnected?: () => void;
}

type ViewMode = "commits" | "checkpoints";

// Activity calculation constants
const CHANGES_PER_CIRCLE = 50;
const MAX_CIRCLES = 10;

// Calculate activity score for commits
const calculateCommitActivity = (commits: GitHubCommit[]): number => {
  const totalChanges = commits.reduce((sum, commit) => {
    const commitChanges = (commit.files || []).reduce(
      (fileSum: number, file: { additions: number; deletions: number }) =>
        fileSum + file.additions + file.deletions,
      0
    );
    return sum + commitChanges;
  }, 0);

  return Math.min(totalChanges / CHANGES_PER_CIRCLE, MAX_CIRCLES);
};

// Calculate activity score for checkpoints
const calculateCheckpointActivity = (checkpoints: Checkpoint[]): number => {
  return Math.min(checkpoints.length, MAX_CIRCLES);
};

// Get summary stats for commits
const getCommitStats = (commits: GitHubCommit[]) => {
  // Debug logging
  if (commits.length > 0) {
    console.log('[DEBUG] Sample commit:', commits[0]);
    console.log('[DEBUG] Has files?', commits[0]?.files);
    console.log('[DEBUG] Files length:', commits[0]?.files?.length);
  }

  const totalAdditions = commits.reduce(
    (sum, commit) =>
      sum +
      (commit.files || []).reduce(
        (s: number, f: { additions: number }) => s + f.additions,
        0
      ),
    0
  );
  const totalDeletions = commits.reduce(
    (sum, commit) =>
      sum +
      (commit.files || []).reduce(
        (s: number, f: { deletions: number }) => s + f.deletions,
        0
      ),
    0
  );

  return {
    count: commits.length,
    additions: totalAdditions,
    deletions: totalDeletions,
  };
};

// ActivityCircles component
interface ActivityCirclesProps {
  activityScore: number;
}

const ActivityCircles = ({
  activityScore,
}: ActivityCirclesProps) => {
  // Don't render anything if no activity
  if (activityScore === 0) {
    return null;
  }

  const fullCircles = Math.floor(activityScore);
  const partialFill = activityScore - fullCircles;

  return (
    <HStack gap={0.5} ml={2}>
      {/* Full circles */}
      {Array.from({ length: fullCircles }).map((_, i) => (
        <Box
          key={`full-${i}`}
          w="10px"
          h="10px"
          borderRadius="full"
          bg="blue.500"
          borderWidth="1px"
          borderColor="blue.600"
        />
      ))}

      {/* Partial circle */}
      {partialFill > 0 && (
        <Box
          position="relative"
          w="10px"
          h="10px"
          borderRadius="full"
          borderWidth="1px"
          borderColor="blue.600"
          overflow="hidden"
        >
          <Box
            position="absolute"
            left={0}
            top={0}
            bottom={0}
            width={`${partialFill * 100}%`}
            bg="blue.500"
          />
          <Box
            position="absolute"
            right={0}
            top={0}
            bottom={0}
            width={`${(1 - partialFill) * 100}%`}
            bg="gray.200"
            _dark={{ bg: "gray.700" }}
          />
        </Box>
      )}
    </HStack>
  );
};

// DateHeader component with activity indicators
interface DateHeaderProps {
  dateString: string;
  activityScore: number;
  count: number;
  itemType: "commits" | "checkpoints";
  additions?: number;
  deletions?: number;
}

const DateHeader = ({
  dateString,
  activityScore,
  count,
  itemType,
  additions,
  deletions,
}: DateHeaderProps) => (
  <Box
    py={1}
    px={2}
    mb={2}
    mt={2}
  >
    <HStack gap={2} align="center">
      {/* Date Label */}
      <Text fontSize="sm" fontWeight="bold" color="fg.emphasized">
        {dateString}
      </Text>

      {/* Count Badge */}
      <Badge size="sm" variant="subtle" colorPalette="blue">
        {count} {itemType}
      </Badge>

      {/* Lines Changed (commits only) */}
      {itemType === "commits" &&
        additions !== undefined &&
        deletions !== undefined && (
          <HStack gap={1} fontSize="xs">
            <Text color="green.600" _dark={{ color: "green.400" }}>
              +{additions}
            </Text>
            <Text color="red.600" _dark={{ color: "red.400" }}>
              -{deletions}
            </Text>
          </HStack>
        )}

      {/* Activity Circles */}
      <ActivityCircles activityScore={activityScore} />

      {/* Divider Line */}
      <Box flex={1} height="1px" bg="border.subtle" ml={2} />
    </HStack>
  </Box>
);

export default function TimelineTabContent({
  projectId,
  gitUrl,
  gitConnected,
  onGitConnected,
}: TimelineTabContentProps) {
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

  // Checkpoint filter state
  const [checkpointNameFilter, setCheckpointNameFilter] = useState("");
  const [checkpointSelectedTags, setCheckpointSelectedTags] = useState<string[]>([]);
  const [checkpointAllTags, setCheckpointAllTags] = useState<string[]>([]);
  const [isCheckpointFilterOpen, setIsCheckpointFilterOpen] = useState(false);
  const checkpointFilterButtonRef = useRef<HTMLButtonElement>(null);

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

  // Load checkpoints when project changes (needed for commits view to show pinned commits)
  useEffect(() => {
    if (projectId && gitConnected) {
      loadCheckpoints();
    }
  }, [projectId, gitConnected]);

  // Reload checkpoints when switching to checkpoints view
  useEffect(() => {
    if (viewMode === "checkpoints" && projectId && gitConnected) {
      loadCheckpoints();
    }
  }, [viewMode]);

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

  // Format elegant date for headers
  const formatElegantDate = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (targetDate.getTime() === today.getTime()) {
      return "Today";
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      const daysDiff = Math.floor(
        (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 7 && daysDiff > 0) {
        // This week - show day of week
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } else {
        // Older - show full date
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    }
  };

  // Group commits by date
  const groupCommitsByDate = (
    commits: GitHubCommit[]
  ): { date: Date; dateString: string; commits: GitHubCommit[] }[] => {
    const groups: Map<
      string,
      { date: Date; dateString: string; commits: GitHubCommit[] }
    > = new Map();

    commits.forEach((commit) => {
      const commitDate = new Date(commit.commit.author.date);
      const dateKey = `${commitDate.getFullYear()}-${commitDate.getMonth()}-${commitDate.getDate()}`;

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: commitDate,
          dateString: formatElegantDate(commitDate),
          commits: [],
        });
      }

      groups.get(dateKey)!.commits.push(commit);
    });

    return Array.from(groups.values());
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
          variant="ghost"
          size="sm"
          loading={loading}
          loadingText="Syncing..."
          bg="bg.subtle"
          borderWidth="1px"
          borderColor="border.subtle"
          _hover={{ bg: "bg.subtle" }}
        >
          <HStack gap={2}>
            <Icon>
              <LuRefreshCw />
            </Icon>
            <Text>Sync</Text>
          </HStack>
        </Button>
      )}
      {viewMode === "checkpoints" && (
        <Box position="relative">
          <Button
            ref={checkpointFilterButtonRef}
            variant="ghost"
            size="sm"
            onClick={() => setIsCheckpointFilterOpen(!isCheckpointFilterOpen)}
            bg={isCheckpointFilterOpen ? "bg.subtle" : "bg.subtle"}
            borderWidth="1px"
            borderColor="border.subtle"
            _hover={{ bg: "bg.subtle" }}
          >
            <HStack gap={2}>
              <Icon>
                <LuFilter />
              </Icon>
              <Text>Filter</Text>
              {(checkpointNameFilter || checkpointSelectedTags.length > 0) && (
                <Badge size="sm" colorPalette="primary" variant="solid">
                  {[checkpointNameFilter && 1, checkpointSelectedTags.length]
                    .filter(Boolean)
                    .reduce((a, b) => (a || 0) + (b || 0), 0)}
                </Badge>
              )}
            </HStack>
          </Button>
        </Box>
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

      {/* FilterPanel for Checkpoints - positioned absolutely relative to filter button */}
      {viewMode === "checkpoints" && (
        <FilterPanel
          isOpen={isCheckpointFilterOpen}
          onClose={() => setIsCheckpointFilterOpen(false)}
          nameFilter={checkpointNameFilter}
          onNameFilterChange={setCheckpointNameFilter}
          allTags={checkpointAllTags}
          selectedTags={checkpointSelectedTags}
          onToggleTag={(tag) => {
            setCheckpointSelectedTags((prev) => {
              if (prev.includes(tag)) {
                return prev.filter((t) => t !== tag);
              } else {
                return [...prev, tag];
              }
            });
          }}
          filterButtonRef={checkpointFilterButtonRef}
        />
      )}

      {viewMode === "commits" ? (
        <>
          {groupCommitsByDate(commits).map((group, _groupIndex) => {
            const activityScore = calculateCommitActivity(group.commits);
            const stats = getCommitStats(group.commits);

            // Debug logging
            console.log('[DEBUG] Date Group:', group.dateString);
            console.log('[DEBUG] - Commits:', group.commits.length);
            console.log('[DEBUG] - Activity Score:', activityScore);
            console.log('[DEBUG] - Stats:', stats);

            return (
            <Box key={`group-${_groupIndex}`}>
              <DateHeader
                dateString={group.dateString}
                activityScore={activityScore}
                count={stats.count}
                itemType="commits"
                additions={stats.additions}
                deletions={stats.deletions}
              />
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
                  {group.commits.map((commit) => {
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
                        borderRadius="16px"
                        borderWidth="1px"
                        transition="all 0.2s ease-in-out"
                        css={{
                          background: 'rgba(255, 255, 255, 0.15)',
                          backdropFilter: 'blur(30px) saturate(180%)',
                          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                          borderColor: isPinned && checkpointTypeColor ? checkpointTypeColor : 'rgba(255, 255, 255, 0.2)',
                          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                          _dark: {
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderColor: isPinned && checkpointTypeColor ? checkpointTypeColor : 'rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                          },
                          _hover: {
                            transform: 'scale(1.005)',
                          },
                        }}
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
            </Box>
            );
          })}

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
          nameFilter={checkpointNameFilter}
          selectedTags={checkpointSelectedTags}
          onAllTagsUpdate={setCheckpointAllTags}
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
  nameFilter: string;
  selectedTags: string[];
  onAllTagsUpdate: (tags: string[]) => void;
}

function CheckpointsView({
  projectId,
  gitUrl,
  checkpoints,
  loading,
  onCheckpointsUpdated,
  nameFilter,
  selectedTags,
  onAllTagsUpdate,
}: CheckpointsViewProps) {
  const [branchOffModalOpen, setBranchOffModalOpen] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);

  // Format date from milliseconds timestamp
  const formatDateFromMs = (timestampMs: number): string => {
    const date = new Date(timestampMs);
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

  // Format elegant date for headers
  const formatElegantDate = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    if (targetDate.getTime() === today.getTime()) {
      return "Today";
    } else if (targetDate.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      const daysDiff = Math.floor(
        (today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff < 7 && daysDiff > 0) {
        // This week - show day of week
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } else {
        // Older - show full date
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    }
  };

  // Get all unique tags from checkpoints and update parent
  useMemo(() => {
    const tagSet = new Set<string>();
    checkpoints.forEach((checkpoint) => {
      if (checkpoint.tags) {
        try {
          const parsedTags = JSON.parse(checkpoint.tags) as string[];
          parsedTags.forEach((tag) => tagSet.add(tag));
        } catch (err) {
          console.error("Failed to parse tags:", err);
        }
      }
    });
    const tags = Array.from(tagSet).sort();
    onAllTagsUpdate(tags); // Pass tags back to parent for FilterPanel
    return tags;
  }, [checkpoints, onAllTagsUpdate]);

  // Filter checkpoints based on name and tags
  const filteredCheckpoints = useMemo(() => {
    return checkpoints.filter((checkpoint) => {
      const matchesName =
        !nameFilter ||
        checkpoint.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        checkpoint.description?.toLowerCase().includes(nameFilter.toLowerCase());

      let checkpointTags: string[] = [];
      if (checkpoint.tags) {
        try {
          checkpointTags = JSON.parse(checkpoint.tags) as string[];
        } catch (err) {
          console.error("Failed to parse tags:", err);
        }
      }

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((selectedTag) =>
          checkpointTags.some(
            (tag) => tag.toLowerCase() === selectedTag.toLowerCase()
          )
        );

      return matchesName && matchesTags;
    });
  }, [checkpoints, nameFilter, selectedTags]);

  // Group checkpoints by date
  const groupedCheckpoints = useMemo(() => {
    const groups: Map<
      string,
      { date: Date; dateString: string; checkpoints: Checkpoint[] }
    > = new Map();

    filteredCheckpoints.forEach((checkpoint) => {
      const checkpointDate = new Date(checkpoint.createdAt);
      const dateKey = `${checkpointDate.getFullYear()}-${checkpointDate.getMonth()}-${checkpointDate.getDate()}`;

      if (!groups.has(dateKey)) {
        groups.set(dateKey, {
          date: checkpointDate,
          dateString: formatElegantDate(checkpointDate),
          checkpoints: [],
        });
      }

      groups.get(dateKey)!.checkpoints.push(checkpoint);
    });

    return Array.from(groups.values());
  }, [filteredCheckpoints]);

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
    <Box>
      {filteredCheckpoints.length === 0 ? (
        <Box
          p={6}
          bg="bg.subtle"
          borderRadius="md"
          borderWidth="1px"
          borderColor="border.subtle"
          textAlign="center"
        >
          <Text color="fg.muted" fontSize="sm">
            {nameFilter || selectedTags.length > 0
              ? "No checkpoints match the current filters"
              : "No checkpoints found"}
          </Text>
        </Box>
      ) : (
        <>
          {groupedCheckpoints.map((group, _groupIndex) => {
            const activityScore = calculateCheckpointActivity(group.checkpoints);

            return (
            <Box key={`group-${_groupIndex}`}>
              <DateHeader
                dateString={group.dateString}
                activityScore={activityScore}
                count={group.checkpoints.length}
                itemType="checkpoints"
              />
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
                  {group.checkpoints.map((checkpoint) => {
          const typeColor = getCheckpointTypeColor(checkpoint.checkpointType);
          return (
            <Timeline.Item key={checkpoint.id}>
              <Timeline.Indicator bg={`${typeColor}`} color="white">
                <RiFlag2Fill />
              </Timeline.Indicator>
              <Timeline.Content>
                <Card.Root
                  borderRadius="16px"
                  borderWidth="1px"
                  transition="all 0.2s ease-in-out"
                  css={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                    _dark: {
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderColor: 'rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
                    },
                    _hover: {
                      transform: 'scale(1.005)',
                    },
                  }}
                >
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
                        <Text fontSize="xs" color="fg.muted">
                          Created {formatDateFromMs(checkpoint.createdAt)}
                        </Text>
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
                          onClick={() => {
                            setSelectedCheckpoint(checkpoint);
                            setBranchOffModalOpen(true);
                          }}
                          css={{
                            color: "#F28333",
                            "&:hover": {
                              bg: "rgba(242, 131, 51, 0.1)",
                            },
                          }}
                        >
                          <TbCopyPlus />
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
                    <VStack align="start" gap={2}>
                      <Text fontSize="xs" fontFamily="mono" color="fg.subtle">
                        {checkpoint.gitCommitSha.substring(0, 7)}
                      </Text>
                      {(() => {
                        const tags = parseCheckpointTags(checkpoint.tags);
                        return tags.length > 0 ? (
                          <HStack gap={1} flexWrap="wrap">
                            {tags.map((tag) => (
                              <Tag.Root
                                key={tag}
                                size="sm"
                                variant="subtle"
                                colorPalette="gray"
                              >
                                <Tag.Label>{tag}</Tag.Label>
                              </Tag.Root>
                            ))}
                          </HStack>
                        ) : null;
                      })()}
                    </VStack>
                  </CardBody>
                </Card.Root>
              </Timeline.Content>
            </Timeline.Item>
          );
                  })}
                </Timeline.Root>
              </Box>
            </Box>
            );
          })}
        </>
      )}

      {/* Branch Off Modal */}
      {selectedCheckpoint && (
        <BranchOffModal
          isOpen={branchOffModalOpen}
          onClose={() => {
            setBranchOffModalOpen(false);
            setSelectedCheckpoint(null);
          }}
          checkpoint={selectedCheckpoint}
          projectId={projectId}
          onSuccess={() => {
            onCheckpointsUpdated();
          }}
        />
      )}
    </Box>
  );
}
