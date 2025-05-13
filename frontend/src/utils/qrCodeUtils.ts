/**
 * QR Code Utilities for WebRTC Connection Data
 * 
 * This file contains utilities for encoding and decoding WebRTC connection data
 * for QR code transmission between devices.
 */

import { WebRTCConnectionData } from "@/services/WebRTCService";

/**
 * Maximum size for QR code data (in characters)
 * Standard QR codes can hold up to about 4,296 alphanumeric characters
 * We're setting a lower limit to ensure reliable scanning
 */
const MAX_QR_SIZE = 2500;

/**
 * Encode WebRTC connection data for QR code
 * Compresses and converts to a format suitable for QR codes
 * 
 * @param data The WebRTC connection data to encode
 * @returns Encoded string for QR code
 */
export function encodeConnectionData(data: WebRTCConnectionData): string {
  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(data);
    
    // Base64 encode to make it QR-friendly
    const encoded = btoa(jsonString);
    
    // Check if the encoded data is too large
    if (encoded.length > MAX_QR_SIZE) {
      throw new Error(`QR code data too large: ${encoded.length} characters (max: ${MAX_QR_SIZE})`);
    }
    
    return encoded;
  } catch (error) {
    console.error('Error encoding connection data:', error);
    throw error;
  }
}

/**
 * Decode WebRTC connection data from QR code
 * 
 * @param encodedData The encoded string from QR code
 * @returns Decoded WebRTC connection data
 */
export function decodeConnectionData(encodedData: string): WebRTCConnectionData {
  try {
    // Base64 decode
    const jsonString = atob(encodedData);
    
    // Parse JSON
    const data = JSON.parse(jsonString) as WebRTCConnectionData;
    
    // Validate required fields
    if (!data.type || !data.sdp) {
      throw new Error('Invalid connection data: missing required fields');
    }
    
    return data;
  } catch (error) {
    console.error('Error decoding connection data:', error);
    throw error;
  }
}

/**
 * Split large connection data into multiple QR codes if needed
 * 
 * @param data The WebRTC connection data to encode
 * @returns Array of encoded strings, each suitable for a QR code
 */
export function splitConnectionData(data: WebRTCConnectionData): string[] {
  const encoded = encodeConnectionData(data);
  
  // If the encoded data fits in one QR code, return it
  if (encoded.length <= MAX_QR_SIZE) {
    return [encoded];
  }
  
  // Otherwise, split it into multiple chunks
  const chunks: string[] = [];
  for (let i = 0; i < encoded.length; i += MAX_QR_SIZE) {
    chunks.push(encoded.slice(i, i + MAX_QR_SIZE));
  }
  
  return chunks;
}

/**
 * Join multiple QR code chunks back into a single connection data object
 * 
 * @param chunks Array of encoded strings from multiple QR codes
 * @returns Decoded WebRTC connection data
 */
export function joinConnectionData(chunks: string[]): WebRTCConnectionData {
  const encoded = chunks.join('');
  return decodeConnectionData(encoded);
}
