import { useState, useEffect } from "react";
import { ShieldCheck, Smartphone, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface NFCReaderProps {
  onNFCVerified: () => void;
  onNFCFailed?: () => void;
  expectedPayload?: string;
}

const NFCReader = ({ onNFCVerified, onNFCFailed, expectedPayload }: NFCReaderProps) => {
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  // Check if NFC is available
  const nfcAvailable = 'NDEFReader' in window;

  const startNFCReader = async () => {
    if (!nfcAvailable) {
      setError("NFC is not supported on this device");
      toast({
        title: "NFC Not Supported",
        description: "Your device doesn't support NFC reading",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsReading(true);
      setError(null);
      setSuccess(false);

      // @ts-ignore - TypeScript might not have NDEFReader types
      const ndef = new window.NDEFReader();
      await ndef.scan();
      
      toast({
        title: "NFC Ready",
        description: "Tap your NFC card or device now",
      });

      ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
        console.log("NFC Serial Number:", serialNumber);
        console.log("NFC Records:", message.records);
        
        // Process NFC records
        let nfcData = "";
        for (const record of message.records) {
          if (record.recordType === "text") {
            const textDecoder = new TextDecoder();
            nfcData = textDecoder.decode(record.data);
          }
        }

        // If we have an expected payload, verify it matches
        if (expectedPayload && nfcData !== expectedPayload) {
          setError("NFC verification failed. The data doesn't match.");
          setSuccess(false);
          if (onNFCFailed) onNFCFailed();
          
          toast({
            title: "Verification Failed",
            description: "The NFC data doesn't match the expected value",
            variant: "destructive",
          });
          
          return;
        }

        // Success
        setSuccess(true);
        setIsReading(false);
        
        toast({
          title: "NFC Verified",
          description: "NFC data successfully verified",
        });
        
        onNFCVerified();
      });

      ndef.addEventListener("error", (error: any) => {
        console.error("NFC Error:", error);
        setError(`NFC error: ${error.message || "Unknown error"}`);
        setIsReading(false);
        
        toast({
          title: "NFC Error",
          description: error.message || "Failed to read NFC data",
          variant: "destructive",
        });
        
        if (onNFCFailed) onNFCFailed();
      });
    } catch (err) {
      console.error("NFC scan error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start NFC reader";
      setError(errorMessage);
      setIsReading(false);
      
      toast({
        title: "NFC Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopNFCReader = () => {
    setIsReading(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopNFCReader();
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-xs aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4 flex items-center justify-center">
        {isReading ? (
          <div className="text-center p-6">
            <div className="animate-pulse mb-4">
              <Smartphone size={64} className="text-greenleaf-500 mx-auto" />
            </div>
            <p className="text-dark font-medium mb-2">Tap Your NFC Device</p>
            <p className="text-sm text-dark-lighter">
              Hold your NFC-enabled card or phone near this device
            </p>
          </div>
        ) : success ? (
          <div className="text-center p-6">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
            <p className="text-dark font-medium">Verification Successful</p>
          </div>
        ) : error ? (
          <div className="text-center p-6">
            <XCircle size={64} className="text-red-500 mx-auto mb-4" />
            <p className="text-dark font-medium mb-2">Verification Failed</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : (
          <div className="text-center p-6">
            <Smartphone size={64} className="text-gray-400 mx-auto mb-4" />
            <p className="text-dark font-medium mb-2">NFC Reader</p>
            <p className="text-sm text-dark-lighter">
              {nfcAvailable 
                ? "Tap the button below to start NFC verification" 
                : "NFC is not supported on this device"}
            </p>
          </div>
        )}
      </div>

      {!success && (
        <div className="flex gap-2">
          {!isReading ? (
            <Button 
              onClick={startNFCReader} 
              className="bg-greenleaf-500 hover:bg-greenleaf-600"
              disabled={!nfcAvailable}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Start NFC Reader
            </Button>
          ) : (
            <Button onClick={stopNFCReader} variant="outline">
              Cancel NFC Reading
            </Button>
          )}
        </div>
      )}

      {nfcAvailable && (
        <div className="mt-4 flex items-center justify-center text-xs text-greenleaf-600">
          <ShieldCheck size={14} className="mr-1" />
          <span>Secure NFC verification</span>
        </div>
      )}
    </div>
  );
};

export default NFCReader;
