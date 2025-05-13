import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import QrScanner from 'qr-scanner';

// QrScanner.WORKER_PATH is no longer required

createRoot(document.getElementById("root")!).render(<App />);
