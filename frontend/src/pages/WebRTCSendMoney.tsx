import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext';
import { useNavigate } from 'react-router-dom';
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
enum SendMoneyStep {
  input = 'input',
  createOffer = 'createOffer',
  waitForAnswer = 'waitForAnswer',
  waitForReceipt = 'waitForReceipt',
  sending = 'sending',
  complete = 'complete'
};

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
  const [step, setStep] = useState<SendMoneyStep>(SendMoneyStep.input);
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
  
  // Variables for handling multiple QR code chunks when scanning answer
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);
  
  // We no longer need to initialize IndexedDB as we're using the context directly

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
        setStep(SendMoneyStep.createOffer);
      } catch (encodeError) {
        console.error('Error encoding offer data:', encodeError);
        setError('Failed to encode connection data. The offer might be too large.');
        setStep(SendMoneyStep.input);
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create connection offer. Please try again.');
      setStep(SendMoneyStep.input);
    } finally {
      setLoading(false);
    }
  };

  // Handle QR code scan (answer from receiver)
  const handleQrCodeScanned = async (data: string) => {
    console.log('QR code scanned, processing data...');
    
    if (!webrtcService || !user?.email) {
      console.error('WebRTC service not initialized or user not logged in');
      setError('WebRTC service not initialized or user not logged in');
      setShowScanner(false);
      return;
    }
    
    try {
      // Validate QR code data
      if (!data || data.trim() === '') {
        throw new Error('Invalid QR code: empty data');
      }
      
      // Check if this is a multi-chunk QR code
      if (data.startsWith('CHUNK:')) {
        // Format: CHUNK:current:total:data
        const parts = data.split(':', 4);
        if (parts.length !== 4) {
          throw new Error('Invalid chunk format');
        }
        
        const currentChunk = parseInt(parts[1]);
        const totalChunks = parseInt(parts[2]);
        const chunkData = parts[3];
        
        console.log(`Received chunk ${currentChunk} of ${totalChunks}`);
        
        // First chunk - initialize the collection
        if (currentChunk === 1) {
          setScannedChunks([chunkData]);
          setTotalChunksExpected(totalChunks);
          setIsMultiChunkMode(true);
          toast({
            title: "Multiple QR Codes Required",
            description: `This is chunk 1 of ${totalChunks}. Please scan all chunks in order.`,
            duration: 5000,
          });
        } else {
          // Add to existing chunks
          setScannedChunks(prev => [...prev, chunkData]);
        }
        
        // Check if we have all chunks
        if (scannedChunks.length + 1 === totalChunks) {
          // Process all chunks together
          const allChunks = [...scannedChunks, chunkData];
          processAnswerData(allChunks);
          setShowScanner(false);
        } else {
          // Keep scanning
          toast({
            title: `Chunk ${currentChunk} Scanned`,
            description: `${totalChunks - currentChunk} more chunks to scan.`,
            duration: 3000,
          });
          // Don't hide scanner, we need more chunks
          return;
        }
      } else {
        // Single chunk - process directly
        processAnswerData([data]);
        setShowScanner(false);
      }
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError(`Failed to process QR code: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setShowScanner(false);
      setStep(SendMoneyStep.createOffer);
    }
  };
  
  // Process answer data after all chunks are collected
  const processAnswerData = async (chunks: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      // Join chunks if multiple
      let answerData: WebRTCConnectionData;
      
      if (chunks.length > 1 || isMultiChunkMode) {
        console.log(`Processing ${chunks.length} chunks...`);
        answerData = joinConnectionData(chunks);
      } else {
        // Single chunk
        answerData = decodeConnectionData(chunks[0]);
      }
      
      console.log('Decoded answer data:', answerData);
      
      // Validate answer data
      if (answerData.type !== 'answer') {
        throw new Error('Invalid answer data: wrong type');
      }
      
      // Set answer in WebRTC service
      await webrtcService!.completeSenderConnection(answerData);
      
      // Set up message handler
      webrtcService!.onMessage((message) => {
        console.log('Received message:', message);
        // Handle receipt message from receiver
        if (message.type === 'receipt') {
          console.log('Receipt received from receiver:', message);
          // Update transaction with receipt and complete the payment
          if (transaction) {
            const updatedTransaction = {
              ...transaction,
              receiptId: message.receiptId,
              status: 'completed' as const
            };
            setTransaction(updatedTransaction);
            
            // Call payment confirmation to update balance and complete the process
            console.log('Receipt received, completing payment process');
            handlePaymentConfirmation();
          } else {
            console.error('Receipt received but no transaction found');
          }
        }
      });
      
      // Set up connection state handler
      webrtcService!.onConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          // Connection established
          console.log('WebRTC connection established');
          toast({
            title: "Connection Established",
            description: "Connected to receiver device",
            duration: 3000,
          });
          setStep(SendMoneyStep.sending);
          
          // Create and send payment data
          setTimeout(() => {
            // Create payment data
            const paymentData = {
              type: 'payment',
              amount: amount,
              senderID: user?.email || 'unknown',
              recipientID: answerData.senderID || recipientId || 'unknown',
              timestamp: Date.now(),
              note: note,
              transactionId: uuidv4()
            };
            
            // Send the payment data through WebRTC
            webrtcService!.sendMessage(paymentData);
            
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
            
            // Set transaction only - wait for receipt before confirming
            setTransaction(newTransaction);
          }, 1000);
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.log('WebRTC connection lost:', state);
          if (step !== 'complete') {
            setError('Connection lost. Please try again.');
            setStep(SendMoneyStep.createOffer);
          }
        }
      });
      
      // Move to next step
      setStep(SendMoneyStep.waitForAnswer);
    } catch (err) {
      console.error('Error processing answer data:', err);
      setError(`Failed to process answer data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep(SendMoneyStep.createOffer);
      
      // Reset chunk state
      setScannedChunks([]);
      setTotalChunksExpected(null);
      setIsMultiChunkMode(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment confirmation
  const handlePaymentConfirmation = async () => {
    console.log('handlePaymentConfirmation called with transaction:', transaction);
    
    if (!transaction || amount === '') {
      console.error('Cannot confirm payment: transaction or amount is missing');
      return;
    }
    
    // Prevent duplicate confirmations
    if (step === 'complete') {
      console.log('Payment already completed, skipping confirmation');
      return;
    }
    
    try {
      console.log('Confirming payment of', amount);
      console.log('Current offline balance:', offlineBalance);
      
      // Update transaction status to pending
      const pendingTransaction: Transaction = {
        ...transaction,
        status: 'pending' as const
      };
      
      // Update transaction state
      setTransaction(pendingTransaction);
      
      // Send payment message to receiver
      const paymentData = {
        amount: amount,
        senderID: user?.email || '',
        transactionId: transaction.id,
        timestamp: transaction.timestamp,
        note: transaction.note
      };
      
      console.log('Sending payment data:', paymentData);
      await webrtcService.sendMessage({
        type: 'payment',
        ...paymentData
      });
      
      // Wait for receipt
      const receiptTimeout = 30000; // 30 seconds
      const receiptPromise = new Promise<void>((resolve, reject) => {
        const receiptHandler = (message: any) => {
          if (message.type === 'receipt' && 
              message.transactionId === transaction.id) {
            // Store current handler
            const currentHandler = webrtcService.getCurrentMessageHandler();
            
            // Remove handler before resolving/rejecting
            webrtcService.offMessage();
            
            if (message.status === 'success') {
              // Restore previous handler if any
              if (currentHandler) {
                webrtcService.onMessage(currentHandler);
              }
              resolve();
            } else {
              reject(new Error(message.error || 'Receipt failed'));
            }
          }
        };
        
        // Store current handler
        const currentHandler = webrtcService.getCurrentMessageHandler();
        
        // Set the new handler
        webrtcService.onMessage(receiptHandler);
        
        // Clean up on timeout
        setTimeout(() => {
          // Restore previous handler if any
          if (currentHandler) {
            webrtcService.onMessage(currentHandler);
          } else {
            webrtcService.offMessage();
          }
          reject(new Error('Receipt timeout'));
        }, receiptTimeout);
      });
      
      await receiptPromise;
      
      // Now that receipt is confirmed, update transaction and balance
      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Invalid payment amount');
      }
      
      // Update transaction status
      const completedTransaction: Transaction = {
        ...pendingTransaction,
        status: 'completed' as const
      };
      
      // Update offline balance
      const amountToDeduct = -Math.abs(amountNum);
      await updateOfflineBalance(amountToDeduct);
      
      // Refresh balance
      await refreshOfflineBalance();
      
      // Update transaction state
      setTransaction(completedTransaction);
      setStep(SendMoneyStep.complete);
      
      toast({
        title: "Payment Sent",
        description: `$${amountNum.toFixed(2)} sent successfully`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to complete payment: ${errorMessage}. Please check your balance.`);
      
      // Update transaction to failed state
      if (transaction) {
        const failedTransaction: Transaction = {
          ...transaction,
          status: 'failed' as const
        };
        setTransaction(failedTransaction);
      }
      
      // Show error toast
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
      
      // Reset to previous step
      setStep(SendMoneyStep.waitForReceipt);
    }
  };

  // Reset the form and go back to input step
  const resetForm = () => {
    setAmount('');
    setRecipientId('');
    setNote('');
    setError(null);
    setOfferQrData(null);
    setOfferQrDataChunks([]);
    setCurrentQrChunkIndex(0);
    setTransaction(null);
    setStep(SendMoneyStep.input);
    
    // Reset chunk state
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);
    
    // Close any existing WebRTC connection
    if (webrtcService) {
      webrtcService.closeConnection();
      
      // Reinitialize WebRTC service
      if (user?.email) {
        const service = createWebRTCService(user.email);
        setWebrtcService(service);
      }
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
