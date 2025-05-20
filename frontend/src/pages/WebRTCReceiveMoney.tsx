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
// import { Separator } from "@/components/ui/separator"; // Not used
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, CheckCircle, QrCode, ScanLine, Smartphone, ChevronLeft, ChevronRight } from "lucide-react";
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData, joinConnectionData, splitConnectionData } from '@/utils/qrCodeUtils';
import { storageService } from '@/services/storageService';

type ReceiveMoneyStep = 'scan' | 'createAnswer' | 'waitForPayment' | 'complete';

interface Transaction {
  id: string; // Receiver's internal receiptId, used as primary key
  type: 'receive';
  amount: number;
  sender: string;
  recipient: string;
  timestamp: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string; // Same as 'id' for receiver
  synced?: boolean;
  senderTransactionId?: string; // Sender's original transactionId
}

const WebRTCReceiveMoney = () => {
  const { user } = useAuth();
  const { addToOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<ReceiveMoneyStep>('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const [answerQrData, setAnswerQrData] = useState<string | null>(null); // Not directly used if chunks are primary
  const [answerQrDataChunks, setAnswerQrDataChunks] = useState<string[]>([]);
  const [currentAnswerChunkIndex, setCurrentAnswerChunkIndex] = useState(0);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]); // For offer chunks
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null); // For offer chunks
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false); // For offer chunks

  useEffect(() => {
    if (user?.email) {
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
      return () => service.closeConnection();
    }
  }, [user]);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const handleQrCodeScanned = async (data: string) => {
    setShowScanner(false);
    if (!webrtcService || !user?.email) {
      setError('WebRTC service not ready or user not logged in.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
        let fullOfferData = data;
        if (data.startsWith('CHUNK:')) {
            const parts = data.split(':', 4);
            if (parts.length !== 4) throw new Error('Invalid chunk format for offer');
            const currentChunk = parseInt(parts[1], 10);
            const totalChunks = parseInt(parts[2], 10);
            const chunkData = parts[3];

            let currentScannedOfferChunks = scannedChunks;
            if (currentChunk === 1) { // First chunk of a new sequence
                currentScannedOfferChunks = new Array(totalChunks).fill(null);
                setTotalChunksExpected(totalChunks);
                setIsMultiChunkMode(true); // Mark that we are in multi-chunk mode for the offer
                toast({ title: "Multiple QR Codes", description: `Scanned offer chunk 1 of ${totalChunks}.` });
            }
            currentScannedOfferChunks[currentChunk - 1] = chunkData;
            setScannedChunks([...currentScannedOfferChunks]);

            if (currentScannedOfferChunks.filter(Boolean).length === totalChunks) {
                fullOfferData = currentScannedOfferChunks.join('');
                console.log('All offer chunks received, processing combined data.');
                setIsMultiChunkMode(false); // Reset for next time
                setScannedChunks([]);
                setTotalChunksExpected(null);
            } else {
                 toast({ title: `Chunk ${currentChunk} Scanned`, description: `${totalChunks - currentScannedOfferChunks.filter(Boolean).length} more offer chunks to scan.` });
                setLoading(false);
                setShowScanner(true); // Keep scanner open for more offer chunks
                return;
            }
        }
        // If not chunked or all chunks are combined, decode
        const offerData = isMultiChunkMode || data.startsWith('CHUNK:') // if it was chunked, join was used
            ? joinConnectionData([fullOfferData]) // Ensure it's treated as combined even if logic above changes
            : decodeConnectionData(fullOfferData);

        if (offerData.type !== 'offer') throw new Error('Invalid QR code: Not an offer.');
        await processOfferData(offerData);

    } catch (err) {
        console.error('Error processing scanned offer QR:', err);
        setError(`Failed to process offer QR: ${err instanceof Error ? err.message : 'Unknown error'}`);
        // Reset chunk scanning state
        setIsMultiChunkMode(false);
        setScannedChunks([]);
        setTotalChunksExpected(null);
    } finally {
        setLoading(false);
    }
};


  const processOfferData = async (offerData: WebRTCConnectionData) => {
    if (!webrtcService || !user?.email) {
      setError('Cannot process offer: service or user missing.');
      setStep('scan');
      return;
    }
    try {
      const answer = await webrtcService.initiateReceiverConnection(offerData);
      const answerConnectionData: WebRTCConnectionData = { type: 'answer', sdp: answer.sdp, senderID: user.email };
      const chunks = splitConnectionData(answerConnectionData);
      setAnswerQrDataChunks(chunks);
      setCurrentAnswerChunkIndex(0);
      setStep('createAnswer');

      webrtcService.onMessage(async (message) => {
        console.log('Receiver received message:', message);
        if (message.type === 'payment') {
          await handlePaymentReceived(message);
        }
      });

      webrtcService.onConnectionStateChange((state) => {
        console.log('Receiver connection state:', state);
        if (state === 'connected') {
          toast({ title: "Connection Established", description: "Securely connected to sender." });
          setStep('waitForPayment');
        } else if (['failed', 'disconnected', 'closed'].includes(state)) {
          if (step !== 'complete' && transaction?.status !== 'completed') {
            setError('Connection lost. Please try again or cancel.');
            // Don't auto-reset, let user decide via cancel or retry scan
          }
        }
      });

    } catch (err) {
      console.error('Error creating answer:', err);
      setError(`Failed to create answer: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('scan');
    }
  };

  const handlePaymentReceived = async (paymentData: any) => {
    if (!user?.email || !webrtcService) {
        console.error("User or WebRTC service not available for handling payment.");
        setError("Cannot process payment: critical components missing.");
        return;
    }

    console.log('Payment data received by receiver:', paymentData);
    if (!paymentData.transactionId || !paymentData.amount || !paymentData.senderID) {
      console.error('Invalid payment data received:', paymentData);
      setError('Received invalid payment data from sender.');
      // Send a failure receipt if possible
      try {
        await webrtcService.sendMessage({
          type: 'receipt',
          transactionId: paymentData.transactionId || 'unknown_tx',
          status: 'failed',
          error: 'Invalid payment data received by recipient',
        });
      } catch (e) { console.error("Failed to send error receipt for invalid payment data", e); }
      return;
    }

    // Idempotency Check
    const existingTransactions = await storageService.getTransactions();
    const alreadyCompletedTx = existingTransactions.find(
      (tx: Transaction) => tx.type === 'receive' && tx.senderTransactionId === paymentData.transactionId && tx.status === 'completed'
    );

    if (alreadyCompletedTx) {
      console.log(`Payment ${paymentData.transactionId} already completed. Resending receipt ${alreadyCompletedTx.receiptId}.`);
      setTransaction(alreadyCompletedTx); // Show existing
      setStep('complete');
      toast({ title: "Payment Already Processed", description: `This payment was already successfully recorded.`});
      try {
        await webrtcService.sendMessage({
          type: 'receipt',
          receiptId: alreadyCompletedTx.receiptId,
          transactionId: paymentData.transactionId,
          status: 'success'
        });
      } catch (e) { console.error("Failed to resend success receipt", e); }
      return;
    }

    const newReceiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let currentTransactionRecord: Transaction = {
      id: newReceiptId,
      receiptId: newReceiptId,
      type: 'receive',
      amount: Number(paymentData.amount),
      sender: paymentData.senderID,
      recipient: user.email,
      timestamp: paymentData.timestamp || Date.now(),
      note: paymentData.note,
      status: 'pending',
      senderTransactionId: paymentData.transactionId,
      synced: false,
    };
    setTransaction(currentTransactionRecord); // Show pending state
    console.log(`Attempting to save transaction ${currentTransactionRecord.id} with status: ${currentTransactionRecord.status} (initial pending) for senderTxId: ${currentTransactionRecord.senderTransactionId}`);
    await storageService.saveTransaction(currentTransactionRecord);

    try {
      await addToOfflineBalance(currentTransactionRecord.amount);
      currentTransactionRecord = { ...currentTransactionRecord, status: 'completed' };
      setTransaction(currentTransactionRecord);
      console.log(`Attempting to save transaction ${currentTransactionRecord.id} with status: ${currentTransactionRecord.status} (completed)`);
      await storageService.saveTransaction(currentTransactionRecord);

      console.log('Sending success receipt:', { receiptId: currentTransactionRecord.receiptId, transactionId: currentTransactionRecord.senderTransactionId });
      await webrtcService.sendMessage({
        type: 'receipt',
        receiptId: currentTransactionRecord.receiptId,
        transactionId: currentTransactionRecord.senderTransactionId!,
        status: 'success'
      });
      setStep('complete');
      toast({ title: "Payment Received!", description: `$${currentTransactionRecord.amount.toFixed(2)} added to offline balance.` });

    } catch (err) {
      console.error('Error processing payment or sending receipt:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Payment processing error: ${errorMessage}`);

      // Ensure we only save 'failed' state if not already completed or failed.
      // (The idempotency check handles already 'completed', this handles if it was 'pending' then failed)
      if (currentTransactionRecord.status !== 'completed' && currentTransactionRecord.status !== 'failed') {
        currentTransactionRecord = { ...currentTransactionRecord, status: 'failed' };
        setTransaction(currentTransactionRecord);
        console.log(`Attempting to save transaction ${currentTransactionRecord.id} with status: ${currentTransactionRecord.status} (from error)`);
        await storageService.saveTransaction(currentTransactionRecord);
      }

      try {
        console.log('Sending failure receipt:', { receiptId: currentTransactionRecord.receiptId, transactionId: currentTransactionRecord.senderTransactionId, error: errorMessage });
        await webrtcService.sendMessage({
          type: 'receipt',
          receiptId: currentTransactionRecord.receiptId, // Send our receipt ID even for failure
          transactionId: currentTransactionRecord.senderTransactionId!,
          status: 'failed',
          error: errorMessage
        });
      } catch (e) { console.error("Failed to send failure receipt", e); }
      // Do not change step here, allow user to see error on current step or handle via connection state.
    }
  };

  const resetProcess = () => {
    setError(null);
    // setTransaction(null); // Keep last transaction for display if user just wants to go back
    setAnswerQrDataChunks([]);
    setCurrentAnswerChunkIndex(0);
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);

    if (webrtcService) {
      webrtcService.closeConnection();
      if (user?.email) {
        const service = createWebRTCService(user.email);
        setWebrtcService(service);
      } else {
        setWebrtcService(null);
      }
    }
    setStep('scan'); // Go back to scan step
  };

  const readyToScan = !!user?.email && !!webrtcService;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
         <Button variant="ghost" onClick={() => navigate('/offline')} className="mr-4">
  <ArrowLeft className="h-4 w-4 mr-2" />
  Back to Offline
</Button>

          <h1 className="text-2xl font-bold text-dark">Receive Money (WebRTC)</h1>
        </div>

        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === 'scan' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold">Scan Sender's QR Code</h2>
              <p className="text-sm text-gray-500">Scan the QR code from the sender to initiate connection.</p>
              {readyToScan ? (
                <GreenButton onClick={() => { setError(null); setShowScanner(true); }} className="w-full">
                  <ScanLine className="mr-2 h-4 w-4" /> Scan Sender's QR
                </GreenButton>
              ) : (<p>Initializing WebRTC service...</p>)}
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
          )}

          {showScanner && (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                    <h3 className="text-lg font-semibold mb-4">Scanning Sender's QR</h3>
                    <QrScanner
                        onScan={handleQrCodeScanned}
                        onError={(scanError) => { console.error('Scanner error:', scanError.message); setError(scanError.message); setShowScanner(false); }}
                        onCancel={() => setShowScanner(false) }
                    />
                    <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full mt-4">Close Scanner</Button>
                </div>
            </div>
          )}

          {step === 'createAnswer' && answerQrDataChunks.length > 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">
                    {answerQrDataChunks.length > 1 ? `Show QR ${currentAnswerChunkIndex + 1}/${answerQrDataChunks.length}` : "Show QR Code to Sender"}
                </h2>
                <p className="text-sm text-gray-500">Sender needs to scan this to complete connection.</p>
              </div>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCode value={answerQrDataChunks[currentAnswerChunkIndex]} size={256} />
                </div>
              </div>
               {answerQrDataChunks.length > 1 && (
                <div className="flex justify-between space-x-4">
                  <Button variant="outline" onClick={() => setCurrentAnswerChunkIndex(prev => Math.max(0, prev - 1))} disabled={currentAnswerChunkIndex === 0}>
                    <ChevronLeft /> Previous
                  </Button>
                  <Button variant="outline" onClick={() => setCurrentAnswerChunkIndex(prev => Math.min(answerQrDataChunks.length - 1, prev + 1))} disabled={currentAnswerChunkIndex === answerQrDataChunks.length - 1}>
                    Next <ChevronRight />
                  </Button>
                </div>
              )}
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
          )}

          {step === 'waitForPayment' && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-greenleaf-600 mx-auto animate-spin" />
              <h2 className="text-xl font-semibold">Waiting for Payment...</h2>
              <p className="text-sm text-gray-500">Connection established. Waiting for sender to complete payment.</p>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
          )}

          {step === 'complete' && transaction && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Payment Received!</h2>
              </div>
              <Card>
                <CardHeader><CardTitle>Payment Details</CardTitle><CardDescription>Receiver Tx ID: {transaction.id}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">${transaction.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sender</span><span>{transaction.sender}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(transaction.timestamp).toLocaleString()}</span></div>
                  {transaction.note && (<div><span className="text-gray-500 block mb-1">Note</span><p className="bg-gray-50 p-2 rounded text-sm">{transaction.note}</p></div>)}
                  <div className="pt-2"><span className="text-gray-500 block mb-1">Our Receipt ID</span><p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">{transaction.receiptId}</p></div>
                  {transaction.senderTransactionId && <div className="pt-2"><span className="text-gray-500 block mb-1">Sender's Tx ID</span><p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">{transaction.senderTransactionId}</p></div>}
                </CardContent>
                <CardFooter><GreenButton onClick={() => navigate('/offline')} className="w-full">Done</GreenButton></CardFooter>
              </Card>
            </div>
          )}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default WebRTCReceiveMoney;
