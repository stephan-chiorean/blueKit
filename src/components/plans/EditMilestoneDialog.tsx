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
} from '@chakra-ui/react';
import { PlanMilestone } from '../../types/plan';
import { invokeUpdatePlanMilestone } from '../../ipc';
import { toaster } from '../ui/toaster';

interface EditMilestoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: PlanMilestone;
  onMilestoneUpdated: () => void;
}

export default function EditMilestoneDialog({
  isOpen,
  onClose,
  milestone,
  onMilestoneUpdated,
}: EditMilestoneDialogProps) {
  const [name, setName] = useState(milestone.name);
  const [description, setDescription] = useState(milestone.description || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(milestone.name);
    setDescription(milestone.description || '');
  }, [milestone]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toaster.create({
        type: 'error',
        title: 'Name required',
        description: 'Please enter a milestone name',
        closable: true,
      });
      return;
    }

    setLoading(true);
    try {
      await invokeUpdatePlanMilestone(
        milestone.id,
        name.trim(),
        description.trim() || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Milestone updated',
      });

      onMilestoneUpdated();
      onClose();
    } catch (error) {
      console.error('Failed to update milestone:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to update milestone',
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
              <Dialog.Title>Edit Milestone</Dialog.Title>
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
                    placeholder="Enter milestone name..."
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
                  Update Milestone
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
