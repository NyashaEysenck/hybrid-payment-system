// services/syncService.ts
import api from '@/utils/api';
import { Transaction } from '@/hooks/useIndexedDB';
import { toast } from '@/components/ui/use-toast';

/**
 * Syncs offline transactions to the online database
 * @param transactions List of offline transactions from IndexedDB
 * @param updateTransaction Function to update a transaction in IndexedDB
 * @param deleteTransaction Function to delete a transaction from IndexedDB
 * @param refreshOfflineBalance Optional function to refresh the offline balance after sync
 * @returns Object containing sync results
 */
export const syncOfflineTransactions = async (
  transactions: Transaction[],
  updateTransaction: (transaction: Transaction) => Promise<Transaction>,
  deleteTransaction: (id: string) => Promise<void>,
  refreshOfflineBalance?: () => Promise<void>
): Promise<{ synced: number; pending: number; failed: number }> => {
  // Filter only offline transactions
  const offlineTransactions = transactions.filter(tx => tx.type === 'offline');
  
  if (offlineTransactions.length === 0) {
    return { synced: 0, pending: 0, failed: 0 };
  }

  console.log(`Starting sync of ${offlineTransactions.length} offline transactions`);
  
  let synced = 0;
  let pending = 0;
  let failed = 0;

  // Process each transaction
  for (const transaction of offlineTransactions) {
    try {
      // First check if the transaction already exists in the online database
      const checkResponse = await api.get(`/transactions/check/${transaction.id}`);
      
      if (checkResponse.data.exists) {
        // Transaction already exists in online database
        console.log(`Transaction ${transaction.id} already exists online, updating status`);
        
        if (checkResponse.data.status === 'completed') {
          // If it's completed, we can safely delete it from local storage
          await deleteTransaction(transaction.id);
          synced++;
        } else if (checkResponse.data.status === 'pending') {
          // If it's pending, we need to keep it locally but mark as synced
          const updatedTransaction = {
            ...transaction,
            status: 'pending' as const,
            synced: true
          };
          await updateTransaction(updatedTransaction);
          pending++;
        }
      } else {
        // Transaction doesn't exist online, upload it
        console.log(`Uploading transaction ${transaction.id} to online database`);
        
        const syncResponse = await api.post('/transactions/sync', {
          ...transaction,
          status: 'pending' // Initially set as pending in online database
        });
        
        if (syncResponse.status === 201) {
          // Successfully synced to online database as pending
          const updatedTransaction = {
            ...transaction,
            status: 'pending' as const,
            synced: true
          };
          await updateTransaction(updatedTransaction);
          pending++;
        } else {
          // Something went wrong, keep as is
          failed++;
        }
      }
    } catch (error) {
      console.error(`Error syncing transaction ${transaction.id}:`, error);
      failed++;
    }
  }

  // Refresh offline balance if function is provided
  if (refreshOfflineBalance) {
    try {
      await refreshOfflineBalance();
    } catch (error) {
      console.error('Error refreshing offline balance:', error);
    }
  }

  return { synced, pending, failed };
};

/**
 * Confirms pending transactions that have been verified by both parties
 * @param transactions List of pending transactions from IndexedDB
 * @param deleteTransaction Function to delete a transaction from IndexedDB
 * @param refreshOfflineBalance Optional function to refresh the offline balance after confirmation
 * @returns Number of transactions confirmed and deleted
 */
export const confirmPendingTransactions = async (
  transactions: Transaction[],
  deleteTransaction: (id: string) => Promise<void>,
  refreshOfflineBalance?: () => Promise<void>
): Promise<number> => {
  // Filter only pending transactions that have been synced
  const pendingTransactions = transactions.filter(
    tx => tx.status === 'pending' && tx.synced === true
  );
  
  if (pendingTransactions.length === 0) {
    return 0;
  }

  console.log(`Checking ${pendingTransactions.length} pending transactions for confirmation`);
  
  let confirmed = 0;

  // Process each pending transaction
  for (const transaction of pendingTransactions) {
    try {
      // Check if the transaction has been confirmed by both parties
      const confirmResponse = await api.post(`/transactions/confirm/${transaction.id}`, {
        user_email: transaction.sender // Use sender email to confirm from this side
      });
      
      if (confirmResponse.data.is_completed) {
        // Transaction is now completed, we can delete it locally
        await deleteTransaction(transaction.id);
        confirmed++;
      }
    } catch (error) {
      console.error(`Error confirming transaction ${transaction.id}:`, error);
    }
  }

  // Refresh offline balance if function is provided
  if (refreshOfflineBalance && confirmed > 0) {
    try {
      await refreshOfflineBalance();
    } catch (error) {
      console.error('Error refreshing offline balance:', error);
    }
  }

  return confirmed;
};
