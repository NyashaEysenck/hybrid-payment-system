// services/syncService.ts
import api from '@/utils/api';
import { Transaction } from '@/types';
// In services/syncService.ts
export const syncOfflineTransactions = async (
  transactions: Transaction[],
  refreshOfflineBalance?: () => Promise<void>
): Promise<{ synced: number; pending: number; failed: number }> => {
  const offlineTransactions = transactions.filter(tx => tx.type === 'offline');
  
  if (offlineTransactions.length === 0) {
    return { synced: 0, pending: 0, failed: 0 };
  }

  try {
    // Send all offline transactions in one batch
    const response = await api.post('/transactions/sync/batch', { transactions: offlineTransactions });
    
    let synced = 0;
    let pending = 0;
    let failed = 0;

    // Process results
    for (const result of response.data.results) {
      if (result.status === 'success') {
        synced++;
     
      } else if (result.status === 'failed') {
        failed++;
      } else if (result.status === 'skipped') {
        pending++;
      }
    }

    return { synced, pending, failed };
  } catch (error) {
    console.error('Error syncing transactions:', error);
    return { synced: 0, pending: 0, failed: offlineTransactions.length };
  }
};