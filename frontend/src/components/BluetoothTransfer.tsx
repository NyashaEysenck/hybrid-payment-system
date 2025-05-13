import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BluetoothTransferProps {
  onTransfer: (data: string) => void;
}

const BluetoothTransfer = ({ onTransfer }: BluetoothTransferProps) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startBluetoothTransfer = async () => {
    setConnecting(true);
    setError(null);
    try {
      console.log("[Bluetooth-DEBUG] Scanning for already connected devices...");
      // @ts-ignore: Property 'getDevices' might not exist on type 'Bluetooth'
      const devices = await navigator.bluetooth.getDevices();

      if (devices.length === 0) {
        console.log("[Bluetooth-DEBUG] No connected devices found.");
        setError("No connected Bluetooth devices found.");
        setConnecting(false);
        return;
      }

      console.log(`[Bluetooth-DEBUG] Found ${devices.length} connected devices.`);
      const device = devices[0]; // For demonstration, use the first device

      console.log(`[Bluetooth-DEBUG] Connecting to GATT server of device: ${device.name}`);
      const server = await device.gatt.connect();

      console.log("[Bluetooth-DEBUG] Getting battery service...");
      const service = await server.getPrimaryService('battery_service');

      console.log("[Bluetooth-DEBUG] Getting battery level characteristic...");
      const characteristic = await service.getCharacteristic('battery_level');

      console.log("[Bluetooth-DEBUG] Reading battery level...");
      const value = await characteristic.readValue();
      const batteryLevel = value.getUint8(0);

      console.log(`Battery level is ${batteryLevel}%`);
      onTransfer(`Battery level is ${batteryLevel}%`);

      setConnecting(false);
    } catch (err) {
      console.error("[Bluetooth-ERROR] Bluetooth transfer error:", err);
      setError("Failed to connect to Bluetooth device. Please try again.");
      setConnecting(false);
    }
  };

  return (
    <div>
      <Button onClick={startBluetoothTransfer} disabled={connecting}>
        {connecting ? "Connecting..." : "Start Bluetooth Transfer"}
      </Button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default BluetoothTransfer;
