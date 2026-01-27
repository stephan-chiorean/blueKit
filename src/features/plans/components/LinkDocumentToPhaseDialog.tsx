import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  VStack,
  Text,
  NativeSelect,
  Field,
} from '@chakra-ui/react';
import { PlanDocument, PlanPhase } from '@/types/plan';
import { invokeLinkDocumentToPhase } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';
import { useState } from 'react';

interface LinkDocumentToPhaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  document: PlanDocument;
  phases: PlanPhase[];
  onLinked: () => void;
}

export default function LinkDocumentToPhaseDialog({
  isOpen,
  onClose,
  document,
  phases,
  onLinked,
}: LinkDocumentToPhaseDialogProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(
    document.phaseId || ''
  );
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    try {
      setLoading(true);
      await invokeLinkDocumentToPhase(
        document.id,
        selectedPhaseId || undefined
      );
      toaster.create({
        type: 'success',
        title: 'Document linked',
        description: selectedPhaseId
          ? 'Document linked to phase'
          : 'Document unlinked from phase',
        closable: true,
      });
      onLinked();
      onClose();
    } catch (error) {
      console.error('Failed to link document:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to link document',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Document to Phase</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={4}>
            <Text fontSize="sm" color="text.secondary">
              Select a phase to link "{document.fileName}" to, or choose "Unlinked" to remove the link.
            </Text>

            <Field.Root>
              <Field.Label>Phase</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  value={selectedPhaseId}
                  onChange={(e) => setSelectedPhaseId(e.currentTarget.value)}
                >
                  <option value="">Unlinked</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            loading={loading}
            disabled={loading}
            colorPalette="primary"
          >
            {selectedPhaseId ? 'Link' : 'Unlink'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog.Root>
  );
}

