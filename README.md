
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

The QR code transfer system uses WebRTC for peer-to-peer communication, allowing secure offline payments between devices. Here's how it works:

## Important: Offline Mode Requirements

Before attempting any QR code offline transfers:

1. Toggle to Offline Mode:
   - Click the "Offline Mode" toggle in the navbar or sidebar
   - Ensure your offline balance is greater than 0
   - You'll see "Offline Mode" indicator in the UI

2. After completing all offline transfers:
   - Toggle back to Online Mode
   - Your transactions will sync with the server
   - Your balances will be reconciled

## Steps to Perform QR Code Offline Transfer

**Navigate to offline transactions in the sidebar**
**- or click manage offline payments from the dashboard**

### For the Payer (Sending Money):

1. **Prepare Payment**:
   - Go to "Send Money" page
   - Enter the payment amount
   - Click "Generate QR Code"

2. **QR Code Exchange**:
   - If data is large, system will split into multiple QR codes
   - Show first QR code to payee
   - Wait for payee to scan all QR codes in order

3. **Receive Answer**:
   - Wait for payee's answer QR code
   - If split into chunks:
     - Scan first chunk QR code
     - Wait for remaining chunks
     - Scan all chunks in order
   - If single QR code:
     - Scan single answer QR code

4. **Completion**:
   - Wait for payment confirmation
   - Your offline balance updates automatically

### For the Payee (Receiving Money):

1. **Receive Payment**:
   - Go to "Receive Money" page
   - Click "Scan QR Code"

2. **QR Code Exchange**:
   - If payer's QR code is split:
     - Scan first chunk QR code
     - Wait for remaining chunks
     - Scan all chunks in order
   - If single QR code:
     - Scan single QR code

3. **Send Answer**:
   - System establishes WebRTC connection
   - Generate answer QR code
   - If split into chunks:
     - Show first answer QR code
     - Wait for payer to scan first QR code
   - If single QR code:
     - Show single answer QR code
     - Wait for payer to scan QR code

4. **Completion**:
   - Wait for payment to be processed
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

