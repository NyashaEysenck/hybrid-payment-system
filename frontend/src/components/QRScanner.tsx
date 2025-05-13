import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@mui/material";
import jsQR from "jsqr";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError: (error: Error) => void;
  onCancel: () => void;
}

const QrScanner = ({ onScan, onError, onCancel }: QRScannerProps) => {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastScanRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  const startScanner = async () => {
    setScanning(true);
    setError(null);
    lastScanRef.current = null;
    lastScanTimeRef.current = 0;

    try {
      const constraints = { 
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        scanFrame();
      }
    } catch (err) {
      const errorMessage = "Unable to access camera. Please ensure camera permissions are granted.";
      setError(errorMessage);
      setScanning(false);
      onError(new Error(errorMessage));
    }
  };

  const stopScanner = () => {
    cancelAnimationFrame(animationFrameRef.current);
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
    onCancel();
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data from canvas
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Scan for QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    // If QR code found
    if (code) {
      const now = Date.now();
      // Debounce scan - prevent multiple scans of the same code within 3 seconds
      if (
        lastScanRef.current !== code.data || 
        now - lastScanTimeRef.current > 3000
      ) {
        lastScanRef.current = code.data;
        lastScanTimeRef.current = now;
        
        // Process the QR code data
        onScan(code.data);
        stopScanner();
        return;
      }
    }

    // Continue scanning
    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ 
        position: 'relative', 
        width: '100%', 
        maxWidth: '300px', 
        aspectRatio: '1/1', 
        backgroundColor: '#f0f0f0', 
        borderRadius: '8px', 
        overflow: 'hidden', 
        marginBottom: '16px' 
      }}>
        {scanning ? (
          <>
            <video 
              ref={videoRef} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              autoPlay 
              playsInline
              muted
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ 
              position: 'absolute', 
              inset: 0, 
              border: '2px solid #4caf50', 
              borderRadius: '8px',
              opacity: 0.5 
            }}>
              <div style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                transform: 'translate(-50%, -50%)', 
                width: '75%', 
                height: '75%', 
                border: '2px solid #4caf50', 
                borderRadius: '8px' 
              }}></div>
              
              {/* Simple scanning indicator */}
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '2px', 
                backgroundColor: '#4caf50', 
                opacity: 0.7,
                animation: 'scanline 2s linear infinite'
              }}></div>
            </div>
          </>
        ) : (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Camera size={48} style={{ color: '#9e9e9e', marginBottom: '8px' }} />
            <p style={{ fontSize: '14px', color: '#757575' }}>Camera is inactive</p>
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: '#f44336', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>
      )}

      <style>{`
        @keyframes scanline {
          0% { transform: translateY(0); }
          50% { transform: translateY(calc(100% - 4px)); }
          100% { transform: translateY(0); }
        }
      `}</style>
      <Button onClick={stopScanner} variant="contained" style={{ backgroundColor: '#4caf50', color: '#fff' }}>
        <RefreshCw style={{ marginRight: '8px' }} />
        Stop Scanner
      </Button>
    </div>
  );
};

export default QrScanner;