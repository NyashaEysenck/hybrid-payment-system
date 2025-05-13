import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, DollarSign, ArrowDown, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GreenButton from "@/components/GreenButton";
import { useWallet } from "@/contexts/WalletContext";

const WithdrawalPage = () => {
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { balance } = useWallet();
  const { toast } = useToast();

  const mockWithdrawalHistory = [
    {
      id: "w1",
      date: new Date(Date.now() - 86400000 * 10),
      amount: 150,
      account: "•••• 4321",
      status: "completed",
    },
    {
      id: "w2",
      date: new Date(Date.now() - 86400000 * 5),
      amount: 250,
      account: "•••• 8765",
      status: "completed",
    },
    {
      id: "w3",
      date: new Date(Date.now() - 86400000),
      amount: 100,
      account: "•••• 4321",
      status: "pending",
    }
  ];

  const handleMaxAmount = () => {
    setAmount(balance.toString());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to withdraw.",
        variant: "destructive",
      });
      return;
    }

    if (!account) {
      toast({
        title: "Select Account",
        description: "Please select a bank account for withdrawal.",
        variant: "destructive",
      });
      return;
    }

    if (parseFloat(amount) > balance) {
      toast({
        title: "Insufficient Balance",
        description: "You don't have enough funds to withdraw this amount.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      toast({
        title: "Withdrawal Initiated",
        description: `$${parseFloat(amount).toFixed(2)} will be transferred to your account within 1-3 business days.`,
      });
      setAmount("");
    }, 1500);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Withdraw Funds</h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left column - Withdrawal Form */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Current Balance</h2>
                <div className="text-2xl font-bold text-nexapay-600">${balance.toFixed(2)}</div>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="account">Bank Account</Label>
                  <Select value={account} onValueChange={setAccount}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account1">Chase Bank •••• 4321</SelectItem>
                      <SelectItem value="account2">Bank of America •••• 8765</SelectItem>
                      <SelectItem value="account3">Wells Fargo •••• 9999</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Button 
                      type="button" 
                      onClick={handleMaxAmount}
                      variant="ghost" 
                      size="sm" 
                      className="h-auto py-1 px-2 text-xs text-nexapay-600"
                    >
                      Max
                    </Button>
                  </div>
                  <Input
                    id="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <GreenButton 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Confirm Withdrawal"}
                </GreenButton>
                
                <p className="text-xs text-gray-500 mt-4">
                  A 1% processing fee may apply. Funds typically arrive in 1-3 business days.
                </p>
              </form>
            </div>
          </div>
          
          {/* Right column - Recent Withdrawals */}
          <div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Withdrawals</h2>
              
              {mockWithdrawalHistory.length > 0 ? (
                <div className="space-y-4">
                  {mockWithdrawalHistory.map((withdrawal) => (
                    <div 
                      key={withdrawal.id} 
                      className="flex items-center justify-between p-3 border-b last:border-0"
                    >
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                          <ArrowDown size={18} className="text-red-500" />
                        </div>
                        <div>
                          <div className="font-medium text-dark">
                            Withdrawal to {withdrawal.account}
                          </div>
                          <div className="text-xs text-dark-lighter">
                            {withdrawal.date.toLocaleDateString()} 
                            <span className="mx-1.5">•</span>
                            <span className="flex items-center">
                              {withdrawal.status === "completed" ? (
                                <span className="text-nexapay-600 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-nexapay-500 rounded-full mr-1"></span>
                                  Completed
                                </span>
                              ) : (
                                <span className="text-amber-500 flex items-center">
                                  <Clock size={12} className="mr-1" />
                                  Pending
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-red-600">
                        -${withdrawal.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No recent withdrawals
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default WithdrawalPage;
