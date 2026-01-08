import { useState, useEffect } from "react";
import {
  Dialog,
  Button,
  Input,
  HStack,
  VStack,
  Text,
  Box,
  Card,
  Icon,
  Fieldset,
} from "@chakra-ui/react";
import { toaster } from "../ui/toaster";
import { LuArrowLeft, LuCode, LuTerminal } from "react-icons/lu";
import { invokeCheckoutCommitInProject } from "../../ipc/commits";
import { invokeOpenProjectInEditor } from "../../ipc/projects";
import type { Checkpoint } from "../../ipc/types";

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoint: Checkpoint;
  projectId: string;
}

type CheckoutMethod = "detached" | "branch";

type EditorType = "cursor" | "vscode" | "antigravity";

interface EditorConfig {
  name: string;
  value: EditorType;
  icon: any;
  description: string;
}

export default function RollbackModal({
  isOpen,
  onClose,
  checkpoint,
  projectId,
}: RollbackModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [checkoutMethod, setCheckoutMethod] = useState<CheckoutMethod | null>(null);
  const [branchName, setBranchName] = useState("");
  const [selectedEditor, setSelectedEditor] = useState<EditorType | null>(null);
  const [loading, setLoading] = useState(false);

  // Editor configurations
  const editorConfigs: EditorConfig[] = [
    {
      name: "Cursor",
      value: "cursor",
      icon: LuCode,
      description: "Open in Cursor editor",
    },
    {
      name: "VSCode",
      value: "vscode",
      icon: LuCode,
      description: "Open in Visual Studio Code",
    },
    {
      name: "Antigravity",
      value: "antigravity",
      icon: LuTerminal,
      description: "Open in Antigravity editor",
    },
  ];

  // Handle back navigation
  const handleBack = () => {
    setStep(1);
  };

  // Handle checkout method selection
  const handleSelectCheckoutMethod = (method: CheckoutMethod) => {
    setCheckoutMethod(method);
    if (method === "detached") {
      // Go directly to step 2 for detached HEAD
      setStep(2);
    } else {
      // Stay on step 1 to enter branch name
    }
  };

  // Handle proceed to editor selection
  const handleProceedToEditor = () => {
    if (checkoutMethod === "branch" && !branchName.trim()) {
      toaster.create({
        type: "error",
        title: "Branch name required",
        description: "Please enter a branch name",
        duration: 3000,
      });
      return;
    }

    // Validate branch name format
    if (checkoutMethod === "branch") {
      const trimmedBranch = branchName.trim();
      // Git branch name validation: no spaces, no special chars except - and _
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmedBranch)) {
        toaster.create({
          type: "error",
          title: "Invalid branch name",
          description: "Branch name can only contain letters, numbers, dashes, and underscores",
          duration: 3000,
        });
        return;
      }
    }

    setStep(2);
  };

  // Handle rollback (checkout and open editor)
  const handleRollback = async () => {
    if (!selectedEditor) {
      toaster.create({
        type: "error",
        title: "Editor required",
        description: "Please select an editor",
        duration: 3000,
      });
      return;
    }

    try {
      setLoading(true);

      // Step 1: Checkout commit
      const projectPath = await invokeCheckoutCommitInProject(
        projectId,
        checkpoint.gitCommitSha,
        checkoutMethod === "branch" ? branchName.trim() : undefined
      );

      // Step 2: Open in editor
      await invokeOpenProjectInEditor(projectPath, selectedEditor);

      // Success toast
      toaster.create({
        type: "success",
        title: "Rollback successful",
        description: `Checked out commit ${checkpoint.gitCommitSha.substring(0, 7)} and opened in ${editorConfigs.find(e => e.value === selectedEditor)?.name}`,
        duration: 5000,
      });

      handleClose();
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Rollback failed",
        description: err instanceof Error ? err.message : "Unknown error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle close (reset state)
  const handleClose = () => {
    setStep(1);
    setCheckoutMethod(null);
    setBranchName("");
    setSelectedEditor(null);
    onClose();
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCheckoutMethod(null);
      setBranchName("");
      setSelectedEditor(null);
    }
  }, [isOpen]);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) {
          handleClose();
        }
      }}
      size={step === 1 ? "xl" : "lg"}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW={step === 1 ? "700px" : "600px"}>
          <Dialog.Header>
            <HStack gap={2}>
              {step === 2 && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleBack}
                  disabled={loading}
                >
                  <LuArrowLeft />
                </Button>
              )}
              <Dialog.Title>
                {step === 1 ? "Rollback to Checkpoint" : "Select Editor"}
              </Dialog.Title>
            </HStack>
          </Dialog.Header>

          <Dialog.Body>
            {step === 1 ? (
              <VStack align="stretch" gap={4}>
                <VStack align="start" gap={2}>
                  <Text fontSize="sm" fontWeight="medium">
                    Checkpoint: {checkpoint.name}
                  </Text>
                  <Text fontSize="xs" fontFamily="mono" color="fg.muted">
                    {checkpoint.gitCommitSha.substring(0, 7)}
                  </Text>
                </VStack>

                <Text fontSize="sm" color="fg.muted">
                  Choose how you want to checkout this commit
                </Text>

                <Box
                  display="grid"
                  gridTemplateColumns="repeat(2, 1fr)"
                  gap={4}
                >
                  {/* Detached HEAD option */}
                  <Card.Root
                    borderWidth="1px"
                    cursor="pointer"
                    onClick={() => handleSelectCheckoutMethod("detached")}
                    borderColor={
                      checkoutMethod === "detached" ? "#F28333" : "border.subtle"
                    }
                    bg={
                      checkoutMethod === "detached"
                        ? "rgba(242, 131, 51, 0.05)"
                        : "transparent"
                    }
                    _hover={{
                      borderColor: "#F28333",
                      bg: "rgba(242, 131, 51, 0.05)",
                    }}
                    transition="all 0.2s"
                  >
                    <Card.Body p={4}>
                      <VStack align="start" gap={3}>
                        <Text fontWeight="semibold" fontSize="md">
                          Detached HEAD
                        </Text>
                        <Text fontSize="sm" color="fg.muted" lineHeight="short">
                          Checkout the commit without creating a branch. You'll be in a detached HEAD state.
                        </Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>

                  {/* New Branch option */}
                  <Card.Root
                    borderWidth="1px"
                    cursor="pointer"
                    onClick={() => handleSelectCheckoutMethod("branch")}
                    borderColor={
                      checkoutMethod === "branch" ? "#F28333" : "border.subtle"
                    }
                    bg={
                      checkoutMethod === "branch"
                        ? "rgba(242, 131, 51, 0.05)"
                        : "transparent"
                    }
                    _hover={{
                      borderColor: "#F28333",
                      bg: "rgba(242, 131, 51, 0.05)",
                    }}
                    transition="all 0.2s"
                  >
                    <Card.Body p={4}>
                      <VStack align="start" gap={3}>
                        <Text fontWeight="semibold" fontSize="md">
                          New Branch
                        </Text>
                        <Text fontSize="sm" color="fg.muted" lineHeight="short">
                          Create a new branch from this commit. Useful for making changes.
                        </Text>
                      </VStack>
                    </Card.Body>
                  </Card.Root>
                </Box>

                {/* Branch name input (only shown for branch option) */}
                {checkoutMethod === "branch" && (
                  <Fieldset.Root>
                    <Fieldset.Legend fontWeight="medium">Branch Name *</Fieldset.Legend>
                    <Input
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      placeholder="rollback-feature-branch"
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && branchName.trim()) {
                          handleProceedToEditor();
                        }
                      }}
                    />
                    <Text fontSize="xs" color="fg.muted" mt={1}>
                      Enter a valid git branch name (letters, numbers, dashes, underscores only)
                    </Text>
                  </Fieldset.Root>
                )}
              </VStack>
            ) : (
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Select the editor to open the project in
                </Text>

                <Box
                  display="grid"
                  gridTemplateColumns="repeat(3, 1fr)"
                  gap={4}
                >
                  {editorConfigs.map((editor) => (
                    <Card.Root
                      key={editor.value}
                      borderWidth="1px"
                      cursor="pointer"
                      onClick={() => setSelectedEditor(editor.value)}
                      borderColor={
                        selectedEditor === editor.value
                          ? "#F28333"
                          : "border.subtle"
                      }
                      bg={
                        selectedEditor === editor.value
                          ? "rgba(242, 131, 51, 0.05)"
                          : "transparent"
                      }
                      _hover={{
                        borderColor: "#F28333",
                        bg: "rgba(242, 131, 51, 0.05)",
                      }}
                      transition="all 0.2s"
                    >
                      <Card.Body p={4}>
                        <VStack align="start" gap={2}>
                          <Icon boxSize={5} color="#F28333">
                            <editor.icon />
                          </Icon>
                          <Text fontWeight="semibold" fontSize="sm">
                            {editor.name}
                          </Text>
                        </VStack>
                      </Card.Body>
                    </Card.Root>
                  ))}
                </Box>
              </VStack>
            )}
          </Dialog.Body>

          <Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <Button variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Dialog.CloseTrigger>
            {step === 1 ? (
              checkoutMethod === "detached" ? (
                <Button
                  onClick={handleProceedToEditor}
                  disabled={loading}
                  css={{
                    bg: "#F28333",
                    color: "white",
                    "&:hover": {
                      bg: "#d97329",
                    },
                  }}
                >
                  Continue
                </Button>
              ) : checkoutMethod === "branch" ? (
                <Button
                  onClick={handleProceedToEditor}
                  disabled={!branchName.trim() || loading}
                  css={{
                    bg: "#F28333",
                    color: "white",
                    "&:hover": {
                      bg: "#d97329",
                    },
                  }}
                >
                  Continue
                </Button>
              ) : null
            ) : (
              <Button
                onClick={handleRollback}
                loading={loading}
                disabled={!selectedEditor}
                css={{
                  bg: "#F28333",
                  color: "white",
                  "&:hover": {
                    bg: "#d97329",
                  },
                }}
              >
                Open
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

