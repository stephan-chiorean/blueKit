import { createContext, useContext, useState, ReactNode } from 'react';

interface QuickTaskPopoverContextType {
  openPopover: (options?: {
    defaultView?: 'list' | 'create' | 'edit';
    defaultProjectId?: string;
    onTaskCreated?: () => void;
  }) => void;
  closePopover: () => void;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  popoverOptions: {
    defaultView?: 'list' | 'create' | 'edit';
    defaultProjectId?: string;
    onTaskCreated?: () => void;
  };
}

const QuickTaskPopoverContext = createContext<QuickTaskPopoverContextType | undefined>(undefined);

export function QuickTaskPopoverProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverOptions, setPopoverOptions] = useState<{
    defaultView?: 'list' | 'create' | 'edit';
    defaultProjectId?: string;
    onTaskCreated?: () => void;
  }>({});

  const openPopover = (options?: {
    defaultView?: 'list' | 'create' | 'edit';
    defaultProjectId?: string;
    onTaskCreated?: () => void;
  }) => {
    setPopoverOptions(options || {});
    setIsOpen(true);
  };

  const closePopover = () => {
    setIsOpen(false);
    setPopoverOptions({});
  };

  return (
    <QuickTaskPopoverContext.Provider
      value={{
        openPopover,
        closePopover,
        isOpen,
        setOpen: setIsOpen,
        popoverOptions,
      }}
    >
      {children}
    </QuickTaskPopoverContext.Provider>
  );
}

export function useQuickTaskPopover() {
  const context = useContext(QuickTaskPopoverContext);
  if (context === undefined) {
    throw new Error('useQuickTaskPopover must be used within a QuickTaskPopoverProvider');
  }
  return context;
}

