import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Copy, QrCode, ArrowLeft, Scan, ClipboardPaste, Nfc, Bluetooth } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import GreenButton from "@/components/GreenButton";
import { useAuth } from "@/contexts/AuthContext";
import { encryptData, decryptData, deriveMasterKey } from '@/utils/crypto';
import WhiteCard from "@/components/WhiteCard";
import { useWallet } from "@/contexts/WalletContext";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNFC } from "@/hooks/useNFC";
import { useBluetooth } from "@/hooks/useBluetooth";
import QRDisplay from "@/components/QRDisplay";
import { DollarSign, MessageSquare } from "lucide-react";

const RequestMoney = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isLoading } = useWallet();
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "qr" | "nfc" | "bluetooth" | "success">("form");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [encryptedData, setEncryptedData] = useState<string>("");
  const [nfcStatus, setNfcStatus] = useState<"waiting" | "ready" | "sending" | "success" | "error">("waiting");
  const [bluetoothStatus, setBluetoothStatus] = useState<"waiting" | "scanning" | "connecting" | "success" | "error">("waiting");
  const { initNFC, sendViaNFC, isNFCAvailable } = useNFC();
  const { isSupported: isBluetoothSupported, requestDevice, connectToDevice } = useBluetooth();

  // Initialize NFC
  useEffect(() => {
    const setupNFC = async () => {
      try {
        await initNFC();
      } catch (err) {
        console.error("NFC initialization error:", err);
      }
    };
    
    setupNFC();
  }, []);

  const handleGenerateQR = async () => {
    try {
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      if (amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      // Create payment request data
      const requestData = {
        recipient: user.email,
        amount,
        note,
        type: "qr",
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      };

      // Encrypt the data
      const encryptionKey = deriveMasterKey(
        import.meta.env.VITE_QR_ENCRYPTION_SECRET,
        import.meta.env.VITE_QR_SALT
      );
      
      const encrypted = encryptData(requestData, encryptionKey);
      setEncryptedData(encrypted);
      setStep("qr");
      
      toast({
        title: "QR Code Generated",
        description: "Show this QR code to the sender to request payment",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate QR code";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleNFCRequest = async () => {
    try {
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      if (amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      setNfcStatus("ready");
      
      // Create payment request data
      const requestData = {
        recipient: user.email,
        amount,
        note,
        type: "nfc",
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      };

      // Encrypt the data
      const encryptionKey = deriveMasterKey(
        import.meta.env.VITE_NFC_ENCRYPTION_SECRET,
        import.meta.env.VITE_NFC_SALT
      );
      
      const encrypted = encryptData(requestData, encryptionKey);
      
      toast({
        title: "NFC Ready",
        description: "Hold your device near the sender's device",
      });

      setNfcStatus("sending");
      const success = await sendViaNFC(encrypted);
      
      if (success) {
        setNfcStatus("success");
        toast({
          title: "Request Sent",
          description: "Payment request sent successfully via NFC",
        });
        setStep("success");
      } else {
        throw new Error("Failed to send NFC data");
      }
    } catch (err) {
      setNfcStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Failed to send via NFC";
      setError(errorMessage);
      toast({
        title: "NFC Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleBluetoothRequest = async () => {
    try {
      if (!user?.email) {
        throw new Error("User not authenticated");
      }

      if (amount <= 0) {
        throw new Error("Please enter a valid amount");
      }

      setBluetoothStatus("scanning");
      
      // Create payment request data
      const requestData = {
        recipient: user.email,
        amount,
        note,
        type: "bluetooth",
        timestamp: Date.now(),
        expiry: Date.now() + 300000 // 5 minutes
      };

      // Encrypt the data
      const encryptionKey = deriveMasterKey(
        import.meta.env.VITE_BLUETOOTH_ENCRYPTION_SECRET,
        import.meta.env.VITE_BLUETOOTH_SALT
      );
      
      const encrypted = encryptData(requestData, encryptionKey);
      
      toast({
        title: "Scanning for Bluetooth devices",
        description: "Please select the sender's device",
      });

      const device = await requestDevice({
        acceptAllDevices: true,
        optionalServices: ['00001234-0000-1000-8000-00805f9b34fb']
      });

      setBluetoothStatus("connecting");
      
      toast({
        title: "Connecting to device",
        description: "Please wait while we connect to the selected device",
      });

      const server = await connectToDevice(device);
      const service = await server.getPrimaryService('00001234-0000-1000-8000-00805f9b34fb');
      const characteristic = await service.getCharacteristic('00001234-0000-1000-8000-00805f9b34fb');
      
      // Convert string to ArrayBuffer
      const encoder = new TextEncoder();
      const data = encoder.encode(encrypted);
      
      await characteristic.writeValue(data);
      
      setBluetoothStatus("success");
      toast({
        title: "Request Sent",
        description: "Payment request sent successfully via Bluetooth",
      });
      setStep("success");
    } catch (err) {
      setBluetoothStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Failed to send via Bluetooth";
      setError(errorMessage);
      toast({
        title: "Bluetooth Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setAmount(0);
    setNote("");
    setStep("form");
    setError(null);
    setNfcStatus("waiting");
    setBluetoothStatus("waiting");
  };

  return (
    <Layout>
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4 max-w-6xl mx-auto">
          {step !== "form" && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => step === "success" ? resetForm() : setStep("form")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-2xl font-bold text-dark">
            {step === "form" ? "Request Money" : 
             step === "qr" ? "QR Code Request" :
             step === "nfc" ? "NFC Request" :
             step === "bluetooth" ? "Bluetooth Request" : "Request Sent"}
          </h1>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto h-full flex flex-col">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {step === "form" && (
            <WhiteCard className="p-6">
              <div className="space-y-6">
                <h2 className="text-lg font-semibold text-dark">Request Payment</h2>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                      <Input
                        id="amount"
                        type="number"
                        value={amount || ""}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="pl-10"
                        min={0}
                      />
                      <DollarSign size={18} className="absolute left-3 top-2.5 text-dark-lighter" />
                    </div>
                    {amount <= 0 && amount !== 0 && (
                      <p className="text-red-500 text-sm">
                        Please enter a valid amount.
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="note">Note (Optional)</Label>
                    <div className="relative">
                      <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a message"
                        className="min-h-[100px] pl-10 pt-8"
                      />
                      <MessageSquare size={18} className="absolute left-3 top-3 text-dark-lighter" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <h3 className="font-medium text-dark">Choose Request Method</h3>
                  
                  <button
                    onClick={handleGenerateQR}
                    className="p-6 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                    disabled={amount <= 0 || isLoading}
                  >
                    <div className="flex items-center gap-3">
                      <QrCode size={24} className="text-greenleaf-600" />
                      <div>
                        <h3 className="font-medium text-dark">QR Code</h3>
                        <p className="text-sm text-dark-lighter">Generate a QR code for the sender to scan</p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleNFCRequest}
                    className="p-6 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                    disabled={!isNFCAvailable || amount <= 0 || isLoading}
                  >
                    <div className="flex items-center gap-3">
                      <Nfc size={24} className={isNFCAvailable ? "text-greenleaf-600" : "text-gray-400"} />
                      <div>
                        <h3 className="font-medium text-dark">NFC Transfer</h3>
                        <p className="text-sm text-dark-lighter">
                          {isNFCAvailable 
                            ? "Hold your device close to the sender's device" 
                            : "NFC not supported on this device"}
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={handleBluetoothRequest}
                    className="p-6 border rounded-lg text-left hover:bg-gray-50 transition-colors"
                    disabled={!isBluetoothSupported || amount <= 0 || isLoading}
                  >
                    <div className="flex items-center gap-3">
                      <Bluetooth size={24} className={isBluetoothSupported ? "text-blue-600" : "text-gray-400"} />
                      <div>
                        <h3 className="font-medium text-dark">Bluetooth Transfer</h3>
                        <p className="text-sm text-dark-lighter">
                          {isBluetoothSupported 
                            ? "Connect to sender's device via Bluetooth" 
                            : "Bluetooth not supported on this device"}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </WhiteCard>
          )}

          {step === "qr" && (
            <div className="flex flex-col items-center">
              <WhiteCard className="p-6 max-w-md w-full">
                <div className="text-center mb-4">
                  <h2 className="text-lg font-semibold text-dark">Payment Request</h2>
                  <p className="text-dark-lighter">
                    Ask the sender to scan this QR code
                  </p>
                </div>
                
                <QRDisplay 
                  encryptedValue={encryptedData}
                  amount={amount}
                  expiresIn={300}
                  isSecure={true}
                />
                
                <div className="mt-6 text-center">
                  <p className="text-sm text-dark-lighter mb-2">
                    Amount: <span className="font-semibold">${amount.toFixed(2)}</span>
                  </p>
                  {note && (
                    <p className="text-sm text-dark-lighter">
                      Note: {note}
                    </p>
                  )}
                </div>
              </WhiteCard>
            </div>
          )}

          {step === "success" && (
            <WhiteCard className="p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-dark mb-2">Request Sent!</h2>
              <p className="text-dark-lighter mb-6">
                Your payment request has been sent successfully.
              </p>
              <GreenButton onClick={resetForm} className="w-full">
                Request Another Payment
              </GreenButton>
            </WhiteCard>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RequestMoney;