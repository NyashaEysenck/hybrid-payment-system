/**
 * WebRTCService.ts
 * Handles WebRTC connection establishment and data transfer for offline P2P payments
 */

// Configuration for RTCPeerConnection
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, // Public STUN server
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Connection state type
export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

// Message handler type
export type MessageHandler = (message: any) => void;

// Connection state change handler type
export type ConnectionStateHandler = (state: ConnectionState) => void;

// WebRTC connection data (for QR code exchange)
export interface WebRTCConnectionData {
  type: 'offer' | 'answer';
  sdp: string;
  senderID?: string;
}

/**
 * WebRTC Service for P2P money transfer
 */
export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessageCallback: MessageHandler | null = null;
  private onConnectionStateChangeCallback: ConnectionStateHandler | null = null;
  private userId: string;
  
  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Initialize a new WebRTC connection as the sender (initiator)
   * @returns Promise resolving to the connection offer
   */
  async initiateSenderConnection(): Promise<WebRTCConnectionData> {
    try {
      // Create new peer connection
      this.peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Set up connection state change handler
      this.setupConnectionStateHandler();
      
      // Create data channel
      this.dataChannel = this.peerConnection.createDataChannel('paymentChannel', {
        ordered: true // Ensure ordered delivery of messages
      });
      
      // Set up data channel event handlers
      this.setupDataChannelHandlers(this.dataChannel);
      
      // Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Wait for ICE gathering to complete
      const offerData = await this.waitForIceGatheringComplete();
      
      return {
        type: 'offer',
        sdp: offerData.sdp || '',
        senderID: this.userId
      };
    } catch (error) {
      console.error('Error initiating sender connection:', error);
      throw error;
    }
  }

  /**
   * Initialize a new WebRTC connection as the receiver
   * @param offerData The offer data received from the sender
   * @returns Promise resolving to the connection answer
   */
  async initiateReceiverConnection(offerData: WebRTCConnectionData): Promise<WebRTCConnectionData> {
    try {
      // Create new peer connection
      this.peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Set up connection state change handler
      this.setupConnectionStateHandler();
      
      // Set up data channel event handler for when the sender creates the channel
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers(this.dataChannel);
      };
      
      // Set remote description from offer
      const offerSdp = new RTCSessionDescription({
        type: 'offer',
        sdp: offerData.sdp
      });
      
      await this.peerConnection.setRemoteDescription(offerSdp);
      
      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // Wait for ICE gathering to complete
      const answerData = await this.waitForIceGatheringComplete();
      
      return {
        type: 'answer',
        sdp: answerData.sdp || '',
        senderID: this.userId
      };
    } catch (error) {
      console.error('Error initiating receiver connection:', error);
      throw error;
    }
  }

  /**
   * Complete the connection as the sender by processing the receiver's answer
   * @param answerData The answer data received from the receiver
   */
  async completeSenderConnection(answerData: WebRTCConnectionData): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }
    
    try {
      const answerSdp = new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.sdp
      });
      
      await this.peerConnection.setRemoteDescription(answerSdp);
    } catch (error) {
      console.error('Error completing sender connection:', error);
      throw error;
    }
  }

  /**
   * Send a message through the data channel
   * @param message The message to send
   */
  sendMessage(message: any): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }
    
    try {
      this.dataChannel.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Set a callback to handle incoming messages
   * @param callback The function to call when a message is received
   */
  onMessage(callback: MessageHandler): void {
    this.onMessageCallback = callback;
  }

  /**
   * Set a callback to handle connection state changes
   * @param callback The function to call when the connection state changes
   */
  onConnectionStateChange(callback: ConnectionStateHandler): void {
    this.onConnectionStateChangeCallback = callback;
  }

  /**
   * Close the WebRTC connection
   */
  closeConnection(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    this.dataChannel = null;
    this.peerConnection = null;
  }

  /**
   * Wait for ICE gathering to complete and return the SDP
   */
  private waitForIceGatheringComplete(): Promise<RTCSessionDescriptionInit> {
    return new Promise((resolve) => {
      if (!this.peerConnection) {
        resolve({ type: 'offer', sdp: '' });
        return;
      }
      
      // If gathering is already complete, resolve immediately
      if (this.peerConnection.iceGatheringState === 'complete') {
        resolve(this.peerConnection.localDescription || { type: 'offer', sdp: '' });
        return;
      }
      
      // Otherwise wait for the gathering to complete
      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
          resolve(this.peerConnection.localDescription || { type: 'offer', sdp: '' });
        }
      };
      
      this.peerConnection.addEventListener('icegatheringstatechange', checkState);
      
      // Set a timeout in case gathering takes too long
      setTimeout(() => {
        this.peerConnection?.removeEventListener('icegatheringstatechange', checkState);
        resolve(this.peerConnection?.localDescription || { type: 'offer', sdp: '' });
      }, 10000); // 10 seconds timeout
    });
  }

  /**
   * Set up data channel event handlers
   */
  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('Data channel opened');
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('connected');
      }
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('disconnected');
      }
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback('failed');
      }
    };
    
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  /**
   * Set up connection state change handler
   */
  private setupConnectionStateHandler(): void {
    if (!this.peerConnection) return;
    
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      
      console.log('Connection state changed:', this.peerConnection.connectionState);
      
      if (this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.peerConnection.connectionState as ConnectionState);
      }
    };
  }
}

/**
 * Helper function to compress SDP for QR code
 * @param sdp The SDP to compress
 * @returns Compressed SDP string
 */
export function compressSDP(sdp: string): string {
  // Basic compression - remove unnecessary lines and whitespace
  // In a real app, you might want to use a more sophisticated compression algorithm
  return sdp
    .split('\n')
    .filter(line => !line.startsWith('#')) // Remove comments
    .join('|'); // Use a separator that's unlikely to appear in the SDP
}

/**
 * Helper function to decompress SDP from QR code
 * @param compressed The compressed SDP string
 * @returns Decompressed SDP string
 */
export function decompressSDP(compressed: string): string {
  // Reverse the compression
  return compressed.split('|').join('\n');
}

/**
 * Create a WebRTC service instance
 * @param userId The user ID to use for the connection
 * @returns A new WebRTC service instance
 */
export function createWebRTCService(userId: string): WebRTCService {
  return new WebRTCService(userId);
}

export default createWebRTCService;
