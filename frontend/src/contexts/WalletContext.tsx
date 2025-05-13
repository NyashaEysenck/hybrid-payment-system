// frontend/src/contexts/wallet/WalletContext.tsx
import { createContext, useContext } from "react";
import { useWalletState } from "./useWalletState";
import { WalletContextType, WalletProviderProps } from "./types";

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const walletState = useWalletState();
  
  return (
    <WalletContext.Provider value={walletState}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};