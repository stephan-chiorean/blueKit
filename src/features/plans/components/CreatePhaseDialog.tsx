import { useState } from 'react';
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
import { invokeCreatePlanPhase } from '@/ipc';
import { toaster } from '@/shared/components/ui/toaster';

interface CreatePhaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  onPhaseCreated: () => void;
}

export default function CreatePhaseDialog({
  isOpen,
  onClose,
  planId,
  onPhaseCreated,
}: CreatePhaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

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
      await invokeCreatePlanPhase(
        planId,
        name.trim(),
        description.trim() || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Phase created',
        description: `Created phase: ${name.trim()}`,
      });

      onPhaseCreated();

      // Reset form
      setName('');
      setDescription('');

      onClose();
    } catch (error) {
      console.error('Failed to create phase:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create phase',
        description: String(error),
        closable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Create Phase</Dialog.Title>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
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
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSubmit}
                  loading={loading}
                  loadingText="Creating..."
                >
                  Create Phase
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}
