// hooks/useNFC.ts
import { useState } from "react";

export const useNFC = () => {
  const [isNFCAvailable, setIsNFCAvailable] = useState(false);

  const initNFC = async () => {
    if ('NDEFReader' in window) {
      setIsNFCAvailable(true);
      return true;
    }
    return false;
  };

  const sendViaNFC = async (data: string) => {
    try {
      // @ts-ignore - NDEFReader not in TS types
      const writer = new NDEFReader();
      await writer.write({
        records: [{ recordType: "text", data }]
      });
      return true;
    } catch (err) {
      console.error("NFC write error:", err);
      return false;
    }
  };

  const readFromNFC = async (): Promise<string | null> => {
    try {
      // @ts-ignore - NDEFReader not in TS types
      const reader = new NDEFReader();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("NFC read timeout"));
        }, 30000); // 30 second timeout
        
        reader.addEventListener("reading", (event: any) => {
          clearTimeout(timeout);
          
          if (event.message && event.message.records) {
            for (const record of event.message.records) {
              if (record.recordType === "text" && record.data) {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                resolve(text);
                return;
              }
            }
          }
          
          // If we got here, no valid data was found
          reject(new Error("No valid data found in NFC tag"));
        });
        
        reader.addEventListener("readingerror", (error: any) => {
          clearTimeout(timeout);
          reject(error);
        });
        
        reader.scan().catch((err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (err) {
      console.error("NFC read error:", err);
      return null;
    }
  };

  return { initNFC, sendViaNFC, readFromNFC, isNFCAvailable };
};