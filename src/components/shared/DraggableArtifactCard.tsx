import { useDraggable } from '@dnd-kit/core';
import { ArtifactFile } from '../../ipc';

interface DraggableArtifactCardProps {
  artifact: ArtifactFile;
  children: React.ReactNode;
}

/**
 * DraggableArtifactCard - wrapper component that makes artifact cards draggable.
 *
 * Wraps existing artifact card components (kit cards, walkthrough cards, etc.)
 * and adds drag-and-drop functionality so they can be moved into folders.
 *
 * @example
 * ```tsx
 * <DraggableArtifactCard artifact={kit}>
 *   <Card.Root> // Your existing kit card JSX
 *     ...
 *   </Card.Root>
 * </DraggableArtifactCard>
 * ```
 */
export function DraggableArtifactCard({ artifact, children }: DraggableArtifactCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `artifact-${artifact.path}`,
    data: {
      type: 'artifact',
      artifact,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        opacity: transform ? 0.5 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
