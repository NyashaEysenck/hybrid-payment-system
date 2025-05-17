import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext';
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

const WebRTCReceiveMoney: React.FC = () => {
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
          // Initialize with nulls or an empty array that you manage carefully
          setScannedChunks(currentChunk === 1 ? [chunkData] : new Array(totalChunks).fill(null).map((_, i) => i === currentChunk -1 ? chunkData : null) );

        } else {
           // Ensure array is large enough if chunks arrive out of order (though ideally they shouldn't for this simple setup)
           const newScannedChunks = [...scannedChunks];
           while (newScannedChunks.length < totalChunks) {
            newScannedChunks.push(null);
           }
           newScannedChunks[currentChunk - 1] = chunkData;
           setScannedChunks(newScannedChunks);
        }

        const currentFilledChunks = scannedChunks.filter(Boolean).length + (scannedChunks[currentChunk-1] === null ? 1:0) ; // Account for the current chunk if it wasn't already set
        
        if (currentFilledChunks === totalChunks) {
          console.log('All chunks received, processing...');
          const finalChunks = isMultiChunkMode ? scannedChunks.map((c,i)=> i === currentChunk -1 ? chunkData : c) : [chunkData];
          if(finalChunks.some(c => c === null)){
            throw new Error('Error collecting all chunks. Some are missing.');
          }
          const combinedData = finalChunks.join('');
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
            setShowScanner(true); // Allow re-scan
            setIsMultiChunkMode(false);
            setScannedChunks([]);
            setTotalChunksExpected(null);
          }
        } else {
          const missingChunks = totalChunks - currentFilledChunks;
          setError(`Received chunk ${currentChunk} of ${totalChunks}. Need ${missingChunks} more chunks.`);
          toast({ title: `Chunk ${currentChunk}/${totalChunks} Received`, description: `Please scan the next chunk. Missing ${missingChunks}.`, duration: 3000 });
          setLoading(false);
          setShowScanner(true); // Re-open scanner for next chunk
        }
        return;
      }
      
      // Single chunk QR code
      try {
        if (!/^[A-Za-z0-9+/=]+$/.test(data) && !data.includes('{')) { // Simple check, adjust if your non-chunked data isn't always JSON-like if not base64
             console.error('Invalid base64 data in single QR code, or unrecognized format');
             throw new Error('Invalid QR code format: not properly encoded or recognized.');
        }
        console.log('Decoding QR code data (single chunk)...');
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
      setLoading(false); // Ensure loading is reset
      setShowScanner(true); // Allow re-scan
      setStep('scan'); // Reset step if necessary
      setIsMultiChunkMode(false); // Reset multi-chunk state
      setScannedChunks([]);
      setTotalChunksExpected(null);
    }
    // Removed finally { setLoading(false) } as it's handled in error paths and success path leads to different state
  };

  const processOfferData = async (offerData: WebRTCConnectionData) => {
    console.log('Processing offer data...');
    setLoading(true); // Set loading true at the start of processing the offer
    if (!webrtcService || !user?.email) { // Check user email as well
      setError('WebRTC service not initialized or user not identified.');
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
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.log('WebRTC connection lost:', state);
          if (step !== 'complete') {
            setError('Connection lost. Please try again.');
            setStep('scan'); // Go back to scan step to restart
            setShowScanner(true); // Make sure scanner can be reopened
          }
        }
      });
      setAnswerQrDataChunks(chunks);
      setCurrentAnswerChunkIndex(0); // Ensure it starts from the first chunk
      // setAnswerQrData(chunks[0]); // Set the first chunk for display - This was missing, might be needed if UI relies on answerQrData directly
      setStep('createAnswer');
    } catch (error) {
      console.error('Error creating answer:', error);
      setError(`Failed to create answer: ${error instanceof Error ? error.message : "Unknown error"}`);
      setStep('scan'); // Reset to scan on error
      setShowScanner(true);
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  const handlePaymentReceived = async (paymentData: any) => {
    console.log('Processing payment data:', paymentData);
    let receiptId = ''; // Initialize receiptId
    try {
      if (!paymentData.amount || !paymentData.senderID || !paymentData.transactionId) {
        console.error('Invalid payment data:', paymentData);
        throw new Error('Invalid payment data received from sender.');
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
         console.log('Offline balance updated for receiver by:', receivedAmount);
      } else {
        console.log('Received amount is not positive, offline balance not changed by this transaction.');
      }
      // ^^^^^^ MODIFIED BLOCK ^^^^^^
      
      console.log('Sending success receipt to sender...');
      await webrtcService?.sendMessage({
        type: 'receipt',
        receiptId: receiptId,
        transactionId: paymentData.transactionId,
        status: 'success'
      });
      console.log('Sent success receipt:', { receiptId, transactionId: paymentData.transactionId, status: 'success' });
      
      const completedTransaction: Transaction = {
        ...pendingTransaction,
        status: 'completed' as const
      };
      setTransaction(completedTransaction); // Update to completed
      
      setStep('complete');
      // VVVVVV MODIFIED TOAST VVVVVV
      toast({
        title: "Payment Received",
        description: `$${receivedAmount.toFixed(2)} received. Offline balance updated.`,
        duration: 5000,
      });
      // ^^^^^^ MODIFIED TOAST ^^^^^^

    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during payment processing';
      setError(`Payment processing failed: ${errorMessage}`);
      
      if (transaction && transaction.status === 'pending') { // Only update if it was set to pending
        const failedTransaction: Transaction = {
          ...transaction, // Use the existing transaction details if available
          status: 'failed' as const,
          receiptId: receiptId || transaction.receiptId || `failed-${Date.now()}` // ensure receiptId exists
        };
        setTransaction(failedTransaction);
      }
      
      try {
        console.log('Attempting to send error receipt to sender...');
        await webrtcService?.sendMessage({
          type: 'receipt',
          receiptId: receiptId || (transaction?.receiptId) || `error-${Date.now()}`, // Use generated or existing receiptId
          transactionId: paymentData.transactionId, // Critical to include this
          status: 'failed',
          error: errorMessage,
        });
        console.log('Sent error receipt.');
      } catch (sendError) {
        console.error('Error sending error receipt:', sendError);
      }
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
      // Decide if we should reset step. waitForPayment might be okay if connection is still there.
      // If error is critical, maybe setStep('scan');
      // For now, let's keep it on waitForPayment if the connection might still be active,
      // or allow user to cancel. If connection is lost, onConnectionStateChange will handle it.
    }
  };

  const resetProcess = () => {
    console.log('Resetting WebRTC process...');
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setAnswerQrDataChunks([]);
    setCurrentAnswerChunkIndex(0);
    setTransaction(null);
    setShowScanner(true); // Ensure scanner is ready for next attempt
    
    setScannedChunks([]); // Clear scanned chunks
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);

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
      setError("User not logged in. Cannot initialize receiver functionality.");
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
                    resetProcess(); // Allow canceling mid-process
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
                Scan the QR code(s) displayed on the sender's device to establish a connection.
              </p>
              <p className="text-xs text-gray-400">
                Make sure the QR code is well-lit and positioned within the scanning area. If multiple QR codes are presented by the sender, scan them in order.
              </p>
              
              {readyToScan ? (
                showScanner ? (
                  <>
                    <QrScanner
                      onScan={handleQrCodeScanned}
                      onError={(scanError) => {
                        console.error('Scanner error:', scanError.message);
                        setError(`Scanner error: ${scanError.message}. Try again.`);
                        // setShowScanner(false); // Keep scanner open or provide a button to reopen
                      }}
                      onCancel={() => {
                        console.log('Scanner cancelled by user or closed');
                        // setShowScanner(false); // User might want to explicitly cancel the whole process instead
                        // navigate('/offline'); // Or go back
                      }}
                    />
                     <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full mt-4">Close Scanner Manually</Button>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-600 mb-4">{error ? "Try scanning again." : "Scanner is closed or was processing."}</p>
                    <Button 
                      variant="default" 
                      onClick={() => {
                        console.log('Re-opening QR scanner...');
                        setError(null); // Clear previous scan errors
                        setShowScanner(true);
                        // Reset multi-chunk scan state if starting fresh
                        setIsMultiChunkMode(false);
                        setScannedChunks([]);
                        setTotalChunksExpected(null);
                      }}
                      className="w-full"
                    >
                      <ScanLine className="mr-2 h-4 w-4" />
                      {scannedChunks.length > 0 && totalChunksExpected ? `Scan Next Chunk (${scannedChunks.filter(Boolean).length + 1}/${totalChunksExpected})` : 'Open Scanner'}
                    </Button>
                  </div>
                )
              ) : (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto animate-spin mb-2" />
                  <p className="text-gray-500">Initializing receiver service... Please wait.</p>
                  {!user?.email && <p className="text-red-500 text-sm mt-1">User not identified.</p>}
                </div>
              )}
              
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Scan Error</AlertTitle>
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
                <div className="bg-white p-4 rounded-lg shadow-inner border">
                  <QRCode value={answerQrDataChunks[currentAnswerChunkIndex]} size={220} level="M" />
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
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <span className="text-sm text-gray-600">Part {currentAnswerChunkIndex + 1}/{answerQrDataChunks.length}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentAnswerChunkIndex(prev => Math.min(answerQrDataChunks.length - 1, prev + 1))}
                    disabled={currentAnswerChunkIndex === answerQrDataChunks.length - 1}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
              
              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {/* Cancel button handled by the main back/cancel button */}
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
                  <AlertTitle>Connection Issue</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {/* Cancel button handled by the main back/cancel button */}
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
                  You have successfully received a payment. Your offline balance has been updated.
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
                      <p className="bg-gray-50 p-2 rounded text-sm break-words">{transaction.note}</p>
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
