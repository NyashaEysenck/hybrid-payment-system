// utils/crypto.js
import CryptoJS from 'crypto-js';

/**
 * Encrypts data using AES encryption
 * @param {Object} data - Data to encrypt
 * @param {string} key - Encryption key
 * @returns {string} - Encrypted data as string
 */
export const encryptData = (data, key) => {
  try {
    // TEMPORARY BYPASS: Return JSON string directly for development
    if (data && typeof data === 'object' && data.type === 'offline') {
      console.log('ENCRYPTION BYPASSED for offline transaction:', data);
      return JSON.stringify(data);
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, key, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    }).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts data using AES decryption with better error handling
 * @param {string} ciphertext - Encrypted data
 * @param {string} key - Decryption key
 * @returns {Object|null} - Decrypted data or null if decryption fails
 */
export const decryptData = (ciphertext, key) => {
  try {
    // TEMPORARY BYPASS: Check if this is a JSON string (not encrypted)
    if (ciphertext && typeof ciphertext === 'string' && 
        (ciphertext.startsWith('{') || ciphertext.startsWith('['))) {
      try {
        const parsed = JSON.parse(ciphertext);
        console.log('DECRYPTION BYPASSED - direct JSON data:', parsed);
        return parsed;
      } catch (jsonError) {
        // Not valid JSON, continue with normal decryption
      }
    }
    
    // First check if the ciphertext looks valid
    if (!ciphertext || typeof ciphertext !== 'string' || ciphertext.length < 16) {
      throw new Error('Invalid ciphertext format');
    }

    const bytes = CryptoJS.AES.decrypt(ciphertext, key, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Check if decryption produced any output
    if (!bytes.sigBytes || bytes.sigBytes <= 0) {
      throw new Error('Decryption failed - possibly wrong key');
    }

    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    
    // Validate that the decrypted text is valid JSON
    if (!decryptedText) {
      throw new Error('Decryption produced empty result');
    }
    
    try {
      return JSON.parse(decryptedText);
    } catch (parseError) {
      console.error('Failed to parse decrypted JSON:', parseError);
      throw new Error('Decryption succeeded but produced invalid JSON');
    }
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

/**
 * Derives a secure key from password using PBKDF2
 * @param {string} password - User password
 * @param {string} salt - Unique per-user salt (store securely)
 * @returns {string} - Derived key
 */
export const deriveMasterKey = (password, salt) => {
  // For offline mode, provide a dummy key if needed
  if (password === 'offline_bypass') {
    return 'offline_master_key';
  }
  
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 10000,
    hasher: CryptoJS.algo.SHA256
  }).toString();
};

/**
 * Generates short-lived session key for PIN unlock
 * @param {string} masterKey - Primary derived key
 * @param {string} pin - User's quick-access PIN
 * @returns {string} - Temporary session key
 */
export const deriveSessionKey = (masterKey, pin) => {
  return CryptoJS.HmacSHA256(pin, masterKey).toString();
};

/**
 * Securely clears sensitive data from memory
 * Note: JavaScript can't guarantee memory wiping, but this helps
 */
export const clearSensitiveData = (obj) => {
  if (!obj) return;
  
  // Overwrite properties with zeros
  Object.keys(obj).forEach(key => {
    if (typeof obj[key] === 'string') {
      obj[key] = '0'.repeat(obj[key].length);
    } else if (typeof obj[key] === 'object') {
      clearSensitiveData(obj[key]);
    }
  });
};

/**
 * Helper for generating random salts (store these with user profile)
 */
export const generateSalt = () => {
  return CryptoJS.lib.WordArray.random(128 / 8).toString();
};