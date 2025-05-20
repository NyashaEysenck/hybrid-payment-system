import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import BalanceDisplay from "@/components/BalanceDisplay";
import GreenButton from "@/components/GreenButton";
import { useWallet } from "@/contexts/WalletContext";
import { useOfflineBalance } from "@/contexts/OfflineBalanceContext";
import { transferToOffline, transferToOnline } from "@/contexts/WalletService";
import {
  CreditCard,
  Lock,
  Unlock,
  QrCode,
  ScanLine,
  Smartphone,
  Send,
  Wallet,
  ArrowLeftRight,
  WifiOff,
  History,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";
import { storageService } from '@/services/storageService';
import { Transaction } from '@/types';

const processTransactions = (transactions: Transaction[]): Transaction[] => {
  const transactionMap = new Map<string, Transaction>();
  const statusPriority: { [key: string]: number } = { completed: 3, failed: 2, pending: 1 };
  for (const tx of transactions) {
    const existingTx = transactionMap.get(tx.id);
    if (!existingTx) {
      transactionMap.set(tx.id, tx);
    } else {
      const currentTxPriority = statusPriority[tx.status] ?? 0;
      const existingTxPriority = statusPriority[existingTx.status] ?? 0;
      if (currentTxPriority > existingTxPriority) {
        transactionMap.set(tx.id, tx);
      } else if (currentTxPriority === existingTxPriority && tx.timestamp > existingTx.timestamp) {
        transactionMap.set(tx.id, tx);
      }
    }
  }
  return Array.from(transactionMap.values()).sort((a, b) => b.timestamp - a.timestamp);
};

const OfflinePage = () => {
  const { balance, fetchWalletData } = useWallet();
  const { offlineBalance, pendingTransactions, refreshOfflineBalance, isOffline } = useOfflineBalance();
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineTransactions, setOfflineTransactions] = useState<Transaction[]>([]);
  const navigate = useNavigate();
  const onlineBalance = isOffline ? "N/A" : Number(balance);

  const resetDatabases = useCallback(async () => {
    setIsProcessing(true);
    try {
      console.log('Resetting IndexedDB databases...');
      await new Promise<void>((resolve, reject) => {
        const deleteRequest = indexedDB.deleteDatabase('offline-payments');
        deleteRequest.onsuccess = () => {
          console.log('Database deleted successfully');
          resolve();
        };
        deleteRequest.onerror = () => {
          console.error('Error deleting database');
          reject(new Error('Failed to delete database'));
        };
      });
      window.location.reload();
    } catch (error) {
      console.error('Error resetting databases:', error);
      setIsProcessing(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsProcessing(true);
      try {
        console.log('Loading data on OfflinePage...');
        await fetchWalletData();
        await refreshOfflineBalance();
        const transactions = await storageService.getTransactions();
        const processed = processTransactions(transactions);
        setOfflineTransactions(processed);
        console.log('Data loaded successfully');
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    loadData();
  }, [fetchWalletData, refreshOfflineBalance]);

  const handleSendMoneyClick = () => {
    if (!isOffline) {
      return;
    }
    navigate("/webrtc-send-money");
  };

  const handleReceiveMoneyClick = () => {
    if (!isOffline) {
      return;
    }
    navigate("/webrtc-receive-money");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Offline Wallet</h1>
        <div className="grid grid-cols-1">
          <WhiteCard className="p-6">
            <h2 className="text-xl font-semibold text-dark mb-6">Your Balances</h2>
            <div className="space-y-4">
              <BalanceDisplay
                amount={onlineBalance}
                label="Online Balance"
                type="primary"
              />
              <BalanceDisplay
                amount={isOffline ? offlineBalance : "N/A"}
                label="Offline Balance"
                size="md"
                type="secondary"
                icon={<WifiOff size={16} />}
              />
              {pendingTransactions > 0 && (
                <div className="text-sm text-amber-600 mt-2">
                  You have {pendingTransactions} pending offline {pendingTransactions === 1 ?
                    'transaction' : 'transactions'} to be synced
                </div>
              )}
            </div>
          </WhiteCard>
        </div>

        <WhiteCard className="p-6">
          <h2 className="text-xl font-semibold text-dark mb-6">QR Code Transfer</h2>
          <div className="space-y-4">
            <button
              onClick={handleSendMoneyClick}
              disabled={!isOffline}
              className={`group p-6 rounded-lg border ${isOffline ? 'border-gray-200 hover:border-greenleaf-300' : 'border-gray-100 bg-gray-50 cursor-not-allowed'} transition-colors text-left w-full`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${isOffline ? 'bg-greenleaf-100 group-hover:bg-greenleaf-200' : 'bg-gray-200'} flex items-center justify-center transition-colors`}>
                  <Send size={24} className={isOffline ? "text-greenleaf-600" : "text-gray-400"} />
                </div>
                <div>
                  <h3 className={`font-semibold ${isOffline ? "text-dark" : "text-gray-400"}`}>Send Money</h3>
                  <p className={`text-sm ${isOffline ? "text-dark-lighter" : "text-gray-400"}`}>
                    {isOffline 
                      ? "Send money offline using QR code transfer" 
                      : "Please switch to offline mode to use this feature"}
                  </p>
                </div>
              </div>
            </button>
            <button
              onClick={handleReceiveMoneyClick}
              disabled={!isOffline}
              className={`group p-6 rounded-lg border ${isOffline ? 'border-gray-200 hover:border-greenleaf-300' : 'border-gray-100 bg-gray-50 cursor-not-allowed'} transition-colors text-left w-full`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full ${isOffline ? 'bg-greenleaf-100 group-hover:bg-greenleaf-200' : 'bg-gray-200'} flex items-center justify-center transition-colors`}>
                  <Wallet size={24} className={isOffline ? "text-greenleaf-600" : "text-gray-400"} />
                </div>
                <div>
                  <h3 className={`font-semibold ${isOffline ? "text-dark" : "text-gray-400"}`}>Receive Money</h3>
                  <p className={`text-sm ${isOffline ? "text-dark-lighter" : "text-gray-400"}`}>
                    {isOffline 
                      ? "Receive money offline using QR code transfer" 
                      : "Please switch to offline mode to use this feature"}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </WhiteCard>

        <WhiteCard className="p-6">
          <h2 className="text-xl font-semibold text-dark mb-6 flex items-center">
            <History size={24} className="mr-2" />
            Offline Transaction History
          </h2>
          <div className="space-y-4">
            {offlineTransactions.length === 0 ? (
              <p className="text-gray-500 text-sm">No offline transactions recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {offlineTransactions.map((tx) => (
                  <div key={tx.id} className="border p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold capitalize">{tx.type}</span>
                      <span className={`font-bold ${tx.type === 'send' ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.type === 'send' ? '-' : '+'}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {tx.type === 'send' ?
                        `To: ${tx.recipient}` : `From: ${tx.sender}`}
                    </div>
                    {tx.note && (
                      <div className="text-sm text-gray-500 mt-1">Note: {tx.note}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(tx.timestamp).toLocaleString()}
                    </div>
                    <div className={`text-sm mt-1 ${tx.status === 'completed' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                      Status: {tx.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </WhiteCard>

        <WhiteCard className="p-6 bg-greenleaf-50 border-none">
          <div className="flex items-start">
            <div className="mr-4 mt-1">
              <QrCode size={24} className="text-greenleaf-600" />
            </div>
            <div>
              <h3 className="font-semibold text-dark">How QR Code Offline Transfer Works</h3>
               <h4 className="font-semibold text-dark mt-3">Important: Offline Mode Requirements</h4>
              <p className="text-dark-lighter text-sm mt-1">
                Before attempting any QR code offline transfers:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Toggle to Offline Mode:
                    <ul className="list-disc pl-5">
                        <li>Click the "Offline Mode" toggle in the navbar or sidebar</li>
                        <li>Ensure your offline balance is greater than 0</li>
                        <li>You'll see "Offline Mode" indicator in the UI</li>
                    </ul>
                  </li>
                  <li>After completing all offline transfers:
                    <ul className="list-disc pl-5">
                        <li>Toggle back to Online Mode</li>
                        <li>Your transactions will sync with the server</li>
                        <li>Your balances will be reconciled</li>
                    </ul>
                  </li>
                </ul>
              </p>
              <h4 className="font-semibold text-dark mt-3">Steps to Perform QR Code Offline Transfer</h4>
              <p className="text-dark-lighter text-sm mt-1">
                <strong>For the Payer (Sending Money):</strong>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>Prepare Payment:
                    <ul className="list-disc pl-5">
                        <li>Go to "Send Money" page</li>
                        <li>Enter the payment amount</li>
                        <li>Click "Generate QR Code"</li>
                    </ul>
                  </li>
                  <li>QR Code Exchange:
                    <ul className="list-disc pl-5">
                        <li>If data is large, system will split into multiple QR codes</li>
                        <li>Show first QR code to payee</li>
                        <li>Wait for payee to scan all QR codes in order</li>
                    </ul>
                  </li>
                  <li>Receive Answer:
                    <ul className="list-disc pl-5">
                        <li>Wait for payee's answer QR code</li>
                        <li>If split into chunks:
                            <ul className="list-disc pl-5">
                                <li>Scan first chunk QR code</li>
                                <li>Wait for remaining chunks</li>
                                <li>Scan all chunks in order</li>
                            </ul>
                        </li>
                        <li>If single QR code:
                            <ul className="list-disc pl-5">
                                <li>Scan single answer QR code</li>
                            </ul>
                        </li>
                    </ul>
                  </li>
                  <li>Completion:
                     <ul className="list-disc pl-5">
                        <li>Wait for payment confirmation</li>
                        <li>Your offline balance updates automatically</li>
                    </ul>
                  </li>
                </ol>
              </p>
              <p className="text-dark-lighter text-sm mt-1">
                <strong>For the Payee (Receiving Money):</strong>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>Receive Payment:
                    <ul className="list-disc pl-5">
                        <li>Go to "Receive Money" page</li>
                        <li>Click "Scan QR Code"</li>
                    </ul>
                  </li>
                  <li>QR Code Exchange:
                    <ul className="list-disc pl-5">
                        <li>If payer's QR code is split:
                            <ul className="list-disc pl-5">
                                <li>Scan first chunk QR code</li>
                                <li>Wait for remaining chunks</li>
                                <li>Scan all chunks in order</li>
                            </ul>
                        </li>
                        <li>If single QR code:
                            <ul className="list-disc pl-5">
                                <li>Scan single QR code</li>
                            </ul>
                        </li>
                    </ul>
                  </li>
                  <li>Send Answer:
                    <ul className="list-disc pl-5">
                        <li>System generates answer QR code</li>
                        <li>If split into chunks:
                            <ul className="list-disc pl-5">
                                <li>Show first answer QR code</li>
                                <li>Wait for payer to scan first QR code</li>
                            </ul>
                        </li>
                        <li>If single QR code:
                            <ul className="list-disc pl-5">
                                <li>Show single answer QR code</li>
                                <li>Wait for payer to scan QR code</li>
                            </ul>
                        </li>
                    </ul>
                  </li>
                  <li>Completion:
                    <ul className="list-disc pl-5">
                        <li>Wait for payment to be processed</li>
                        <li>Your offline balance updates automatically</li>
                    </ul>
                  </li>
                </ol>
              </p>
            </div>
          </div>
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default OfflinePage;