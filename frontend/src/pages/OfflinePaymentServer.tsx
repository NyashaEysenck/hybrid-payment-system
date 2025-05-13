import React, { useState, useEffect, useCallback } from 'react';
import Layout from "@/components/Layout";
import WhiteCard from "@/components/WhiteCard";
import { useAuth } from '@/contexts/AuthContext';
import { useOfflineBalance } from '@/contexts/OfflineBalanceContext';
import { useNavigate } from 'react-router-dom';
import { useIndexedDB, Transaction } from '../hooks/useIndexedDB';
import QRCode from 'react-qr-code';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import GreenButton from "@/components/GreenButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Wifi, WifiOff, QrCode, RefreshCw, CheckCircle, Smartphone, Globe } from "lucide-react";
import { checkOnlineStatus } from '@/utils/connectivity';
import api from '@/utils/api';

interface ServerInfo {
  serverUrl: string;
  qrCodeDataUrl: string;
}

const OfflinePaymentServer: React.FC = () => {
  const { user } = useAuth();
  const { updateOfflineBalance, refreshOfflineBalance } = useOfflineBalance();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [onlineTransactions, setOnlineTransactions] = useState<Transaction[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [checkingOnlineStatus, setCheckingOnlineStatus] = useState(false);
  
  const { getAllItems, addItem, error: dbError } = useIndexedDB({
    dbName: 'offlinePayments',
    storeName: 'transactions',
  });

  // Check online status
  const checkConnectionStatus = useCallback(async () => {
    setCheckingOnlineStatus(true);
    try {
      const online = await checkOnlineStatus();
      setIsOnline(online);
      console.log('Connection status:', online ? 'Online' : 'Offline');
    } catch (err) {
      console.error('Error checking connection status:', err);
      setIsOnline(false);
    } finally {
      setCheckingOnlineStatus(false);
    }
  }, []);

  useEffect(() => {
    // Check online status on mount and every 30 seconds
    checkConnectionStatus();
    const interval = setInterval(checkConnectionStatus, 30000);
    
    return () => clearInterval(interval);
  }, [checkConnectionStatus]);

  useEffect(() => {
    // No need to redirect in offline mode
    if (!user && !isOnline) {
      navigate('/login');
    }
  }, [user, navigate, isOnline]);

  useEffect(() => {
    // Clean up polling interval on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Fetch online transactions from the backend
  const fetchOnlineTransactions = useCallback(async () => {
    if (!isOnline || !user) return;
    
    try {
      const response = await api.get('/api/transactions');
      if (response.status === 200) {
        setOnlineTransactions(response.data);
      }
    } catch (err) {
      console.error('Error fetching online transactions:', err);
    }
  }, [isOnline, user]);

  // Fetch offline transactions from IndexedDB
  const fetchOfflineTransactions = useCallback(async () => {
    try {
      const items = await getAllItems<Transaction>();
      console.log('Fetched transactions from IndexedDB:', items);
      
      // Check if there are new transactions
      const newTransactions = items.filter(
        item => !transactions.some(tx => tx.id === item.id)
      );
      
      // Update offline balance for new transactions
      if (newTransactions.length > 0 && user?.email) {
        newTransactions.forEach(tx => {
          if (tx.recipient === user.email) {
            // Money received (add to balance)
            updateOfflineBalance(parseFloat(tx.amount.toString()));
          }
        });
        
        // Refresh the full offline balance
        refreshOfflineBalance();
      }
      
      setTransactions(items || []);
    } catch (err) {
      console.error('Error fetching offline transactions:', err);
    }
  }, [getAllItems, transactions, user, updateOfflineBalance, refreshOfflineBalance]);

  const fetchTransactions = useCallback(async () => {
    // Fetch both online and offline transactions
    await fetchOfflineTransactions();
    
    if (isOnline) {
      await fetchOnlineTransactions();
    }
  }, [fetchOfflineTransactions, fetchOnlineTransactions, isOnline]);

  useEffect(() => {
    fetchTransactions();
    
    // Set up polling for transactions
    const interval = setInterval(fetchTransactions, 5000);
    setPollingInterval(interval);
    
    return () => {
      clearInterval(interval);
    };
  }, [fetchTransactions]);

  const startServer = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // In a real application, we would start the server process here
      // For this demo, we'll simulate starting the server and generate a QR code
      
      // Get the local IP address (in a real app, this would come from the server)
      const ipAddress = window.location.hostname === 'localhost' ? '192.168.1.43' : window.location.hostname;
      const port = '3001'; // This should match the port in server.js
      
      // Always use HTTPS for the server URL since our backend is configured for HTTPS
      const serverUrl = `https://${ipAddress}:${port}`;
      
      // Generate a data URL for the QR code (this is normally done by the server)
      // Here we're just creating a URL that the client can use to connect
      const qrCodeData = serverUrl;
      
      setServerInfo({
        serverUrl,
        qrCodeDataUrl: qrCodeData,
      });
      
      toast({
        title: "Server Started",
        description: "Payment server is now running and ready to accept connections.",
        duration: 3000,
      });
    } catch (err) {
      console.error('Error starting server:', err);
      setError('Failed to start payment server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const stopServer = () => {
    setServerInfo(null);
    setTransactions([]);
    
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    
    toast({
      title: "Server Stopped",
      description: "Payment server has been stopped.",
      duration: 3000,
    });
  };

  // Get the correct transactions based on online/offline status
  const displayTransactions = isOnline ? onlineTransactions : transactions;

  return (
    <Layout>
      <WhiteCard>
        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-6">Offline Payment Server</h1>
          
          <div className="mb-4 flex items-center">
            <div className={`flex items-center ${isOnline ? 'text-green-600' : 'text-amber-600'} gap-2`}>
              {isOnline ? (
                <>
                  <Wifi className="h-5 w-5" />
                  <span className="font-medium">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5" />
                  <span className="font-medium">Offline</span>
                </>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkConnectionStatus}
              disabled={checkingOnlineStatus}
              className="ml-2"
            >
              {checkingOnlineStatus ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          <Tabs defaultValue="server" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="server">Server</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>
            
            <TabsContent value="server" className="space-y-4 mt-4">
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {!serverInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-4">
                    <Wifi className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-500">
                      Start the payment server to receive payments from other devices
                    </span>
                  </div>
                  
                  <GreenButton 
                    onClick={startServer} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Starting Server...
                      </>
                    ) : (
                      'Start Payment Server'
                    )}
                  </GreenButton>
                </div>
              ) : (
                <div className="space-y-6">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">Server Running</AlertTitle>
                    <AlertDescription>
                      Your payment server is active. Scan the QR code below to connect.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border">
                    <div className="mb-4">
                      <QRCode 
                        value={serverInfo.qrCodeDataUrl} 
                        size={200}
                        level="H"
                      />
                    </div>
                    <p className="text-sm text-gray-500 text-center mb-2">
                      Scan this QR code with another device to connect
                    </p>
                    <p className="text-xs text-gray-400 break-all text-center">
                      {serverInfo.serverUrl}
                    </p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    onClick={stopServer}
                    className="w-full"
                  >
                    Stop Server
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="transactions" className="space-y-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recent Transactions</h2>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    {isOnline ? (
                      <>
                        <Globe className="h-4 w-4" />
                        <span>Online</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4" />
                        <span>Local</span>
                      </>
                    )}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchTransactions}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              {displayTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <Smartphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No transactions yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Transactions will appear here when payments are processed
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayTransactions.map((tx) => (
                    <div key={tx.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">{tx.recipient}</h3>
                          <p className="text-sm text-gray-500">{new Date(tx.timestamp).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">+${tx.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">
                            {tx.type === 'offline' ? 'Offline Payment' : tx.type}
                          </p>
                        </div>
                      </div>
                      {tx.note && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-sm">{tx.note}</p>
                        </>
                      )}
                      <div className="mt-2 text-xs text-gray-400">
                        Receipt ID: {tx.receiptId || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </WhiteCard>
    </Layout>
  );
};

export default OfflinePaymentServer;
