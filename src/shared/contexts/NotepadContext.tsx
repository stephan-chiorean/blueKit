import { createContext, useContext, useState, ReactNode } from 'react';

interface NotepadContextType {
  isOpen: boolean;
  notes: string;
  openNotepad: () => void;
  closeNotepad: () => void;
  toggleNotepad: () => void;
  setNotes: (notes: string) => void;
  clearNotes: () => void;
}

const NotepadContext = createContext<NotepadContextType | undefined>(undefined);

export function NotepadProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const openNotepad = () => setIsOpen(true);
  const closeNotepad = () => setIsOpen(false);
  const toggleNotepad = () => setIsOpen(prev => !prev);
  const clearNotes = () => setNotes('');

  return (
    <NotepadContext.Provider
      value={{
        isOpen,
        notes,
        openNotepad,
        closeNotepad,
        toggleNotepad,
        setNotes,
        clearNotes,
      }}
    >
      {children}
    </NotepadContext.Provider>
  );
}

export function useNotepad() {
  const context = useContext(NotepadContext);
  if (context === undefined) {
    throw new Error('useNotepad must be used within a NotepadProvider');
  }
  return context;
}
