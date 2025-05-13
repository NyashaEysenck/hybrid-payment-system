import { useState, useEffect } from 'react';

interface IndexedDBOptions {
  dbName: string;
  storeName: string;
  version?: number;
}

export interface Transaction {
  id: string;
  sender: string;
  recipient: string;
  amount: number;
  note?: string;
  timestamp: number;
  receiptId: string;
  status: 'completed' | 'pending';
  type: 'online' | 'offline' | 'qr' | 'nfc' | 'bluetooth';
  synced?: boolean;
}

export function useIndexedDB({ dbName, storeName, version = 1 }: IndexedDBOptions) {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const openDB = () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, version);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
            console.log(`Created object store: ${storeName}`);
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          console.log(`Successfully opened IndexedDB: ${dbName}`);
          resolve(db);
        };

        request.onerror = (event) => {
          const error = `Error opening IndexedDB: ${(event.target as IDBOpenDBRequest).error}`;
          console.error(error);
          reject(new Error(error));
        };
      });
    };

    const initDB = async () => {
      try {
        const database = await openDB();
        setDb(database);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error initializing IndexedDB');
      }
    };

    initDB();

    return () => {
      if (db) {
        db.close();
        console.log(`Closed IndexedDB connection: ${dbName}`);
      }
    };
  }, [dbName, storeName, version]);

  const addItem = async <T extends { id: string }>(item: T): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      setIsLoading(true);
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);

        request.onsuccess = () => {
          setIsLoading(false);
          resolve(item);
        };

        request.onerror = (event) => {
          setIsLoading(false);
          const errorMsg = `Error adding item to IndexedDB: ${(event.target as IDBRequest).error}`;
          setError(errorMsg);
          reject(new Error(errorMsg));
        };
      } catch (err) {
        setIsLoading(false);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error adding item to IndexedDB';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  };

  const getItem = async <T>(id: string): Promise<T | null> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      setIsLoading(true);
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = (event) => {
          setIsLoading(false);
          resolve((event.target as IDBRequest).result as T || null);
        };

        request.onerror = (event) => {
          setIsLoading(false);
          const errorMsg = `Error getting item from IndexedDB: ${(event.target as IDBRequest).error}`;
          setError(errorMsg);
          reject(new Error(errorMsg));
        };
      } catch (err) {
        setIsLoading(false);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error getting item from IndexedDB';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  };

  const getAllItems = async <T>(): Promise<T[]> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      setIsLoading(true);
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
          setIsLoading(false);
          resolve((event.target as IDBRequest).result as T[]);
        };

        request.onerror = (event) => {
          setIsLoading(false);
          const errorMsg = `Error getting all items from IndexedDB: ${(event.target as IDBRequest).error}`;
          setError(errorMsg);
          reject(new Error(errorMsg));
        };
      } catch (err) {
        setIsLoading(false);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error getting all items from IndexedDB';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  };

  const updateItem = async <T extends { id: string }>(item: T): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      setIsLoading(true);
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => {
          setIsLoading(false);
          resolve(item);
        };

        request.onerror = (event) => {
          setIsLoading(false);
          const errorMsg = `Error updating item in IndexedDB: ${(event.target as IDBRequest).error}`;
          setError(errorMsg);
          reject(new Error(errorMsg));
        };
      } catch (err) {
        setIsLoading(false);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error updating item in IndexedDB';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  };

  const deleteItem = async (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!db) {
        reject(new Error('Database not initialized'));
        return;
      }

      setIsLoading(true);
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          setIsLoading(false);
          resolve();
        };

        request.onerror = (event) => {
          setIsLoading(false);
          const errorMsg = `Error deleting item from IndexedDB: ${(event.target as IDBRequest).error}`;
          setError(errorMsg);
          reject(new Error(errorMsg));
        };
      } catch (err) {
        setIsLoading(false);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error deleting item from IndexedDB';
        setError(errorMsg);
        reject(new Error(errorMsg));
      }
    });
  };

  return {
    db,
    error,
    isLoading,
    addItem,
    getItem,
    getAllItems,
    updateItem,
    deleteItem,
  };
}
