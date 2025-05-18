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
  History, // Import History icon
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";
import { storageService } from '@/services/storageService'; // Import storageService
import { Transaction } from '@/types'; // Import Transaction interface

const OfflinePage = () => {
  const { balance, fetchWalletData } = useWallet();
  const { offlineBalance, pendingTransactions, refreshOfflineBalance, isOffline } = useOfflineBalance();
  // Removed transferAmount state
  // const [transferAmount, setTransferAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [offlineTransactions, setOfflineTransactions] = useState<Transaction[]>([]); // State to store transactions
  const navigate = useNavigate();

  // Calculate available balance with precision
  const onlineBalance = isOffline ? "N/A" : Number(balance);
  // Removed maxTransfer calculations as transfer section is removed
  // const maxTransferToOffline = isOffline ? 0 : Math.min(500, Number(onlineBalance) > 0 ? Math.floor(Number(onlineBalance) * 100) / 100 : 0);
  // const maxTransferToOnline = Math.min(500, offlineBalance > 0 ? Math.floor(offlineBalance * 100) / 100 : 0);

  // Removed useEffect for updating transfer amount

  // Function to reset IndexedDB databases - Kept in case needed elsewhere or for future feature
  const resetDatabases = useCallback(async () => {
    setIsProcessing(true);
    try {
      console.log('Resetting IndexedDB databases...');

      // Delete the database - using the consistent database name
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

      // Reload the page to reinitialize everything
      window.location.reload();
    } catch (error) {
      console.error('Error resetting databases:', error);
      setIsProcessing(false);
    }
  }, []);

  // Load balances and transactions when component mounts
  useEffect(() => {
    const loadData = async () => {
      setIsProcessing(true);
      try {
        console.log('Loading data on OfflinePage...');

        // Refresh wallet data to get latest online balance
        await fetchWalletData();

        // Refresh offline balance
        await refreshOfflineBalance();

        // Load offline transactions
        const transactions = await storageService.getTransactions(); // Fetch transactions
        setOfflineTransactions(transactions); // Set transactions state

        console.log('Data loaded successfully');
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    loadData();
  }, [fetchWalletData, refreshOfflineBalance]);

  // Removed handleTransferToOffline and handleTransferToOnline functions


  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Offline Wallet</h1>

        <div className="grid grid-cols-1"> {/* Changed grid to 1 column */}
          {/* Balance Summary */}
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
                  You have {pendingTransactions} pending offline {pendingTransactions === 1 ? 'transaction' : 'transactions'} to be synced
                </div>
              )}
            </div>
          </WhiteCard>

          {/* Removed Balance Transfer section */}
          {/*
          <WhiteCard className="p-6">
            <h2 className="text-xl font-semibold text-dark mb-4">Balance Transfer</h2>
            <p className="text-dark-lighter text-sm mb-6">
              Transfer funds between your online and offline balances.
            </p>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-dark">Amount to Transfer</Label>
                <Slider
                  value={[transferAmount]}
                  min={0}
                  max={Math.min(500, Number(maxTransferToOffline), Number(maxTransferToOnline))} // Use the minimum of both max transfers
                  step={Math.min(500, Number(maxTransferToOffline), Number(maxTransferToOnline)) > 50 ? 5 : 1} // Smaller step for smaller balances
                  onValueChange={(value) => {
                    // Round to 2 decimal places
                    const roundedValue = Math.floor(value[0] * 100) / 100;
                    setTransferAmount(roundedValue);
                  }}
                  className="py-4"
                />
                <div className="flex justify-between text-sm text-dark-lighter">
                  <span>$0</span>
                  <span>${typeof transferAmount === 'number' ? transferAmount.toFixed(2) : '0.00'}</span>
                  <span>${Math.min(500, Number(maxTransferToOffline), Number(maxTransferToOnline)).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <GreenButton
                  onClick={handleTransferToOffline}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={typeof onlineBalance === 'string' || Number(onlineBalance) < transferAmount || isProcessing || transferAmount === 0 || transferAmount > maxTransferToOffline}
                >
                  <Smartphone size={16} />
                  To Offline
                </GreenButton>
                <GreenButton
                  onClick={handleTransferToOnline}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={offlineBalance < transferAmount || isProcessing || transferAmount === 0 || transferAmount > maxTransferToOnline}
                  variant="outline"
                >
                  <Wallet size={16} />
                  To Online
                </GreenButton>
              </div>
            </div>
          </WhiteCard>
          */}
        </div>

        {/* WebRTC P2P Money Transfer */}
        <WhiteCard className="p-6">
          <h2 className="text-xl font-semibold text-dark mb-6">WebRTC P2P Money Transfer</h2>
          <div className="space-y-4">
            <button
              onClick={() => navigate("/webrtc-send-money")}
              className="group p-6 rounded-lg border border-gray-200 hover:border-greenleaf-300 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-greenleaf-100 flex items-center justify-center group-hover:bg-greenleaf-200 transition-colors">
                  <Send size={24} className="text-greenleaf-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark">Send Money</h3>
                  <p className="text-sm text-dark-lighter">
                    Send money offline using WebRTC peer-to-peer connection
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate("/webrtc-receive-money")}
              className="group p-6 rounded-lg border border-gray-200 hover:border-greenleaf-300 transition-colors text-left w-full"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-greenleaf-100 flex items-center justify-center group-hover:bg-greenleaf-200 transition-colors">
                  <Wallet size={24} className="text-greenleaf-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark">Receive Money</h3>
                  <p className="text-sm text-dark-lighter">
                    Receive money offline using WebRTC peer-to-peer connection
                  </p>
                </div>
              </div>
            </button>
          </div>
        </WhiteCard>

        {/* Offline Transaction History Section */}
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
                                {/* Display sender/recipient based on transaction type */}
                                <div className="text-sm text-gray-500 mt-1">
                                    {tx.type === 'send' ? `To: ${tx.recipient}` : `From: ${tx.sender}`}
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


        {/* Educational Section */}
        <WhiteCard className="p-6 bg-greenleaf-50 border-none">
          <div className="flex items-start">
            <div className="mr-4 mt-1">
              <CreditCard size={24} className="text-greenleaf-600" />
            </div>
            <div>
              <h3 className="font-semibold text-dark">How WebRTC P2P Payments Work</h3>
              <p className="text-dark-lighter text-sm mt-1">
                When you reserve tokens, you're setting aside funds specifically for offline use.
                These tokens are cryptographically signed and can be transferred via WebRTC
                even without an internet connection. Once you're back online,
                the transactions will automatically sync with our servers.
              </p>
              <h4 className="font-semibold text-dark mt-3">Secure Peer-to-Peer Transactions</h4>
              <p className="text-dark-lighter text-sm mt-1">
                Our WebRTC-based system allows two devices to transact completely offline:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Device A (Sender) creates a connection offer and displays it as a QR code</li>
                  <li>Device B (Receiver) scans the QR code and creates an answer QR code</li>
                  <li>Device A scans the answer QR code to establish a secure WebRTC connection</li>
                  <li>Money is transferred directly between devices via the WebRTC data channel</li>
                  <li>Both devices update their local balances and store transaction records</li>
                </ul>
              </p>
            </div>
          </div>
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default OfflinePage;
