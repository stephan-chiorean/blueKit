import { createContext, useContext, useState, ReactNode } from 'react';
import { ResourceFile, ResourceType } from '@/types/resource';

interface ResourceContextType {
  selectedResource: ResourceFile | null;
  resourceContent: string | null;
  resourceType: ResourceType | null;
  setSelectedResource: (resource: ResourceFile | null, content: string | null, type?: ResourceType) => void;
  clearSelectedResource: () => void;
}

const ResourceContext = createContext<ResourceContextType | undefined>(undefined);

interface ResourceProviderProps {
  children: ReactNode;
}

export function ResourceProvider({ children }: ResourceProviderProps) {
  const [selectedResource, setSelectedResourceState] = useState<ResourceFile | null>(null);
  const [resourceContent, setResourceContent] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType | null>(null);

  const setSelectedResource = (resource: ResourceFile | null, content: string | null, type?: ResourceType) => {
    setSelectedResourceState(resource);
    setResourceContent(content);

    // If type is explicitly provided, use it
    // Otherwise, infer from resource.resourceType or resource.frontMatter.type
    if (type) {
      setResourceType(type);
    } else if (resource) {
      const inferredType = resource.resourceType ||
                          (resource.frontMatter?.type as ResourceType) ||
                          'kit';
      setResourceType(inferredType);
    } else {
      setResourceType(null);
    }
  };

  const clearSelectedResource = () => {
    setSelectedResourceState(null);
    setResourceContent(null);
    setResourceType(null);
  };

  return (
    <ResourceContext.Provider
      value={{
        selectedResource,
        resourceContent,
        resourceType,
        setSelectedResource,
        clearSelectedResource
      }}
    >
      {children}
    </ResourceContext.Provider>
  );
}

export function useResource() {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error('useResource must be used within a ResourceProvider');
  }
  return context;
}
