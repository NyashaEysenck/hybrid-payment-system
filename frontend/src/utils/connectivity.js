// utils/connectivity.js
import api from './api';
import { syncOfflineTransactions, confirmPendingTransactions } from '@/services/syncService';
import { toast } from '@/components/ui/use-toast';

/**
 * Checks if the online backend server (index.js) is accessible
 * @returns {Promise<boolean>} True if online, false if offline
 */
export const checkOnlineStatus = async () => {
  try {
    // Try to access the main backend server (not the local offline server)
    // Set a short timeout to avoid long waits
    const response = await api.get('/health', { 
      timeout: 3000,
      // Don't retry on failure
      retry: 0,
      // Don't throw on error status codes
      validateStatus: () => true
    });
    
    // Consider 2xx status codes as online
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.log('Online check failed:', error.message);
    return false;
  }
};

/**
 * Syncs transactions when going from offline to online
 * @param {boolean} isOnline Current online status
 * @param {boolean} wasOnline Previous online status
 * @param {Object} indexedDB IndexedDB hook instance
 * @param {Function} refreshOfflineBalance Function to refresh offline balance
 */
export const handleConnectionChange = async (isOnline, wasOnline, indexedDB, refreshOfflineBalance) => {
  // Only sync when transitioning from offline to online
  if (isOnline && !wasOnline && indexedDB) {
    try {
      // Get all transactions from IndexedDB
      const transactions = await indexedDB.getAllItems();
      
      // Sync offline transactions
      const { synced, pending, failed } = await syncOfflineTransactions(
        transactions,
        indexedDB.updateItem,
        indexedDB.deleteItem,
        refreshOfflineBalance
      );
      
      // Check if any pending transactions are now confirmed
      const confirmed = await confirmPendingTransactions(
        transactions,
        indexedDB.deleteItem,
        refreshOfflineBalance
      );
      
      // Show toast notification if any transactions were processed
      if (synced > 0 || pending > 0 || confirmed > 0) {
        toast({
          variant: "default",
          title: "Transactions Synced",
          description: `${synced} completed, ${pending} pending, ${confirmed} confirmed`,
          duration: 5000,
        });
      }
      
      if (failed > 0) {
        toast({
          variant: "destructive",
          title: "Sync Issues",
          description: `${failed} transactions failed to sync`,
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error during transaction sync:', error);
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to sync transactions. Will try again later.",
        duration: 5000,
      });
    }
  }
};

/**
 * Periodically checks online status and calls the provided callback when status changes
 * @param {Function} onStatusChange Callback function that receives the new status
 * @param {Object} indexedDB IndexedDB hook instance for transaction syncing
 * @param {Function} refreshOfflineBalance Function to refresh offline balance
 * @param {number} interval Polling interval in milliseconds
 * @returns {Function} Function to stop the polling
 */
export const startOnlineStatusMonitor = (onStatusChange, indexedDB, refreshOfflineBalance, interval = 10000) => {
  let lastStatus = null;
  let timerId = null;
  
  const checkStatus = async () => {
    const isOnline = await checkOnlineStatus();
    
    // Only call the callback when status changes
    if (lastStatus === null || lastStatus !== isOnline) {
      // Call the status change callback
      onStatusChange(isOnline);
      
      // Handle connection change (sync transactions if needed)
      if (indexedDB) {
        await handleConnectionChange(isOnline, lastStatus, indexedDB, refreshOfflineBalance);
      }
      
      // Update last known status
      lastStatus = isOnline;
    }
  };
  
  // Initial check
  checkStatus();
  
  // Start periodic checking
  timerId = setInterval(checkStatus, interval);
  
  // Return function to stop monitoring
  return () => {
    if (timerId) {
      clearInterval(timerId);
    }
  };
};
