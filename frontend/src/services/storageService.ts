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

export class LocalStorageService implements StorageService {
  private static readonly USER_PREFIX = 'user_';
  private static readonly TX_PREFIX = 'tx_';
  private static readonly BALANCE_PREFIX = 'balance_';

  async saveUser(email: string, user: any): Promise<any> {
    try {
      console.log("Saving user:", user);
      const existingUser = await this.getUser(email); //
      if (existingUser) { //
        console.log("User already exists, updating data."); //
      } else {
        console.log("User does not exist, saving new data."); //
      }

      const userToStore = {
        email: email,
        crypto_salt: user.crypto_salt,
        encryptedData: user.encryptedData
      }; //
      localStorage.setItem(`${LocalStorageService.USER_PREFIX}${email}`, JSON.stringify(userToStore)); //
      return userToStore;
    } catch (error) {
      console.error("Error saving user:", error); //
      throw error; //
    }
  }

  async getUser(email: string): Promise<any> {
    try {
      console.log(`Attempting to get user with email: ${email}`); //
      const userStr = localStorage.getItem(`${LocalStorageService.USER_PREFIX}${email}`); //
      return userStr ? JSON.parse(userStr) : null; //
    } catch (error) {
      console.error("Error getting user:", error); //
      throw error; //
    }
  }

  async debugListAllUsers(): Promise<any[]> {
    const users: any[] = []; //
    for (let i = 0; i < localStorage.length; i++) { //
      const key = localStorage.key(i); //
      if (key?.startsWith(LocalStorageService.USER_PREFIX)) { //
        const user = JSON.parse(localStorage.getItem(key) || '{}'); //
        if (user.email) { //
          users.push(user); //
        }
      }
    }
    console.log('All users in storage:', users); //
    return users; //
  }

  async clearUserStorage(): Promise<void> {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(LocalStorageService.USER_PREFIX)) { //
        localStorage.removeItem(key); //
      }
    }
  }

  async saveTransaction(tx: Transaction): Promise<void> {
    let txs = await this.getTransactions();
    const existingTxIndex = txs.findIndex(existing => existing.id === tx.id);

    if (existingTxIndex > -1) {
      // If transaction with the same ID exists, update it
      txs[existingTxIndex] = tx;
    } else {
      // Otherwise, add the new transaction
      txs.push(tx);
    }
    localStorage.setItem(LocalStorageService.TX_PREFIX, JSON.stringify(txs));
  }

  async getTransactions(): Promise<Transaction[]> {
    const txsStr = localStorage.getItem(LocalStorageService.TX_PREFIX);
    return txsStr ?
      JSON.parse(txsStr) : []; //
  }

  async clearTransactions(): Promise<void> {
    localStorage.removeItem(LocalStorageService.TX_PREFIX); //
  }

  async saveOfflineBalance(balance: number, userEmail: string): Promise<void> {
    localStorage.setItem(`${LocalStorageService.BALANCE_PREFIX}${userEmail}`, balance.toString()); //
  }

  async getOfflineBalance(userEmail: string): Promise<number> {
    const balanceStr = localStorage.getItem(`${LocalStorageService.BALANCE_PREFIX}${userEmail}`); //
    return balanceStr ? parseFloat(balanceStr) : 0; //
  }
}

// Export a singleton instance
export const storageService = new LocalStorageService(); //
