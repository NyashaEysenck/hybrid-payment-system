import { storageService } from '@/services/storageService';

// Keys for storing wallet data in localStorage
export const WALLET_BALANCE_KEY = 'walletBalance';
export const WALLET_RESERVED_BALANCE_KEY = 'walletReservedBalance';
export const WALLET_LAST_UPDATED_KEY = 'walletLastUpdated';

// For backward compatibility, re-export the storage service methods
export const saveUser = (email, user) => storageService.saveUser(email, user);
export const debugListAllUsers = () => storageService.debugListAllUsers();
export const getUser = (email) => storageService.getUser(email);
export const clearUserStorage = () => storageService.clearUserStorage();

// Export transaction-related methods
export const saveTransaction = (tx) => storageService.saveTransaction(tx);
export const getTransactions = () => storageService.getTransactions();
export const clearTransactions = () => storageService.clearTransactions();

// Export balance-related methods
export const saveOfflineBalance = (balance, userEmail) => storageService.saveOfflineBalance(balance, userEmail);
export const getOfflineBalance = (userEmail) => storageService.getOfflineBalance(userEmail);