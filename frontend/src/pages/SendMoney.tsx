import React from 'react';
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Nfc, Bluetooth, QrCode, Camera } from "lucide-react";

const SendMoney = () => {
  return (
    <Layout>
      <div className="p-4 sm:p-6 text-center">
        <h1 className="text-2xl font-bold mb-6">Send Money</h1>
        <div className="space-y-4">
          <div className="text-gray-500">
            This feature is coming soon!
          </div>
          <div className="text-sm text-gray-400">
            We're working hard to bring you NFC, Bluetooth, QR code, and camera payment capabilities. Stay tuned!
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="outline" disabled>
              <Nfc className="h-4 w-4 mr-2" />
              NFC Payment
            </Button>
            <Button variant="outline" disabled>
              <Bluetooth className="h-4 w-4 mr-2" />
              Bluetooth Payment
            </Button>
            <Button variant="outline" disabled>
              <QrCode className="h-4 w-4 mr-2" />
              QR Code Payment
            </Button>
            <Button variant="outline" disabled>
              <Camera className="h-4 w-4 mr-2" />
              Camera Payment
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SendMoney;