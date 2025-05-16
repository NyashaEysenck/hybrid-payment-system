// frontend/src/contexts/wallet/useWalletState.ts
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import * as walletService from "./WalletService"
import { useAuth } from "./AuthContext";
import { useOfflineBalance } from "./OfflineBalanceContext";
import { saveUser } from "@/utils/storage";

import { Transaction, SendMoneyParams, WalletContextType } from "./types";

export const useWalletState = (): WalletContextType => {
  const { toast } = useToast();
  const { user, setUser } = useAuth();
  const { refreshOfflineBalance } = useOfflineBalance();
  const [balance, setBalance] = useState(0);
  // Removed reservedBalance state as we're using the simplified two-balance approach
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown, defaultMessage: string) => {
    setError(defaultMessage);
    console.error(defaultMessage, err);
    toast({
      title: "Error",
      description: defaultMessage,
      variant: "destructive",
    });
  }, [toast]);

  const fetchWalletData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await walletService.fetchWalletData();
      setBalance(data.balance);
      // No longer tracking reservedBalance in state
      setTransactions(data.transactions);
    } catch (err) {
      handleError(err, "Failed to fetch wallet data");
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const transferToOffline = useCallback(async (amount: number) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to transfer.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log(`Transferring ${amount} to offline balance...`);
      
      // Call the new transferToOffline function
      const { onlineBalance, transferredAmount } = await walletService.transferToOffline(amount);
      
      // Update online balance in state
      setBalance(onlineBalance);
      
      console.log(`Updated online balance: ${onlineBalance}, Transferred: ${transferredAmount}`);
      
      // Update user's balance in AuthContext
      if (user) {
        // Create updated user object with new balance
        const updatedUser = {
          ...user,
          balance: onlineBalance
        };
        
        console.log('Updating user in AuthContext with new balance');
        
        // Update user in AuthContext
        setUser(updatedUser);
        
        // Persist updated user to storage
        const email = localStorage.getItem('lastEmail');
        if (email) {
          await saveUser(email, updatedUser);
          console.log('User data persisted to storage with updated balance');
        }
      }
      
      // Refresh the offline balance
      await refreshOfflineBalance();
      console.log('Offline balance refreshed after transfer');
      
      toast({
        title: "Transfer Successful",
        description: `$${amount.toFixed(2)} has been transferred to your offline balance.`,
      });
    } catch (err) {
      handleError(err, "Failed to transfer to offline balance");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast, refreshOfflineBalance, user, setUser]);

  const transferToOnline = useCallback(async (amount: number) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to transfer.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log(`Transferring ${amount} from offline to online balance...`);
      const { onlineBalance, transferredAmount } = await walletService.transferToOnline(amount);
      
      // Update online balance in state
      setBalance(onlineBalance);
      
      console.log(`Updated online balance: ${onlineBalance}, Transferred: ${transferredAmount}`);
      
      // Update user's balance in AuthContext
      if (user) {
        // Create updated user object with new balance
        const updatedUser = {
          ...user,
          balance: onlineBalance
        };
        
        console.log('Updating user in AuthContext with new balance');
        
        // Update user in AuthContext
        setUser(updatedUser);
        
        // Persist updated user to storage
        const email = localStorage.getItem('lastEmail');
        if (email) {
          await saveUser(email, updatedUser);
          console.log('User data persisted to storage with updated balance');
        }
      }
      
      // Refresh the offline balance
      await refreshOfflineBalance();
      console.log('Offline balance refreshed after transfer');
      
      toast({
        title: "Transfer Successful",
        description: `$${amount.toFixed(2)} has been transferred to your online balance.`,
      });
    } catch (err) {
      handleError(err, "Failed to transfer to online balance");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast, refreshOfflineBalance, user, setUser]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, "id" | "date">) => {
    setIsLoading(true);
    try {
      const { transaction: newTransaction } = await walletService.addTransaction(transaction);
      setTransactions(prev => [newTransaction, ...prev]);
      
      if (transaction.transaction_type !== "payment" || transaction.status === "completed") {
        const amountChange = transaction.amount;
        
        // All transactions affect the online balance now
        setBalance(prev => prev + amountChange);
      }

      toast({
        title: "Transaction Added",
        description: `${transaction.transaction_type === "deposit" ? "Received" : "Sent"} $${Math.abs(transaction.amount).toFixed(2)}`,
        variant: transaction.amount > 0 ? "default" : transaction.status === "failed" ? "destructive" : "default",
      });
    } catch (err) {
      handleError(err, "Failed to add transaction");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast]);

  const addFunds = useCallback(async (amount: number) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to deposit.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { balance, transaction } = await walletService.addFunds(amount);
      setBalance(balance);
      if (transaction) {
        setTransactions(prev => [transaction, ...prev]);
      }
      toast({
        title: "Deposit Successful",
        description: `$${amount.toFixed(2)} has been added to your account.`,
      });
    } catch (err) {
      handleError(err, "Failed to add funds");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast]);

  const sendMoney = useCallback(async ({ sender: email, amount, recipient, note, type }: SendMoneyParams) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to send.",
        variant: "destructive",
      });
      return null;  // Return null if amount is invalid
    }
  
    setIsLoading(true);
    try {
      const { balance, transaction } = await walletService.sendMoney({
        sender: email,
        amount,
        recipient,
        note,
        type
      });
  
      if (!transaction || balance === undefined) {
        throw new Error("Failed to process the transaction. Missing data.");
      }
  
      setBalance(balance);
      // No longer tracking reservedBalance in state
      setTransactions(prev => [transaction, ...prev]);
  
      toast({
        title: "Payment Successful",
        description: `$${amount.toFixed(2)} sent to ${recipient}`,
      });
  
      return transaction;  // Return the transaction object on success
    } catch (err) {
      handleError(err, "Failed to send money");
      return null;  // Return null if an error occurred
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast]);
  
  return {
    balance,
    reservedBalance: 0, // Keeping for backward compatibility, but always 0 now
    transactions,
    isLoading,
    error,
    transferToOffline,
    transferToOnline,
    addTransaction,
    addFunds,
    sendMoney,
    fetchWalletData
  };
};