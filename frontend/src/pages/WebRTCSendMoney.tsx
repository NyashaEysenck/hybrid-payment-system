import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext';
import { useNavigate } from 'react-router-dom';
import { useIndexedDB } from '@/hooks/useIndexedDB';
import QRCode from 'react-qr-code';
import QrScanner from '@/components/QRScanner';
import { Button } from "@/components/ui/button";
import GreenButton from "@/components/GreenButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Send, RefreshCw, CheckCircle, QrCode, ScanLine } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData } from '@/utils/qrCodeUtils';

// Steps in the send money process
type SendMoneyStep = 'input' | 'createOffer' | 'waitForAnswer' | 'sending' | 'complete';

// Transaction type
interface Transaction {
  id: string;
  type: 'send';
  amount: number;
  recipient: string;
  timestamp: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string;
}

const WebRTCSendMoney: React.FC = () => {
  const { user } = useAuth();
  const { balance } = useWallet();
  const { offlineBalance, updateOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State variables
  const [step, setStep] = useState<SendMoneyStep>('input');
  const [amount, setAmount] = useState<number | ''>('');
  const [recipientId, setRecipientId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerQrData, setOfferQrData] = useState<string | null>(null);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  
  // IndexedDB hook for storing transactions
  const { addItem } = useIndexedDB({
    dbName: 'offlinePayments',
    storeName: 'transactions',
  });

  // Initialize WebRTC service when component mounts
  useEffect(() => {
    if (user?.email) {
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
      
      return () => {
        // Clean up WebRTC connection when component unmounts
        service.closeConnection();
      };
    }
  }, [user]);

  // Check if user is logged in
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Handle amount input change
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setAmount('');
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        setAmount(numValue);
      }
    }
  };

  // Create WebRTC offer and generate QR code
  const handleCreateOffer = async () => {
    if (!webrtcService || !user?.email || amount === '' || amount <= 0) {
      setError('Invalid input or WebRTC service not initialized');
      return;
    }
    
    if (amount > offlineBalance) {
      setError(`Insufficient offline balance. Available: $${offlineBalance.toFixed(2)}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create WebRTC offer
      const offerData = await webrtcService.initiateSenderConnection();
      
      // Encode offer data for QR code
      const encodedOffer = encodeConnectionData(offerData);
      setOfferQrData(encodedOffer);
      
      // Set up message handler
      webrtcService.onMessage((message) => {
        console.log('Received message:', message);
        if (message.type === 'payment_confirmation') {
          handlePaymentConfirmation();
        }
      });
      
      // Set up connection state handler
      webrtcService.onConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          // Connection established
          toast({
            title: "Connection Established",
            description: "Connected to recipient device",
            duration: 3000,
          });
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          if (step !== 'complete') {
            setError('Connection lost. Please try again.');
            setStep('input');
          }
        }
      });
      
      // Move to next step
      setStep('createOffer');
    } catch (error) {
      console.error('Error creating offer:', error);
      setError('Failed to create connection offer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle QR code scan (answer from receiver)
  const handleQrCodeScanned = async (data: string) => {
    setShowScanner(false);
    
    if (!webrtcService) {
      setError('WebRTC service not initialized');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Decode answer data from QR code
      const answerData = decodeConnectionData(data);
      
      if (answerData.type !== 'answer') {
        throw new Error('Invalid QR code: not an answer');
      }
      
      // Complete the connection
      await webrtcService.completeSenderConnection(answerData);
      
      // Move to next step
      setStep('sending');
      
      // Send payment data
      const paymentData = {
        type: 'payment',
        amount: amount,
        senderID: user?.email || 'unknown',
        recipientID: answerData.senderID || recipientId || 'unknown',
        timestamp: Date.now(),
        note: note,
        transactionId: uuidv4()
      };
      
      // Send the payment data
      webrtcService.sendMessage(paymentData);
      
      // Create transaction record
      const newTransaction: Transaction = {
        id: paymentData.transactionId,
        type: 'send',
        amount: Number(amount),
        recipient: answerData.senderID || recipientId || 'unknown',
        timestamp: paymentData.timestamp,
        note: note,
        status: 'pending',
        receiptId: paymentData.transactionId
      };
      
      setTransaction(newTransaction);
      
      // Wait for confirmation or timeout
      setTimeout(() => {
        if (step === 'sending') {
          handlePaymentConfirmation();
        }
      }, 5000);
    } catch (error) {
      console.error('Error processing answer:', error);
      setError('Failed to establish connection. Please try again.');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirmation = async () => {
    if (!transaction || amount === '') return;
    
    try {
      // Update transaction status
      const updatedTransaction = {
        ...transaction,
        status: 'completed'
      };
      
      // Save transaction to IndexedDB
      await addItem(updatedTransaction);
      
      // Update offline balance
      await updateOfflineBalance(-Number(amount));
      
      // Move to complete step
      setTransaction(updatedTransaction);
      setStep('complete');
      
      toast({
        title: "Payment Sent",
        description: `$${Number(amount).toFixed(2)} sent successfully`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      setError('Failed to complete payment. Your balance may still be updated.');
    }
  };

  // Reset the form and go back to input step
  const resetForm = () => {
    setStep('input');
    setAmount('');
    setRecipientId('');
    setNote('');
    setError(null);
    setOfferQrData(null);
    setTransaction(null);
    
    // Close and reinitialize WebRTC connection
    if (webrtcService) {
      webrtcService.closeConnection();
    }
    
    if (user?.email) {
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/offline')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-dark">Send Money (WebRTC)</h1>
        </div>
        
        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === 'input' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Send Money Offline</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter the amount you want to send. This will create a QR code that the recipient can scan.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={amount === '' ? '' : amount.toString()}
                      onChange={handleAmountChange}
                      placeholder="0.00"
                      className="pl-8 text-lg"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Available offline balance: ${offlineBalance.toFixed(2)}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient ID (Optional)</Label>
                  <Input
                    id="recipient"
                    value={recipientId}
                    onChange={(e) => setRecipientId(e.target.value)}
                    placeholder="Enter recipient ID or name"
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
              
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <GreenButton 
                onClick={handleCreateOffer}
                disabled={loading || amount === '' || Number(amount) <= 0 || Number(amount) > offlineBalance}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating Connection...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate Payment QR
                  </>
                )}
              </GreenButton>
            </div>
          )}
          
          {step === 'createOffer' && offerQrData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Scan This QR Code</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Ask the recipient to scan this QR code with their device
                </p>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white border rounded-lg">
                  <QRCode 
                    value={offerQrData} 
                    size={200}
                    level="H"
                  />
                </div>
              </div>
              
              <p className="text-center text-sm text-gray-500">
                Amount: ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
              </p>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="flex flex-col gap-3">
                <GreenButton 
                  onClick={() => setShowScanner(true)}
                  className="w-full"
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan Recipient's QR
                </GreenButton>
                
                <Button 
                  variant="outline" 
                  onClick={resetForm}
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
              
              {showScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                    <h3 className="text-lg font-semibold mb-4">Scan Answer QR Code</h3>
                    <QrScanner
                      onScan={handleQrCodeScanned}
                      onError={(error) => {
                        setError(error.message);
                        setShowScanner(false);
                      }}
                      onCancel={() => setShowScanner(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {step === 'sending' && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-greenleaf-600 mx-auto animate-spin" />
              <h2 className="text-xl font-semibold">Sending Payment</h2>
              <p className="text-sm text-gray-500">
                Please wait while the payment is being processed...
              </p>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {step === 'complete' && transaction && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Payment Sent!</h2>
                <p className="text-gray-500 mt-1">
                  Your payment has been sent successfully
                </p>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Payment Receipt</CardTitle>
                  <CardDescription>
                    Transaction ID: {transaction.id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold">${transaction.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Recipient</span>
                    <span>{transaction.recipient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{new Date(transaction.timestamp).toLocaleString()}</span>
                  </div>
                  {transaction.note && (
                    <div>
                      <span className="text-gray-500 block mb-1">Note</span>
                      <p className="bg-gray-50 p-2 rounded text-sm">{transaction.note}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">Receipt ID</span>
                    <p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                      {transaction.receiptId}
                    </p>
                  </div>
                </CardContent>
                <CardFooter>
                  <GreenButton 
                    onClick={() => navigate('/offline')}
                    className="w-full"
                  >
                    Done
                  </GreenButton>
                </CardFooter>
              </Card>
            </div>
          )}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default WebRTCSendMoney;
