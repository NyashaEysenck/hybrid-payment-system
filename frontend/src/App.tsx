import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { WalletProvider } from "@/contexts/WalletContext";
import { OfflineBalanceProvider } from "@/contexts/OfflineBalanceContext";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import Dashboard from "./pages/Dashboard";
import OfflinePage from "./pages/OfflinePage";
import SendMoney from "./pages/SendMoney";
import RequestMoney from "./pages/RequestMoney";
import DepositPage from "./pages/DepositPage";
import WithdrawalPage from "./pages/WithdrawalPage";
import TransactionsPage from "./pages/TransactionsPage";
import TransactionDetailPage from "./pages/TransactionDetailPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import OfflinePaymentServer from "./pages/OfflinePaymentServer";
import OfflinePaymentClient from "./pages/OfflinePaymentClient";
import WebRTCSendMoney from "./pages/WebRTCSendMoney";
import WebRTCReceiveMoney from "./pages/WebRTCReceiveMoney";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <HomePage />} 
      />
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
      />
      <Route 
        path="/signup" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignUpPage />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/offline" 
        element={
          <ProtectedRoute>
            <OfflinePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/send" 
        element={
          <ProtectedRoute>
            <SendMoney />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/request" 
        element={
          <ProtectedRoute>
            <RequestMoney />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/deposit" 
        element={
          <ProtectedRoute>
            <DepositPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/withdraw" 
        element={
          <ProtectedRoute>
            <WithdrawalPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/transactions" 
        element={
          <ProtectedRoute>
            <TransactionsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/transactions/:transactionId" 
        element={
          <ProtectedRoute>
            <TransactionDetailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/offline-server" 
        element={
          <ProtectedRoute>
            <OfflinePaymentServer />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/offline-client" 
        element={
          <ProtectedRoute>
            <OfflinePaymentClient />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/payment" 
        element={
          <ProtectedRoute>
            <OfflinePaymentClient />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/webrtc-send-money" 
        element={
          <ProtectedRoute>
            <WebRTCSendMoney />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/webrtc-receive-money" 
        element={
          <ProtectedRoute>
            <WebRTCReceiveMoney />
          </ProtectedRoute>
        } 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <OfflineBalanceProvider>
            <WalletProvider>
              <AppRoutes />
            </WalletProvider>
          </OfflineBalanceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
