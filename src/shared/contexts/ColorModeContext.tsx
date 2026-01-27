import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ColorMode = 'light' | 'dark';

interface ColorModeContextType {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    // Check localStorage first, then system preference
    const stored = localStorage.getItem('chakra-ui-color-mode') as ColorMode | null;
    if (stored) return stored;

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    // Apply color mode to document
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
    document.documentElement.setAttribute('data-theme', colorMode);
    localStorage.setItem('chakra-ui-color-mode', colorMode);
  }, [colorMode]);

  const toggleColorMode = () => {
    setColorModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
  };

  return (
    <ColorModeContext.Provider value={{ colorMode, toggleColorMode, setColorMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (context === undefined) {
    throw new Error('useColorMode must be used within a ColorModeProvider');
  }
  return context;
}

