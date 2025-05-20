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
  const [transaction, _setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);
  
  const transactionRef = useRef<Transaction | null>(null);
  const transactionIdRef = useRef<string | null>(null);

  const setTransaction = (tx: Transaction | null) => {
    transactionRef.current = tx;
    _setTransaction(tx);
    if (tx) {
      transactionIdRef.current = tx.id;
    } else {
      transactionIdRef.current = null;
    }
  };

  const saveTransactionWithLog = async (tx: Transaction) => {
    console.log(`Saving transaction ${tx.id} with status ${tx.status}`);
    await storageService.saveTransaction(tx);
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

        if (updatedChunks.filter(Boolean).length === totalChunks) {
          console.log('All chunks received, processing...');
          const combinedData = updatedChunks.join('');
          try {
            const offerData = decodeConnectionData(combinedData);
            if (offerData.type !== 'offer') {
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

      const offerData = decodeConnectionData(data);
      if (offerData.type !== 'offer') {
        throw new Error('Invalid QR code: not an offer');
      }
      processOfferData(offerData);
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError(`Failed to process QR code: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep('scan');
    } finally {
      setLoading(false);
    }
  };

  const processOfferData = async (offerData: WebRTCConnectionData) => {
    if (!webrtcService) return;

    try {
      const answer = await webrtcService.initiateReceiverConnection(offerData);
      const answerData: WebRTCConnectionData = {
        type: 'answer',
        sdp: answer.sdp,
        senderID: user?.email || '',
      };

      const chunks = splitConnectionData(answerData);
      setAnswerQrDataChunks(chunks);
      setCurrentAnswerChunkIndex(0);
      setStep('createAnswer');

      webrtcService.onMessage(async (message) => {
        if (message.type === 'payment') {
          await handlePaymentReceived(message);
        }
      });

      webrtcService.onConnectionStateChange((state) => {
        if (state === 'connected') {
          toast({ title: "Connection Established", description: "Connected to sender device", duration: 3000 });
          setStep('waitForPayment');
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          if (step !== 'complete' && transactionRef.current?.status !== 'completed') {
            setError('Connection lost. Please try again.');
            resetProcess();
          }
        }
      });
    } catch (error) {
      console.error('Error creating answer:', error);
      setError(`Failed to create answer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStep('scan');
    }
  };

  const handlePaymentReceived = async (paymentData: any) => {
    let receiptId = '';
    let pendingTransaction: Transaction | null = null;

    try {
      if (!paymentData.amount || !paymentData.senderID || !paymentData.transactionId) {
        throw new Error('Invalid payment data');
      }

      // Use existing transaction ID if available
      receiptId = transactionIdRef.current 
        ? `receipt-${transactionIdRef.current}`
        : `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      const amount = Number(paymentData.amount);
      const newPendingTransaction: Transaction = {
        id: paymentData.transactionId,
        type: 'receive',
        amount: amount,
        sender: paymentData.senderID || 'unknown',
        recipient: user?.email || 'unknown',
        timestamp: paymentData.timestamp || Date.now(),
        note: paymentData.note,
        receiptId,
        status: 'pending',
        synced: false
      };

      // Only save if not already saved
      if (!transactionRef.current) {
        setTransaction(newPendingTransaction);
        await saveTransactionWithLog(newPendingTransaction);
      }
      pendingTransaction = newPendingTransaction;

      await addToOfflineBalance(amount);
      await webrtcService?.sendMessage({
        type: 'receipt',
        receiptId: receiptId,
        transactionId: paymentData.transactionId,
        status: 'success'
      });

      const completedTransaction: Transaction = {
        ...newPendingTransaction,
        status: 'completed'
      };
      setTransaction(completedTransaction);
      await saveTransactionWithLog(completedTransaction);

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

      if (pendingTransaction) {
        // Only save failed state if not already completed
        if (transactionRef.current?.status !== 'completed') {
          const failedTransaction: Transaction = {
            ...pendingTransaction,
            status: 'failed'
          };
          setTransaction(failedTransaction);
          await saveTransactionWithLog(failedTransaction);
        }
      }

      try {
        await webrtcService?.sendMessage({
          type: 'receipt',
          receiptId: receiptId,
          status: 'failed',
          error: errorMessage,
          transactionId: paymentData.transactionId
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
      setStep('waitForPayment');
    }
  };

  const resetProcess = () => {
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setAnswerQrDataChunks([]);
    setCurrentAnswerChunkIndex(0);
    setTransaction(null);
    setShowScanner(false);
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);

    if (webrtcService) {
      webrtcService.closeConnection();
    }

    if (user?.email) {
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
    }
  };

  const readyToScan = !!user?.email && !!webrtcService;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={() => navigate('/offline')} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-dark">Receive Money (WebRTC)</h1>
        </div>

        <WhiteCard className="p-6 max-w-md mx-auto">
          {/* Existing UI components remain the same, only transaction handling logic changed */}
          {/* ... (keep all JSX structure unchanged) ... */}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default WebRTCReceiveMoney;