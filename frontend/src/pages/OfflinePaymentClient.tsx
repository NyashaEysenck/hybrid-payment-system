import React, { useState, useEffect } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext';
import { useNavigate } from 'react-router-dom';
import { useIndexedDB, Transaction } from '../hooks/useIndexedDB';
import QRScanner from '@/components/QRScanner';
import { QrCode, ArrowLeft, Send, RefreshCw, CheckCircle, Smartphone, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import GreenButton from "@/components/GreenButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { checkOnlineStatus } from '@/utils/connectivity';

const OfflinePaymentClient: React.FC = () => {
  const { user } = useAuth();
  const { updateOfflineBalance, refreshOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState<'scan' | 'confirm' | 'success'>('scan');
  const [amount, setAmount] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [checkingOnlineStatus, setCheckingOnlineStatus] = useState(false);
  
  const { addItem, error: dbError } = useIndexedDB({
    dbName: 'offlinePayments',
    storeName: 'transactions',
  });

  // Check online status
  const checkConnectionStatus = async () => {
    setCheckingOnlineStatus(true);
    try {
      const online = await checkOnlineStatus();
      setIsOnline(online);
      console.log('Connection status:', online ? 'Online' : 'Offline');
    } catch (err) {
      console.error('Error checking connection status:', err);
      setIsOnline(false);
    } finally {
      setCheckingOnlineStatus(false);
    }
  };

  useEffect(() => {
    // Check online status on mount
    checkConnectionStatus();
    
    // Set up interval to check status
    const interval = setInterval(checkConnectionStatus, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Only redirect if not in offline mode
    if (!user && isOnline) {
      navigate('/login');
    }
  }, [user, navigate, isOnline]);

  const handleQrCodeScanned = (data: string) => {
    try {
      // Validate URL format
      const url = new URL(data);
      // Accept both HTTP and HTTPS protocols, but prefer HTTPS
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Invalid URL protocol');
      }
      
      // Ensure we're using HTTPS for secure connections
      const secureUrl = data.replace('http://', 'https://');
      setServerUrl(secureUrl);
      setScanning(false);
      setStep('confirm');
      setError(null);
      
      toast({
        title: "Server Connected",
        description: "Successfully connected to payment server.",
        duration: 3000,
      });
    } catch (err) {
      console.error('Invalid QR code data:', err);
      setError('Invalid QR code. Please scan a valid payment server QR code.');
      toast({
        variant: "destructive",
        title: "Invalid QR Code",
        description: "The scanned QR code is not a valid payment server URL.",
        duration: 5000,
      });
    }
  };

  const stopScanning = () => {
    setScanning(false);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+(\.\d{0,2})?$/.test(value)) {
      setAmount(value === '' ? '' : parseFloat(value));
    }
  };

  const handleSubmitPayment = async () => {
    if (!serverUrl || amount === '' || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Get the server user's email from the QR code URL
      // In a real app, this would be more secure, but for demo purposes
      // we'll extract it from the URL or use a default
      const urlObj = new URL(serverUrl);
      const serverUserEmail = urlObj.searchParams.get('user') || 'server-user';
      
      const paymentData = {
        sender: user?.email || 'anonymous-user',
        recipient: serverUserEmail, 
        amount: amount,
        note: note,
        timestamp: Date.now(),
        type: 'offline',
      };
      
      console.log('Submitting payment data:', paymentData);
      
      // Generate a unique transaction ID
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Generate a unique receipt ID
      const receiptId = `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Create a transaction object
      const transaction: Transaction = {
        id: transactionId,
        sender: paymentData.sender,
        recipient: paymentData.recipient,
        amount: paymentData.amount as number,
        note: paymentData.note,
        timestamp: paymentData.timestamp,
        receiptId: receiptId,
        status: 'completed',
        type: 'offline',
      };
      
      // Save transaction to local IndexedDB
      await addItem<Transaction>(transaction);
      console.log('Transaction saved to IndexedDB:', transaction);
      
      // Update offline balance
      updateOfflineBalance(-parseFloat(amount.toString()));
      await refreshOfflineBalance();
      
      // Try to send to the server
      let serverResponse = null;
      
      try {
        // Try the new API endpoint first
        const response = await fetch(`${serverUrl}/api/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            ...paymentData,
            id: transactionId,
            receiptId: receiptId,
            status: 'completed',
          }),
        });
        
        if (!response.ok) {
          // If the new endpoint fails, try the legacy endpoint
          const legacyResponse = await fetch(`${serverUrl}/api/transactions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              ...paymentData,
              id: transactionId,
              receiptId: receiptId,
              status: 'completed',
            }),
          });
          
          if (!legacyResponse.ok) {
            throw new Error(`Server responded with status: ${legacyResponse.status}`);
          }
          
          const data = await legacyResponse.json();
          console.log('Payment successful (legacy API):', data);
          serverResponse = data;
        } else {
          const data = await response.json();
          console.log('Payment successful:', data);
          serverResponse = data;
        }
      } catch (serverError) {
        console.error('Error sending to server, but transaction saved locally:', serverError);
        // We don't throw here because we've already saved to IndexedDB
        toast({
          variant: "default",
          title: "Offline Transaction",
          description: "Transaction saved locally but couldn't reach the server.",
          duration: 5000,
        });
      }
      
      // Set receipt and move to success step
      setReceipt(transaction);
      setStep('success');
      
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully.",
        duration: 3000,
      });
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to process payment. Please try again.');
      
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "There was an error processing your payment.",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetPayment = () => {
    setStep('scan');
    setServerUrl(null);
    setAmount('');
    setNote('');
    setReceipt(null);
    setError(null);
  };

  return (
    <Layout>
      <WhiteCard>
        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-6">Offline Payment</h1>
          
          <div className="mb-4 flex items-center">
            <div className={`flex items-center ${isOnline ? 'text-green-600' : 'text-amber-600'} gap-2`}>
              {isOnline ? (
                <>
                  <Wifi className="h-5 w-5" />
                  <span className="font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5" />
                  <span className="font-medium">Offline</span>
                </>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkConnectionStatus}
              disabled={checkingOnlineStatus}
              className="ml-2"
            >
              {checkingOnlineStatus ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {step === 'scan' && (
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {!scanning ? (
                <div className="text-center py-8">
                  <QrCode className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Scan a payment server QR code</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Connect to another device to make an offline payment
                  </p>
                  <GreenButton 
                    onClick={() => setScanning(true)}
                    className="mt-6"
                  >
                    Scan QR Code
                  </GreenButton>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-square w-full max-w-md mx-auto border rounded-lg overflow-hidden">
                    <QRScanner
                      onScan={handleQrCodeScanned}
                      onError={(err) => {
                        console.error('QR Scanner error:', err);
                        setError('Failed to access camera. Please check permissions.');
                      }}
                      onCancel={stopScanning}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={stopScanning}
                    className="w-full"
                  >
                    Cancel Scanning
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {step === 'confirm' && (
            <div className="space-y-6">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setStep('scan')}
                    className="mb-4 -ml-2 text-gray-500"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                  
                  <h2 className="text-xl font-semibold mb-2">Make Payment</h2>
                  <p className="text-gray-500 text-sm">
                    Connected to: <span className="font-medium">{serverUrl}</span>
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($)</Label>
                    <Input
                      id="amount"
                      type="text"
                      value={amount === '' ? '' : amount.toString()}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      className="text-lg"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="note">Note (Optional)</Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What's this payment for?"
                      className="resize-none"
                    />
                  </div>
                </div>
                
                <GreenButton 
                  onClick={handleSubmitPayment}
                  disabled={loading || amount === '' || Number(amount) <= 0}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Payment
                    </>
                  )}
                </GreenButton>
              </div>
            </div>
          )}
          
          {step === 'success' && receipt && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Payment Successful!</h2>
                <p className="text-gray-500 mt-1">
                  Your payment has been processed
                </p>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Payment Receipt</CardTitle>
                  <CardDescription>
                    Transaction ID: {receipt.id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold">${receipt.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recipient</span>
                    <span>{receipt.recipient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{new Date(receipt.timestamp).toLocaleString()}</span>
                  </div>
                  {receipt.note && (
                    <div>
                      <span className="text-gray-500 block mb-1">Note</span>
                      <p className="bg-gray-50 p-2 rounded text-sm">{receipt.note}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">Receipt ID</span>
                    <p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                      {receipt.receiptId}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <GreenButton 
                    onClick={resetPayment}
                    className="w-full"
                  >
                    Done
                  </GreenButton>
                </CardFooter>
              </Card>
            </div>
          )}
        </div>
      </WhiteCard>
    </Layout>
  );
};

export default OfflinePaymentClient;
