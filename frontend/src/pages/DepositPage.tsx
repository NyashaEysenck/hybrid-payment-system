
import { useState } from "react";
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import GreenButton from "@/components/GreenButton";
import BalanceDisplay from "@/components/BalanceDisplay";
import { useWallet } from "@/contexts/WalletContext";
import { 
  CreditCard, 
  Building, 
  DollarSign, 
  ChevronRight,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const DepositPage = () => {
  const navigate = useNavigate();
  const { balance, addFunds } = useWallet();
  const [amount, setAmount] = useState<number>(0);
  const [step, setStep] = useState<"form" | "success">("form");
  const [depositMethod, setDepositMethod] = useState<"card" | "bank">("card");
  
  // Mock card/bank details
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");

  const handleDeposit = () => {
    // Process the deposit
    addFunds(amount);
    setStep("success");
  };

  const resetForm = () => {
    setAmount(0);
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setAccountNumber("");
    setRoutingNumber("");
    setStep("form");
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-dark">Deposit Funds</h1>
        
        {step === "form" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Balance Card */}
              <WhiteCard className="p-6 md:col-span-1">
                <h2 className="text-lg font-semibold text-dark mb-4">Current Balance</h2>
                <BalanceDisplay 
                  amount={balance} 
                  label="Total Balance" 
                  size="lg" 
                  type="primary" 
                />
              </WhiteCard>

              {/* Deposit Form */}
              <WhiteCard className="p-6 md:col-span-2">
                <h2 className="text-lg font-semibold text-dark mb-6">Add Money</h2>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="deposit-amount">Amount to Deposit</Label>
                    <div className="relative">
                      <Input
                        id="deposit-amount"
                        type="number"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="pl-10"
                        min={1}
                      />
                      <DollarSign size={18} className="absolute left-3 top-2.5 text-dark-lighter" />
                    </div>
                  </div>
                  
                  <Tabs 
                    defaultValue="card" 
                    onValueChange={(value) => setDepositMethod(value as "card" | "bank")}
                  >
                    <TabsList className="grid grid-cols-2 mb-6">
                      <TabsTrigger value="card" className="flex items-center gap-2">
                        <CreditCard size={16} />
                        Credit/Debit Card
                      </TabsTrigger>
                      <TabsTrigger value="bank" className="flex items-center gap-2">
                        <Building size={16} />
                        Bank Account
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="card">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="card-number">Card Number</Label>
                          <Input
                            id="card-number"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            placeholder="1234 5678 9012 3456"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="card-expiry">Expiry Date</Label>
                            <Input
                              id="card-expiry"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="card-cvc">CVC</Label>
                            <Input
                              id="card-cvc"
                              value={cardCvc}
                              onChange={(e) => setCardCvc(e.target.value)}
                              placeholder="123"
                            />
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="bank">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="account-number">Account Number</Label>
                          <Input
                            id="account-number"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="12345678"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="routing-number">Routing Number</Label>
                          <Input
                            id="routing-number"
                            value={routingNumber}
                            onChange={(e) => setRoutingNumber(e.target.value)}
                            placeholder="123456789"
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </WhiteCard>
            </div>

            {/* Security Notice */}
            <WhiteCard className="p-6 bg-gray-50 border-none">
              <div className="flex items-start">
                <AlertCircle size={24} className="text-dark-lighter mr-4 mt-1" />
                <div>
                  <h3 className="font-semibold text-dark">Secure Transactions</h3>
                  <p className="text-dark-lighter text-sm mt-1">
                    All your financial information is encrypted and securely processed. 
                    We never store your complete card details on our servers.
                  </p>
                </div>
              </div>
            </WhiteCard>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Cancel
              </Button>
              <GreenButton 
                onClick={handleDeposit}
                disabled={amount <= 0 || 
                  (depositMethod === "card" && (!cardNumber || !cardExpiry || !cardCvc)) || 
                  (depositMethod === "bank" && (!accountNumber || !routingNumber))}
              >
                Deposit ${amount > 0 ? amount.toFixed(2) : "0.00"}
              </GreenButton>
            </div>
          </>
        ) : (
          <WhiteCard className="p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-greenleaf-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} className="text-greenleaf-600" />
            </div>
            <h2 className="text-xl font-semibold text-dark mb-2">Deposit Successful!</h2>
            <p className="text-dark-lighter mb-6">
              You have successfully deposited ${amount.toFixed(2)} into your account.
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-6 mx-auto max-w-xs">
              <div className="flex justify-between mb-2">
                <span className="text-dark-lighter">Amount</span>
                <span className="font-semibold text-dark">${amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-dark-lighter">Method</span>
                <span className="text-dark">
                  {depositMethod === "card" ? "Credit/Debit Card" : "Bank Account"}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-dark-lighter">New Balance</span>
                <span className="font-semibold text-greenleaf-600">${(balance).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={resetForm}>
                Make Another Deposit
              </Button>
              <GreenButton onClick={() => navigate("/dashboard")}>
                Back to Dashboard
              </GreenButton>
            </div>
          </WhiteCard>
        )}

        {/* Recent Deposits */}
        <WhiteCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark">Recent Deposits</h2>
            <button 
              className="text-greenleaf-600 hover:text-greenleaf-700 font-medium text-sm flex items-center"
            >
              View All 
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="text-center py-8 text-dark-lighter">
            <DollarSign size={24} className="mx-auto mb-2 text-dark-lighter opacity-50" />
            No recent deposits
          </div>
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default DepositPage;
