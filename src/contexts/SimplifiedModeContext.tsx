import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeStorage } from '../lib/safeStorage';

interface SimplifiedModeContextType {
  isSimplifiedMode: boolean;
  setIsSimplifiedMode: (value: boolean) => void;
  toggleSimplifiedMode: () => void;
}

const SimplifiedModeContext = createContext<SimplifiedModeContextType | undefined>(undefined);

export const useSimplifiedMode = () => {
  const context = useContext(SimplifiedModeContext);
  if (!context) {
    throw new Error('useSimplifiedMode must be used within a SimplifiedModeProvider');
  }
  return context;
};

export const SimplifiedModeProvider = ({ children }: { children: ReactNode }) => {
  const [isSimplifiedMode, setIsSimplifiedModeState] = useState<boolean>(() => {
    try {
      const stored = safeStorage.getItem('sabay-simplified-mode');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const setIsSimplifiedMode = (value: boolean) => {
    setIsSimplifiedModeState(value);
    safeStorage.setItem('sabay-simplified-mode', value ? 'true' : 'false');
  };

  const toggleSimplifiedMode = () => {
    setIsSimplifiedMode(!isSimplifiedMode);
  };

  return (
    <SimplifiedModeContext.Provider value={{ isSimplifiedMode, setIsSimplifiedMode, toggleSimplifiedMode }}>
      {children}
    </SimplifiedModeContext.Provider>
  );
};
