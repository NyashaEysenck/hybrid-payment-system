import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext'; // Already imported
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import QrScanner from '@/components/QRScanner';
import { Button } from "@/components/ui/button";
import GreenButton from "@/components/GreenButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, CheckCircle, QrCode, ScanLine, Smartphone, ChevronLeft, ChevronRight } from "lucide-react";
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData, joinConnectionData, splitConnectionData } from '@/utils/qrCodeUtils';

// Steps in the receive money process
type ReceiveMoneyStep = 'scan' | 'createAnswer' | 'waitForPayment' | 'complete';

// Transaction type
interface Transaction {
  id: string;
  type: 'receive';
  amount: number;
  sender: string;
  timestamp: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string;
}

const WebRTCReceiveMoney = () => {
  const { user } = useAuth();
  // UPDATED: Destructure addToOfflineBalance
  const { offlineBalance, refreshOfflineBalance, addToOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State variables
  const [step, setStep] = useState<ReceiveMoneyStep>('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerQrData, setAnswerQrData] = useState<string | null>(null);
  const [answerQrDataChunks, setAnswerQrDataChunks] = useState<string[]>([]);
  const [currentAnswerChunkIndex, setCurrentAnswerChunkIndex] = useState(0);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);
  
  useEffect(() => {
    if (user?.email) {
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
      
      return () => {
        service.closeConnection();
      };
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleQrCodeScanned = async (data: string) => {
    console.log('QR code scanned, processing data...');
    setShowScanner(false);
    
    if (!webrtcService || !user?.email) {
      console.error('WebRTC service not initialized or user not logged in');
      setError('WebRTC service not initialized or user not logged in');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!data || data.trim() === '') {
        throw new Error('Invalid QR code: empty data');
      }
      
      if (data.startsWith('CHUNK:')) {
        const parts = data.split(':', 4);
        if (parts.length !== 4) {
          throw new Error('Invalid chunk format');
        }
        
        const currentChunk = parseInt(parts[1], 10);
        const totalChunks = parseInt(parts[2], 10);
        const chunkData = parts[3];
        
        console.log(`Received chunk ${currentChunk} of ${totalChunks}`);
        if (!isMultiChunkMode) {
          setIsMultiChunkMode(true);
          setTotalChunksExpected(totalChunks);
          setScannedChunks(new Array(totalChunks).fill(null));
        }
        
        if (!/^[A-Za-z0-9+/=]+$/.test(chunkData)) {
          console.error('Invalid base64 data in chunk');
          throw new Error(`Invalid QR code format: chunk ${currentChunk} is not properly encoded`);
        }
        
        const updatedChunks = [...scannedChunks];
        updatedChunks[currentChunk - 1] = chunkData;
        setScannedChunks(updatedChunks);
        
        console.log(`Stored chunk ${currentChunk} of ${totalChunks}, data length: ${chunkData.length}`);
        
        if (updatedChunks.filter(Boolean).length === totalChunks) {
          console.log('All chunks received, processing...');
          const combinedData = updatedChunks.join('');
          console.log(`Combined data length: ${combinedData.length}`);
          
          try {
            const offerData = decodeConnectionData(combinedData);
            console.log('Combined offer data decoded successfully:', offerData.type);
            
            if (offerData.type !== 'offer') {
              console.error('Invalid QR code type:', offerData.type);
              throw new Error('Invalid QR code: not an offer');
            }
            processOfferData(offerData);
          } catch (error) {
            console.error('Error processing combined chunks:', error);
            setError(`Error processing QR code chunks: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setLoading(false);
            setShowScanner(true);
            setIsMultiChunkMode(false);
            setScannedChunks([]);
          }
        } else {
          const missingChunks = totalChunks - updatedChunks.filter(Boolean).length;
          setError(`Received chunk ${currentChunk} of ${totalChunks}. Need ${missingChunks} more chunks.`);
          setLoading(false);
          setShowScanner(true); // Allow scanning next chunk
        }
        return;
      }
      
      // Single chunk QR code
      try {
        if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
          console.error('Invalid base64 data in single QR code');
          throw new Error('Invalid QR code format: not properly encoded');
        }
        console.log('Decoding QR code data...');
        const offerData = decodeConnectionData(data);
        console.log('Offer data decoded successfully:', offerData.type);
        
        if (offerData.type !== 'offer') {
          console.error('Invalid QR code type:', offerData.type);
          throw new Error('Invalid QR code: not an offer');
        }
        processOfferData(offerData);
      } catch (error) {
        console.error('Error decoding QR code:', error);
        setError(`Error decoding QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLoading(false);
        setShowScanner(true);
      }
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError(`Failed to process QR code: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('scan'); // Reset to scan step on error
      setShowScanner(true); // Ensure scanner is available again
    } finally {
      // setLoading(false); // Loading is handled within specific paths now
    }
  };

  const processOfferData = async (offerData: WebRTCConnectionData) => {
    console.log('Processing offer data...');
    setLoading(true); // Moved loading here
    if (!webrtcService || !user?.email) { // Added user?.email check
      setError('WebRTC service not initialized or user not available.');
      setLoading(false);
      return;
    }
    
    try {
      const answer = await webrtcService.initiateReceiverConnection(offerData);
      console.log('Created answer:', answer);
      
      const answerData: WebRTCConnectionData = {
        type: 'answer' as const,
        sdp: answer.sdp,
        senderID: user.email, // Use user.email directly
      };

      const chunks = splitConnectionData(answerData);
      console.log(`Split answer into ${chunks.length} chunks`);
      
      webrtcService.onMessage((message) => {
        console.log('Received message:', message);
        if (message.type === 'payment') {
          console.log('Payment message received, processing...');
          handlePaymentReceived(message);
        }
      });
      webrtcService.onConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          console.log('WebRTC connection established');
          toast({
            title: "Connection Established",
            description: "Connected to sender device",
            duration: 3000,
          });
          setStep('waitForPayment');
          setLoading(false); // Connection established, stop general loading
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.log('WebRTC connection lost:', state);
          if (step !== 'complete') {
            setError('Connection lost. Please try again.');
            setStep('scan');
            setShowScanner(true); // Allow re-scan
          }
          setLoading(false); // Connection lost, stop loading
        }
      });
      setAnswerQrDataChunks(chunks);
      setCurrentAnswerChunkIndex(0);
      setAnswerQrData(chunks[0]); // Ensure first chunk is set for display
      setStep('createAnswer');
      // setLoading(false); // Loading should stop on connection established or error
    } catch (error) {
      console.error('Error creating answer:', error);
      setError(`Failed to create answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('scan'); // Revert to scan on error
      setShowScanner(true);
      setLoading(false);
    }
  };

  const handlePaymentReceived = async (paymentData: any) => {
    console.log('Processing payment data:', paymentData);
    let receiptId = ''; // Initialize receiptId
    try {
      if (!paymentData.amount || !paymentData.senderID || !paymentData.transactionId) {
        console.error('Invalid payment data:', paymentData);
        throw new Error('Invalid payment data');
      }
      
      receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      console.log('Generated receipt ID:', receiptId);
      
      const receivedAmount = Number(paymentData.amount);
      console.log('Payment amount:', receivedAmount);
      
      const pendingTransaction: Transaction = {
        id: paymentData.transactionId,
        type: 'receive',
        amount: receivedAmount,
        sender: paymentData.senderID,
        timestamp: paymentData.timestamp || Date.now(),
        note: paymentData.note,
        receiptId,
        status: 'pending' as const
      };
      setTransaction(pendingTransaction); // Set pending transaction first

      // VVVVVV MODIFIED BLOCK VVVVVV
      // Add to offline balance
      if (receivedAmount > 0) { // Ensure there's an amount to add
         await addToOfflineBalance(receivedAmount); // Use the context's function
         console.log('Offline balance updated for receiver');
      } else {
         console.warn("Payment received, but receivedAmount is not positive:", receivedAmount);
      }
      // ^^^^^^ MODIFIED BLOCK ^^^^^^
      
      console.log('Sending receipt to sender...');
      await webrtcService?.sendMessage({
        type: 'receipt',
        receiptId: receiptId,
        transactionId: paymentData.transactionId,
        status: 'success'
      });
      console.log('Sent receipt:', { receiptId, transactionId: paymentData.transactionId, status: 'success' });
      
      const completedTransaction: Transaction = {
        ...pendingTransaction,
        status: 'completed' as const
      };
      setTransaction(completedTransaction); // Update to completed
      
      setStep('complete');
      // UPDATED TOAST
      toast({
        title: "Payment Received",
        description: `$${receivedAmount.toFixed(2)} received. Offline balance updated.`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Payment failed: ${errorMessage}`);
      
      if (transaction) { // Use the existing transaction state if available for failure
        const failedTransaction: Transaction = {
          ...transaction, // Spread existing transaction
          id: paymentData.transactionId || transaction.id, // Ensure ID from paymentData if available
          receiptId: receiptId || transaction.receiptId, // Use generated or existing receiptId
          status: 'failed' as const
        };
        setTransaction(failedTransaction);
      } else if (paymentData.transactionId) { // If no prior transaction state, create one for failure
        setTransaction({
            id: paymentData.transactionId,
            type: 'receive',
            amount: Number(paymentData.amount) || 0,
            sender: paymentData.senderID || 'Unknown',
            timestamp: paymentData.timestamp || Date.now(),
            note: paymentData.note,
            receiptId: receiptId, // Use generated receiptId
            status: 'failed' as const
        });
      }
      
      try {
        await webrtcService?.sendMessage({
          type: 'receipt',
          receiptId: receiptId, // Use the generated receiptId
          transactionId: paymentData.transactionId,
          status: 'failed',
          error: errorMessage
        });
        console.log('Sent error receipt:', { receiptId, transactionId: paymentData.transactionId, status: 'failed', error: errorMessage });
      } catch (sendError) {
        console.error('Error sending error receipt:', sendError);
      }
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
      setStep('waitForPayment'); // Or 'scan' if connection is too unstable
    }
  };

  const resetProcess = () => {
    console.log('Resetting WebRTC process...');
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setAnswerQrDataChunks([]);
    setCurrentAnswerChunkIndex(0);
    setShowScanner(true);
    setTransaction(null);
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);
    setLoading(false);
    
    if (webrtcService) {
      console.log('Closing existing WebRTC connection');
      webrtcService.closeConnection();
    }
    
    if (user?.email) {
      console.log('Initializing new WebRTC service');
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
    } else {
      console.error('Cannot reset WebRTC service: user not logged in');
    }
  };

  const readyToScan = !!user?.email && !!webrtcService;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={() => {
                if (step === 'complete' || step === 'scan') {
                    navigate('/offline');
                } else {
                    resetProcess(); // Offer cancel/reset for intermediate steps
                }
            }}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 'complete' || step === 'scan' ? 'Back' : 'Cancel'}
          </Button>
          <h1 className="text-2xl font-bold text-dark">Receive Money (WebRTC)</h1>
        </div>
        
        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === 'scan' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Scan QR Code</h2>
              <p className="text-sm text-gray-500">
                Scan the QR code displayed on the sender's device to establish a connection.
              </p>
              <p className="text-xs text-gray-400">
                Make sure the QR code is well-lit and positioned within the scanning area.
              </p>
              
              {loading && <div className="text-center"><RefreshCw className="h-8 w-8 text-greenleaf-600 mx-auto animate-spin" /><p>Processing QR Code...</p></div>}

              {!loading && readyToScan ? (
                showScanner ? (
                  <QrScanner
                    onScan={handleQrCodeScanned}
                    onError={(scanError) => {
                      console.error('Scanner error:', scanError.message);
                      setError(scanError.message);
                      // setShowScanner(false); // Keep scanner open or allow re-open
                    }}
                    onCancel={() => {
                      console.log('Scanner cancelled by user');
                      // setShowScanner(false); // User might want to go back instead
                      navigate('/offline');
                    }}
                  />
                ) : (
                  <div className="text-center">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        console.log('Opening QR scanner...');
                        setError(null); // Clear previous errors
                        setShowScanner(true);
                      }}
                      className="w-full"
                    >
                      <ScanLine className="mr-2 h-4 w-4" />
                      {error ? 'Try Scanning Again' : 'Open Scanner'}
                    </Button>
                  </div>
                )
              ) : (
                !loading && <div className="text-center"><p>Initializing WebRTC service...</p><RefreshCw className="h-6 w-6 mx-auto animate-spin" /></div>
              )}
              
              {error && !loading && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {step === 'createAnswer' && answerQrDataChunks.length > 0 && (
            <div className="space-y-6">
              <div className="text-center">
                 <h2 className="text-xl font-semibold mb-2">Show QR Code to Sender</h2>
                <p className="text-sm text-gray-500">
                  {answerQrDataChunks.length > 1 
                    ? `Show QR code ${currentAnswerChunkIndex + 1} of ${answerQrDataChunks.length} to the sender.`
                    : 'Show this QR code to the sender to establish the connection.'}
                </p>
              </div>
              
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCode value={answerQrDataChunks[currentAnswerChunkIndex]} size={256} level="H" />
                </div>
              </div>
              
              {answerQrDataChunks.length > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentAnswerChunkIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentAnswerChunkIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />Previous
                  </Button>
                  <span className="text-sm text-gray-500">QR {currentAnswerChunkIndex + 1} of {answerQrDataChunks.length}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentAnswerChunkIndex(prev => Math.min(answerQrDataChunks.length - 1, prev + 1))}
                    disabled={currentAnswerChunkIndex === answerQrDataChunks.length - 1}
                  >
                    Next<ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {loading && <div className="text-center"><RefreshCw className="h-8 w-8 text-greenleaf-600 mx-auto animate-spin" /><p>Waiting for connection...</p></div>}
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          
          {step === 'waitForPayment' && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-greenleaf-600 mx-auto animate-spin" />
              <h2 className="text-xl font-semibold">Waiting for Payment</h2>
              <p className="text-sm text-gray-500">
                Connection established. Waiting for the sender to complete the payment...
              </p>
              {error && (
                <Alert variant="destructive" className="mt-4">
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
                <h2 className="text-xl font-semibold">Payment Received!</h2>
                <p className="text-gray-500 mt-1">
                  You have successfully received a payment.
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
                    <span className="text-gray-500">Sender</span>
                    <span>{transaction.sender}</span>
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

export default WebRTCReceiveMoney;
