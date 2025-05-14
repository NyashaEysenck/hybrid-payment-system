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
import { ArrowLeft, Send, RefreshCw, CheckCircle, QrCode, ScanLine, ChevronLeft, ChevronRight } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData, splitConnectionData, joinConnectionData } from '@/utils/qrCodeUtils';

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
  const { offlineBalance, updateOfflineBalance, refreshOfflineBalance } = useOfflineBalance();
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
  const [offerQrDataChunks, setOfferQrDataChunks] = useState<string[]>([]);
  const [currentQrChunkIndex, setCurrentQrChunkIndex] = useState(0);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  
  // IndexedDB hook for storing transactions
  const { addItem } = useIndexedDB({
    dbName: 'offline-payments',
    storeName: 'offline-transactions'
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
    console.log('Creating WebRTC offer...');
    if (!webrtcService || !user?.email) {
      console.error('WebRTC service not initialized or user not logged in');
      setError('WebRTC service not initialized or user not logged in');
      return;
    }
    
    if (amount === '' || amount <= 0) {
      console.error('Invalid amount:', amount);
      setError('Please enter a valid amount greater than 0');
      return;
    }
    
    if (amount > offlineBalance) {
      console.error(`Insufficient balance. Amount: ${amount}, Available: ${offlineBalance}`);
      setError(`Insufficient offline balance. Available: $${offlineBalance.toFixed(2)}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Create WebRTC offer
      console.log('Initializing sender connection...');
      const offerData = await webrtcService.initiateSenderConnection();
      console.log('Offer created successfully');
      
      // Split and encode offer data for QR code
      console.log('Encoding offer data for QR code...');
      try {
        // First, log the size of the raw JSON data
        const rawJsonSize = JSON.stringify(offerData).length;
        console.log(`Raw JSON data size: ${rawJsonSize} characters`);
        
        // Use splitConnectionData to handle large data
        const dataChunks = splitConnectionData(offerData);
        console.log(`QR code data split into ${dataChunks.length} chunks`);
        
        // Log the size of each chunk for debugging
        dataChunks.forEach((chunk, index) => {
          console.log(`Chunk ${index + 1} size: ${chunk.length} characters`);
        });
        
        if (dataChunks.length === 1) {
          // If only one chunk, use the simple approach
          setOfferQrData(dataChunks[0]);
          setOfferQrDataChunks([]);
        } else {
          // If multiple chunks, store them and show the first one
          setOfferQrDataChunks(dataChunks);
          setCurrentQrChunkIndex(0);
          setOfferQrData(dataChunks[0]);
          console.log(`Showing chunk 1 of ${dataChunks.length}`);
          
          // Show a toast notification to inform the user about multiple QR codes
          toast({
            title: "Multiple QR Codes Required",
            description: `This connection requires ${dataChunks.length} QR codes. Please scan all of them in order.`,
            duration: 5000,
          });
        }
        
        // Move to next step - using createOffer instead of waitForAnswer since that's where the QR code is displayed
        setStep('createOffer');
      } catch (encodeError) {
        console.error('Error encoding offer data:', encodeError);
        setError('Failed to encode connection data. The offer might be too large.');
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create connection offer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle QR code scan (answer from receiver)
  const handleQrCodeScanned = async (data: string) => {
    console.log('QR code scanned, processing data...');
    if (!webrtcService) {
      console.error('WebRTC service not initialized');
      setError('WebRTC service not initialized');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Decode answer data from QR code
      console.log('Decoding QR code data, length:', data.length);
      
      // Validate the data is Base64 encoded
      if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
        console.error('QR code data is not valid Base64');
        throw new Error('Invalid QR code format: not Base64 encoded');
      }
      
      const answerData = decodeConnectionData(data);
      console.log('Answer data decoded successfully:', answerData.type);
      
      if (answerData.type !== 'answer') {
        console.error('Invalid QR code type:', answerData.type);
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
      console.log('Confirming payment of', amount);
      console.log('Current offline balance:', offlineBalance);
      
      // Update transaction status
      const updatedTransaction: Transaction = {
        ...transaction,
        status: 'completed' as const
      };
      
      // Save transaction to IndexedDB
      await addItem(updatedTransaction);
      console.log('Transaction saved to IndexedDB:', updatedTransaction);
      
      // Update offline balance
      const amountNum = Number(amount);
      console.log('Updating offline balance by -', amountNum);
      await updateOfflineBalance(-amountNum); // Fixed to match new interface
      
      // Refresh the offline balance to ensure consistency
      await refreshOfflineBalance();
      console.log('Refreshed offline balance:', offlineBalance);
      
      // Move to complete step
      setTransaction(updatedTransaction);
      setStep('complete');
      
      toast({
        title: "Payment Sent",
        description: `$${amountNum.toFixed(2)} sent successfully`,
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
                  {offerQrData && (
                    <QRCode 
                      value={offerQrData} 
                      size={200}
                      level="H"
                    />
                  )}
                </div>
              </div>
              
              {offerQrDataChunks.length > 1 && (
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newIndex = Math.max(0, currentQrChunkIndex - 1);
                      setCurrentQrChunkIndex(newIndex);
                      setOfferQrData(offerQrDataChunks[newIndex]);
                    }}
                    disabled={currentQrChunkIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <span className="text-sm text-gray-500">
                    QR Code {currentQrChunkIndex + 1} of {offerQrDataChunks.length}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newIndex = Math.min(offerQrDataChunks.length - 1, currentQrChunkIndex + 1);
                      setCurrentQrChunkIndex(newIndex);
                      setOfferQrData(offerQrDataChunks[newIndex]);
                    }}
                    disabled={currentQrChunkIndex === offerQrDataChunks.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <p className="text-center text-sm text-gray-500">
                Amount: ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}
              </p>
              
              {offerQrDataChunks.length > 1 && (
                <p className="text-center text-xs text-amber-600 mt-2">
                  This payment requires multiple QR codes. Ask the recipient to scan all {offerQrDataChunks.length} QR codes in order.
                </p>
              )}
              
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
                    <p className="text-sm text-gray-500 mb-4">
                      Position the QR code from the receiver within the scanning area.
                    </p>
                    <QrScanner
                      onScan={handleQrCodeScanned}
                      onError={(error) => {
                        console.error('Scanner error:', error.message);
                        setError(error.message);
                        setShowScanner(false);
                      }}
                      onCancel={() => {
                        console.log('Scanner cancelled by user');
                        setShowScanner(false);
                      }}
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
