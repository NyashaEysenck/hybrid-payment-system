/**
 * QR Code Utilities for WebRTC Connection Data
 * 
 * This file contains utilities for encoding and decoding WebRTC connection data
 * for QR code transmission between devices.
 */

import { WebRTCConnectionData } from "@/services/WebRTCService";

/**
 * Maximum size for QR code data (in characters)
 * QR codes have different capacity limits based on version and error correction level
 * The error shows that we need to stay under 10,208 characters, but we'll use a much lower value
 * to ensure reliable scanning across all devices and error correction levels
 */
const MAX_QR_SIZE = 1000;

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
  // First, convert to JSON and encode to base64
  const jsonString = JSON.stringify(data);
  const encoded = btoa(jsonString);
  
  // Calculate chunk size - leave room for chunk header
  // Format: CHUNK:current:total:data
  // We need to leave room for the header which is about 20 chars
  const CHUNK_SIZE = MAX_QR_SIZE - 20;
  
  // If the encoded data fits in one QR code, return it directly
  if (encoded.length <= MAX_QR_SIZE) {
    return [encoded];
  }
  
  // Otherwise, split it into multiple chunks with headers
  const chunks: string[] = [];
  const totalChunks = Math.ceil(encoded.length / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, encoded.length);
    const chunkData = encoded.slice(start, end);
    
    // Format: CHUNK:current:total:data
    const chunkWithHeader = `CHUNK:${i + 1}:${totalChunks}:${chunkData}`;
    chunks.push(chunkWithHeader);
  }
  
  console.log(`Split data into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Join multiple QR code chunks back into a single connection data object
 * 
 * @param chunks Array of encoded strings from multiple QR codes
 * @returns Decoded WebRTC connection data
 */
export function joinConnectionData(chunks: string[]): WebRTCConnectionData {
  // Extract data from chunks (remove headers)
  const dataChunks: string[] = [];
  
  // First, sort the chunks by their index if they have CHUNK: headers
  const sortedChunks = [...chunks].sort((a, b) => {
    if (a.startsWith('CHUNK:') && b.startsWith('CHUNK:')) {
      const aIndex = parseInt(a.split(':', 4)[1]) || 0;
      const bIndex = parseInt(b.split(':', 4)[1]) || 0;
      return aIndex - bIndex;
    }
    return 0;
  });
  
  console.log('Processing chunks in order:', sortedChunks.map(chunk => {
    if (chunk.startsWith('CHUNK:')) {
      const parts = chunk.split(':', 4);
      return `Chunk ${parts[1]} of ${parts[2]}`;
    }
    return 'Single chunk';
  }));
  
  // Then extract the data portion from each chunk
  for (const chunk of sortedChunks) {
    try {
      if (chunk.startsWith('CHUNK:')) {
        // Format: CHUNK:current:total:data
        const parts = chunk.split(':', 4);
        if (parts.length === 4) {
          const dataChunk = parts[3].trim();
          dataChunks.push(dataChunk);
          console.log(`Added chunk ${parts[1]} of ${parts[2]}: ${dataChunk.substring(0, 20)}...`);
        }
      } else {
        // Single chunk without header
        const trimmedChunk = chunk.trim();
        dataChunks.push(trimmedChunk);
        console.log(`Added single chunk: ${trimmedChunk.substring(0, 20)}...`);
      }
    } catch (error) {
      console.error('Error processing chunk:', error);
      console.error('Problematic chunk:', chunk);
      throw new Error(`Failed to process QR code chunk: ${error.message}`);
    }
  }
  
  // Join the data parts and decode
  const encoded = dataChunks.join('');
  console.log(`Joined ${dataChunks.length} chunks, total length: ${encoded.length}`);
  try {
    return decodeConnectionData(encoded);
  } catch (error) {
    console.error('Error decoding joined data:', error);
    console.error('First 100 chars of joined data:', encoded.substring(0, 100));
    throw new Error('Failed to decode joined QR code data: ' + (error as Error).message);
  }
}

/**
 * Check if a string is valid base64
 * 
 * @param str String to check
 * @returns True if the string is valid base64
 */
function isValidBase64(str: string): boolean {
  try {
    // Try to decode the string
    return btoa(atob(str)) === str;
  } catch (e) {
    return false;
  }
}
