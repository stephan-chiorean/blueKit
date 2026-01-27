import { createContext, useContext, useState, ReactNode } from 'react';
import { ArtifactFile } from '@/ipc';

interface ProjectArtifactsContextType {
  artifacts: ArtifactFile[];
  setArtifacts: (artifacts: ArtifactFile[]) => void;
}

const ProjectArtifactsContext = createContext<ProjectArtifactsContextType | undefined>(undefined);

export function ProjectArtifactsProvider({ children }: { children: ReactNode }) {
  const [artifacts, setArtifacts] = useState<ArtifactFile[]>([]);

  return (
    <ProjectArtifactsContext.Provider value={{ artifacts, setArtifacts }}>
      {children}
    </ProjectArtifactsContext.Provider>
  );
}

export function useProjectArtifacts() {
  const context = useContext(ProjectArtifactsContext);
  if (!context) {
    throw new Error('useProjectArtifacts must be used within ProjectArtifactsProvider');
  }
  return context;
}

