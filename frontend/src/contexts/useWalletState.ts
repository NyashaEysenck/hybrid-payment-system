// frontend/src/contexts/wallet/useWalletState.ts
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import * as walletService from "./WalletService"
import { useAuth } from "./AuthContext";
import { useOfflineBalance } from "./OfflineBalanceContext";

import { Transaction, SendMoneyParams, WalletContextType } from "./types";


export const useWalletState = (): WalletContextType => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshOfflineBalance } = useOfflineBalance();
  const [balance, setBalance] = useState(0);
  const [reservedBalance, setReservedBalance] = useState(0);
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
      setReservedBalance(data.reservedBalance);
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

  const reserveTokens = useCallback(async (amount: number) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to reserve.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { reservedBalance } = await walletService.reserveTokens(amount);
      setReservedBalance(reservedBalance);
      
      // Refresh the offline balance to reflect the reserved tokens
      await refreshOfflineBalance();
      
      toast({
        title: "Tokens Reserved",
        description: `$${amount.toFixed(2)} has been reserved for offline use.`,
      });
    } catch (err) {
      handleError(err, "Failed to reserve tokens");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast, refreshOfflineBalance]);

  const releaseTokens = useCallback(async (amount: number) => {
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a positive amount to release.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { reservedBalance } = await walletService.releaseTokens(amount);
      setReservedBalance(reservedBalance);
      
      // Refresh the offline balance to reflect the released tokens
      await refreshOfflineBalance();
      
      toast({
        title: "Tokens Released",
        description: `$${amount.toFixed(2)} has been returned to your main balance.`,
      });
    } catch (err) {
      handleError(err, "Failed to release tokens");
    } finally {
      setIsLoading(false);
    }
  }, [handleError, toast, refreshOfflineBalance]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, "id" | "date">) => {
    setIsLoading(true);
    try {
      const { transaction: newTransaction } = await walletService.addTransaction(transaction);
      setTransactions(prev => [newTransaction, ...prev]);
      
      if (transaction.transaction_type !== "payment" || transaction.status === "completed") {
        const amountChange = transaction.amount;
        
        if (transaction.offline_method && transaction.amount < 0) {
          setReservedBalance(prev => Math.max(0, prev + amountChange));
        } else {
          setBalance(prev => prev + amountChange);
        }
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
      const { balance, reservedBalance, transaction } = await walletService.sendMoney({
        sender: email,
        amount,
        recipient,
        note,
        type
      });
  
      if (!transaction || balance === undefined || reservedBalance === undefined) {
        throw new Error("Failed to process the transaction. Missing data.");
      }
  
      setBalance(balance);
      setReservedBalance(reservedBalance);
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
    reservedBalance,
    transactions,
    isLoading,
    error,
    reserveTokens,
    releaseTokens,
    addTransaction,
    addFunds,
    sendMoney,
    fetchWalletData
  };
};