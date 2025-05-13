// frontend/src/contexts/wallet/walletService.ts
import api from "@/utils/api";
import { Transaction, SendMoneyParams } from "./types";
import { getUser} from "@/utils/storage";

export const fetchWalletData = async () => {
  const email = localStorage.getItem('lastEmail');
  if (!email) throw new Error('No email found in localStorage');

  try {
    // Get user data from local storage instead of API
    const localUser = await getUser(email);
    
    if (!localUser) {
      throw new Error('User not found in local storage');
    }

    // Decrypt user data if needed (assuming it might be encrypted)
    let userData = localUser;
    if (localUser.encryptedData) {
      // Note: You'll need the password to decrypt, which you might not have here
      // This is a potential limitation of this approach
      throw new Error('Cannot decrypt user data without password');
    }

    return {
      balance: userData.balance || 0,
      reservedBalance: userData.offline_credits || 0, // Using offline_credits as reserved balance
      transactions: [] // Still returning empty array as we don't store transactions locally
    };
  } catch (error) {
    console.error('Error fetching wallet data from local storage:', error);
    
    // Fallback to API if local data fails
    try {
  
      const balanceRes = await api.post('/wallet/balance', { email });
      const transactionRes = await api.get('/transactions/user', { params: { email } });
      console.log(transactionRes.data.data)

      return {
        balance: balanceRes.data.balance,
        reservedBalance: balanceRes.data.reserved_Balance || 0,
        transactions: transactionRes.data.data
      };
    } catch (apiError) {
      console.error('Error fetching wallet data from API:', apiError);
      throw apiError;
    }
  }
};

export const reserveTokens = async (amount: number) => {
  const email = localStorage.getItem("lastEmail")
  const response = await api.post('/wallet/reserve', { amount, email });

  return { reservedBalance: response.data.reserved_Balance };
};


export const releaseTokens = async (amount: number) => {
  const email = localStorage.getItem("lastEmail")
  const response = await api.post('/wallet/release', { amount, email});
  return { reservedBalance: response.data.reserved_Balance };
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