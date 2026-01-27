import { useState, useEffect } from "react";
import { Center, Spinner, Text, VStack } from "@chakra-ui/react";
import { invokeGetVaultProject, Project } from "@/ipc";
import LibrarySetupScreen from "@/pages/LibrarySetupScreen";
import ProjectView from "@/views/project/ProjectView";

interface HomeViewProps {
  onProjectSelect: (project: Project) => void;
  onNavigateToPlans?: (source: "claude" | "cursor") => void;
}

export default function HomeView({ onProjectSelect }: HomeViewProps) {
  const [vaultProject, setVaultProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadVaultProject = async () => {
    try {
      setIsLoading(true);
      const project = await invokeGetVaultProject();
      setVaultProject(project);
    } catch (error) {
      console.error("Failed to load vault project:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVaultProject();
  }, []);

  if (isLoading) {
    return (
      <Center h="100vh">
        <VStack gap={4}>
          <Spinner size="xl" color="primary.500" />
          <Text color="fg.muted">Loading Vault...</Text>
        </VStack>
      </Center>
    );
  }

  if (!vaultProject) {
    return <LibrarySetupScreen onLibraryCreated={loadVaultProject} />;
  }

  return (
    <ProjectView
      project={{
        ...vaultProject,
        // Ensure ProjectEntry compatibility if needed, though Project should match
        path: vaultProject.path,
        id: vaultProject.id,
        name: vaultProject.name,
        title: vaultProject.name,
      } as any}
      onBack={() => { }}
      isVault={true}
      onProjectSelect={onProjectSelect}
    />
  );
}
