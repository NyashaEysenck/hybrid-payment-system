import { useState, useEffect } from 'react';

// Default database version to use across the application
const DEFAULT_DB_VERSION = 1;

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

export function useIndexedDB({ dbName, storeName, version = DEFAULT_DB_VERSION }: IndexedDBOptions) {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const openDB = () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        try {
          // Check if IndexedDB is available
          if (!window.indexedDB) {
            const errorMsg = 'Your browser doesn\'t support IndexedDB. Some features may not work properly.';
            console.error(errorMsg);
            reject(new Error(errorMsg));
            return;
          }

          console.log(`Attempting to open IndexedDB database: ${dbName}, version: ${version}`);
          const request = indexedDB.open(dbName, version);

          request.onupgradeneeded = (event) => {
            try {
              const db = (event.target as IDBOpenDBRequest).result;
              const oldVersion = event.oldVersion;
              console.log(`Upgrading database from version ${oldVersion} to ${version}`);
              
              // Create the object store if it doesn't exist
              if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
                console.log(`Created object store: ${storeName}`);
              }
            } catch (upgradeError) {
              console.error('Error during database upgrade:', upgradeError);
            }
          };

          request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            console.log(`Successfully opened IndexedDB: ${dbName}`);
            resolve(db);
          };

          request.onerror = (event) => {
            const errorObj = (event.target as IDBOpenDBRequest).error;
            const errorMsg = `Error opening IndexedDB: ${errorObj?.message || 'Unknown error'}`;
            console.error(errorMsg, event);
            reject(new Error(errorMsg));
          };

          // Handle edge cases like private browsing mode
          request.onblocked = (event) => {
            console.error('Database request blocked. Close other tabs with this site open.', event);
            reject(new Error('Database request blocked. Try closing other tabs with this site open.'));
          };
        } catch (error) {
          const errorMsg = `Unexpected error opening IndexedDB: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          reject(new Error(errorMsg));
        }
      });
    };

    const initDB = async () => {
      try {
        setIsLoading(true);
        const database = await openDB();
        setDb(database);
        setIsInitialized(true);
        console.log(`IndexedDB initialized for ${dbName}/${storeName}`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error initializing IndexedDB';
        console.error(`IndexedDB initialization error for ${dbName}/${storeName}:`, errorMsg);
        setError(errorMsg);
      } finally {
        setIsLoading(false);
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

  const getAllItems = async <T>() => {
    // If database is not initialized yet, wait for it
    if (!db && !error) {
      console.log(`Waiting for database ${dbName}/${storeName} to initialize...`);
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (isInitialized || error) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, 5000);
      });
    }
    
    return new Promise<T[]>((resolve, reject) => {
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
