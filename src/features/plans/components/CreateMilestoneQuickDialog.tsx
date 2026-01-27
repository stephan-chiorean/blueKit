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
  NativeSelect,
} from '@chakra-ui/react';
import { invokeCreatePlanMilestone, invokeCreatePlanPhase } from '@/ipc';
import { PlanPhaseWithMilestones } from '@/types/plan';
import { toaster } from '@/shared/components/ui/toaster';

interface CreateMilestoneQuickDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  phases: PlanPhaseWithMilestones[];
  onMilestoneCreated: () => void;
}

export default function CreateMilestoneQuickDialog({
  isOpen,
  onClose,
  planId,
  phases,
  onMilestoneCreated,
}: CreateMilestoneQuickDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [creatingNewPhase, setCreatingNewPhase] = useState(false);
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
      setSelectedPhaseId('');
      setNewPhaseName('');
      setCreatingNewPhase(false);
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

    // If creating new phase, create it first
    let phaseId = selectedPhaseId;
    if (creatingNewPhase && newPhaseName.trim()) {
      try {
        setLoading(true);
        const newPhase = await invokeCreatePlanPhase(
          planId,
          newPhaseName.trim(),
          undefined,
          phases.length
        );
        phaseId = newPhase.id;
      } catch (error) {
        console.error('Failed to create phase:', error);
        toaster.create({
          type: 'error',
          title: 'Failed to create phase',
          description: String(error),
          closable: true,
        });
        setLoading(false);
        return;
      }
    }

    // If no phase selected and not creating new, create "Ungrouped" phase
    if (!phaseId && !creatingNewPhase) {
      try {
        // Check if "Ungrouped" phase already exists
        const ungroupedPhase = phases.find(p => p.name === 'Ungrouped');
        if (ungroupedPhase) {
          phaseId = ungroupedPhase.id;
        } else {
          const newPhase = await invokeCreatePlanPhase(
            planId,
            'Ungrouped',
            'Milestones not assigned to a specific phase',
            phases.length
          );
          phaseId = newPhase.id;
        }
      } catch (error) {
        console.error('Failed to create ungrouped phase:', error);
        toaster.create({
          type: 'error',
          title: 'Failed to create phase',
          description: String(error),
          closable: true,
        });
        setLoading(false);
        return;
      }
    }

    if (!phaseId) {
      toaster.create({
        type: 'error',
        title: 'Phase required',
        description: 'Please select or create a phase',
        closable: true,
      });
      setLoading(false);
      return;
    }

    try {
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
      setNewPhaseName('');
      setCreatingNewPhase(false);
      
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
      setSelectedPhaseId('');
      setNewPhaseName('');
      setCreatingNewPhase(false);
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

                <Field.Root>
                  <Field.Label>Phase (Optional)</Field.Label>
                  <VStack align="stretch" gap={2}>
                    {!creatingNewPhase ? (
                      <>
                        <NativeSelect.Root
                          value={selectedPhaseId}
                          onValueChange={(e) => setSelectedPhaseId(e.value)}
                          disabled={loading}
                        >
                          <NativeSelect.Field>
                            <option value="">No phase (will create "Ungrouped")</option>
                            {phases.map((phase) => (
                              <option key={phase.id} value={phase.id}>
                                {phase.name}
                              </option>
                            ))}
                          </NativeSelect.Field>
                        </NativeSelect.Root>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setCreatingNewPhase(true)}
                          disabled={loading}
                        >
                          + Create new phase
                        </Button>
                      </>
                    ) : (
                      <>
                        <Input
                          value={newPhaseName}
                          onChange={(e) => setNewPhaseName(e.target.value)}
                          placeholder="Enter new phase name..."
                          disabled={loading}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              setCreatingNewPhase(false);
                            }
                          }}
                        />
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setCreatingNewPhase(false);
                            setNewPhaseName('');
                          }}
                          disabled={loading}
                        >
                          Cancel new phase
                        </Button>
                      </>
                    )}
                  </VStack>
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

