import { useEffect, useRef } from 'react';
import BlueprintsTabContent from './BlueprintsTabContent';
import { ArtifactFile } from '../../ipc';

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
}

export default function BlueprintsTabContentWrapper({
  blueprints,
  onCreateBlueprint,
  isCreateMode,
  onSetCreateMode,
  kits,
  kitsLoading,
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

  return (
    <BlueprintsTabContent
      blueprints={blueprints}
      onCreateBlueprint={(name, description) => {
        onCreateBlueprint(name, description);
        onSetCreateMode(false);
      }}
      initialCreateMode={isCreateMode}
      onCancelCreate={() => onSetCreateMode(false)}
      kits={kits}
      kitsLoading={kitsLoading}
    />
  );
}

