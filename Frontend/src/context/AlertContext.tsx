import React, { createContext, useState, useContext, ReactNode } from "react";

interface AlertState {
  type: string;
  message: string;
}

interface AlertContextType {
  alert: AlertState;
  showAlert: (type: string, message: string, timeout?: number) => void;
  clearAlert: () => void;
}

interface AlertProviderProps {
  children: ReactNode;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({ type: "", message: "" });

  const showAlert = (type: string, message: string, timeout: number = 5000): void => {
    setAlert({ type, message });

    if (timeout) {
      setTimeout(() => {
        clearAlert();
      }, timeout);
    }
  };

  const clearAlert = (): void => {
    setAlert({ type: "", message: "" });
  };

  const contextValue: AlertContextType = {
    alert,
    showAlert,
    clearAlert,
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
    </AlertContext.Provider>
  );
};
