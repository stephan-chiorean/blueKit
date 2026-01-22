import { useState, useRef, useEffect } from 'react';
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
import { invokeCreatePlanMilestone, invokeCreatePlanPhase } from '../../ipc';
import { PlanPhaseWithMilestones } from '../../types/plan';
import { toaster } from '../ui/toaster';

interface CreateMilestoneSeamlessDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onMilestoneCreated: () => void;
}

export default function CreateMilestoneSeamlessDialog({
  isOpen,
  onClose,
  planId,
  phases,
  onMilestoneCreated,
}: CreateMilestoneSeamlessDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when dialog opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
    }
  }, [isOpen]);

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
      // Find or create "Ungrouped" phase
      let phaseId = phases.find(p => p.name === 'Ungrouped')?.id;
      
      if (!phaseId) {
        const newPhase = await invokeCreatePlanPhase(
          planId,
          'Ungrouped',
          'Milestones not assigned to a specific phase',
          phases.length
        );
        phaseId = newPhase.id;
      }

      await invokeCreatePlanMilestone(
        phaseId,
        name.trim(),
        description.trim() || undefined
      );

      toaster.create({
        type: 'success',
        title: 'Milestone created',
        description: `Created milestone: ${name.trim()}`,
      });

      onMilestoneCreated();

      // Reset form but keep dialog open for quick entry
      setName('');
      setDescription('');
      
      // Focus name input for next entry
      setTimeout(() => nameInputRef.current?.focus(), 100);
    } catch (error) {
      console.error('Failed to create milestone:', error);
      toaster.create({
        type: 'error',
        title: 'Failed to create milestone',
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

  const handleKeyDown = (e: React.KeyboardEvent, field: 'name' | 'description') => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (field === 'name') {
        // Move to description or submit if description is empty
        if (!description.trim()) {
          handleSubmit();
        } else {
          // Focus description or submit
          document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="description"]')?.focus();
        }
      } else {
        // Submit from description
        handleSubmit();
      }
    }
  };

  return (
    <Portal>
      <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header>
              <Dialog.Title>Create Milestone</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton aria-label="Close" size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>

            <Dialog.Body>
              <VStack gap={4} align="stretch">
                <Field.Root required>
                  <Field.Label>Name</Field.Label>
                  <Input
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter milestone name..."
                    disabled={loading}
                    onKeyDown={(e) => handleKeyDown(e, 'name')}
                  />
                  <Field.HelperText>Press Enter to continue or submit</Field.HelperText>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Description (Optional)</Field.Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description..."
                    disabled={loading}
                    rows={2}
                    onKeyDown={(e) => handleKeyDown(e, 'description')}
                  />
                  <Field.HelperText>Press Enter to submit</Field.HelperText>
                </Field.Root>
              </VStack>
            </Dialog.Body>

            <Dialog.Footer>
              <HStack gap={2} justify="flex-end">
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                  Close
                </Button>
                <Button
                  colorPalette="primary"
                  onClick={handleSubmit}
                  loading={loading}
                  loadingText="Creating..."
                >
                  Create
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Portal>
  );
}




