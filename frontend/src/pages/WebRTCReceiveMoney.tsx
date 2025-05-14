import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, CheckCircle, QrCode, ScanLine, Smartphone } from "lucide-react";
import createWebRTCService, { WebRTCConnectionData } from '@/services/WebRTCService';
import { encodeConnectionData, decodeConnectionData, joinConnectionData } from '@/utils/qrCodeUtils';

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
  status: 'completed';
  receiptId: string;
}

const WebRTCReceiveMoney = () => {
  const { user } = useAuth();
  const { updateOfflineBalance, refreshOfflineBalance, syncOfflineCredits } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State variables
  const [step, setStep] = useState<ReceiveMoneyStep>('scan');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answerQrData, setAnswerQrData] = useState<string | null>(null);
  const [webrtcService, setWebrtcService] = useState<ReturnType<typeof createWebRTCService> | null>(null);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [showScanner, setShowScanner] = useState(true);
  
  // Variables for handling multiple QR code chunks
  const [scannedChunks, setScannedChunks] = useState<string[]>([]);
  const [totalChunksExpected, setTotalChunksExpected] = useState<number | null>(null);
  const [isMultiChunkMode, setIsMultiChunkMode] = useState(false);
  
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

  // Handle QR code scan (offer from sender)
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
      // Validate QR code data
      if (!data || data.trim() === '') {
        throw new Error('Invalid QR code: empty data');
      }
      
      // Check if this is a multi-chunk QR code
      // We'll use a simple protocol: if the data starts with "CHUNK:" followed by chunk info
      if (data.startsWith('CHUNK:')) {
        // Format: CHUNK:current:total:data
        const parts = data.split(':', 4);
        if (parts.length !== 4) {
          throw new Error('Invalid chunk format');
        }
        
        const currentChunk = parseInt(parts[1], 10);
        const totalChunks = parseInt(parts[2], 10);
        const chunkData = parts[3];
        
        console.log(`Received chunk ${currentChunk} of ${totalChunks}`);
        
        // Initialize multi-chunk mode if this is the first chunk
        if (!isMultiChunkMode) {
          setIsMultiChunkMode(true);
          setTotalChunksExpected(totalChunks);
          setScannedChunks(new Array(totalChunks).fill(null));
        }
        
        // Validate the chunk data is base64 encoded
        if (!/^[A-Za-z0-9+/=]+$/.test(chunkData)) {
          console.error('Invalid base64 data in chunk');
          throw new Error(`Invalid QR code format: chunk ${currentChunk} is not properly encoded`);
        }
        
        // Store this chunk - keep the raw chunk data without any processing
        const updatedChunks = [...scannedChunks];
        updatedChunks[currentChunk - 1] = chunkData;
        setScannedChunks(updatedChunks);
        
        console.log(`Stored chunk ${currentChunk} of ${totalChunks}, data length: ${chunkData.length}`);
        console.log(`First 20 chars of chunk: ${chunkData.substring(0, 20)}...`);
        
        // Check if we have all chunks
        if (updatedChunks.filter(Boolean).length === totalChunks) {
          console.log('All chunks received, processing...');
          
          // Join the raw data chunks without the headers
          const combinedData = updatedChunks.join('');
          console.log(`Combined data length: ${combinedData.length}`);
          
          // Process the combined data
          try {
            // Directly decode the combined base64 data
            const offerData = decodeConnectionData(combinedData);
            console.log('Combined offer data decoded successfully:', offerData.type);
            
            if (offerData.type !== 'offer') {
              console.error('Invalid QR code type:', offerData.type);
              throw new Error('Invalid QR code: not an offer');
            }
            
            // Continue with the offer data
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
          // We still need more chunks
          const missingChunks = totalChunks - updatedChunks.filter(Boolean).length;
          setError(`Received chunk ${currentChunk} of ${totalChunks}. Need ${missingChunks} more chunks.`);
          setLoading(false);
          setShowScanner(true);
        }
        return;
      }
      
      // Single chunk QR code - standard processing
      try {
        // Validate the data is base64 encoded
        if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
          console.error('Invalid base64 data in single QR code');
          throw new Error('Invalid QR code format: not properly encoded');
        }
        
        // Decode offer data from QR code
        console.log('Decoding QR code data...');
        const offerData = decodeConnectionData(data);
        console.log('Offer data decoded successfully:', offerData.type);
        
        if (offerData.type !== 'offer') {
          console.error('Invalid QR code type:', offerData.type);
          throw new Error('Invalid QR code: not an offer');
        }
        
        // Process the offer data
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
  
  // Process offer data after it's been decoded
  const processOfferData = async (offerData: WebRTCConnectionData) => {
    try {
      if (!webrtcService) {
        throw new Error('WebRTC service not initialized');
      }
      
      // Create answer
      console.log('Initializing receiver connection...');
      const answerData = await webrtcService.initiateReceiverConnection(offerData);
      console.log('Answer created successfully');
      
      // Encode answer data for QR code
      console.log('Encoding answer data for QR code...');
      try {
        const encodedAnswer = encodeConnectionData(answerData);
        console.log('QR code data size:', encodedAnswer.length, 'characters');
        setAnswerQrData(encodedAnswer);
        
        // Set up message handler
        console.log('Setting up message handler...');
        webrtcService.onMessage((message) => {
          console.log('Received message:', message);
          if (message.type === 'payment') {
            console.log('Payment message received, processing...');
            handlePaymentReceived(message);
          }
        });
        
        // Set up connection state handler
        console.log('Setting up connection state handler...');
        webrtcService.onConnectionStateChange((state) => {
          console.log('Connection state changed:', state);
          if (state === 'connected') {
            // Connection established
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
              setStep('scan');
            }
          }
        });
        
        // Move to next step
        setStep('createAnswer');
      } catch (encodeError) {
        console.error('Error encoding answer data:', encodeError);
        setError('Failed to encode connection data. The answer might be too large.');
        setStep('scan');
      }
    } catch (err) {
      console.error('Error processing QR code:', err);
      setError('Failed to process QR code. Please try again.');
      setStep('scan');
    } finally {
      setLoading(false);
    }
  };

  // Handle payment received
  const handlePaymentReceived = async (paymentData: any) => {
    console.log('Processing payment data:', paymentData);
    try {
      // Validate payment data
      if (!paymentData.amount || !paymentData.senderID || !paymentData.transactionId) {
        console.error('Invalid payment data:', paymentData);
        throw new Error('Invalid payment data');
      }
      
      // Generate receipt ID
      const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      console.log('Generated receipt ID:', receiptId);
      
      // Send receipt back to sender
      console.log('Sending receipt to sender...');
      webrtcService?.sendMessage({
        type: 'receipt',
        receiptId,
        status: 'success'
      });
      
      // Create transaction object
      const amount = Number(paymentData.amount);
      console.log('Payment amount:', amount);
      
      const newTransaction: Transaction = {
        id: paymentData.transactionId,
        type: 'receive',
        amount: amount,
        sender: paymentData.senderID,
        timestamp: paymentData.timestamp || Date.now(),
        note: paymentData.note,
        receiptId,
        status: 'completed'
      };
      
      // Save transaction to IndexedDB
      console.log('Saving transaction to IndexedDB...');
      try {
        await addItem<Transaction>(newTransaction);
        console.log('Transaction saved successfully');
      } catch (dbError) {
        console.error('Error saving transaction to IndexedDB:', dbError);
        // Continue even if saving to DB fails
      }
      
      // Update offline balance
      console.log('Updating offline balance by', amount);
      await updateOfflineBalance(amount);
      
      // Refresh the offline balance to ensure consistency
      console.log('Refreshing offline balance...');
      await refreshOfflineBalance();
      
      // Ensure the user's offline_credits are in sync with the offline balance
      console.log('Syncing offline credits with user data...');
      await syncOfflineCredits();
      
      // Update state
      setTransaction(newTransaction);
      setStep('complete');
      
      toast({
        title: "Payment Received",
        description: `$${amount.toFixed(2)} received successfully`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Failed to process payment. Please try again.');
    }
  };

  // Reset the process and go back to scan step
  const resetProcess = () => {
    console.log('Resetting WebRTC process...');
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setShowScanner(true);
    
    // Close any existing connection
    if (webrtcService) {
      console.log('Closing existing WebRTC connection');
      webrtcService.closeConnection();
    }
    
    // Initialize a new WebRTC service
    if (user?.email) {
      console.log('Initializing new WebRTC service');
      const service = createWebRTCService(user.email);
      setWebrtcService(service);
    } else {
      console.error('Cannot reset WebRTC service: user not logged in');
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
              
              {showScanner ? (
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
              ) : (
                <div className="text-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      console.log('Opening QR scanner...');
                      setShowScanner(true);
                    }}
                    className="w-full"
                  >
                    <ScanLine className="mr-2 h-4 w-4" />
                    Open Scanner
                  </Button>
                </div>
              )}
              
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                variant="outline" 
                onClick={() => navigate('/offline')}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
          
          {step === 'createAnswer' && answerQrData && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Show This QR Code</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Show this QR code to the sender to complete the connection
                </p>
              </div>
              
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-white border rounded-lg">
                  <QRCode 
                    value={answerQrData} 
                    size={200}
                    level="H"
                  />
                </div>
              </div>
              
              <p className="text-center text-sm text-gray-500">
                Waiting for sender to scan this QR code...
              </p>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                variant="outline" 
                onClick={resetProcess}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
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
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                variant="outline" 
                onClick={resetProcess}
                className="w-full"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
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
                  You have successfully received a payment
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
