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
  ArrowLeftRight
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useNavigate } from "react-router-dom";

const OfflinePage = () => {
  const { balance, fetchWalletData } = useWallet();
  const { offlineBalance, pendingTransactions, refreshOfflineBalance } = useOfflineBalance();
  const [transferAmount, setTransferAmount] = useState(20);
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  // Calculate available balance with precision
  const onlineBalance = balance;
  const maxTransferToOffline = Math.min(500, onlineBalance > 0 ? Math.floor(onlineBalance * 100) / 100 : 0);
  const maxTransferToOnline = Math.min(500, offlineBalance > 0 ? Math.floor(offlineBalance * 100) / 100 : 0);

  // Update transfer amount when balances change
  useEffect(() => {
    // Ensure transfer amount is within valid range and has correct precision
    const newAmount = Math.min(
      Math.max(0, transferAmount), // Ensure non-negative
      Math.min(maxTransferToOffline, maxTransferToOnline) // Use the smaller of the two max values
    );
    
    // Round to 2 decimal places
    const roundedAmount = Math.floor(newAmount * 100) / 100;
    
    if (roundedAmount !== transferAmount) {
      console.log(`Adjusting transfer amount from ${transferAmount} to ${roundedAmount} based on available balance`);
      setTransferAmount(roundedAmount);
    }
  }, [onlineBalance, offlineBalance, transferAmount]);

  // Function to reset IndexedDB databases
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

  // Load balances when component mounts
  useEffect(() => {
    const loadBalances = async () => {
      setIsProcessing(true);
      try {
        console.log('Loading balances on OfflinePage...');
        
        // Refresh wallet data to get latest online balance
        await fetchWalletData();
        
        // Refresh offline balance
        await refreshOfflineBalance();
        
        console.log('Balances loaded successfully - Online:', onlineBalance, 'Offline:', offlineBalance);
      } catch (error) {
        console.error('Error loading balances:', error);
      } finally {
        setIsProcessing(false);
      }
    };
    
    loadBalances();
  }, [fetchWalletData, refreshOfflineBalance]);

  // Handle transferring money from online to offline balance
  const handleTransferToOffline = async () => {
    if (transferAmount <= 0 || transferAmount > onlineBalance) {
      console.error('Invalid transfer amount:', transferAmount);
      return;
    }
    
    try {
      setIsProcessing(true);
      console.log(`Transferring ${transferAmount} from online to offline balance...`);
      
      // Use the transferToOffline function from WalletService
      await transferToOffline(transferAmount);
      
      // Update the wallet context state to get the new online balance
      await fetchWalletData();
      
      // Force a refresh of the offline balance from the context
      await refreshOfflineBalance();
      
      console.log('Transfer to offline completed successfully');
      setTransferAmount(Math.min(20, onlineBalance - transferAmount));
    } catch (error) {
      console.error('Error transferring to offline:', error);
      // Refresh balances in case of error to ensure UI is consistent
      await fetchWalletData();
      await refreshOfflineBalance();
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle transferring money from offline to online balance
  const handleTransferToOnline = async () => {
    if (transferAmount <= 0 || transferAmount > offlineBalance) {
      console.error('Invalid transfer amount:', transferAmount);
      return;
    }
    
    try {
      setIsProcessing(true);
      console.log(`Transferring ${transferAmount} from offline to online balance...`);
      
      // Use the transferToOnline function from WalletService
      await transferToOnline(transferAmount);
      
      // Update the wallet context state to get the new online balance
      await fetchWalletData();
      
      // Force a refresh of the offline balance from the context
      await refreshOfflineBalance();
      
      console.log('Transfer to online completed successfully');
      setTransferAmount(Math.min(20, offlineBalance - transferAmount));
    } catch (error) {
      console.error('Error transferring to online:', error);
      // Refresh balances in case of error to ensure UI is consistent
      await fetchWalletData();
      await refreshOfflineBalance();
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSliderValue = (value: number[]) => {
    return `$${value[0].toFixed(2)}`;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Offline Transactions</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                amount={offlineBalance} 
                label="Offline Balance" 
                type="secondary" 
              />
              {pendingTransactions > 0 && (
                <div className="text-sm text-amber-600 mt-2">
                  You have {pendingTransactions} pending offline {pendingTransactions === 1 ? 'transaction' : 'transactions'} to be synced
                </div>
              )}
            </div>
          </WhiteCard>

          {/* Balance Transfer */}
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
                  max={Math.min(500, maxTransferToOffline, maxTransferToOnline)}
                  step={maxTransferToOffline > 50 ? 5 : 1} // Smaller step for smaller balances
                  onValueChange={(value) => {
                    // Round to 2 decimal places
                    const roundedValue = Math.floor(value[0] * 100) / 100;
                    setTransferAmount(roundedValue);
                  }}
                  className="py-4"
                />
                <div className="flex justify-between text-sm text-dark-lighter">
                  <span>$0</span>
                  <span>${transferAmount.toFixed(2)}</span>
                  <span>${Math.min(500, maxTransferToOffline, maxTransferToOnline).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <GreenButton 
                  onClick={handleTransferToOffline}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={onlineBalance < transferAmount || isProcessing}
                >
                  <Smartphone size={16} />
                  To Offline
                </GreenButton>
                <GreenButton 
                  onClick={handleTransferToOnline}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={offlineBalance < transferAmount || isProcessing}
                  variant="outline"
                >
                  <Wallet size={16} />
                  To Online
                </GreenButton>
              </div>
            </div>
          </WhiteCard>
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
              className="group p-6 rounded-lg border border-gray-200 hover:border-greenleaf-300 transition-colors text-left"
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

            <button 
              onClick={() => navigate("/offline-transactions")}
              className="group p-6 rounded-lg border border-gray-200 hover:border-greenleaf-300 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-greenleaf-100 flex items-center justify-center group-hover:bg-greenleaf-200 transition-colors">
                  <ArrowLeftRight size={24} className="text-greenleaf-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark">Transaction History</h3>
                  <p className="text-sm text-dark-lighter">
                    View your offline transaction history
                  </p>
                </div>
              </div>
            </button>
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