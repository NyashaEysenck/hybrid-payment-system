export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'online' | 'offline' | 'qr' | 'nfc' | 'bluetooth';
  amount: number;
  sender: string;
  recipient: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  note?: string;
  receiptId: string;
  synced?: boolean;
}
