import { useEffect, useState, useMemo } from "react";
import WhiteCard from "./WhiteCard";
import GreenButton from "./GreenButton";
import { Clock, Copy as CopyIcon, ShieldCheck } from "lucide-react";
import QRCode from "react-qr-code";

interface QRDisplayProps {
  encryptedValue: string;
  amount: number;
  expiresIn?: number;
  isSecure?: boolean;
}

const QRDisplay = ({ 
  encryptedValue, 
  amount, 
  expiresIn = 300,
  isSecure = true
}: QRDisplayProps) => {
  const [timeLeft, setTimeLeft] = useState(expiresIn);
  const [copied, setCopied] = useState(false);
  const [clipboardPermission, setClipboardPermission] = useState<PermissionState | null>(null);

  // Check clipboard permissions (modern browsers)
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        if (navigator.permissions) {
          const status = await navigator.permissions.query({
            name: "clipboard-write" as PermissionName
          });
          setClipboardPermission(status.state);
          status.onchange = () => setClipboardPermission(status.state);
        }
      } catch (err) {
        console.log("Clipboard permission API not supported");
      }
    };
    checkPermissions();
  }, []);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresIn]);

  const copyToClipboard = async () => {
    if (!encryptedValue) {
      console.error("No data to copy");
      return;
    }

    try {
      // Modern clipboard API (requires secure context)
      await navigator.clipboard.writeText(encryptedValue);
      setCopied(true);
    } catch (err) {
      console.log("Modern clipboard failed, trying fallback...");

      // Fallback 1: Document.execCommand (deprecated but widely supported)
      const textArea = document.createElement("textarea");
      textArea.value = encryptedValue;
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        const success = document.execCommand("copy");
        if (!success) throw new Error("execCommand failed");
        setCopied(true);
      } catch (fallbackErr) {
        console.error("Fallback failed:", fallbackErr);
        
        // Fallback 2: Prompt user to copy manually
        promptManualCopy(encryptedValue);
      } finally {
        document.body.removeChild(textArea);
      }
    } finally {
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const promptManualCopy = (text: string) => {
    const message = `Press Ctrl+C to copy:\n\n${text}`;
    alert(message); // Or use a toast notification
  };

  const memoizedQR = useMemo(() => (
    <div className="mb-4 p-4 bg-[#A0D468] rounded-lg">
      <QRCode
        value={encryptedValue}
        size={256}
        bgColor="#FFFFFF"
        fgColor="#008000"
        level="L"
      />
    </div>
  ), [encryptedValue]);

  return (
    <WhiteCard className="flex flex-col items-center max-w-xs mx-auto p-6">
      {memoizedQR}
      <GreenButton 
        onClick={copyToClipboard}
        className="w-full bg-gradient-to-r from-[#008000] to-[#00A000]"
      >
        <CopyIcon size={16} className="mr-2" />
        {copied ? "Copied!" : "Copy Encrypted Data"}
      </GreenButton>
    </WhiteCard>
  );
};

export default QRDisplay;