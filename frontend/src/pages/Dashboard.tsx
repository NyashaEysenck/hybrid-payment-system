import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import BalanceDisplay from "@/components/BalanceDisplay";
import TransactionItem from "@/components/TransactionItem";
import GreenButton from "@/components/GreenButton";
import { useWallet } from "@/contexts/WalletContext";
import { useOfflineBalance } from "@/contexts/OfflineBalanceContext";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus,
  ChevronRight,
  WifiOff
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const { balance, transactions, fetchWalletData } = useWallet();
  const { offlineBalance, pendingTransactions, refreshOfflineBalance } = useOfflineBalance();

  // Refresh balances when component mounts
  useEffect(() => {
    refreshOfflineBalance();
    fetchWalletData();
  }, [refreshOfflineBalance, fetchWalletData]);

  // Total balance is the sum of online and offline balances
  const totalBalance = balance + offlineBalance;
  
  // Get recent transactions (last 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .map(tx => ({
        ...tx,
        created_at: new Date(tx.created_at), // ✅ Ensure it's a Date
      }))
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, 5);
  }, [transactions]);
  

  return (
    <Layout>
      <div className="space-y-6">
        {/* Balance Summary */}
        <WhiteCard className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-dark mb-6">Balance Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BalanceDisplay 
                amount={totalBalance}
                label="Total Balance" 
                size="lg" 
                type="primary" 
              />
              <BalanceDisplay 
                amount={balance}
                label="Online Balance" 
                size="md" 
                type="secondary" 
              />
              <BalanceDisplay 
                amount={offlineBalance} 
                label="Offline Balance" 
                size="md" 
                type="secondary" 
              />
            </div>
          </div>

          {/* Transfer Options */}
          <div className="mb-6 border-t pt-6">
            <h3 className="font-medium text-dark-light mb-3 flex items-center gap-2">
              <ArrowDownLeft size={18} />
              Balance Transfer
              {pendingTransactions > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                  {pendingTransactions} pending
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4">
                <GreenButton 
                  onClick={() => navigate('/offline')}
                  className="flex items-center gap-2"
                >
                  <ArrowDownLeft size={16} />
                  Transfer Funds
                </GreenButton>
              </div>
              <div className="flex items-center">
                <p className="text-sm text-gray-500">
                  Transfer funds between your online and offline balances. Offline balance can be used for peer-to-peer payments when you don't have internet access.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="font-medium text-dark-light mb-3">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-3">
              <GreenButton 
                onClick={() => navigate("/send")} 
                className="flex items-center justify-center gap-2"
              >
                <ArrowUpRight size={18} />
                Send Money
              </GreenButton>
              <GreenButton 
                variant="secondary" 
                onClick={() => navigate("/request")}
                className="flex items-center justify-center gap-2"
              >
                <ArrowDownLeft size={18} />
                Request Money
              </GreenButton>
              <GreenButton 
                onClick={() => navigate("/deposit")}
                className="flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Deposit
              </GreenButton>
            </div>
          </div>
        </WhiteCard>

        {/* Recent Activity */}
        <WhiteCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-dark">Recent Activity</h2>
            <button 
              className="text-greenleaf-600 hover:text-greenleaf-700 font-medium text-sm flex items-center"
              onClick={() => navigate("/transactions")}
            >
              View All 
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="space-y-3">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((transaction) => (
                <TransactionItem 
                  key={transaction.transaction_id} 
                  transaction={{
                    ...transaction,
                    currentUserId: "user123" // You need to pass the current user's ID here
                  }}
                />
              ))
            ) : (
              <div className="text-center py-8 text-dark-lighter">
                No recent transactions
              </div>
            )}
          </div>
        </WhiteCard>

        {/* Offline Payment Section */}
        <WhiteCard className="p-6 border-l-4 border-l-greenleaf-500">
          <h2 className="text-xl font-semibold text-dark mb-4">Offline Payments</h2>
          <p className="text-dark-lighter mb-4">
            Reserve funds for offline use and make payments even without an internet connection.
          </p>
          <GreenButton 
            onClick={() => navigate("/offline")}
            className="flex items-center"
          >
            Manage Offline Payments
          </GreenButton>
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default Dashboard;
