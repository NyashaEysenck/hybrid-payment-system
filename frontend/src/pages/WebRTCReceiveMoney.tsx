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
import { encodeConnectionData, decodeConnectionData } from '@/utils/qrCodeUtils';

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

const WebRTCReceiveMoney: React.FC = () => {
  const { user } = useAuth();
  const { updateOfflineBalance } = useOfflineBalance();
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
  
  // IndexedDB hook for storing transactions
  const { addItem } = useIndexedDB({
    dbName: 'offlinePayments',
    storeName: 'transactions',
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
    setShowScanner(false);
    
    if (!webrtcService || !user?.email) {
      setError('WebRTC service not initialized');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Decode offer data from QR code
      const offerData = decodeConnectionData(data);
      
      if (offerData.type !== 'offer') {
        throw new Error('Invalid QR code: not an offer');
      }
      
      // Create answer
      const answerData = await webrtcService.initiateReceiverConnection(offerData);
      
      // Encode answer data for QR code
      const encodedAnswer = encodeConnectionData(answerData);
      setAnswerQrData(encodedAnswer);
      
      // Set up message handler
      webrtcService.onMessage((message) => {
        console.log('Received message:', message);
        if (message.type === 'payment') {
          handlePaymentReceived(message);
        }
      });
      
      // Set up connection state handler
      webrtcService.onConnectionStateChange((state) => {
        console.log('Connection state changed:', state);
        if (state === 'connected') {
          // Connection established
          toast({
            title: "Connection Established",
            description: "Connected to sender device",
            duration: 3000,
          });
          setStep('waitForPayment');
        } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          if (step !== 'complete') {
            setError('Connection lost. Please try again.');
            resetProcess();
          }
        }
      });
      
      // Move to next step
      setStep('createAnswer');
    } catch (error) {
      console.error('Error processing offer:', error);
      setError('Failed to process connection offer. Please try again.');
      resetProcess();
    } finally {
      setLoading(false);
    }
  };

  // Handle payment received
  const handlePaymentReceived = async (paymentData: any) => {
    if (!webrtcService || !user?.email) return;
    
    try {
      // Validate payment data
      if (!paymentData.amount || !paymentData.senderID || !paymentData.timestamp || !paymentData.transactionId) {
        throw new Error('Invalid payment data');
      }
      
      // Create transaction record
      const newTransaction: Transaction = {
        id: paymentData.transactionId,
        type: 'receive',
        amount: Number(paymentData.amount),
        sender: paymentData.senderID,
        timestamp: paymentData.timestamp,
        note: paymentData.note,
        status: 'completed',
        receiptId: paymentData.transactionId
      };
      
      // Save transaction to IndexedDB
      await addItem(newTransaction);
      
      // Update offline balance
      await updateOfflineBalance(Number(paymentData.amount));
      
      // Send confirmation
      webrtcService.sendMessage({
        type: 'payment_confirmation',
        transactionId: paymentData.transactionId,
        status: 'completed'
      });
      
      // Update state
      setTransaction(newTransaction);
      setStep('complete');
      
      toast({
        title: "Payment Received",
        description: `$${Number(paymentData.amount).toFixed(2)} received successfully`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('Failed to process payment. Please try again.');
    }
  };

  // Reset the process and go back to scan step
  const resetProcess = () => {
    setStep('scan');
    setError(null);
    setAnswerQrData(null);
    setTransaction(null);
    setShowScanner(true);
    
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
          <h1 className="text-2xl font-bold text-dark">Receive Money (WebRTC)</h1>
        </div>
        
        <WhiteCard className="p-6 max-w-md mx-auto">
          {step === 'scan' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Scan Sender's QR Code</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Scan the QR code displayed on the sender's device
                </p>
              </div>
              
              {showScanner ? (
                <div className="mb-4">
                  <QrScanner
                    onScan={handleQrCodeScanned}
                    onError={(error) => {
                      setError(error.message);
                      setShowScanner(false);
                    }}
                    onCancel={() => navigate('/offline')}
                  />
                </div>
              ) : (
                <div className="flex justify-center mb-4">
                  <GreenButton 
                    onClick={() => setShowScanner(true)}
                    className="w-full"
                  >
                    <ScanLine className="mr-2 h-4 w-4" />
                    Start Scanner
                  </GreenButton>
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
