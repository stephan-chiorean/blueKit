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
  Textarea,
  Fieldset,
  RadioGroup,
  Checkbox,
} from "@chakra-ui/react";
import { toaster } from "@/shared/components/ui/toaster";
import { LuHammer, LuFlaskConical, LuEye, LuFileText, LuArrowLeft } from "react-icons/lu";
import { open } from "@tauri-apps/api/dialog";
import { invokeCreateProjectFromCheckpoint } from "@/ipc/checkpoints";
import type { Checkpoint } from "@/ipc/types";

interface BranchOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkpoint: Checkpoint;
  projectId: string;
  onSuccess: () => void;
}

type WorkflowType = "build" | "experiment" | "review" | "template";

interface WorkflowConfig {
  namePrefix: string;
  nameSuffix: string;
  description: string;
  register: boolean;
  projectType: "development" | "production" | "experiment" | "template";
  title: string;
  icon: any;
  fullDescription: string;
}

export default function BranchOffModal({
  isOpen,
  onClose,
  checkpoint,
  projectId,
  onSuccess,
}: BranchOffModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(null);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [parentDirectory, setParentDirectory] = useState("");
  const [registerInBlueKit, setRegisterInBlueKit] = useState(true);
  const [projectType, setProjectType] = useState<"development" | "production" | "experiment" | "template">("development");
  const [loading, setLoading] = useState(false);

  // Workflow configurations
  const workflowConfigs: Record<WorkflowType, WorkflowConfig> = {
    build: {
      namePrefix: "",
      nameSuffix: "-dev",
      description: `Development workspace from checkpoint: ${checkpoint.name}`,
      register: true,
      projectType: "development",
      title: "Build a New Project",
      icon: LuHammer,
      fullDescription: "Start a new development project from this checkpoint. Creates a fully-featured workspace registered in BlueKit for active development work.",
    },
    experiment: {
      namePrefix: "experiment-",
      nameSuffix: `-${Date.now()}`,
      description: `Quick experiment from ${checkpoint.name}`,
      register: false,
      projectType: "experiment",
      title: "Temporary Experiment",
      icon: LuFlaskConical,
      fullDescription: "Spin up a quick experimental workspace. Perfect for testing ideas without long-term commitment. Not registered by default.",
    },
    review: {
      namePrefix: "review-",
      nameSuffix: "",
      description: `Code review snapshot of ${checkpoint.name}`,
      register: false,
      projectType: "development",
      title: "Read-only Review",
      icon: LuEye,
      fullDescription: "Create a reference copy for code review or documentation. Preserves this exact state for future reference and exploration.",
    },
    template: {
      namePrefix: "template-",
      nameSuffix: "",
      description: `Reusable template based on ${checkpoint.name}`,
      register: true,
      projectType: "template",
      title: "Template Starting Point",
      icon: LuFileText,
      fullDescription: "Create a reusable template from this checkpoint. Use as a foundation for future projects with similar architecture or patterns.",
    },
  };

  // Apply workflow defaults
  const applyWorkflowDefaults = (workflow: WorkflowType) => {
    const config = workflowConfigs[workflow];
    const baseName = checkpoint.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    setProjectName(`${config.namePrefix}${baseName}${config.nameSuffix}`);
    setDescription(config.description);
    setRegisterInBlueKit(config.register);
    setProjectType(config.projectType);
    setSelectedWorkflow(workflow);
    setStep(2);
  };

  // Handle back navigation
  const handleBack = () => {
    setStep(1);
  };

  // Handle directory picker
  const handleChooseDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Parent Directory for New Project",
      });

      if (selectedPath && typeof selectedPath === "string") {
        setParentDirectory(selectedPath);
      }
    } catch (err) {
      console.error("Error selecting directory:", err);
    }
  };

  // Handle branch off (create project)
  const handleBranchOff = async () => {
    // Validate
    const trimmedName = projectName.trim();
    if (!trimmedName || !parentDirectory) {
      toaster.create({
        type: "error",
        title: "Validation Error",
        description: "Please provide a project name and select a directory",
        duration: 3000,
      });
      return;
    }

    // Validate project name (alphanumeric, dash, underscore only)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      toaster.create({
        type: "error",
        title: "Invalid Project Name",
        description: "Project name can only contain letters, numbers, dashes, and underscores",
        duration: 3000,
      });
      return;
    }

    // Build target path
    const targetPath = `${parentDirectory}/${trimmedName}`;

    try {
      setLoading(true);

      // Call IPC with project type (even though backend doesn't use it yet)
      const result = await invokeCreateProjectFromCheckpoint(
        checkpoint.id,
        targetPath,
        trimmedName,
        registerInBlueKit,
        description.trim() || undefined,
        projectType
      );

      // Success toast
      toaster.create({
        type: "success",
        title: "Project created successfully",
        description: result,
        duration: 5000,
      });

      onSuccess();
      handleClose();
    } catch (err) {
      toaster.create({
        type: "error",
        title: "Failed to create project",
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
    setSelectedWorkflow(null);
    setProjectName("");
    setDescription("");
    setParentDirectory("");
    setRegisterInBlueKit(true);
    setProjectType("development");
    onClose();
  };

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedWorkflow(null);
      setProjectName("");
      setDescription("");
      setParentDirectory("");
      setRegisterInBlueKit(true);
      setProjectType("development");
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
                {step === 1
                  ? "Branch Off from Checkpoint"
                  : selectedWorkflow
                  ? workflowConfigs[selectedWorkflow].title
                  : ""}
              </Dialog.Title>
            </HStack>
          </Dialog.Header>

          <Dialog.Body>
            {step === 1 ? (
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Choose how you want to use this checkpoint
                </Text>

                <Box
                  display="grid"
                  gridTemplateColumns="repeat(2, 1fr)"
                  gap={4}
                >
                  {(Object.keys(workflowConfigs) as WorkflowType[]).map((workflow) => {
                    const config = workflowConfigs[workflow];
                    return (
                      <Card.Root
                        key={workflow}
                        borderWidth="1px"
                        cursor="pointer"
                        onClick={() => applyWorkflowDefaults(workflow)}
                        _hover={{
                          borderColor: "#F28333",
                          bg: "rgba(242, 131, 51, 0.05)",
                        }}
                        transition="all 0.2s"
                      >
                        <Card.Body p={4}>
                          <VStack align="start" gap={3}>
                            <Icon boxSize={6} color="#F28333">
                              <config.icon />
                            </Icon>
                            <Text fontWeight="semibold" fontSize="md">
                              {config.title}
                            </Text>
                            <Text fontSize="sm" color="fg.muted" lineHeight="short">
                              {config.fullDescription}
                            </Text>
                          </VStack>
                        </Card.Body>
                      </Card.Root>
                    );
                  })}
                </Box>
              </VStack>
            ) : (
              <VStack align="stretch" gap={4}>
                <Text fontSize="sm" color="fg.muted">
                  Customize your new project details
                </Text>

                <Fieldset.Root>
                  <Fieldset.Legend fontWeight="medium">Project Name *</Fieldset.Legend>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-project"
                    disabled={loading}
                  />
                </Fieldset.Root>

                <Fieldset.Root>
                  <Fieldset.Legend fontWeight="medium">Description (Optional)</Fieldset.Legend>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this project..."
                    disabled={loading}
                    rows={3}
                  />
                </Fieldset.Root>

                <Fieldset.Root>
                  <Fieldset.Legend fontWeight="medium">Location *</Fieldset.Legend>
                  <HStack>
                    <Input
                      value={parentDirectory}
                      placeholder="Select directory..."
                      readOnly
                      flex={1}
                    />
                    <Button
                      onClick={handleChooseDirectory}
                      variant="outline"
                      disabled={loading}
                    >
                      Choose...
                    </Button>
                  </HStack>
                </Fieldset.Root>

                <Checkbox.Root
                  checked={registerInBlueKit}
                  onCheckedChange={(e) => setRegisterInBlueKit(e.checked === true)}
                  disabled={loading}
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label>Register in BlueKit</Checkbox.Label>
                </Checkbox.Root>

                {registerInBlueKit && (
                  <Fieldset.Root>
                    <Fieldset.Legend fontWeight="medium">Project Type</Fieldset.Legend>
                    <RadioGroup.Root
                      value={projectType}
                      onValueChange={(e) => setProjectType(e.value as any)}
                      disabled={loading}
                    >
                      <HStack gap={4} flexWrap="wrap">
                        <RadioGroup.Item value="development">
                          <RadioGroup.ItemControl />
                          <RadioGroup.ItemText>
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                Development
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                Active dev work
                              </Text>
                            </VStack>
                          </RadioGroup.ItemText>
                        </RadioGroup.Item>

                        <RadioGroup.Item value="production">
                          <RadioGroup.ItemControl />
                          <RadioGroup.ItemText>
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                Production
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                Stable release
                              </Text>
                            </VStack>
                          </RadioGroup.ItemText>
                        </RadioGroup.Item>

                        <RadioGroup.Item value="experiment">
                          <RadioGroup.ItemControl />
                          <RadioGroup.ItemText>
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                Experiment
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                Testing ideas
                              </Text>
                            </VStack>
                          </RadioGroup.ItemText>
                        </RadioGroup.Item>

                        <RadioGroup.Item value="template">
                          <RadioGroup.ItemControl />
                          <RadioGroup.ItemText>
                            <VStack align="start" gap={0}>
                              <Text fontSize="sm" fontWeight="medium">
                                Template
                              </Text>
                              <Text fontSize="xs" color="fg.muted">
                                Reusable foundation
                              </Text>
                            </VStack>
                          </RadioGroup.ItemText>
                        </RadioGroup.Item>
                      </HStack>
                    </RadioGroup.Root>
                  </Fieldset.Root>
                )}
              </VStack>
            )}
          </Dialog.Body>

          <Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <Button variant="outline" disabled={loading}>
                Cancel
              </Button>
            </Dialog.CloseTrigger>
            {step === 2 && (
              <Button
                onClick={handleBranchOff}
                loading={loading}
                disabled={!projectName.trim() || !parentDirectory}
                css={{
                  bg: "#F28333",
                  color: "white",
                  "&:hover": {
                    bg: "#d97329",
                  },
                }}
              >
                Create Project
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
