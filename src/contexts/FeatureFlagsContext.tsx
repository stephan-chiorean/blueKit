import { createContext, useContext, useState, ReactNode } from 'react';

interface FeatureFlags {
  // Add new feature flags here as needed
  // Example: newFeature: boolean;
}

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  toggleFlag: (key: keyof FeatureFlags) => void;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

interface FeatureFlagsProviderProps {
  children: ReactNode;
  initialFlags?: Partial<FeatureFlags>;
}

export function FeatureFlagsProvider({ 
  children, 
  initialFlags = {} 
}: FeatureFlagsProviderProps) {
  // Default feature flags - set to true to enable features
  const defaultFlags: FeatureFlags = {
    ...initialFlags,
  };

  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);

  const setFlag = (key: keyof FeatureFlags, value: boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFlag = (key: keyof FeatureFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <FeatureFlagsContext.Provider value={{ flags, setFlag, toggleFlag }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

