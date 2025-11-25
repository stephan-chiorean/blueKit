import { useState } from 'react';
import {
  Dialog,
  Button,
  Field,
  Input,
  Portal,
  CloseButton,
} from '@chakra-ui/react';

export interface Branch {
  id: string;
  name: string;
  blueprints: string[];
}

interface AddBranchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (branch: Branch) => void;
}

export default function AddBranchDialog({
  isOpen,
  onClose,
  onAdd,
}: AddBranchDialogProps) {
  const [branchName, setBranchName] = useState('');

  const handleAdd = () => {
    if (branchName.trim()) {
      const newBranch: Branch = {
        id: `branch-${Date.now()}`,
        name: branchName.trim(),
        blueprints: [],
      };
      onAdd(newBranch);
      setBranchName('');
      onClose();
    }
  };

  const handleClose = () => {
    setBranchName('');
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && handleClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Add Branch</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Field.Root>
                <Field.Label>Branch Name</Field.Label>
                <Input
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Enter branch name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && branchName.trim()) {
                      handleAdd();
                    }
                  }}
                />
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                onClick={handleAdd}
                disabled={!branchName.trim()}
                colorPalette="primary"
              >
                Add
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

