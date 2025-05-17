// frontend/src/contexts/wallet/walletService.ts
import api from "@/utils/api";
import { Transaction, SendMoneyParams } from "./types";
import { getUser, saveUser } from "@/utils/storage";

// Define interfaces for the transfer function return types
interface TransferResult {
  onlineBalance: number;
  offlineBalance: number;
  transferredAmount: number;
}

// Keys for storing wallet data in localStorage
const WALLET_BALANCE_KEY = 'walletBalance';
const WALLET_RESERVED_BALANCE_KEY = 'walletReservedBalance';
const WALLET_LAST_UPDATED_KEY = 'walletLastUpdated';

// Function to save wallet balances to localStorage
const saveWalletDataToLocalStorage = (balance: number, reservedBalance: number) => {
  try {
    localStorage.setItem(WALLET_BALANCE_KEY, balance.toString());
    localStorage.setItem(WALLET_RESERVED_BALANCE_KEY, reservedBalance.toString());
    localStorage.setItem(WALLET_LAST_UPDATED_KEY, Date.now().toString());
    console.log('Wallet data saved to localStorage:', { balance, reservedBalance });
  } catch (error) {
    console.error('Error saving wallet data to localStorage:', error);
  }
};

// Function to get wallet data from localStorage
const getWalletDataFromLocalStorage = () => {
  try {
    const balanceStr = localStorage.getItem(WALLET_BALANCE_KEY);
    const reservedBalanceStr = localStorage.getItem(WALLET_RESERVED_BALANCE_KEY);
    const lastUpdatedStr = localStorage.getItem(WALLET_LAST_UPDATED_KEY);
    
    if (balanceStr && reservedBalanceStr) {
      const balance = parseFloat(balanceStr);
      const reservedBalance = parseFloat(reservedBalanceStr);
      const lastUpdated = lastUpdatedStr ? parseInt(lastUpdatedStr) : 0;
      
      console.log('Retrieved wallet data from localStorage:', { balance, reservedBalance, lastUpdated });
      return { balance, reservedBalance, lastUpdated };
    }
  } catch (error) {
    console.error('Error retrieving wallet data from localStorage:', error);
  }
  
  return null;
};

export const fetchWalletData = async () => {
  console.log('Fetching wallet data...');
  const email = localStorage.getItem('lastEmail');
  if (!email) {
    console.error('No email found in localStorage');
    throw new Error('No email found in localStorage');
  }

  // First try to get user data from sessionStorage which is not encrypted
  console.log('Checking sessionStorage for user data...');
  const sessionUser = sessionStorage.getItem('sessionUser');
  if (sessionUser) {
    try {
      const userData = JSON.parse(sessionUser);
      console.log('Found user data in sessionStorage:', userData);
      
      // Get cached wallet data from localStorage
      const cachedWalletData = getWalletDataFromLocalStorage();
      
      // If we have cached wallet data that's less than 1 hour old, use it
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
      if (cachedWalletData && Date.now() - cachedWalletData.lastUpdated < ONE_HOUR) {
        console.log('Using cached wallet data from localStorage');
        return {
          balance: cachedWalletData.balance,
          reservedBalance: cachedWalletData.reservedBalance,
          transactions: [] // Still returning empty array as we don't store transactions locally
        };
      }
      
      // Use user data from sessionStorage
      const balance = userData.balance || 0;
      const reservedBalance = userData.offline_credits || 0;
      
      // Save this data to localStorage for future use
      saveWalletDataToLocalStorage(balance, reservedBalance);
      
      return {
        balance,
        reservedBalance,
        transactions: [] // Still returning empty array as we don't store transactions locally
      };
    } catch (parseError) {
      console.error('Error parsing session user data:', parseError);
      // Continue to next approach if parsing fails
    }
  }

  // If session storage doesn't have the data, try IndexedDB
  console.log('Checking IndexedDB for user data...');
  try {
    const localUser = await getUser(email);
    console.log('IndexedDB user data:', localUser);
    
    if (localUser) {
      // Get cached wallet data from localStorage
      const cachedWalletData = getWalletDataFromLocalStorage();
      
      // If we have cached wallet data that's less than 1 hour old, use it
      const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds
      if (cachedWalletData && Date.now() - cachedWalletData.lastUpdated < ONE_HOUR) {
        console.log('Using cached wallet data from localStorage');
        return {
          balance: cachedWalletData.balance,
          reservedBalance: cachedWalletData.reservedBalance,
          transactions: []
        };
      }
    }
    
    // If we get here, either no local user was found or it was encrypted
    // Fall back to API without throwing an error
    console.log('No usable data in IndexedDB, falling back to API');
  } catch (error) {
    console.error('Error accessing local storage:', error);
    // Continue to API fallback
  }
  
  // Fallback to API
  console.log('Fetching wallet data from API...');
  try {
    const balanceRes = await api.post('/wallet/balance', { email });
    const transactionRes = await api.get('/transactions/user', { params: { email } });
    
    console.log('API balance response:', balanceRes.data);
    console.log('API transactions response:', transactionRes.data);
    
    const balance = balanceRes.data.balance || 0;
    const reservedBalance = balanceRes.data.reserved_Balance || 0;
    
    // Save this data to localStorage for future use
    saveWalletDataToLocalStorage(balance, reservedBalance);
    
    // Also update the user in sessionStorage
    try {
      const sessionUser = sessionStorage.getItem('sessionUser');
      if (sessionUser) {
        const userData = JSON.parse(sessionUser);
        userData.balance = balance;
        userData.offline_credits = reservedBalance;
        sessionStorage.setItem('sessionUser', JSON.stringify(userData));
        console.log('Updated user data in sessionStorage');
      }
    } catch (sessionError) {
      console.error('Error updating sessionStorage:', sessionError);
    }
    
    return {
      balance,
      reservedBalance,
      transactions: transactionRes.data.data || []
    };
  } catch (apiError) {
    console.error('Error fetching wallet data from API:', apiError);
    
    // If API fails, try to use cached data as a last resort
    const cachedWalletData = getWalletDataFromLocalStorage();
    if (cachedWalletData) {
      console.log('API failed, using cached wallet data as fallback');
      return {
        balance: cachedWalletData.balance,
        reservedBalance: cachedWalletData.reservedBalance,
        transactions: []
      };
    }
    
    throw apiError;
  }
};

export const transferToOffline = async (amount: number): Promise<TransferResult> => {
  console.log(`Transferring ${amount} from online to offline balance...`);
  const email = localStorage.getItem("lastEmail");
  if (!email) {
    console.error('No email found in localStorage');
    throw new Error('No email found in localStorage');
  }
  
  if (amount <= 0) {
    console.error('Cannot transfer non-positive amount');
    throw new Error('Amount must be greater than zero');
  }
  
  try {
    // First, check if we have enough online balance
    const balanceRes = await api.post('/wallet/balance', { email });
    const onlineBalance = balanceRes.data.balance || 0;
    const currentOfflineBalance = balanceRes.data.offline_balance || 0;
    
    if (onlineBalance < amount) {
      console.error(`Insufficient online balance: ${onlineBalance} < ${amount}`);
      throw new Error('Insufficient online balance');
    }
    
    // Transfer to offline balance
    const response = await api.post('/wallet/transfer-to-offline', { amount, email });
    console.log('Transfer to offline response:', response.data);
    
    // Get the updated balances from the response
    const newOnlineBalance = response.data.online_balance;
    const newOfflineBalance = response.data.offline_balance;
    
    // Update the cached wallet data
    saveWalletDataToLocalStorage(newOnlineBalance, newOfflineBalance);
    
    // Update the user in sessionStorage
    try {
      const sessionUser = sessionStorage.getItem('sessionUser');
      if (sessionUser) {
        const userData = JSON.parse(sessionUser);
        userData.balance = newOnlineBalance;
        sessionStorage.setItem('sessionUser', JSON.stringify(userData));
        console.log('Updated user data in sessionStorage after transferring to offline');
      }
    } catch (sessionError) {
      console.error('Error updating sessionStorage:', sessionError);
    }
    
    return { 
      onlineBalance: newOnlineBalance,
      offlineBalance: newOfflineBalance,
      transferredAmount: amount
    };
  } catch (error) {
    console.error('Error transferring to offline:', error);
    throw error;
  }
};

export const transferToOnline = async (amount: number): Promise<TransferResult> => {
  console.log(`Transferring ${amount} from offline to online balance...`);
  const email = localStorage.getItem("lastEmail");
  if (!email) {
    console.error('No email found in localStorage');
    throw new Error('No email found in localStorage');
  }
  
  if (amount <= 0) {
    console.error('Cannot transfer non-positive amount');
    throw new Error('Amount must be greater than zero');
  }
  
  try {
    // First, check current balances
    const balanceRes = await api.post('/wallet/balance', { email });
    const currentOnlineBalance = balanceRes.data.balance || 0;
    const currentOfflineBalance = balanceRes.data.offline_balance || 0;
    
    if (currentOfflineBalance < amount) {
      console.error(`Insufficient offline balance: ${currentOfflineBalance} < ${amount}`);
      throw new Error('Insufficient offline balance');
    }
    
    // Transfer from offline to online
    const response = await api.post('/wallet/transfer-to-online', { amount, email });
    console.log('Transfer to online response:', response.data);
    
    // Get the updated balances from the response
    const newOnlineBalance = response.data.online_balance;
    const newOfflineBalance = response.data.offline_balance;
    
    // Update the cached wallet data
    saveWalletDataToLocalStorage(newOnlineBalance, newOfflineBalance);
    
    // Update the user in sessionStorage
    try {
      const sessionUser = sessionStorage.getItem('sessionUser');
      if (sessionUser) {
        const userData = JSON.parse(sessionUser);
        userData.balance = newOnlineBalance;
        sessionStorage.setItem('sessionUser', JSON.stringify(userData));
        console.log('Updated user data in sessionStorage after transferring to online');
      }
    } catch (sessionError) {
      console.error('Error updating sessionStorage:', sessionError);
    }
    
    return { 
      onlineBalance: newOnlineBalance,
      offlineBalance: newOfflineBalance,
      transferredAmount: amount
    };
  } catch (error) {
    console.error('Error transferring to online:', error);
    throw error;
  }
};

export const addTransaction = async (transaction: Omit<Transaction, "id" | "date">) => {
  const response = await api.post('/transactions', transaction);
  return { transaction: response.data };
};

export const addFunds = async (amount: number) => {
  const response = await api.post('/wallet/deposit', { amount });
  return {
    balance: response.data.balance,
    transaction: response.data.transaction
  };
};

export const sendMoney = async ({ sender, amount, recipient, note, type }: SendMoneyParams) => {
  const response = await api.post('/transactions/transfer', {
    sender,
    amount,
    recipient,
    note,
    type
  });
  return {
    balance: response.data.balance,
    reservedBalance: response.data.reservedBalance || 0,
    transaction: response.data.transaction
  };
};