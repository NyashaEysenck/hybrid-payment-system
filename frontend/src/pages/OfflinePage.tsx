import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import BalanceDisplay from "@/components/BalanceDisplay";
import GreenButton from "@/components/GreenButton";
import { useWallet } from "@/contexts/WalletContext";
import { useOfflineBalance } from "@/contexts/OfflineBalanceContext";
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
  const { balance, reservedBalance, reserveTokens, releaseTokens } = useWallet();
  const { offlineBalance, pendingTransactions, refreshOfflineBalance } = useOfflineBalance();
  const [reserveAmount, setReserveAmount] = useState(20);
  const navigate = useNavigate();

  // Calculate available balance
  const availableBalance = balance;
  const maxReserveAmount = availableBalance > 0 ? availableBalance : 0;

  // Refresh offline balance when component mounts
  useEffect(() => {
    refreshOfflineBalance();
  }, [refreshOfflineBalance]);

  const handleReserveTokens = () => {
    reserveTokens(reserveAmount);
    setReserveAmount(Math.min(20, maxReserveAmount - reserveAmount));
  };

  const handleReleaseTokens = () => {
    releaseTokens(reserveAmount);
    setReserveAmount(Math.min(20, maxReserveAmount + reserveAmount));
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
                amount={availableBalance} 
                label="Available Online" 
                type="primary" 
              />
              <BalanceDisplay 
                amount={reservedBalance} 
                label="Reserved for Offline" 
                type="reserved" 
              />
              <BalanceDisplay 
                amount={offlineBalance} 
                label="Current Offline Balance" 
                type="secondary" 
              />
              {pendingTransactions > 0 && (
                <div className="text-sm text-amber-600 mt-2">
                  You have {pendingTransactions} pending offline {pendingTransactions === 1 ? 'transaction' : 'transactions'} to be synced
                </div>
              )}
            </div>
          </WhiteCard>

          {/* Token Management */}
          <WhiteCard className="p-6">
            <h2 className="text-xl font-semibold text-dark mb-4">Token Management</h2>
            <p className="text-dark-lighter text-sm mb-6">
              Reserve funds for offline payments when you don't have internet access.
            </p>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-dark">Amount to Reserve/Release</Label>
                <Slider
                  value={[reserveAmount]}
                  max={Math.max(500, maxReserveAmount, reservedBalance)}
                  step={5}
                  onValueChange={(value) => setReserveAmount(value[0])}
                  className="py-4"
                />
                <div className="flex justify-between text-sm text-dark-lighter">
                  <span>$0</span>
                  <span>${reserveAmount.toFixed(2)}</span>
                  <span>$500</span>
                </div>
              </div>

              <div className="flex gap-3">
                <GreenButton 
                  onClick={handleReserveTokens}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={availableBalance <= 0 || reserveAmount <= 0}
                >
                  <Lock size={16} />
                  Reserve Tokens
                </GreenButton>
                <GreenButton 
                  variant="secondary"
                  onClick={handleReleaseTokens}
                  className="flex-1 flex items-center justify-center gap-1"
                  disabled={reservedBalance <= 0 || reserveAmount <= 0}
                >
                  <Unlock size={16} />
                  Release Tokens
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