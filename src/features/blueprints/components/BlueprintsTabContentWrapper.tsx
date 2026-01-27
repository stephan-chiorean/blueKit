import { useEffect, useRef } from 'react';
import BlueprintsSection from '@/views/project/sections/BlueprintsSection';
import { ArtifactFile } from '@/ipc';

interface Blueprint {
  id: string;
  name: string;
  description: string;
}

interface BlueprintsTabContentWrapperProps {
  blueprints: Blueprint[];
  onCreateBlueprint: (name: string, description: string) => void;
  isCreateMode: boolean;
  onSetCreateMode: (mode: boolean) => void;
  kits: ArtifactFile[];
  kitsLoading: boolean;
  /**
   * Optional compatibility props for the new BlueprintsSection API.
   * These are not used by the legacy wrapper callers but keep the module safe.
   */
  projectPath?: string;
  projectsCount?: number;
  onViewTask?: (blueprintPath: string, taskFile: string, taskDescription: string) => void;
}

export default function BlueprintsTabContentWrapper({
  isCreateMode,
  projectPath,
  projectsCount,
  onViewTask,
}: BlueprintsTabContentWrapperProps) {
  const prevCreateModeRef = useRef(isCreateMode);

  useEffect(() => {
    if (isCreateMode && !prevCreateModeRef.current) {
      // Create mode was just activated
      prevCreateModeRef.current = true;
    } else if (!isCreateMode) {
      prevCreateModeRef.current = false;
    }
  }, [isCreateMode]);

  // Compatibility defaults: the legacy wrapper does not know about these props.
  const safeProjectPath = projectPath ?? '';
  const safeProjectsCount = projectsCount ?? 0;
  const safeOnViewTask = onViewTask ?? (() => {});

  return (
    <BlueprintsSection
      projectPath={safeProjectPath}
      projectsCount={safeProjectsCount}
      onViewTask={safeOnViewTask}
    />
  );
}
