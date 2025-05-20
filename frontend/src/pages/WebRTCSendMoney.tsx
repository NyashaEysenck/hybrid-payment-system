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
// import { Separator } from "@/components/ui/separator"; // Not used
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
  receiptId: string; // ID of the receipt received from the recipient
  synced?: boolean;
}

const WebRTCSendMoney: React.FC = () => {
  const { user } = useAuth();
  const { offlineBalance, addToOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<SendMoneyStep>(SendMoneyStep.input);
  const [amount, setAmount] = useState<number | ''>('');
  const [recipientId, setRecipientId] = useState(''); // Not directly used in WebRTC logic but kept for form
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerQrData, setOfferQrData] = useState<string | null>(null);
  const [offerQrDataChunks, setOfferQrDataChunks] = useState<string[]>([]);
  const [currentQrChunkIndex, setCurrentQrChunkIndex] = useState(0);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [_transaction, _setTransaction] = useState<Transaction | null>(null); // Renamed to avoid confusion
  const [showScanner, setShowScanner] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);

  const transactionRef = useRef<Transaction | null>(null);
  const setTransaction = (tx: Transaction | null) => {
    transactionRef.current = tx;
    _setTransaction(tx);
  };

  // To ensure a transaction ID is generated once per payment attempt being actively processed
  const currentTransactionAttemptIdRef = useRef<string | null>(null);


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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value === '' ? '' : parseFloat(value));
  };

  const handleCreateOffer = async () => {
    if (!webrtcService || !user?.email) {
      setError('WebRTC service not initialized or user not logged in.');
      return;
    }
    if (amount === '' || amount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (amount > offlineBalance) {
      setError(`Insufficient offline balance. Available: $${offlineBalance.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError(null);
    currentTransactionAttemptIdRef.current = uuidv4(); // Generate ID for this new attempt
    console.log(`Initiating new payment attempt, generated txId: ${currentTransactionAttemptIdRef.current}`);

    try {
      const offer = await webrtcService.initiateSenderConnection();
      const offerConnectionData: WebRTCConnectionData = { type: 'offer', sdp: offer.sdp, senderID: user.email };
      const chunks = splitConnectionData(offerConnectionData);
      setOfferQrDataChunks(chunks);
      setOfferQrData(chunks[0]);
      setCurrentQrChunkIndex(0);
      setStep(SendMoneyStep.createOffer);
      if (chunks.length > 1) {
        toast({ title: "Multiple QR Codes", description: `Displaying 1 of ${chunks.length}. Scan all in order.` });
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setError(`Failed to create offer: ${err instanceof Error ? err.message : 'Unknown error'}`);
      currentTransactionAttemptIdRef.current = null; // Reset on failure
    } finally {
      setLoading(false);
    }
  };

  const handleQrCodeScanned = async (data: string) => {
    if (!webrtcService) return;
    setShowScanner(false);
    setLoading(true);
    setError(null);

    try {
        let fullData = data;
        if (data.startsWith('CHUNK:')) {
            const parts = data.split(':', 4);
            if (parts.length !== 4) throw new Error('Invalid chunk format');
            const currentChunk = parseInt(parts[1], 10);
            const totalChunks = parseInt(parts[2], 10);
            const chunkData = parts[3];

            let currentScannedChunks = scannedChunks;
            if (currentChunk === 1) {
                currentScannedChunks = new Array(totalChunks).fill(null);
                setTotalChunksExpected(totalChunks);
                setIsMultiChunkMode(true);
                toast({ title: "Multiple QR Codes", description: `Scanned chunk 1 of ${totalChunks}.` });
            }
            currentScannedChunks[currentChunk - 1] = chunkData;
            setScannedChunks([...currentScannedChunks]);


            if (currentScannedChunks.filter(Boolean).length === totalChunks) {
                fullData = currentScannedChunks.join('');
                console.log('All answer chunks received, processing combined data.');
                setIsMultiChunkMode(false); // Reset for next time
                setScannedChunks([]);
                setTotalChunksExpected(null);
            } else {
                toast({ title: `Chunk ${currentChunk} Scanned`, description: `${totalChunks - currentScannedChunks.filter(Boolean).length} more chunks to scan.` });
                setLoading(false);
                setShowScanner(true); // Keep scanner open
                return;
            }
        }
        const answerData = isMultiChunkMode || chunks.length > 1 ? joinConnectionData([fullData]) : decodeConnectionData(fullData);
        if (answerData.type !== 'answer') throw new Error('Invalid QR code: Not an answer.');
        await processAnswerData(answerData);

    } catch (err) {
        console.error('Error processing scanned QR code:', err);
        setError(`Failed to process QR: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setStep(SendMoneyStep.createOffer); // Go back to show offer QR
        // Reset chunk scanning state
        setIsMultiChunkMode(false);
        setScannedChunks([]);
        setTotalChunksExpected(null);
    } finally {
        setLoading(false);
    }
};


  const processAnswerData = async (answerData: WebRTCConnectionData) => {
    if (!webrtcService || !user?.email || !currentTransactionAttemptIdRef.current) {
      setError('Cannot process answer: service, user, or transaction attempt ID missing.');
      setStep(SendMoneyStep.input);
      return;
    }
    setLoading(true);
    try {
      await webrtcService.completeSenderConnection(answerData);

      webrtcService.onMessage(async (message) => {
        console.log('Sender received message:', message);
        const currentTx = transactionRef.current;
        if (message.type === 'receipt') {
          if (!currentTx) {
            console.error('Receipt received, but no local transaction (ref) to update.');
            setError('Receipt context lost. Please verify with recipient.');
            setStep(SendMoneyStep.input);
            return;
          }
          // IMPORTANT: Match receipt's transactionId with the ID of the transaction we sent
          if (message.transactionId !== currentTx.id) {
            console.warn(`Received receipt for txId ${message.transactionId}, but current active tx is ${currentTx.id}. Ignoring for current transaction.`);
            // Potentially find and update the historic transaction if needed and if it's still pending
            return;
          }

          if (currentTx.status === 'completed' || currentTx.status === 'failed') {
             console.log(`Transaction ${currentTx.id} already ${currentTx.status}. Ignoring duplicate receipt info.`);
             return;
          }

          const newStatus = message.status === 'success' ? 'completed' : 'failed';
          const updatedTransaction: Transaction = { ...currentTx, status: newStatus, receiptId: message.receiptId || '' };
          setTransaction(updatedTransaction);
          console.log(`Attempting to save transaction ${updatedTransaction.id} with status: ${updatedTransaction.status} (from receipt)`);
          await storageService.saveTransaction(updatedTransaction);

          if (newStatus === 'completed') {
            toast({ title: "Payment Sent", description: `$${updatedTransaction.amount.toFixed(2)} sent successfully.` });
            if (typeof amount === 'number' && amount > 0) { // Ensure amount is a positive number
              await addToOfflineBalance(-amount); // Deduct from sender's balance
            }
            setStep(SendMoneyStep.complete);
            currentTransactionAttemptIdRef.current = null; // Clear after completion
          } else {
            setError(`Payment failed on recipient side: ${message.error || 'Unknown error'}`);
            setStep(SendMoneyStep.input); // Or a specific error step
            currentTransactionAttemptIdRef.current = null; // Clear on failure
          }
        }
      });

      webrtcService.onConnectionStateChange(async (state) => {
        console.log('Sender connection state:', state);
        if (state === 'connected') {
          toast({ title: "Connection Established", description: "Securely connected to receiver." });
          // Create and save the pending transaction record
          const paymentAmount = typeof amount === 'number' ? amount : 0;
          const newTransaction: Transaction = {
            id: currentTransactionAttemptIdRef.current!, // Use the generated ID for this attempt
            type: 'send',
            amount: paymentAmount,
            sender: user!.email!,
            recipient: answerData.senderID || recipientId || 'unknown', // recipientId from form is fallback
            timestamp: Date.now(),
            note: note,
            status: 'pending',
            receiptId: '', // Will be filled upon successful receipt
            synced: false,
          };
          setTransaction(newTransaction);
          console.log(`Attempting to save transaction ${newTransaction.id} with status: ${newTransaction.status} (initial pending)`);
          await storageService.saveTransaction(newTransaction);

          // Send payment details
          const paymentData = {
            type: 'payment',
            transactionId: newTransaction.id, // Send our generated transaction ID
            amount: newTransaction.amount,
            senderID: newTransaction.sender,
            note: newTransaction.note,
            timestamp: newTransaction.timestamp,
          };
          await handlePaymentConfirmation(paymentData, newTransaction);
        } else if (['failed', 'disconnected', 'closed'].includes(state)) {
           const currentTx = transactionRef.current;
           if (currentTx && currentTx.status === 'pending') {
                setError('Connection lost before payment confirmation.');
                // Optionally mark as failed if connection drops definitively while pending and no resolution.
                // For now, allow going back to createOffer to retry.
           }
          if (step !== SendMoneyStep.complete && step !== SendMoneyStep.receiptTimeout) {
             setStep(SendMoneyStep.createOffer); // Allow retrying the offer scan
          }
        }
      });

    } catch (err) {
      console.error('Error processing answer data:', err);
      setError(`Failed to establish connection: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setStep(SendMoneyStep.createOffer); // Go back to offer QR
      currentTransactionAttemptIdRef.current = null; // Reset on failure
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentConfirmation = async (paymentData: any, txInProgress: Transaction) => {
    if (!webrtcService) {
      setError('WebRTC service not available to send payment.');
      return;
    }
    setStep(SendMoneyStep.sending); // Intermediate step while sending
    try {
      await webrtcService.sendMessage(paymentData);
      console.log('Payment message sent, txId:', paymentData.transactionId);
      setStep(SendMoneyStep.waitForReceipt);

      // Timeout for receipt
      setTimeout(async () => {
        const currentTx = transactionRef.current;
        if (currentTx && currentTx.id === txInProgress.id && currentTx.status === 'pending') {
          console.warn(`Receipt timeout for transaction ${currentTx.id}.`);
          setError("Receipt timeout. Payment status uncertain. Please verify with recipient.");
          if (currentTx.status !== 'failed' && currentTx.status !== 'completed') { // Avoid multiple failed saves
            const failedTransaction: Transaction = { ...currentTx, status: 'failed' };
            setTransaction(failedTransaction);
            console.log(`Attempting to save transaction ${failedTransaction.id} with status: ${failedTransaction.status} (from timeout)`);
            await storageService.saveTransaction(failedTransaction);
          }
          setStep(SendMoneyStep.receiptTimeout);
          currentTransactionAttemptIdRef.current = null;
        }
      }, 30000); // 30 seconds timeout

    } catch (err) {
      console.error('Error sending payment message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to send payment: ${errorMessage}`);
      if (txInProgress.status !== 'failed' && txInProgress.status !== 'completed') { // Check status of txInProgress
        const failedTransaction: Transaction = { ...txInProgress, status: 'failed' };
        setTransaction(failedTransaction);
        console.log(`Attempting to save transaction ${failedTransaction.id} with status: ${failedTransaction.status} (from send error)`);
        await storageService.saveTransaction(failedTransaction);
      }
      setStep(SendMoneyStep.input); // Or a specific error step
      currentTransactionAttemptIdRef.current = null;
      toast({ title: "Payment Send Error", description: errorMessage, variant: "destructive" });
    }
  };

  const resetFormAndProcess = (goHome: boolean = false) => {
    setAmount('');
    setRecipientId('');
    setNote('');
    setError(null);
    setOfferQrData(null);
    setOfferQrDataChunks([]);
    setCurrentQrChunkIndex(0);
    setTransaction(null);
    setShowScanner(false);
    setScannedChunks([]);
    setTotalChunksExpected(null);
    setIsMultiChunkMode(false);
    currentTransactionAttemptIdRef.current = null; // Reset the attempt ID

    if (webrtcService) {
      webrtcService.closeConnection(); // Close existing
      if (user?.email) { // Re-initialize for a fresh start if user is still there
        const service = createWebRTCService(user.email);
        setWebrtcService(service);
      } else {
        setWebrtcService(null);
      }
    }
    if (goHome) {
        navigate('/offline');
    } else {
        setStep(SendMoneyStep.input);
    }
  };

  const handleBackOrCancel = () => {
    if (step === SendMoneyStep.input || step === SendMoneyStep.complete || step === SendMoneyStep.receiptTimeout) {
      resetFormAndProcess(true); // Go to offline page
    } else {
      // For other steps, provide a way to cancel the current operation and reset
      resetFormAndProcess(false); // Go to input step
    }
  };


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Button variant="ghost" onClick={handleBackOrCancel} className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === SendMoneyStep.input || step === SendMoneyStep.complete || step === SendMoneyStep.receiptTimeout ? 'Back to Offline' : 'Cancel Payment'}
          </Button>
          <h1 className="text-2xl font-bold text-dark">Send Money (WebRTC)</h1>
        </div>

        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === SendMoneyStep.input && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Send Money Offline</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Enter amount. A QR code will be generated for the recipient to scan.
                </p>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={handleAmountChange} placeholder="0.00" className="pl-8 text-lg" />
                  </div>
                  <p className="text-xs text-gray-500">Available offline balance: ${offlineBalance.toFixed(2)}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipient">Recipient ID (Optional)</Label>
                  <Input id="recipient" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} placeholder="Recipient identifier" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note (Optional)</Label>
                  <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment purpose" className="resize-none" />
                </div>
              </div>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <GreenButton onClick={handleCreateOffer} disabled={loading || amount === '' || Number(amount) <= 0 || Number(amount) > offlineBalance} className="w-full">
                {loading ? (<><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Creating Offer...</>) : (<><QrCode className="mr-2 h-4 w-4" />Generate Payment QR</>)}
              </GreenButton>
            </div>
          )}

          {step === SendMoneyStep.createOffer && offerQrData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">
                  {offerQrDataChunks.length > 1 ? `Show QR ${currentQrChunkIndex + 1}/${offerQrDataChunks.length}` : "Show QR Code"}
                </h2>
                <p className="text-sm text-gray-500">Ask recipient to scan this QR code.</p>
              </div>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <QRCode value={offerQrData} size={256} />
                </div>
              </div>
              {offerQrDataChunks.length > 1 && (
                <div className="flex justify-between space-x-4">
                  <Button variant="outline" onClick={() => {const newIdx = Math.max(0, currentQrChunkIndex - 1); setCurrentQrChunkIndex(newIdx); setOfferQrData(offerQrDataChunks[newIdx]);}} disabled={currentQrChunkIndex === 0}>
                    <ChevronLeft /> Previous
                  </Button>
                  <Button variant="outline" onClick={() => {const newIdx = Math.min(offerQrDataChunks.length - 1, currentQrChunkIndex + 1); setCurrentQrChunkIndex(newIdx); setOfferQrData(offerQrDataChunks[newIdx]);}} disabled={currentQrChunkIndex === offerQrDataChunks.length - 1}>
                    Next <ChevronRight />
                  </Button>
                </div>
              )}
              <p className="text-center text-sm text-gray-500">Amount: ${typeof amount === 'number' ? amount.toFixed(2) : '0.00'}</p>
              {error && (<Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <GreenButton onClick={() => { setError(null); setShowScanner(true); }} className="w-full"><ScanLine className="mr-2 h-4 w-4" />Scan Recipient's Answer QR</GreenButton>
            </div>
          )}

          {showScanner && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-lg max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-4">Scan Recipient's Answer QR</h3>
                <QrScanner
                  onScan={handleQrCodeScanned}
                  onError={(scanError) => { console.error('Scanner error:', scanError.message); setError(scanError.message); setShowScanner(false); }}
                  onCancel={() => setShowScanner(false)}
                />
                <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full mt-4">Close Scanner</Button>
              </div>
            </div>
          )}

          {step === SendMoneyStep.sending && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-greenleaf-600 mx-auto animate-spin" />
              <h2 className="text-xl font-semibold">Establishing Connection & Sending...</h2>
              {error && (<Alert variant="destructive" className="mt-4"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
          )}

          {step === SendMoneyStep.waitForReceipt && (
            <div className="space-y-6 text-center">
              <RefreshCw className="h-12 w-12 text-greenleaf-600 mx-auto animate-spin" />
              <h2 className="text-xl font-semibold">Waiting for Receipt...</h2>
              <p className="text-xs text-gray-400 mt-2">This may take up to 30 seconds.</p>
              {error && (<Alert variant="destructive" className="mt-4"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
            </div>
          )}

          {step === SendMoneyStep.receiptTimeout && (
            <div className="space-y-6 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
              <h2 className="text-xl font-semibold">Receipt Timeout</h2>
              <p className="text-sm text-gray-500">Confirmation not received. Payment status is uncertain.</p>
              <p className="text-sm text-gray-500 mt-2">Please check with the recipient.</p>
              {_transaction && <p className="text-xs text-gray-400 mt-2">Transaction ID: {_transaction.id}</p>}
              {error && (<Alert variant="destructive" className="mt-4"><AlertTitle>Details</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}
              <GreenButton onClick={() => resetFormAndProcess(true)} className="w-full mt-6">Okay, Back to Offline</GreenButton>
              <Button variant="outline" onClick={() => resetFormAndProcess(false)} className="w-full mt-2">Try Another Payment</Button>
            </div>
          )}

          {step === SendMoneyStep.complete && _transaction && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold">Payment Sent!</h2>
              </div>
              <Card>
                <CardHeader><CardTitle>Payment Details</CardTitle><CardDescription>Transaction ID: {_transaction.id}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold">${_transaction.amount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Recipient</span><span>{_transaction.recipient}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Date</span><span>{new Date(_transaction.timestamp).toLocaleString()}</span></div>
                  {_transaction.note && (<div><span className="text-gray-500 block mb-1">Note</span><p className="bg-gray-50 p-2 rounded text-sm">{_transaction.note}</p></div>)}
                  {_transaction.receiptId && <div className="pt-2"><span className="text-gray-500 block mb-1">Recipient Receipt ID</span><p className="bg-gray-50 p-2 rounded text-xs font-mono break-all">{_transaction.receiptId}</p></div>}
                </CardContent>
                <CardFooter><GreenButton onClick={() => resetFormAndProcess(true)} className="w-full">Done</GreenButton></CardFooter>
              </Card>
            </div>
          )}
        </WhiteCard>
      </div>
    </Layout>
  );
};

export default WebRTCSendMoney;
