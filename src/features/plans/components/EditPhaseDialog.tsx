import { useState, useEffect } from 'react';
import {
  Dialog,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Field,
  Portal,
  CloseButton,
  SegmentGroup,
} from '@chakra-ui/react';
import { PlanPhase } from '@/types/plan';
import { invokeUpdatePlanPhase } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

interface EditPhaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  phase: PlanPhase;
  onPhaseUpdated: () => void;
}

export default function EditPhaseDialog({
  isOpen,
  onClose,
  phase,
  onPhaseUpdated,
}: EditPhaseDialogProps) {
  const [name, setName] = useState(phase.name);
  const [description, setDescription] = useState(phase.description || '');
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed'>(phase.status);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(phase.name);
    setDescription(phase.description || '');
    setStatus(phase.status);
  }, [phase]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toaster.create({
        type: 'error',
        title: 'Name required',
        description: 'Please enter a phase name',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await invokeUpdatePlanPhase(
        phase.id,
        name.trim(),
        description.trim() || undefined,
        status
      );

      toaster.create({
        type: 'success',
        title: 'Phase updated',
      });

      onPhaseUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update phase:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update phase',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Edit Phase</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Name</Field.Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter phase name..."
                    disabled={loading}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    disabled={loading}
                    rows={3}
                  />
                </Field.Root>

                <Field.Root>
                  <Field.Label>Status</Field.Label>
                  <SegmentGroup.Root
                    value={status}
                    onValueChange={(e) => setStatus(e.value as 'pending' | 'in_progress' | 'completed')}
                    disabled={loading}
                  >
                    <SegmentGroup.Indicator />
                    <SegmentGroup.Item value="pending">
                      <SegmentGroup.ItemText>Pending</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                    <SegmentGroup.Item value="in_progress">
                      <SegmentGroup.ItemText>In Progress</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                    <SegmentGroup.Item value="completed">
                      <SegmentGroup.ItemText>Completed</SegmentGroup.ItemText>
                      <SegmentGroup.ItemHiddenInput />
                    </SegmentGroup.Item>
                  </SegmentGroup.Root>
                  <Field.HelperText>
                    Note: Marking as completed will auto-complete all milestones in this phase
                  </Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2} justify="flex-end">
                <Button variant="ghost" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSubmit}
                  loading={loading}
                  loadingText="Updating..."
                >
                  Update Phase
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
