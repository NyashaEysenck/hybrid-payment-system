// In OfflineBalanceContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { storageService } from '@/services/storageService';
import { useToast } from '@/components/ui/use-toast';
import api from '@/utils/api';

interface OfflineBalanceContextType {
  offlineBalance: number;
  pendingTransactions: number;
  addToOfflineBalance: (amount: number) => Promise<number>;
  refreshOfflineBalance: () => Promise<number>;
  updateOfflineBalance: (amount: number) => Promise<number>;
  syncOfflineCredits: () => Promise<number>;
  setOfflineBalance: (balance: number) => void;
}

const OfflineBalanceContext = createContext<OfflineBalanceContextType>({
  offlineBalance: 0,
  pendingTransactions: 0,
  addToOfflineBalance: async (amount: number) => amount,
  refreshOfflineBalance: async () => 0,
  updateOfflineBalance: async (amount: number) => amount,
  syncOfflineCredits: async () => 0,
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
    if (!user?.email) return 0;
    const newBalance = offlineBalance + amount;
    await saveOfflineBalance(newBalance);
    return newBalance;
  }, [offlineBalance, saveOfflineBalance]);

  // Refresh offline balance from the server
  const refreshOfflineBalance = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      // First get the local balance
      const localBalance = await storageService.getOfflineBalance(user.email);
      setOfflineBalance(localBalance);
      
      // Try to update the backend with our local balance
      try {
        const response = await api.post('/wallet/balance', { 
          email: user.email,
          offline_balance: localBalance
        });
        
        if (response.data.success) {
          toast({
            title: "Success",
            description: "Offline balance synced with server successfully",
          });
        }
      } catch (error) {
        console.error('Error syncing offline balance with server:', error);
        toast({
          title: "Warning",
          description: "Could not sync offline balance with server. Using local balance instead.",
          variant: "destructive",
        });
      }
      
      return localBalance;
    } catch (error) {
      console.error('Error loading local offline balance:', error);
      toast({
        title: "Error",
        description: "Failed to load offline balance. Please try again later.",
        variant: "destructive",
      });
      throw error;
    }
  }, [user?.email, toast]);

  // For backward compatibility
  const updateOfflineBalance = async (amount: number) => {
    await addToOfflineBalance(amount);
    return amount;
  };


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