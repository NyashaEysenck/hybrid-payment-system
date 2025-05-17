import React from 'react';
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Nfc, Bluetooth, QrCode } from "lucide-react";

const RequestMoney = () => {
  return (
    <Layout>
      <div className="p-4 sm:p-6 text-center">
        <h1 className="text-2xl font-bold mb-6">Request Money</h1>
        <div className="space-y-4">
          <div className="text-gray-500">
            This feature is coming soon!
          </div>
          <div className="text-sm text-gray-400">
            We're working hard to bring you NFC, Bluetooth, and QR code payment request capabilities. Stay tuned!
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="outline" disabled>
              <QrCode className="h-4 w-4 mr-2" />
              QR Code Request
            </Button>
            <Button variant="outline" disabled>
              <Nfc className="h-4 w-4 mr-2" />
              NFC Request
            </Button>
            <Button variant="outline" disabled>
              <Bluetooth className="h-4 w-4 mr-2" />
              Bluetooth Request
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RequestMoney;