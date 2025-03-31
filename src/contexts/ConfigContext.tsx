// src/contexts/ConfigContext.tsx
import React, { createContext, useContext, ReactNode } from "react";

interface ConfigContextType {
  googleMapsApiKey: string;
  // Add other config settings as needed
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{
  children: ReactNode;
  googleMapsApiKey: string;
}> = ({ children, googleMapsApiKey }) => {
  return (
    <ConfigContext.Provider
      value={{
        googleMapsApiKey,
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
};
