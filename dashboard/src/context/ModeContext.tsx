import React, { createContext, useContext, useEffect, useState } from 'react';

type Mode = 'developer' | 'friendly';

interface ModeContextType {
  mode: Mode;
  toggleMode: () => void;
  setMode: (value: Mode) => void;
}

const ModeContext = createContext<ModeContextType>({
  mode: 'developer',
  toggleMode: () => {},
  setMode: () => {},
});

const readInitialMode = (): Mode => {
  if (typeof window === 'undefined') return 'developer';
  const stored = window.localStorage.getItem('deemindMode') as Mode | null;
  return stored === 'friendly' ? 'friendly' : 'developer';
};

export const ModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>(readInitialMode);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('deemindMode', mode);
      document.body.dataset.mode = mode;
    }
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'developer' ? 'friendly' : 'developer'));
  };

  return <ModeContext.Provider value={{ mode, toggleMode, setMode }}>{children}</ModeContext.Provider>;
};

export const useMode = () => useContext(ModeContext);

