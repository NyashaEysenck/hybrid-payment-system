// In OfflineBalanceContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storageService } from '@/services/storageService';
import { useToast } from '@/components/ui/use-toast';
import api from '@/utils/api';

interface OfflineBalanceContextType {
  offlineBalance: number;
  pendingTransactions: number;
  addToOfflineBalance: (amount: number) => Promise<void>;
  refreshOfflineBalance: () => Promise<void>;
  updateOfflineBalance: (amount: number) => Promise<void>;
  syncOfflineCredits: () => Promise<void>;
  setOfflineBalance: (balance: number) => void;
}

const OfflineBalanceContext = createContext<OfflineBalanceContextType>({
  offlineBalance: 0,
  pendingTransactions: 0,
  addToOfflineBalance: async () => {},
  refreshOfflineBalance: async () => {},
  updateOfflineBalance: async () => {},
  syncOfflineCredits: async () => {},
  setOfflineBalance: () => {},
});

export const useOfflineBalance = () => {
  const context = useContext(OfflineBalanceContext);
  if (!context) {
    throw new Error('useOfflineBalance must be used within OfflineBalanceProvider');
  }
  return context;
};

export const OfflineBalanceProvider: React.FC = ({ children }: { children: React.ReactNode }) => {
  const [offlineBalance, setOfflineBalance] = useState(0);
  const [pendingTransactions, setPendingTransactions] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadOfflineBalance = useCallback(async () => {
    if (!user?.email) return;
    const balance = await storageService.getOfflineBalance(user.email);
    setOfflineBalance(balance);
  }, [user?.email]);

  useEffect(() => {
    loadOfflineBalance();
  }, [loadOfflineBalance]);

  const saveOfflineBalance = useCallback(async (balance: number) => {
    if (!user?.email) return;
    try {
      await storageService.saveOfflineBalance(balance, user.email);
      setOfflineBalance(balance);
      toast({
        title: "Success",
        description: "Offline balance updated successfully",
      });
    } catch (error) {
      console.error('Error saving offline balance:', error);
      toast({
        title: "Error",
        description: "Failed to update offline balance",
        variant: "destructive",
      });
      throw error;
    }
  }, [user?.email, toast]);

  const addToOfflineBalance = useCallback(async (amount: number) => {
    if (!user?.email) return;
    const newBalance = offlineBalance + amount;
    await saveOfflineBalance(newBalance);
  }, [offlineBalance, saveOfflineBalance]);

  // Refresh offline balance from the server
  const refreshOfflineBalance = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      const response = await api.post('/wallet/balance', { email: user.email });
      const backendOfflineBalance = response.data.reserved_Balance || 0;
      await saveOfflineBalance(backendOfflineBalance);
      return backendOfflineBalance;
    } catch (error) {
      console.error('Error refreshing offline balance:', error);
      // Continue with locally stored balance if server is unavailable
      return loadOfflineBalance();
    }
  }, [user?.email, saveOfflineBalance, loadOfflineBalance]);

  // For backward compatibility
  const updateOfflineBalance = addToOfflineBalance;

  // Placeholder for sync functionality
  const syncOfflineCredits = useCallback(async () => {
    // This would sync with the server if needed
    return refreshOfflineBalance();
  }, [refreshOfflineBalance]);

  // Load initial balance
  useEffect(() => {
    if (user?.email) {
      loadOfflineBalance();
    }
  }, [user?.email, loadOfflineBalance]);

  return (
    <OfflineBalanceContext.Provider
      value={{
        offlineBalance,
        pendingTransactions,
        addToOfflineBalance,
        refreshOfflineBalance,
        updateOfflineBalance,
        syncOfflineCredits,
        setOfflineBalance: (balance: number) => saveOfflineBalance(balance),
      }}
    >
      {children}
    </OfflineBalanceContext.Provider>
  );
};