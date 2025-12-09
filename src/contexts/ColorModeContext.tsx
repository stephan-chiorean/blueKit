import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import mermaid from 'mermaid';

type ColorMode = 'light' | 'dark';

interface ColorModeContextType {
  colorMode: ColorMode;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ColorModeContext = createContext<ColorModeContextType | undefined>(undefined);

// Track Mermaid initialization to prevent multiple initializations
let mermaidInitialized = false;
let lastInitializedColorMode: ColorMode | null = null;

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

    // Initialize Mermaid globally when color mode changes
    // Only initialize once, or re-initialize if color mode changed
    if (!mermaidInitialized || lastInitializedColorMode !== colorMode) {
      // Define custom BlueKit theme variables
      // BlueKit primary blue: #4287f5
      const bluekitPrimary = '#4287f5';
      const bluekitPrimaryLight = '#60a5fa';
      const bluekitPrimaryDark = '#2563eb';
      
      if (colorMode === 'dark') {
        // Dark mode theme with BlueKit blue and darker backgrounds
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'dark',
          themeVariables: {
            // Primary colors - BlueKit blue
            primaryColor: '#1e293b',
            primaryTextColor: '#bfdbfe',
            primaryBorderColor: bluekitPrimary,
            lineColor: bluekitPrimary,
            arrowheadColor: bluekitPrimary,
            
            // Backgrounds - darker for better contrast
            background: '#0f172a',
            mainBkg: '#1e293b',
            secondBkg: '#334155',
            tertiaryBkg: '#475569',
            
            // Text colors - lighter for visibility
            textColor: '#bfdbfe',
            secondaryTextColor: '#93c5fd',
            tertiaryTextColor: '#60a5fa',
            lineTextColor: '#bfdbfe',
            labelColor: '#bfdbfe',
            
            // Borders - BlueKit blue
            border1: bluekitPrimary,
            border2: bluekitPrimaryLight,
            
            // Actor/Node colors - darker blue backgrounds
            actorBorder: bluekitPrimary,
            actorBkg: '#1e3a8a',
            actorTextColor: '#bfdbfe',
            actorLineColor: bluekitPrimary,
            
            // Signal/Flow colors
            signalColor: bluekitPrimary,
            signalTextColor: '#bfdbfe',
            
            // Label boxes
            labelBoxBkgColor: '#1e293b',
            labelBoxBorderColor: bluekitPrimary,
            labelTextColor: '#bfdbfe',
            labelBackground: '#1e293b',
            
            // Notes - darker blue background
            noteBorderColor: bluekitPrimary,
            noteBkgColor: '#1e3a8a',
            noteTextColor: '#bfdbfe',
            
            // Activation boxes - darker blue background
            activationBorderColor: bluekitPrimary,
            activationBkgColor: '#1e3a8a',
            sequenceNumberColor: '#bfdbfe',
            
            // Sections - darker blue background
            sectionBkgColor: '#1e3a8a',
            altBkgColor: '#334155',
            exclBkgColor: '#991b1b',
            
            // Tasks - darker blue background
            taskBorderColor: bluekitPrimary,
            taskBkgColor: '#1e3a8a',
            taskTextColor: '#bfdbfe',
            taskTextLightColor: '#bfdbfe',
            taskTextDarkColor: '#bfdbfe',
            taskTextOutsideColor: '#bfdbfe',
            taskTextClickableColor: bluekitPrimaryLight,
            activeTaskBorderColor: bluekitPrimaryLight,
            activeTaskBkgColor: '#172554',
            doneTaskBkgColor: '#065f46',
            doneTaskBorderColor: '#10b981',
            critBorderColor: '#dc2626',
            critBkgColor: '#991b1b',
            
            // Other
            gridColor: bluekitPrimary,
            todayLineColor: '#ef4444',
            errorBkgColor: '#7f1d1d',
            errorTextColor: '#fca5a5',
            loopTextColor: '#bfdbfe',
          },
        });
      } else {
        // Light mode theme with BlueKit blue
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'default',
          themeVariables: {
            // Primary colors - BlueKit blue
            primaryColor: '#ffffff',
            primaryTextColor: '#1f2937',
            primaryBorderColor: bluekitPrimary,
            lineColor: bluekitPrimary,
            arrowheadColor: bluekitPrimary,
            
            // Backgrounds
            background: '#ffffff',
            mainBkg: '#ffffff',
            secondBkg: '#f3f4f6',
            tertiaryBkg: '#e5e7eb',
            
            // Text colors
            textColor: '#1f2937',
            secondaryTextColor: '#4b5563',
            tertiaryTextColor: '#6b7280',
            lineTextColor: '#1f2937',
            labelColor: '#1f2937',
            
            // Borders - BlueKit blue
            border1: bluekitPrimary,
            border2: bluekitPrimaryDark,
            
            // Actor/Node colors
            actorBorder: bluekitPrimary,
            actorBkg: '#eff6ff',
            actorTextColor: '#1f2937',
            actorLineColor: bluekitPrimary,
            
            // Signal/Flow colors
            signalColor: bluekitPrimary,
            signalTextColor: '#1f2937',
            
            // Label boxes
            labelBoxBkgColor: '#ffffff',
            labelBoxBorderColor: bluekitPrimary,
            labelTextColor: '#1f2937',
            labelBackground: '#ffffff',
            
            // Notes
            noteBorderColor: bluekitPrimary,
            noteBkgColor: '#eff6ff',
            noteTextColor: '#1f2937',
            
            // Activation boxes
            activationBorderColor: bluekitPrimary,
            activationBkgColor: '#dbeafe',
            sequenceNumberColor: '#ffffff',
            
            // Sections
            sectionBkgColor: '#eff6ff',
            altBkgColor: '#f3f4f6',
            exclBkgColor: '#fee2e2',
            
            // Tasks
            taskBorderColor: bluekitPrimary,
            taskBkgColor: '#eff6ff',
            taskTextColor: '#1f2937',
            taskTextLightColor: '#ffffff',
            taskTextDarkColor: '#1f2937',
            taskTextOutsideColor: '#1f2937',
            taskTextClickableColor: bluekitPrimaryDark,
            activeTaskBorderColor: bluekitPrimaryDark,
            activeTaskBkgColor: '#dbeafe',
            doneTaskBkgColor: '#d1fae5',
            doneTaskBorderColor: '#10b981',
            critBorderColor: '#ef4444',
            critBkgColor: '#fee2e2',
            
            // Other
            gridColor: bluekitPrimary,
            todayLineColor: '#ef4444',
            errorBkgColor: '#fee2e2',
            errorTextColor: '#dc2626',
            loopTextColor: '#1f2937',
          },
        });
      }
      
      // Mark as initialized
      mermaidInitialized = true;
      lastInitializedColorMode = colorMode;
    }
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

