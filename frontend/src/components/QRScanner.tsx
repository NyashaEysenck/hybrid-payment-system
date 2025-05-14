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
    console.log('Starting QR scanner...');
    setScanning(true);
    setError(null);
    lastScanRef.current = null;
    lastScanTimeRef.current = 0;

    try {
      // Try to use the back camera first with lower resolution for better performance
      const constraints = { 
        video: { 
          facingMode: "environment",
          width: { ideal: 640 },  // Lower resolution for better performance
          height: { ideal: 480 }
        } 
      };
      
      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera access granted');
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        console.log('Starting video playback...');
        
        // Add event listener to know when video is actually playing
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', 
            videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        };
        
        videoRef.current.onplaying = () => {
          console.log('Video playback started');
          scanFrame();
        };
        
        await videoRef.current.play();
      } else {
        console.error('Video reference not available');
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
    // Check if video and canvas refs exist
    if (!videoRef.current || !canvasRef.current) {
      console.log('Video or canvas ref not available yet');
      animationFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    
    // Check if video is ready - IMPORTANT: readyState should be HAVE_ENOUGH_DATA (4)
    if (videoRef.current.readyState < 4) {
      console.log('Video not ready yet, readyState:', videoRef.current.readyState);
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
    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Log dimensions for debugging
      if (imageData.width === 0 || imageData.height === 0) {
        console.log('Invalid image dimensions:', imageData.width, 'x', imageData.height);
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Scan for QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth", // Try both inverted and non-inverted
      });
      
      // Log scanning attempt
      if (!code) {
        // Only log occasionally to avoid flooding console
        if (Math.random() < 0.05) console.log('No QR code found in frame');
      }

      // If QR code found
      if (code) {
        console.log('QR code found!', code.data.substring(0, 20) + '...');
        const now = Date.now();
        // Debounce scan - prevent multiple scans of the same code within 3 seconds
        if (
          lastScanRef.current !== code.data || 
          now - lastScanTimeRef.current > 3000
        ) {
          lastScanRef.current = code.data;
          lastScanTimeRef.current = now;
          
          // Process the QR code data
          console.log('Processing QR code data');
          onScan(code.data);
          stopScanner();
          return;
        } else {
          console.log('Ignoring duplicate QR code scan');
        }
      }
    } catch (err) {
      console.error('Error processing frame:', err);
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
            {/* Add debugging display */}
            <div style={{
              position: 'absolute',
              bottom: '5px',
              left: '5px',
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'white',
              padding: '2px 5px',
              fontSize: '10px',
              borderRadius: '3px',
              zIndex: 10
            }}>
              Scanning... {videoRef.current?.readyState || 'initializing'}/4
            </div>
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