// In OfflineBalanceContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { storageService } from '@/services/storageService';
import { saveWalletDataToLocalStorage } from '@/contexts/WalletService';
import api from '@/utils/api';
import * as walletService from './WalletService';
import { syncOfflineTransactions } from '@/services/syncService'; 

interface OfflineBalanceContextType {
  offlineBalance: number;
  pendingTransactions: number;
  isOffline: boolean;
  toggleOfflineMode: () => Promise<void>;
  refreshOfflineBalance: () => Promise<number>;
  addToOfflineBalance: (amount: number) => Promise<number>;
}

const OfflineBalanceContext = createContext<OfflineBalanceContextType>({
  offlineBalance: 0,
  pendingTransactions: 0,
  isOffline: false,
  toggleOfflineMode: async () => {},
  refreshOfflineBalance: async () => 0,
  addToOfflineBalance: async () => 0,
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
  const [isOffline, setIsOffline] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const updateOnlineBalance = async (email: string, balance: number) => {
    try {
      const response = await api.post('/wallet/update-balance', {
        email,
        newBalance: balance
      });

      if (response.data.success) {
        toast({
          title: "Success",
          description: "Online balance updated successfully",
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update online balance",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while updating online balance",
        variant: "destructive",
      });
    }
  };

  const loadOfflineBalance = useCallback(async () => {
    if (!user?.email) return;
    const balance = await storageService.getOfflineBalance(user.email);
    setOfflineBalance(balance);
  }, [user?.email]);

  const toggleOfflineMode = useCallback(async () => {
    if (!user?.email) return;

    try {
      const newOfflineMode = !isOffline;
      setIsOffline(newOfflineMode);
      localStorage.setItem('offlineMode', newOfflineMode.toString());

      if (newOfflineMode) {
        // Going offline - copy online balance to offline
        const walletData = await walletService.fetchWalletData();
        const balance = walletData.balance || 0;
        await storageService.saveOfflineBalance(balance, user.email);
        setOfflineBalance(balance);
      } else {
        // Going online - sync offline balance to server
        const currentOfflineBalance = await storageService.getOfflineBalance(user.email);

        // Validate balance before saving
        if (typeof currentOfflineBalance !== 'number' || isNaN(currentOfflineBalance)) {
          throw new Error('Invalid offline balance');
        }

        // Save to localStorage (with error handling)
        try {
          saveWalletDataToLocalStorage(currentOfflineBalance, currentOfflineBalance);
        } catch (storageError) {
          console.error('Failed to save to localStorage:', storageError);
          // Optionally clear old data if quota is exceeded
          localStorage.removeItem('walletBalance');
          localStorage.removeItem('walletReservedBalance');
          saveWalletDataToLocalStorage(currentOfflineBalance, currentOfflineBalance);
        }

        // Update server balance
        await updateOnlineBalance(user.email, currentOfflineBalance);
      }

      toast({
        title: newOfflineMode ? 'Offline mode activated' : 'Online mode activated',
        description: newOfflineMode 
          ? 'Your online balance has been copied to offline' 
          : 'Your offline balance has been synced with online'
      });
    } catch (error) {
      console.error('Toggle error:', error);
      setIsOffline(isOffline); // Revert state on failure
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  }, [user?.email, isOffline, toast]);

  useEffect(() => {
    loadOfflineBalance();
    // Load offline mode state from localStorage
    const offlineMode = localStorage.getItem('offlineMode');
    if (offlineMode !== null) {
      setIsOffline(offlineMode === 'true');
    }
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
        isOffline,
        refreshOfflineBalance,
        toggleOfflineMode,
        addToOfflineBalance
      }}
    >
      {children}
    </OfflineBalanceContext.Provider>
  );
};