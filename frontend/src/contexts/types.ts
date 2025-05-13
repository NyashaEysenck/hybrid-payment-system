// frontend/src/contexts/wallet/types.ts
import { ReactNode } from "react";

export interface Transaction {
  transaction_id: string; // Maps to `transaction_id` in the schema
  sender_id: string; // Maps to `sender_id` in the schema (user ID of the sender)
  receiver_id: string; // Maps to `receiver_id` in the schema (user ID of the recipient)
  amount: number; // Maps to `amount` in the schema
  token_id?: string | null; // Maps to `token_id` in the schema (used for offline payments)
  status: "pending" | "completed" | "failed" | "conflict"; // Maps to `status` in the schema
  created_at: Date; // Maps to `created_at` in the schema (transaction creation date)
  synced_at?: Date | null; // Maps to `synced_at` in the schema (sync date after re-connection)
  sync_status: {
    sender_synced: boolean; // Maps to `sync_status.sender_synced`
    receiver_synced: boolean; // Maps to `sync_status.receiver_synced`
  };
  offline_method?: "QR" | "Bluetooth" | null; // Maps to `offline_method` in the schema
  transaction_type: "deposit" | "withdrawal" | "payment"; // Maps to `transaction_type` in the schema
  note?: string | null; // Maps to `note` in the schema (optional description)
  reference?: string | null; // Can be used for a reference, if needed (not in the schema)
  timeline?: Array<{
    title: string;
    time: string;
    description?: string; // Optional, can be used for a timeline of the transaction
  }>;
}

export interface SendMoneyParams {
  sender: String;
  amount: number;
  recipient: string;
  note?: string;
  type: "online" | "offline" | "qr" | "nfc" | "bluetooth";
}

export interface WalletContextType {
  balance: number;
  reservedBalance: number;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  reserveTokens: (amount: number) => Promise<void>;
  releaseTokens: (amount: number) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, "id" | "date">) => Promise<void>;
  addFunds: (amount: number) => Promise<void>;
  sendMoney: (params: SendMoneyParams) => Promise<void>;
  fetchWalletData: () => Promise<void>;
}

export interface WalletProviderProps {
  children: ReactNode;
}