import { Transaction } from '@/types'; // Assuming Transaction type is defined in @/types

export interface StorageService {
  saveUser(email: string, user: any): Promise<any>;
  getUser(email: string): Promise<any>;
  debugListAllUsers(): Promise<any[]>;
  clearUserStorage(): Promise<void>;

  saveTransaction(tx: Transaction): Promise<void>;
  getTransactions(): Promise<Transaction[]>;
  clearTransactions(): Promise<void>;

  saveOfflineBalance(balance: number, userEmail: string): Promise<void>;
  getOfflineBalance(userEmail: string): Promise<number>;
}

export class IndexedDBStorageService implements StorageService {
  private static readonly DB_NAME = 'app_storage';
  private static readonly DB_VERSION = 1;
  private static readonly USER_STORE = 'users';
  private static readonly TX_STORE = 'transactions';
  private static readonly BALANCE_STORE = 'balances';

  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBStorageService.DB_NAME, IndexedDBStorageService.DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('IndexedDB failed to open');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create users store with email as key path
        if (!db.objectStoreNames.contains(IndexedDBStorageService.USER_STORE)) {
          db.createObjectStore(IndexedDBStorageService.USER_STORE, { keyPath: 'email' });
        }
        
        // Create transactions store
        if (!db.objectStoreNames.contains(IndexedDBStorageService.TX_STORE)) {
          db.createObjectStore(IndexedDBStorageService.TX_STORE, { keyPath: 'id' });
        }
        
        // Create balances store with userEmail as key path
        if (!db.objectStoreNames.contains(IndexedDBStorageService.BALANCE_STORE)) {
          db.createObjectStore(IndexedDBStorageService.BALANCE_STORE, { keyPath: 'userEmail' });
        }
      };
    });
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.initDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  async saveUser(email: string, user: any): Promise<any> {
    try {
      console.log("Saving user:", user);
      const existingUser = await this.getUser(email);
      if (existingUser) {
        console.log("User already exists, updating data.");
      } else {
        console.log("User does not exist, saving new data.");
      }

      const userToStore = {
        email: email,
        crypto_salt: user.crypto_salt,
        encryptedData: user.encryptedData
      };

      const store = await this.getStore(IndexedDBStorageService.USER_STORE, 'readwrite');
      return new Promise((resolve, reject) => {
        const request = store.put(userToStore);
        request.onsuccess = () => resolve(userToStore);
        request.onerror = (event) => {
          console.error("Error saving user:", event);
          reject(event);
        };
      });
    } catch (error) {
      console.error("Error saving user:", error);
      throw error;
    }
  }

  async getUser(email: string): Promise<any> {
    try {
      console.log(`Attempting to get user with email: ${email}`);
      const store = await this.getStore(IndexedDBStorageService.USER_STORE);
      
      return new Promise((resolve, reject) => {
        const request = store.get(email);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = (event) => {
          console.error("Error getting user:", event);
          reject(event);
        };
      });
    } catch (error) {
      console.error("Error getting user:", error);
      throw error;
    }
  }

  async debugListAllUsers(): Promise<any[]> {
    const store = await this.getStore(IndexedDBStorageService.USER_STORE);
    
    return new Promise((resolve, reject) => {
      const users: any[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const user = cursor.value;
          if (user.email) {
            users.push(user);
          }
          cursor.continue();
        } else {
          console.log('All users in storage:', users);
          resolve(users);
        }
      };
      
      request.onerror = (event) => {
        console.error("Error listing users:", event);
        reject(event);
      };
    });
  }

  async clearUserStorage(): Promise<void> {
    const store = await this.getStore(IndexedDBStorageService.USER_STORE, 'readwrite');
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event);
    });
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    // First get all existing transactions
    const existingTransactions = await this.getTransactions();
    
    // Check for duplicates (same amount within 10 seconds)
    const isDuplicate = existingTransactions.some(existingTx => {
        const timeDiff = Math.abs(existingTx.timestamp - tx.timestamp);
        return (
            existingTx.amount === tx.amount && 
            timeDiff <= 10000 && // 10 seconds in milliseconds
            existingTx.type === tx.type &&
            existingTx.sender === tx.sender &&
            existingTx.recipient === tx.recipient
        );
    });

    if (isDuplicate) {
        console.log('Skipping duplicate transaction:', tx);
        return Promise.resolve();
    }

    const store = await this.getStore(IndexedDBStorageService.TX_STORE, 'readwrite');
    
    return new Promise((resolve, reject) => {
        const request = store.put(tx);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event);
    });
}

  async getTransactions(): Promise<Transaction[]> {
    const store = await this.getStore(IndexedDBStorageService.TX_STORE);
    
    return new Promise((resolve, reject) => {
      const transactions: Transaction[] = [];
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          transactions.push(cursor.value);
          cursor.continue();
        } else {
          resolve(transactions);
        }
      };
      
      request.onerror = (event) => {
        console.error("Error getting transactions:", event);
        reject(event);
      };
    });
  }

  async clearTransactions(): Promise<void> {
    const store = await this.getStore(IndexedDBStorageService.TX_STORE, 'readwrite');
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event);
    });
  }

  async saveOfflineBalance(balance: number, userEmail: string): Promise<void> {
    const store = await this.getStore(IndexedDBStorageService.BALANCE_STORE, 'readwrite');
    
    return new Promise((resolve, reject) => {
      const balanceRecord = { userEmail, balance };
      const request = store.put(balanceRecord);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event);
    });
  }

  async getOfflineBalance(userEmail: string): Promise<number> {
    const store = await this.getStore(IndexedDBStorageService.BALANCE_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(userEmail);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.balance : 0);
      };
      request.onerror = (event) => {
        console.error("Error getting offline balance:", event);
        reject(event);
      };
    });
  }
}

// Export a singleton instance
export const storageService = new IndexedDBStorageService();
