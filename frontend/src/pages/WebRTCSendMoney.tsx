// WebRTCSendMoney.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { ArrowLeft, Send, RefreshCw, CheckCircle, QrCode, ScanLine, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData, splitConnectionData, joinConnectionData } from '@/utils/qrCodeUtils';
import { storageService } from '@/services/storageService';

enum SendMoneyStep {
  input = 'input',
  createOffer = 'createOffer',
  waitForAnswer = 'waitForAnswer',
  sending = 'sending',
  waitForReceipt = 'waitForReceipt',
  receiptTimeout = 'receiptTimeout',
  complete = 'complete'
};

interface Transaction {
  id: string;
  type: 'send';
  amount: number;
  sender: string;
  recipient: string;
  timestamp: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string;
  synced?: boolean;
}

const WebRTCSendMoney: React.FC = () => {
  const { user } = useAuth();
  const { balance } = useWallet();
  const { offlineBalance, refreshOfflineBalance, addToOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();

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
  const [transaction, _setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);

  const transactionRef = useRef<Transaction | null>(null);
  const setTransaction = (tx: Transaction | null) => {
    transactionRef.current = tx;
    _setTransaction(tx);
  };

  // Persist transaction ID using useRef
  const transactionIdRef = useRef<string | null>(null);

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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setAmount('');
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setAmount(numValue);
      }
    }
  };

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
      const offerData = await webrtcService.initiateSenderConnection();
      console.log('Offer created successfully');
      try {
        const rawJsonSize = JSON.stringify(offerData).length;
        console.log(`Raw JSON data size: ${rawJsonSize} characters`);
        const dataChunks = splitConnectionData(offerData);
        console.log(`QR code data split into ${dataChunks.length} chunks`);
        dataChunks.forEach((chunk, index) => console.log(`Chunk ${index + 1} size: ${chunk.length} characters`));
        if (dataChunks.length === 1) {
          setOfferQrData(dataChunks[0]);
          setOfferQrDataChunks([]);
        } else {
          setOfferQrDataChunks(dataChunks);
          setCurrentQrChunkIndex(0);
          setOfferQrData(dataChunks[0]);
          toast({
            title: "Multiple QR Codes Required",
            description: `This connection requires ${dataChunks.length} QR codes. Please scan all of them in order.`,
            duration: 5000,
          });
        }
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

  const handleQrCodeScanned = async (data: string) => {
    console.log('QR code scanned, processing data...');
    if (!webrtcService || !user?.email) {
      console.error('WebRTC service not initialized or user not logged in');
      setError('WebRTC service not initialized or user not logged in');
      setShowScanner(false);
      return;
    }

    try {
      if (!data || data.trim() === '') throw new Error('Invalid QR code: empty data');
      if (data.startsWith('CHUNK:')) {
        const parts = data.split(':', 4);
        if (parts.length !== 4) throw new Error('Invalid chunk format');

        const currentChunk = parseInt(parts[1]);
        const totalChunks = parseInt(parts[2]);
        const chunkData = parts[3];

        console.log(`Received chunk ${currentChunk} of ${totalChunks}`);
        if (currentChunk === 1) {
          setScannedChunks([chunkData]);
          setTotalChunksExpected(totalChunks);
          setIsMultiChunkMode(true);
          toast({ title: "Multiple QR Codes Required", description: `This is chunk 1 of ${totalChunks}. Please scan all chunks in order.`, duration: 5000 });
        } else {
          setScannedChunks(prev => [...prev, chunkData]);
        }

        if (scannedChunks.length + 1 === totalChunks) {
          const allChunks = [...scannedChunks, chunkData];
          processAnswerData(allChunks);
          setShowScanner(false);
        } else {
          toast({ title: `Chunk ${currentChunk} Scanned`, description: `${totalChunks - currentChunk} more chunks to scan.`, duration: 3000 });
          return;
        }
      } else {
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

  const processAnswerData = async (chunks: string[]) => {
    setLoading(true);
    setError(null);
    try {
      let answerData: WebRTCConnectionData;
      if (chunks.length > 1 || isMultiChunkMode) {
        console.log(`Processing ${chunks.length} chunks...`);
        answerData = joinConnectionData(chunks);
      } else {
        answerData = decodeConnectionData(chunks[0]);
      }

      console.log('Decoded answer data:', answerData);
      if (answerData.type !== 'answer') throw new Error('Invalid answer data: wrong type');

      await webrtcService!.completeSenderConnection(answerData);

      webrtcService!.onMessage(async (message) => {
        console.log('Received message:', message);

        if (message.type === 'receipt') {
          console.log('Receipt received from receiver:', message);

          const currentTransaction = transactionRef.current;

          if (currentTransaction) {
            // Avoid saving failed states multiple times
            if (currentTransaction.status === 'failed' && message.status !== 'success') {
              console.log(`Transaction ${currentTransaction.id} already failed, skipping save.`);
              return;
            }

            const updatedTransaction: Transaction = {
              ...currentTransaction,
              receiptId: message.receiptId,
              status: message.status === 'success' ? 'completed' : 'failed'
            };
            setTransaction(updatedTransaction);
            console.log(`Logging transaction ID before saving (receipt): ${updatedTransaction.id}`);
            await storageService.saveTransaction(updatedTransaction); // Save updated transaction

            if (message.status === 'success') {
              console.log('Success receipt received, completing payment process');
              const sentAmount = typeof amount === 'number' ? amount : 0;

              if (sentAmount > 0) {
                addToOfflineBalance(-sentAmount).then(() => {
                  toast({
                    title: "Payment Sent",
                    description: `$${sentAmount.toFixed(2)} sent successfully. Offline balance updated.`,
                    duration: 5000,
                  });
                }).catch(err => {
                  console.error("Failed to update offline balance for sender:", err);
                  toast({
                    title: "Balance Update Error",
                    description: "Could not update offline balance locally.",
                    variant: "destructive"
                  });
                });
              }
              setStep(SendMoneyStep.complete);
            } else {
              console.error('Failed receipt received:', message.error);
              setError(`Payment failed on recipient side: ${message.error || 'Unknown error'}`);
              setStep(SendMoneyStep.input);
            }
          } else {
            console.error('Receipt received but no transaction found locally (via ref). This might indicate a desync or earlier error.');
            setError('Receipt received, but local transaction context was lost. Please verify with recipient.');
            setStep(SendMoneyStep.input);
          }
        }
      });

      webrtcService!.onConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          console.log('WebRTC connection established');
          toast({ title: "Connection Established", description: "Connected to receiver device", duration: 3000 });
          setStep(SendMoneyStep.sending);

          setTimeout(() => {
            if (amount === '' || !user?.email) {
              setError("Amount not set or user not identified before sending payment.");
              setStep(SendMoneyStep.input);
              return;
            }

            // Ensure transaction ID is set only once and reused consistently
            if (!transactionIdRef.current) {
              transactionIdRef.current = uuidv4(); // Set only if not already set
            }
            const currentTransactionId = transactionIdRef.current;

            const paymentData = {
              type: 'payment',
              amount: amount,
              senderID: user.email,
              recipientID: answerData.senderID || recipientId || 'unknown',
              timestamp: Date.now(),
              note: note,
              transactionId: currentTransactionId
            };

            const newTransaction: Transaction = {
              id: currentTransactionId,
              type: 'send',
              amount: Number(amount),
              sender: user?.email || 'unknown',
              recipient: answerData.senderID || recipientId || 'unknown',
              timestamp: paymentData.timestamp,
              note: note,
              status: 'pending' as const,
              receiptId: '',
              synced: false
            };
            setTransaction(newTransaction);
            console.log(`Logging transaction ID before saving (initial): ${newTransaction.id}`);
            storageService.saveTransaction(newTransaction); // Save initial transaction

            handlePaymentConfirmation(paymentData, newTransaction);
          }, 500);
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          console.log('WebRTC connection lost:', state);
          // Only set error and reset if the current step is not complete or timed out,
          // AND the transaction status is not 'completed'.
          if (step !== SendMoneyStep.complete && step !== SendMoneyStep.receiptTimeout && transactionRef.current?.status !== 'completed') {
            // Avoid saving failed states multiple times
            if (transactionRef.current && transactionRef.current.status !== 'failed') {
              console.log(`Logging transaction ID before saving (connection lost): ${transactionRef.current.id}`);
              storageService.saveTransaction({ ...transactionRef.current, status: 'failed' as const }); // Save failed transaction
            }
            setError('Connection lost. Please try again.');
            setStep(SendMoneyStep.createOffer);
          }
        }
      });
    } catch (err) {
      console.error('Error processing answer data:', err);
      setError(`Failed to process answer data: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep(SendMoneyStep.createOffer);
      setScannedChunks([]);
      setTotalChunksExpected(null);
      setIsMultiChunkMode(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmation = async (paymentData: any, currentTxForConfirmation: Transaction) => {
    console.log('handlePaymentConfirmation called with transaction:', currentTxForConfirmation);
    if (!currentTxForConfirmation || amount === '') {
      console.error('Cannot confirm payment: transaction or amount is missing');
      setError('Critical error: Transaction data missing during payment confirmation.');
      setStep(SendMoneyStep.input);
      return;
    }

    if (step === SendMoneyStep.complete || step === SendMoneyStep.receiptTimeout) {
      console.log('Payment already processed or timed out, skipping confirmation logic.');
      return;
    }

    try {
      console.log('Confirming payment of', paymentData.amount);
      console.log('Current offline balance:', offlineBalance);
      await webrtcService!.sendMessage(paymentData);
      console.log('Payment sent, waiting for receipt...');
      setStep(SendMoneyStep.waitForReceipt);

      const receiptTimeoutId = setTimeout(() => {
        if (transactionRef.current && transactionRef.current.id === currentTxForConfirmation.id && step === SendMoneyStep.waitForReceipt) {
          console.warn('Receipt timeout occurred for transaction:', currentTxForConfirmation.id);
          setError("Receipt timeout. The payment may have been sent, but confirmation was not received. Please check with the recipient.");

          // Avoid saving failed states multiple times
          if (transactionRef.current.status !== 'failed') {
            const failedTransaction = { ...currentTxForConfirmation, status: 'failed' as const };
            setTransaction(failedTransaction);
            console.log(`Logging transaction ID before saving (receipt timeout): ${failedTransaction.id}`);
            storageService.saveTransaction(failedTransaction); // Save failed transaction
          }
          setStep(SendMoneyStep.receiptTimeout);
        }
      }, 30000);
    } catch (error) {
      console.error('Error sending payment message:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(`Failed to send payment message: ${errorMessage}`);
      if (currentTxForConfirmation) {
        // Avoid saving failed states multiple times
        if (currentTxForConfirmation.status !== 'failed') {
          const failedTransaction = { ...currentTxForConfirmation, status: 'failed' as const };
          setTransaction(failedTransaction);
          console.log(`Logging transaction ID before saving (send error): ${failedTransaction.id}`);
          storageService.saveTransaction(failedTransaction); // Save failed transaction
        }
      }

      toast({ title: "Payment Send Error", description: errorMessage, variant: "destructive", duration: 7000 });
      setStep(SendMoneyStep.input);
    }
  };

  const resetForm = () => {
    setAmount('');
    setRecipientId('');
    setNote('');
    setError(null);
    setOfferQrData(null);
    setOfferQrDataChunks([]);
    setCurrentQrChunkIndex(0);
    setTransaction(null);
    transactionIdRef.current = null; // Clear the transaction ID on reset
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);
    if (webrtcService) {
      webrtcService.closeConnection();
      if (user?.email) {
        const service = createWebRTCService(user.email);
        setWebrtcService(service);
      }
    }
  };

  const handleCancelAndReset = () => {
    resetForm();
    setStep(SendMoneyStep.input);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={() => {
              if (step === SendMoneyStep.input || step === SendMoneyStep.complete || step === SendMoneyStep.receiptTimeout) {
                navigate('/offline');
              } else {
                handleCancelAndReset();
              }
            }}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === SendMoneyStep.input || step === SendMoneyStep.complete || step === SendMoneyStep.receiptTimeout ? 'Back' : 'Cancel'}
          </Button>
          <h1 className="text-2xl font-bold text-dark">Send Money (WebRTC)</h1>
        </div>

        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === SendMoneyStep.input && (
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
                  <p className="text-xs text-gray-500">Available offline balance: ${offlineBalance.toFixed(2)}</p>
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
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <GreenButton
                onClick={handleCreateOffer}
                disabled={loading || amount === '' || Number(amount) <= 0 || Number(amount) > offlineBalance}
                className="w-full"
              >
                {loading ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Creating Connection...</>) : (<><QrCode className="mr-2 h-4 w-4" />Generate Payment QR</>)}
              </GreenButton>
            </div>
          )}

          {step === SendMoneyStep.createOffer && offerQrData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Show QR Code to Sender</h2>
                <p className="text-sm text-gray-500">
                  {offerQrDataChunks.length > 1 ? `Show QR code ${currentQrChunkIndex + 1} of ${offerQrDataChunks.length} to the sender.` : 'Show this QR code to the sender to establish the connection.'}
                </p>
              </div>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCode value={offerQrData} size={256} />
                </div>
              </div>
              {offerQrDataChunks.length > 1 && (
                <div className="flex justify-between space-x-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newIndex = Math.max(0, currentQrChunkIndex - 1);
                      setCurrentQrChunkIndex(newIndex);
                      setOfferQrData(offerQrDataChunks[newIndex]);
                    }}
                    disabled={currentQrChunkIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newIndex = Math.min(offerQrDataChunks.length - 1, currentQrChunkIndex + 1);
                      setCurrentQrChunkIndex(newIndex);
                      setOfferQrData(offerQrDataChunks[newIndex]);
                    }}
                    disabled={currentQrChunkIndex === offerQrDataChunks.length - 1}
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button onClick={() => setShowScanner(true)} className="w-full">
                <ScanLine className="mr-2 h-4 w-4" /> Scan Receiver's QR (Answer)
              </Button>
              <Button variant="outline" onClick={handleCancelAndReset} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {step === SendMoneyStep.sending && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
              <h2 className="text-xl font-semibold">Sending Payment...</h2>
              <p className="text-sm text-gray-500">Please keep your devices close.</p>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button variant="outline" onClick={handleCancelAndReset} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {step === SendMoneyStep.waitForReceipt && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
              <h2 className="text-xl font-semibold">Waiting for Receipt...</h2>
              <p className="text-sm text-gray-500">Confirming transaction with the recipient.</p>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button variant="outline" onClick={handleCancelAndReset} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {step === SendMoneyStep.receiptTimeout && (
            <div className="space-y-6 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h2 className="text-xl font-semibold">Receipt Timeout</h2>
              <p className="text-sm text-gray-500">
                {error || "The payment may have been sent, but confirmation was not received. Please check with the recipient."}
              </p>
              {transactionRef.current && (
                <Card>
                  <CardHeader><CardTitle>Payment Details</CardTitle><CardDescription>Transaction ID: {transactionRef.current.id}</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">${transactionRef.current.amount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Recipient</span><span>{transactionRef.current.recipient}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(transactionRef.current.timestamp).toLocaleString()}</span></div>
                    {transactionRef.current.note && (<div><span className="text-gray-500 block mb-1">Note</span><p className="bg-gray-50 p-2 rounded text-sm">{transactionRef.current.note}</p></div>)}
                    <div className="pt-2"><span className="text-gray-500 block mb-1">Status</span><p className="bg-yellow-50 p-2 rounded text-sm font-semibold">Pending/Unknown</p></div>
                  </CardContent>
                  <CardFooter>
                    <Button onClick={handleCancelAndReset} className="w-full">
                      Done
                    </Button>
                  </CardFooter>
                </Card>
              )}
              <Button onClick={handleCancelAndReset} className="w-full">
                New Transaction
              </Button>
            </div>
          )}

          {step === SendMoneyStep.complete && transactionRef.current && (
            <div className="space-y-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold">Payment Sent!</h2>
              <p className="text-sm text-gray-500">Your payment has been successfully sent offline.</p>
              <Card>
                <CardHeader><CardTitle>Payment Receipt</CardTitle><CardDescription>Transaction ID: {transactionRef.current.id}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">${transactionRef.current.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Recipient</span><span>{transactionRef.current.recipient}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(transactionRef.current.timestamp).toLocaleString()}</span></div>
                  {transactionRef.current.note && (<div><span className="text-gray-500 block mb-1">Note</span><p className="bg-gray-50 p-2 rounded text-sm">{transactionRef.current.note}</p></div>)}
                  <div className="pt-2"><span className="text-gray-500 block mb-1">Receipt ID</span><p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">{transactionRef.current.receiptId}</p></div>
                </CardContent>
                <CardFooter><GreenButton onClick={() => navigate('/offline')} className="w-full">Done</GreenButton></CardFooter>
              </Card>
            </div>
          )}

          {showScanner && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-4">Scan Receiver's QR Code</h3>
                <p className="text-sm text-gray-500 mb-4">Position the QR code from the receiver within the scanning area.</p>
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
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default WebRTCSendMoney;