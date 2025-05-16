import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useIndexedDB, DB_NAME, TRANSACTIONS_STORE, BALANCE_STORE, Transaction as IDBTransaction } from '@/hooks/useIndexedDB';
import { useAuth } from './AuthContext';
import { useToast } from '@/components/ui/use-toast';
import api from '@/utils/api';

// Simple interface for the OfflineBalanceContext
interface OfflineBalanceContextType {
  offlineBalance: number;
  pendingTransactions: number;
  addToOfflineBalance: (amount: number) => Promise<void>;
  refreshOfflineBalance: () => Promise<void>;
  // Adding these for backward compatibility
  updateOfflineBalance: (amount: number) => Promise<void>;
  syncOfflineCredits: () => Promise<void>;
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

// Interface for offline transactions in IndexedDB - extending the standardized Transaction interface
interface OfflineTransaction extends Omit<IDBTransaction, 'type' | 'receiptId'> {
  type: 'offline';
}

// Interface for balance records in IndexedDB
interface BalanceRecord {
  id: string;
  userId: string;
  balance: number;
  lastUpdated: number;
}

// Using standardized constants imported from useIndexedDB

export const OfflineBalanceProvider: React.FC<OfflineBalanceProviderProps> = ({ children }) => {
  const { toast } = useToast();
  const [offlineBalance, setOfflineBalance] = useState<number>(0);
  const [pendingTransactions, setPendingTransactions] = useState<number>(0);
  const [dbAvailable, setDbAvailable] = useState<boolean>(true);
  const { user } = useAuth();
  
  // Initialize IndexedDB for transactions
  const transactionsDB = useIndexedDB({
    dbName: DB_NAME,
    storeName: TRANSACTIONS_STORE
    // Using default version from useIndexedDB
  });
  
  // Initialize IndexedDB for balance
  const balanceDB = useIndexedDB({
    dbName: DB_NAME,
    storeName: BALANCE_STORE
    // Using default version from useIndexedDB
  });
  
  console.log(`Initialized IndexedDB with database: ${DB_NAME}, transaction store: ${TRANSACTIONS_STORE}, balance store: ${BALANCE_STORE}`);

  // Initialize database and handle any errors
  const initializeDatabase = useCallback(async () => {
    try {
      // Wait a short delay to ensure IndexedDB is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if IndexedDB is available
      if (!window.indexedDB) {
        console.error('IndexedDB not supported by this browser');
        toast({
          title: "Browser Compatibility Issue",
          description: "Your browser doesn't support offline storage. Some features may not work properly.",
          variant: "destructive"
        });
        return;
      }
      
      // Check if the database exists by attempting to open it
      const request = indexedDB.open(DB_NAME, 1); // Using version 1 for consistency
      
      request.onerror = (event) => {
        const errorObj = (event.target as IDBOpenDBRequest).error;
        console.error('Error opening database:', errorObj?.message || 'Unknown error', event);
        
        // If in private browsing mode, show a specific message
        if (errorObj?.name === 'QuotaExceededError' || errorObj?.message?.includes('quota')) {
          toast({
            title: "Private Browsing Detected",
            description: "Offline features are limited in private browsing mode. Some functionality may not work properly.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Database Error",
            description: "Could not open the offline database. Your browser might be blocking IndexedDB.",
            variant: "destructive"
          });
        }
      };
      
      request.onsuccess = () => {
        console.log(`Database ${DB_NAME} initialized successfully`);
        // Close this connection as we'll use the ones from useIndexedDB
        request.result.close();
      };
      
      // Handle blocked events (e.g., when multiple tabs are open)
      request.onblocked = () => {
        console.warn('Database opening blocked. This may be due to multiple tabs being open.');
        toast({
          title: "Database Blocked",
          description: "Please close other tabs of this application and try again.",
          variant: "default"
        });
      };
      
      /* Uncomment this code to reset the database if needed
      request.onsuccess = () => {
        request.result.close();
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => {
          console.log('Database deleted successfully');
          window.location.reload();
        };
        deleteRequest.onerror = () => {
          console.error('Error deleting database');
        };
      };
      */
      
      return new Promise<void>((resolve) => {
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    } catch (error) {
      console.error('Error initializing database:', error);
      toast({
        title: "Database Error",
        description: "Failed to initialize the offline database",
        variant: "destructive"
      });
    }
  }, [toast]);
  
  // Load the offline balance from IndexedDB or fallback to localStorage
  const loadOfflineBalance = useCallback(async () => {
    if (!user?.email) return 0;
    
    try {
      console.log('Loading offline balance for user:', user.email);
      
      // Initialize the database first
      await initializeDatabase();
      
      // If IndexedDB is not available, try to use localStorage as fallback
      if (!window.indexedDB || !dbAvailable) {
        console.log('Using localStorage fallback for offline balance');
        setDbAvailable(false);
        
        // Try to get balance from localStorage
        const storedBalance = localStorage.getItem(`offline-balance-${user.email}`);
        if (storedBalance) {
          const balance = parseFloat(storedBalance);
          setOfflineBalance(balance);
          return balance;
        }
        
        // No stored balance found, set to 0
        localStorage.setItem(`offline-balance-${user.email}`, '0');
        setOfflineBalance(0);
        return 0;
      }
      
      // Try to get the balance record from IndexedDB
      const balanceRecords = await balanceDB.getAllItems<BalanceRecord>();
      console.log('Retrieved balance records:', balanceRecords);
      
      const userBalanceRecord = balanceRecords.find(record => record.userId === user.email);
      
      if (userBalanceRecord) {
        console.log('Found balance record:', userBalanceRecord);
        setOfflineBalance(userBalanceRecord.balance);
        
        // Also update localStorage as backup
        localStorage.setItem(`offline-balance-${user.email}`, userBalanceRecord.balance.toString());
        
        return userBalanceRecord.balance;
      } else {
        console.log('No balance record found, creating one with zero balance');
        // Create a new balance record for this user
        await balanceDB.addItem({
          id: `balance-${user.email}`,
          userId: user.email,
          balance: 0,
          lastUpdated: Date.now()
        });
        
        // Also update localStorage as backup
        localStorage.setItem(`offline-balance-${user.email}`, '0');
        
        setOfflineBalance(0);
        return 0;
      }
    } catch (error) {
      console.error('Error loading offline balance:', error);
      setDbAvailable(false);
      
      // Try to use localStorage as fallback
      const storedBalance = localStorage.getItem(`offline-balance-${user.email}`);
      if (storedBalance) {
        const balance = parseFloat(storedBalance);
        setOfflineBalance(balance);
        return balance;
      }
      
      toast({
        title: "Error",
        description: "Failed to load offline balance. Using fallback storage.",
        variant: "default"
      });
      
      return 0;
    }
  }, [user, balanceDB, toast, initializeDatabase]);

  // Save the offline balance to IndexedDB or fallback to localStorage
  const saveOfflineBalance = useCallback(async (newBalance: number) => {
    if (!user?.email) return;
    
    try {
      console.log(`Saving offline balance for user ${user.email}: ${newBalance}`);
      
      // Always save to localStorage as a backup
      localStorage.setItem(`offline-balance-${user.email}`, newBalance.toString());
      
      // If IndexedDB is not available, just use localStorage
      if (!window.indexedDB || !dbAvailable) {
        console.log('Using localStorage for saving offline balance');
        return;
      }
      
      // Get existing balance record from IndexedDB
      const balanceRecords = await balanceDB.getAllItems<BalanceRecord>();
      const userBalanceRecord = balanceRecords.find(record => record.userId === user.email);
      
      if (userBalanceRecord) {
        // Update existing record
        await balanceDB.updateItem({
          ...userBalanceRecord,
          balance: newBalance,
          lastUpdated: Date.now()
        });
      } else {
        // Create new record
        await balanceDB.addItem({
          id: `balance-${user.email}`,
          userId: user.email,
          balance: newBalance,
          lastUpdated: Date.now()
        });
      }
      
      console.log('Offline balance saved successfully');
    } catch (error) {
      console.error('Error saving offline balance:', error);
      setDbAvailable(false);
      
      // Fallback to localStorage
      localStorage.setItem(`offline-balance-${user.email}`, newBalance.toString());
      
      toast({
        title: "Warning",
        description: "Using fallback storage for offline balance.",
        variant: "default"
      });
    }
  }, [user, balanceDB, toast]);

  // Count pending transactions
  const countPendingTransactions = useCallback(async () => {
    if (!user?.email) return 0;
    
    try {
      const transactions = await transactionsDB.getAllItems<OfflineTransaction>();
      const userPendingTransactions = transactions.filter(tx => 
        (tx.sender === user.email || tx.recipient === user.email) && 
        tx.status === 'pending'
      );
      
      setPendingTransactions(userPendingTransactions.length);
      return userPendingTransactions.length;
    } catch (error) {
      console.error('Error counting pending transactions:', error);
      return 0;
    }
  }, [user, transactionsDB]);

  // Load balance when user changes
  useEffect(() => {
    if (user) {
      loadOfflineBalance();
      countPendingTransactions();
    }
  }, [user, loadOfflineBalance, countPendingTransactions]);

  // Function to add to offline balance (positive or negative amount)
  const addToOfflineBalance = useCallback(async (amount: number) => {
    if (!user?.email) return;
    
    try {
      console.log(`Adding ${amount} to offline balance`);
      
      // Get current balance
      const currentBalance = offlineBalance;
      console.log('Current offline balance:', currentBalance);
      
      // Calculate new balance
      const newBalance = currentBalance + amount;
      if (newBalance < 0) {
        console.error('Cannot reduce offline balance below zero');
        toast({
          title: "Error",
          description: "Insufficient offline balance",
          variant: "destructive"
        });
        return;
      }
      
      console.log('New offline balance will be:', newBalance);
      
      // Update state
      setOfflineBalance(newBalance);
      
      // Save to IndexedDB
      await saveOfflineBalance(newBalance);
      
      // Record the transaction
      const transactionId = `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await transactionsDB.addItem({
        id: transactionId,
        sender: amount < 0 ? user.email : 'system',
        recipient: amount > 0 ? user.email : 'system',
        amount: Math.abs(amount),
        timestamp: Date.now(),
        status: 'completed',
        type: 'offline',
        note: amount > 0 ? 'Added to offline balance' : 'Removed from offline balance',
        receiptId: transactionId, // Adding required field from IDBTransaction
        synced: false // Adding required field from IDBTransaction
      });
      
      console.log(`Transaction recorded for ${Math.abs(amount)}`);
      
      toast({
        title: amount > 0 ? "Funds Added" : "Funds Removed",
        description: `$${Math.abs(amount).toFixed(2)} ${amount > 0 ? 'added to' : 'removed from'} offline balance`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error updating offline balance:', error);
      toast({
        title: "Error",
        description: "Failed to update offline balance",
        variant: "destructive"
      });
    }
  }, [user, offlineBalance, saveOfflineBalance, transactionsDB, toast]);

  // Function to refresh offline balance
  const refreshOfflineBalance = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      console.log('Refreshing offline balance from backend and IndexedDB...');
      
      // First try to get the latest offline balance from the backend
      const email = user.email;
      try {
        const response = await api.post('/wallet/balance', { email });
        console.log('Backend balance data:', response.data);
        
        // Get the offline balance from the backend (stored as reserved_Balance)
        const backendOfflineBalance = response.data.reserved_Balance || 0;
        
        // Update the offline balance in IndexedDB to match the backend
        await saveOfflineBalance(backendOfflineBalance);
        
        // Update the state with the new balance
        setOfflineBalance(backendOfflineBalance);
        console.log(`Updated offline balance from backend: ${backendOfflineBalance}`);
      } catch (apiError) {
        console.error('Error fetching from backend:', apiError);
        console.log('Falling back to local data');
        await loadOfflineBalance();
      }
      
      // Also count pending transactions
      await countPendingTransactions();
    } catch (error) {
      console.error('Error refreshing offline balance:', error);
      // Fall back to local data if there's an error
      await loadOfflineBalance();
      await countPendingTransactions();
    }
  }, [user, loadOfflineBalance, countPendingTransactions, saveOfflineBalance]);

  // For backward compatibility - updateOfflineBalance is just an alias for addToOfflineBalance
  const updateOfflineBalance = useCallback(async (amount: number) => {
    console.log('Using updateOfflineBalance (legacy function)');
    return addToOfflineBalance(amount);
  }, [addToOfflineBalance]);

  // For backward compatibility - syncOfflineCredits is just a no-op that refreshes the balance
  const syncOfflineCredits = useCallback(async () => {
    console.log('Using syncOfflineCredits (legacy function)');
    return refreshOfflineBalance();
  }, [refreshOfflineBalance]);

  return (
    <OfflineBalanceContext.Provider
      value={{
        offlineBalance,
        pendingTransactions,
        addToOfflineBalance,
        refreshOfflineBalance,
        // Adding these for backward compatibility
        updateOfflineBalance,
        syncOfflineCredits
      }}
    >
      {children}
    </OfflineBalanceContext.Provider>
  );
};
