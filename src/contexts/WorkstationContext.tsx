import { createContext, useContext, useState, ReactNode } from 'react';
import { ArtifactFile } from '../ipc';

interface WorkstationContextType {
  selectedKit: ArtifactFile | null;
  kitContent: string | null;
  setSelectedKit: (kit: ArtifactFile | null, content: string | null) => void;
  clearSelectedKit: () => void;
  searchQuery: string;
  isSearchOpen: boolean;
  setSearchQuery: (query: string) => void;
  setIsSearchOpen: (open: boolean) => void;
}

const WorkstationContext = createContext<WorkstationContextType | undefined>(undefined);

interface WorkstationProviderProps {
  children: ReactNode;
}

export function WorkstationProvider({ children }: WorkstationProviderProps) {
  const [selectedKit, setSelectedKitState] = useState<ArtifactFile | null>(null);
  const [kitContent, setKitContent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  const setSelectedKit = (kit: ArtifactFile | null, content: string | null) => {
    setSelectedKitState(kit);
    setKitContent(content);
  };

  const clearSelectedKit = () => {
    setSelectedKitState(null);
    setKitContent(null);
  };

  return (
    <WorkstationContext.Provider
      value={{
        selectedKit,
        kitContent,
        setSelectedKit,
        clearSelectedKit,
        searchQuery,
        isSearchOpen,
        setSearchQuery,
        setIsSearchOpen,
      }}
    >
      {children}
    </WorkstationContext.Provider>
  );
}

export function useWorkstation() {
  const context = useContext(WorkstationContext);
  if (context === undefined) {
    throw new Error('useWorkstation must be used within a WorkstationProvider');
  }
  return context;
}

