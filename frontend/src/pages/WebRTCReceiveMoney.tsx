import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { storageService } from '@/services/storageService';
// Import storageService

type ReceiveMoneyStep = 'scan' | 'createAnswer' | 'waitForPayment' | 'complete';

interface Transaction {
  id: string;
  type: 'receive';
  amount: number;
  sender: string;
  recipient: string;
  timestamp: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string;
  synced?: boolean;
}

const WebRTCReceiveMoney = () => {
  const { user } = useAuth();
  const { offlineBalance, refreshOfflineBalance, addToOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<ReceiveMoneyStep>('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerQrData, setAnswerQrData] = useState<string | null>(null);
  const [answerQrDataChunks, setAnswerQrDataChunks] = useState<string[]>([]);
  const [currentAnswerChunkIndex, setCurrentAnswerChunkIndex] = useState(0);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null); // Kept state for display
  const transactionRef = useRef<Transaction | null>(null); // Added ref for consistent transaction access
  const [showScanner, setShowScanner] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);

  // Helper to update both state and ref
  const updateTransaction = (tx: Transaction | null) => {
    setTransaction(tx);
    transactionRef.current = tx;
  };

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
          toast({
            title: "Multiple QR Codes Required",
            description: `This is chunk 1 of ${totalChunks}. Please scan all chunks in order.`,
            duration: 5000,
          });
        }

        if (!/^[A-Za-z0-9+/=]+$/.test(chunkData)) {
          console.error('Invalid base64 data in chunk');
          throw new Error(`Invalid QR code format: chunk ${currentChunk} is not properly encoded`);
        }

        const updatedChunks = [...scannedChunks];
        updatedChunks[currentChunk - 1] = chunkData;
        setScannedChunks(updatedChunks);
        console.log(`Stored chunk ${currentChunk} of ${totalChunks}, data length: ${chunkData.length}`);
        console.log(`First 20 chars of chunk: ${chunkData.substring(0, 20)}...`);
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
          toast({
            title: `Chunk ${currentChunk} Scanned`,
            description: `${missingChunks} more chunks to scan.`,
            duration: 3000,
          });
          setLoading(false);
          setShowScanner(true);
        }
        return;
      }

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
      setStep('scan');
    } finally {
      setLoading(false);
    }
  };
  const processOfferData = async (offerData: WebRTCConnectionData) => {
    console.log('Processing offer data...');
    if (!webrtcService) {
      throw new Error('WebRTC service not initialized');
    }

    try {
      const answer = await webrtcService.initiateReceiverConnection(offerData);
      console.log('Created answer:', answer);
      const answerData: WebRTCConnectionData = {
        type: 'answer' as const,
        sdp: answer.sdp,
        senderID: user?.email || '',
      };

      const chunks = splitConnectionData(answerData);
      console.log(`Split answer into ${chunks.length} chunks`);
      webrtcService.onMessage(async (message) => { // Added async here
        console.log('Received message:', message);
        if (message.type === 'payment') {
          console.log('Payment message received, processing...');
          await handlePaymentReceived(message); // Await the handling of payment
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
          // MODIFIED CONDITION:
          // Only set error and reset if the current step is not 'complete'
          // AND the transaction status is not 'completed'.
          if (step !== 'complete' && transactionRef.current?.status !== 'completed') {
            setError('Connection lost. Please try again.');
            resetProcess(); // Use resetProcess on connection loss
          }
        }
      });
      setAnswerQrDataChunks(chunks);
      setCurrentAnswerChunkIndex(0);
      setStep('createAnswer');
    } catch (error) {
      console.error('Error creating answer:', error);
      setError(`Failed to create answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('scan');
      // Go back to scan step on error
    }
  };
  const handlePaymentReceived = async (paymentData: any) => {
    console.log('Processing payment data:', paymentData);
    let receiptId = '';
    let pendingTransaction: Transaction | null = null; // Define pendingTransaction outside try
    try {
      if (!paymentData.amount || !paymentData.senderID || !paymentData.transactionId) {
        console.error('Invalid payment data:', paymentData);
        throw new Error('Invalid payment data');
      }

      receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      console.log('Generated receipt ID:', receiptId);
      const amount = Number(paymentData.amount);
      console.log('Payment amount:', amount);

      const newPendingTransaction: Transaction = { // Renamed to avoid conflict with outer scope variable
        id: receiptId, // Using receiptId as the transaction ID
        type: 'receive',
        amount: amount,
        sender: paymentData.senderID || paymentData.sender || 'unknown',
        recipient: user?.email || 'unknown',
        timestamp: paymentData.timestamp || Date.now(),
        note: paymentData.note,
        receiptId,
        status: 'pending' as const,
        synced: false
      };
      pendingTransaction = newPendingTransaction; // Assign to outer scope variable
      updateTransaction(pendingTransaction); // Use helper to update both state and ref
      // Log ID before saving pending transaction
      console.log(`Attempting to save pending transaction (id: ${pendingTransaction.id}) with status: ${pendingTransaction.status}`);
      await storageService.saveTransaction(pendingTransaction); // Save pending transaction

      console.log('Adding to offline balance:', amount);
      await addToOfflineBalance(amount);
      console.log('Balance update completed');
      console.log('Sending receipt to sender...');
      await webrtcService?.sendMessage({
        type: 'receipt',
        receiptId: receiptId,
        transactionId: paymentData.transactionId,
        status: 'success'
      });
      console.log('Sent receipt:', {
        receiptId: pendingTransaction.receiptId,
        transactionId: paymentData.transactionId,
        status: 'success'
      });

      const completedTransaction: Transaction = {
        ...pendingTransaction,
        status: 'completed' as const
      };
      updateTransaction(completedTransaction); // Use helper to update both state and ref
      // Log ID before saving completed transaction
      console.log(`Attempting to save completed transaction (id: ${completedTransaction.id}) with status: ${completedTransaction.status}`);
      await storageService.saveTransaction(completedTransaction); // Save completed transaction

      setStep('complete');
      toast({
        title: "Payment Received",
        description: `$${amount.toFixed(2)} received successfully. Offline balance updated.`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Payment failed: ${errorMessage}`);

      // Check if status has already been updated to failed before saving again
      if (pendingTransaction && pendingTransaction.status !== 'failed') {
        const failedTransaction: Transaction = {
          ...pendingTransaction,
          status: 'failed' as const
        };
        updateTransaction(failedTransaction); // Use helper to update both state and ref
        // Log ID before saving failed transaction
        console.log(`Attempting to save failed transaction (id: ${failedTransaction.id}) with status: ${failedTransaction.status} due to error.`);
        await storageService.saveTransaction(failedTransaction); // Save failed transaction
      } else if (transactionRef.current && transactionRef.current.status !== 'failed') { // Fallback if pendingTransaction was not set
        const failedTransaction: Transaction = {
          ...transactionRef.current,
          status: 'failed' as const
        };
        updateTransaction(failedTransaction); // Use helper to update both state and ref
        // Log ID before saving failed transaction (fallback)
        console.log(`Attempting to save failed transaction (id: ${failedTransaction.id}) with status: ${failedTransaction.status} (fallback) due to error.`);
        await storageService.saveTransaction(failedTransaction); // Save failed transaction
      }


      try {
        await webrtcService?.sendMessage({
          type: 'receipt',
          receiptId: receiptId,
          status: 'failed',
          error: errorMessage,
          transactionId: paymentData.transactionId // Use transactionId from paymentData
        });
        console.log('Sent error receipt:', {
          receiptId,
          transactionId: paymentData.transactionId,
          status: 'failed',
          error: errorMessage
        });
      } catch (sendError) {
        console.error('Error sending error receipt:', sendError);
      }

      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
      setStep('waitForPayment'); // Stay on waitForPayment or go back to scan? Staying for now.
    }
  };
  const resetProcess = () => {
    console.log('Resetting WebRTC process...');
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setAnswerQrDataChunks([]);
    setCurrentAnswerChunkIndex(0);
    // setTransaction(null); // Keep transaction for display purposes even after reset if it was completed
    updateTransaction(null); // Clear transaction on reset
    setShowScanner(false);
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);
    if (webrtcService) {
      console.log('Closing existing WebRTC connection');
      webrtcService.closeConnection();
    }

    // Re-initialize WebRTC service
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
          <Button variant="ghost" onClick={() => navigate('/offline')} className="mr-4" >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
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
              {readyToScan ? (
                <div className="flex flex-col gap-3">
                  <GreenButton onClick={() => setShowScanner(true)} className="w-full" >
                    <ScanLine className="mr-2 h-4 w-4" /> Scan QR Code
                  </GreenButton>
                  <Button variant="outline" onClick={() => navigate('/offline')} className="w-full" >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                </div>
              ) : (
                <div className="loading">
                  <p>Initializing...</p>
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
          {showScanner && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-4">Scan Sender's QR Code</h3>
                <p className="text-sm text-gray-500 mb-4">Position the QR code from the sender within the scanning area.</p>
                <QrScanner
                  onScan={handleQrCodeScanned}
                  onError={(scanError) => {
                    console.error('Scanner error:', scanError.message);
                    setError(scanError.message);
                    setShowScanner(false);
                  }}
                  onCancel={() => {
                    console.log('Scanner cancelled by user');
                    setShowScanner(false);
                  }}
                />
                <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full mt-4">
                  Cancel Scan
                </Button>
              </div>
            </div>
          )}
          {step === 'createAnswer' && answerQrDataChunks.length > 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Show QR Code to Sender</h2>
                <p className="text-sm text-gray-500">
                  {answerQrDataChunks.length > 1 ? `Show QR code ${currentAnswerChunkIndex + 1} of ${answerQrDataChunks.length} to the sender.` : 'Show this QR code to the sender to establish the connection.'}
                </p>
              </div>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCode value={answerQrDataChunks[currentAnswerChunkIndex]} size={256} />
                </div>
              </div>
              {answerQrDataChunks.length > 1 && (
                <div className="flex justify-between space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newIndex = Math.max(0, currentAnswerChunkIndex - 1);
                      setCurrentAnswerChunkIndex(newIndex);
                    }}
                    disabled={currentAnswerChunkIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newIndex = Math.min(answerQrDataChunks.length - 1, currentAnswerChunkIndex + 1);
                      setCurrentAnswerChunkIndex(newIndex);
                    }}
                    disabled={currentAnswerChunkIndex === answerQrDataChunks.length - 1}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button onClick={resetProcess} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <p className="text-sm text-gray-500 text-center mt-4">
                Waiting for sender to complete the connection...
              </p>
            </div>
          )}
          {step === 'waitForPayment' && (
            <div className="text-center space-y-4">
              <Smartphone className="mx-auto h-12 w-12 text-blue-500 animate-pulse" />
              <h2 className="text-xl font-semibold">Waiting for Payment...</h2>
              <p className="text-sm text-gray-500">Connection established. Waiting for the sender to initiate the payment.</p>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button onClick={resetProcess} variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel Transaction
              </Button>
            </div>
          )}
          {step === 'complete' && transactionRef.current && (
            <div className="text-center space-y-6">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold text-green-600">Payment Received!</h2>
              <p className="text-sm text-gray-500">
                You have successfully received ${transactionRef.current.amount.toFixed(2)} from {transactionRef.current.sender}.
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>Payment Receipt</CardTitle>
                  <CardDescription>Transaction ID: {transactionRef.current.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="font-semibold">${transactionRef.current.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender</span>
                    <span>{transactionRef.current.sender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span>{new Date(transactionRef.current.timestamp).toLocaleString()}</span>
                  </div>
                  {transactionRef.current.note && (
                    <div>
                      <span className="text-gray-500 block mb-1">Note</span>
                      <p className="bg-gray-50 p-2 rounded text-sm">{transactionRef.current.note}</p>
                    </div>
                  )}
                  <div className="pt-2">
                    <span className="text-gray-500 block mb-1">Receipt ID</span>
                    <p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                      {transactionRef.current.receiptId}
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
