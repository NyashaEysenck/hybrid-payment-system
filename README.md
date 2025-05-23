# Dual Online-Offline Payment System

## Overview

Welcome to the Dual Online-Offline Payment System, a robust POS system designed to handle transactions seamlessly both online and offline. This system is built with React and Express, ensuring reliability even in areas with unstable internet connections. Key features include support for QR codes, NFC, and Bluetooth for contactless payments, with automatic data syncing once online, and secure transaction processing with user authentication.

## Features

- **Online and Offline Transaction Handling**: Ensures transactions can be processed even without an internet connection.
- **Contactless Payments**: Supports QR codes, NFC, and Bluetooth for seamless payment experiences.
- **Automatic Data Syncing**: Transactions made offline are automatically synced once an internet connection is available.
- **Secure Transaction Processing**: Ensures all transactions are processed securely.
- **User Authentication**: Provides secure user authentication to protect user data.
- **Dual Balance System**: Maintains both online and offline balances for seamless transitions between connectivity states.

## Offline Storage Mechanism

The system uses IndexedDB as its offline storage solution, providing a robust and reliable way to store transaction data and balances when offline. The key components are:

1. **Database Structure**:
   - Database name: 'offline-payments'
   - Stores:
     - 'offline-transactions': Stores transaction records
     - 'offline-balance': Stores balance information

2. **Data Persistence**:
   - Transactions are automatically saved to IndexedDB when offline
   - Balances are updated locally using IndexedDB
   - Data persists even after browser restart

3. **Sync Mechanism**:
   - When online, the system automatically detects pending offline transactions
   - Transactions are synced to the central server
   - Balances are reconciled with the server's records

## QR Code Transfer Technology

This system enables offline peer-to-peer (P2P) payments by leveraging WebRTC for direct communication between two devices and QR codes for the initial exchange of connection details.

### Technology Overview

#### WebRTC (Web Real-Time Communication)
WebRTC is a technology that allows web browsers and mobile applications to establish direct peer-to-peer connections. This means data can be sent directly between users' devices without needing to pass through a central server once the connection is set up. In this system, it's used for:

- **Establishing a secure data channel**: A dedicated channel for sending payment information and confirmations directly between the sender and receiver.
- **Offline capability**: Once the initial signaling (connection setup) is done, the actual data transfer can occur over a local network or other direct connection methods supported by WebRTC, which is ideal for offline scenarios.

#### QR Codes
QR codes are used to exchange the initial WebRTC signaling data (offers and answers) between the two devices when they are not yet connected.

- **Offline Data Exchange**: They provide a simple way to transfer text-based information (the WebRTC session descriptions) from one device's screen to another's camera.
- **Connection Data**: The data encoded in the QR codes includes the Session Description Protocol (SDP) information, which tells each device how to connect to the other.

### Establishing Communication

The process of establishing a WebRTC connection involves an "offer" and "answer" mechanism, facilitated by QR codes:

#### Sender Initiates (Creating an Offer)
- The user intending to send money (the sender) initiates the process
- Their device creates an RTCPeerConnection object
- A data channel, named paymentChannel, is created on this connection to ensure ordered delivery of messages
- The sender's WebRTC service then generates an "offer" (an SDP message) that contains the sender's connection parameters
- This offer, along with the sender's ID, is packaged into a WebRTCConnectionData object

#### Offer QR Code Generation
- The WebRTCConnectionData (the offer) is then encoded into a string, often Base64, to be represented as a QR code
- **Multi-Chunk QR Codes**: QR codes have a limited data capacity. If the offer SDP is too large for a single QR code, it's split into multiple smaller chunks. Each chunk is then displayed as a separate QR code, typically with a prefix indicating its sequence (e.g., "CHUNK:1:3:data...", "CHUNK:2:3:data..."). The sender's app will display these QR codes one by one or indicate that multiple scans are needed.

#### Receiver Scans Offer QR Code(s)
- The user intending to receive money (the receiver) uses their device's camera to scan the QR code(s) displayed by the sender
- If multiple chunks are detected (e.g., via the "CHUNK:" prefix), the receiver's app collects all chunks
- Once all chunks are scanned, they are reassembled and decoded to retrieve the original WebRTCConnectionData offer

#### Receiver Processes Offer and Creates Answer
- The receiver's device creates its own RTCPeerConnection object
- It sets the received offer as the "remote description"
- The receiver's WebRTC service then generates an "answer" (another SDP message) containing its own connection parameters
- This answer, along with the receiver's ID (e.g., user email), is packaged into a WebRTCConnectionData object

#### Answer QR Code Generation
- Similar to the offer, the receiver's WebRTCConnectionData (the answer) is encoded into one or more QR codes. This also supports multi-chunking if the answer SDP is large. The receiver's app displays these QR codes.

#### Sender Scans Answer QR Code(s)
- The sender scans the QR code(s) displayed by the receiver
- If multiple chunks are involved, the sender's app collects and reassembles them
- The decoded WebRTCConnectionData answer is retrieved

#### Connection Finalization
- The sender sets the received answer as the "remote description" on their RTCPeerConnection
- At this point, WebRTC attempts to establish the direct P2P connection using the exchanged ICE candidates (part of the SDP, handled by waitForIceGatheringComplete)
- Event handlers for data channel opening (onopen) and connection state changes (onconnectionstatechange) monitor the progress. When the data channel is open and the connection state is 'connected', the devices are ready to communicate directly.

### How the Payment Works

The payment process begins with the sender entering the transaction details, followed by the QR code exchange to establish communication, and then immediate payment processing:

#### Transaction Setup (Sender)
- The sender enters the payment amount and an optional note
- A unique transaction ID is generated (e.g., using uuidv4)
- A preliminary transaction record with 'pending' status is created and stored locally by the sender (using storageService)

#### WebRTC Connection & Payment Processing
Once the WebRTC data channel is established through the QR code exchange (connected state), the payment immediately processes:

- The sender automatically sends a 'payment' message containing the amount, sender ID, recipient ID (if known, or taken from the answer data), timestamp, note, and the transaction ID through the established WebRTC data channel

#### Payment Processing (Receiver)
- The receiver's app listens for messages on the data channel
- Upon receiving the 'payment' message, it validates the data
- A receipt ID is generated
- A transaction record with 'pending' status is created and stored locally by the receiver, linked to the sender's transaction ID and its own receipt ID
- The payment amount is added to the receiver's offline balance
- The transaction status is updated to 'completed' and saved again

#### Receipt Confirmation (Receiver to Sender)
- The receiver sends a 'receipt' message back to the sender via the data channel. This message includes the original transaction ID, the generated receipt ID, and a status ('success' or 'failed')

#### Transaction Finalization (Sender)
- The sender's app receives the 'receipt' message
- It updates its local transaction record with the receipt ID and status based on the message
- If the receipt indicates success:
  - The sender's offline balance is debited by the sent amount
  - The transaction is marked 'completed' locally
  - A success message is displayed to the sender
- If the receipt indicates failure or a timeout occurs (e.g., no receipt within 30 seconds):
  - The transaction is marked 'failed' locally
  - An error message is shown, and the user might be advised to check with the recipient

The payment is considered "worked" or successful from the sender's perspective when a success receipt is received and their balance is updated. From the receiver's perspective, it's successful when the payment message is processed, their balance is updated, and a receipt is sent. The local storage (storageService) ensures that transaction states are persisted on both devices even if the app closes, helping with reconciliation later.

## Important: Offline Mode Requirements

**Offline mode works without internet connection but both devices must be connected to the same network eg. You can use a Mobile Hotspot Connection**

Before attempting any QR code offline transfers:

1. Toggle to Offline Mode:
   - Click the "Offline Mode" toggle in the navbar or sidebar
   - Ensure your offline balance is greater than 0
   - You'll see "Offline Mode" indicator in the UI

2. After completing all offline transfers:
   - Toggle back to Online Mode (Make sure you're online!!)
   - Your balances will be reconciled

## Steps to Perform QR Code Offline Transfer

**Navigate to offline transactions in the sidebar**
**- or click manage offline payments from the dashboard**

### For the Payer (Sending Money):

1. **Set Payment Details**:
   - Go to "Send Money" page
   - Enter the payment amount and optional note
   - Click "Generate QR Code"

2. **QR Code Exchange**:
   - If data is large, system will split into multiple QR codes
   - Show first QR code to payee
   - Wait for payee to scan all QR codes in order

3. **Scan Answer QR Code(s)**:
   - Wait for payee's answer QR code
   - If split into chunks:
     - Scan first chunk QR code
     - Wait for remaining chunks
     - Scan all chunks in order
   - If single QR code:
     - Scan single answer QR code

4. **Receive Payment Confirmation**:
   - Payment processes automatically once connection is established
   - Receive receipt confirmation from payee
   - Your offline balance updates automatically

### For the Payee (Receiving Money):

1. **Prepare to Receive**:
   - Go to "Receive Money" page
   - Click "Scan QR Code"

2. **Scan Payment QR Code(s)**:
   - If payer's QR code is split:
     - Scan first chunk QR code
     - Wait for remaining chunks
     - Scan all chunks in order
   - If single QR code:
     - Scan single QR code

3. **Generate Answer QR Code(s)**:
   - System establishes WebRTC connection
   - Generate answer QR code automatically
   - If split into chunks:
     - Show first answer QR code
     - Wait for payer to scan first QR code
   - If single QR code:
     - Show single answer QR code
     - Wait for payer to scan QR code

4. **Receive Payment & Send Receipt**:
   - Payment processes automatically once connection is established
   - Send receipt confirmation to payer
   - Your offline balance updates automatically

## Important Notes

- Each QR code chunk is formatted as: CHUNK:current:total:data
- You must scan chunks in order (1, 2, 3, etc.)
- The system will show notifications about how many chunks are needed
- You cannot skip or miss any chunks in the sequence
- Ensure both devices are in Offline Mode before starting the transfer

## Security Features

- All transactions are encrypted end-to-end
- Each transaction has a unique identifier
- Payment amounts are verified before confirmation
- Connection data is split across multiple QR codes if needed
- Both parties must confirm the transaction before completion

## Offline Functionality

- Works without internet connection
- Instant peer-to-peer transfer
- Secure local storage of transaction history
- Automatic sync when online
- Maintains transaction integrity offline

## Tech Stack

- **Frontend**: React, TypeScript
- **Backend**: Express, Node.js
- **Languages**: 
  - TypeScript (84%)
  - JavaScript (14.8%)
  - Other (1.2%)

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/NyashaEysenck/hybrid-payment-system.git
    cd hybrid-payment-system
    ```

2. **Install dependencies**:
    ```bash
    # Install main project dependencies
    npm install
    
    # Navigate to frontend and install frontend dependencies
    cd frontend
    npm install
    ```

3. **Build the frontend**:
    ```bash
    npm run build
    ```

4. **Run the application**:
    ```bash
    # Navigate back to main directory and start the server
    cd ..
    node index
    ```

The server will now run both the backend and serve the frontend build files.

## Demo

Try out the offline QR code payment system with our live demo:

- **Live Demo**: [https://hybrid-payment-system-production.up.railway.app/](https://hybrid-payment-system-production.up.railway.app/)
- **Demo Users**:
  - user1@gmail.com (password: test1234)
  - user2@gmail.com (password: test1234)

## Usage

1. **Run the application** by following the steps in the Installation section.

2. **Access the application** in your browser at the provided url.

## Advanced Features Repository

Check out our advanced features repository for:

- NFC and Bluetooth payment implementations
- Advanced online/offline balance system
- More sophisticated encryption mechanisms
- Improved offline sync algorithms

[Advanced Features Repository](https://github.com/NyashaEysenck/Dual-Online-Offline-Payment-System)

We welcome contributions to these advanced features. Please check out the repository and help us:

- Complete NFC and Bluetooth implementations
- Enhance the offline balance system
- Improve encryption and security
- Add new payment methods

To get started, please fork the advanced repository and create a pull request with your changes. We appreciate all contributions, big or small.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any questions or suggestions, please open an issue or contact me directly.
