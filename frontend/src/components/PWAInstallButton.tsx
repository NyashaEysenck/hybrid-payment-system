// src/components/PWAInstallButton.tsx
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, install } = usePWAInstall();

  if (!isInstallable) return null;

  return (
    <button 
      onClick={install}
      className="pwa-install-btn" // Add your styles
    >
      Install App
    </button>
  );
}