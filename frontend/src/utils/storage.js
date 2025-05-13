
const DB_NAME = 'AuthDB';
const STORE_NAME = 'users';

// Connection pooling remains exactly the same
let dbConnection = null;

const openDB = () => {
  return new Promise((resolve, reject) => {
    if (dbConnection) {
      resolve(dbConnection);
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'email' });
      }
    };

    request.onsuccess = () => {
      dbConnection = request.result;
      dbConnection.onclose = () => { dbConnection = null; };
      dbConnection.onerror = (event) => {
        console.error("Database error:", event.target.error);
        dbConnection = null;
      };
      resolve(dbConnection);
    };
    
    request.onerror = () => reject(request.error);
  });
};

export const saveUser = async (email, user) => {
  try {
    console.log("Saving user:", user);
    const db = await openDB();
    console.log("DB opened successfully:", db);
    
    // Check if the user exists before saving
    const existingUser = await getUser(email);
    if (existingUser) {
      console.log("User already exists, updating data.");
    } else {
      console.log("User does not exist, saving new data.");
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const userToStore = {
        email: email,
        crypto_salt: user.crypto_salt,
        encryptedData: user.encryptedData
      };
    
      
      const request = store.put(userToStore);
      
      request.onsuccess = () =>  resolve(userToStore); // C
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
};

export const debugListAllUsers = async () => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      console.log('All users in database:', request.result);
      resolve(request.result);
    };
  });
};

// Updated to match the expected data structure
export const getUser = async (email) => {
 
  try {
    console.log(`Attempting to get user with email: ${email}`);
    const db = await openDB();
    console.log('Database connection established');
    
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      console.log('Transaction created');
      
      const store = tx.objectStore(STORE_NAME);
      console.log('Object store accessed');
      
      const request = store.get(email);
      console.log('Get request initiated for email:', email);
      
      request.onsuccess = () => {
        console.log('Get request succeeded, result:', request.result);
        if (!request.result) {
          console.log('No user found with this email');
          resolve(null);
          return;
        }
        resolve({
          email: request.result.email,
          crypto_salt: request.result.crypto_salt,
          encryptedData: request.result.encryptedData
        });
      };
      
      request.onerror = () => {
        console.error("Error getting user:", request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return null;
  }
};
// clearUserStorage remains exactly the same
export const clearUserStorage = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error clearing user storage:", error);
    throw error;
  }
};