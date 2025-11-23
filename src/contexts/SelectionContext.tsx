import { createContext, useContext, useState, ReactNode } from 'react';

export type SelectionType = 'Kit' | 'Blueprint' | 'Collection' | 'Project';

export interface SelectedItem {
  id: string;
  name: string;
  type: SelectionType;
  path?: string;
}

interface SelectionContextType {
  selectedItems: SelectedItem[];
  addItem: (item: SelectedItem) => void;
  removeItem: (id: string) => void;
  toggleItem: (item: SelectedItem) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  
  console.log('[SelectionProvider] Render - selectedItems:', selectedItems);

  const addItem = (item: SelectedItem) => {
    setSelectedItems((prev) => {
      // Check if item already exists
      if (prev.some((i) => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  };

  const removeItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleItem = (item: SelectedItem) => {
    console.log('[SelectionContext] toggleItem called:', item);
    setSelectedItems((prev) => {
      console.log('[SelectionContext] Previous items:', prev);
      const exists = prev.some((i) => i.id === item.id);
      console.log('[SelectionContext] Item exists?', exists);
      const newItems = exists
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item];
      console.log('[SelectionContext] New items:', newItems);
      return newItems;
    });
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const isSelected = (id: string) => {
    return selectedItems.some((item) => item.id === id);
  };

  const hasSelection = selectedItems.length > 0;

  return (
    <SelectionContext.Provider
      value={{
        selectedItems,
        addItem,
        removeItem,
        toggleItem,
        clearSelection,
        isSelected,
        hasSelection,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

