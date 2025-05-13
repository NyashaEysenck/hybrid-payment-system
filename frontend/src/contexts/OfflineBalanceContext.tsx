import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useIndexedDB, Transaction } from '@/hooks/useIndexedDB';
import { useAuth } from './AuthContext';

interface OfflineBalanceContextType {
  offlineBalance: number;
  pendingTransactions: number;
  updateOfflineBalance: (amount: number) => void;
  refreshOfflineBalance: () => Promise<void>;
}

const OfflineBalanceContext = createContext<OfflineBalanceContextType | undefined>(undefined);

export const useOfflineBalance = () => {
  const context = useContext(OfflineBalanceContext);
  if (!context) {
    throw new Error('useOfflineBalance must be used within an OfflineBalanceProvider');
  }
  return context;
};

interface OfflineBalanceProviderProps {
  children: ReactNode;
}

export const OfflineBalanceProvider: React.FC<OfflineBalanceProviderProps> = ({ children }) => {
  const [offlineBalance, setOfflineBalance] = useState<number>(0);
  const [pendingTransactions, setPendingTransactions] = useState<number>(0);
  const { user } = useAuth();
  
  // Initialize IndexedDB
  const { getAllItems } = useIndexedDB({
    dbName: 'greenleaf-finance',
    storeName: 'transactions'
  });

  // Calculate offline balance based on transactions in IndexedDB and offline_credits
  const calculateOfflineBalance = async () => {
    if (!user?.email) return;
    
    try {
      // Get all transactions from IndexedDB
      const transactions = await getAllItems<Transaction>();
      
      // Filter transactions for the current user
      const userTransactions = transactions.filter(tx => 
        (tx.sender === user.email || tx.recipient === user.email) && 
        tx.type === 'offline'
      );
      
      // Count pending transactions
      const pending = userTransactions.filter(tx => tx.status === 'pending').length;
      setPendingTransactions(pending);
      
      // Calculate balance impact
      let balanceAdjustment = 0;
      
      userTransactions.forEach(tx => {
        if (tx.sender === user.email) {
          // Money sent (deduct from balance)
          balanceAdjustment -= parseFloat(tx.amount.toString());
        } else if (tx.recipient === user.email) {
          // Money received (add to balance)
          balanceAdjustment += parseFloat(tx.amount.toString());
        }
      });
      
      // Get offline_credits from user object (this is the reserved amount for offline use)
      const offlineCredits = user.offline_credits || 0;
      
      // Update offline balance (starting with offline_credits + transaction adjustments)
      setOfflineBalance(offlineCredits + balanceAdjustment);
    } catch (error) {
      console.error('Error calculating offline balance:', error);
    }
  };

  // Update offline balance when user changes
  useEffect(() => {
    if (user) {
      calculateOfflineBalance();
    }
  }, [user]);

  // Function to manually update offline balance (for new transactions)
  const updateOfflineBalance = (amount: number) => {
    setOfflineBalance(prevBalance => prevBalance + amount);
  };

  // Function to refresh offline balance from IndexedDB
  const refreshOfflineBalance = async () => {
    await calculateOfflineBalance();
  };

  return (
    <OfflineBalanceContext.Provider
      value={{
        offlineBalance,
        pendingTransactions,
        updateOfflineBalance,
        refreshOfflineBalance
      }}
    >
      {children}
    </OfflineBalanceContext.Provider>
  );
};
