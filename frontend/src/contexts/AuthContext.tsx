// AuthContext.tsx  
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from "@/utils/api";
import { getUser, saveUser, clearUserStorage } from "@/utils/storage";

interface User {
  _id: string;
  username: string;
  email: string;
  balance: number; // Online balance
  offline_balance: number;
  // No crypto_salt needed since we're not encrypting
}

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize from sessionStorage if available
    const sessionUser = sessionStorage.getItem('sessionUser');
    return sessionUser ? JSON.parse(sessionUser) : null;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Persist user to sessionStorage whenever it changes
  useEffect(() => {
    if (user) {
      sessionStorage.setItem('sessionUser', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('sessionUser');
    }
  }, [user]);

  // Check for existing session on initial load
  useEffect(() => {
    const checkPersistedSession = async () => {
      try {
        const lastEmail = localStorage.getItem('lastEmail');
        if (lastEmail) {
          const localUser = await getUser(lastEmail);
          if (localUser) {
            setUser(localUser);
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkPersistedSession();
  }, [toast]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      // Get user data from login
      const response = await api.post('/auth/login', { email, password });
      const remoteUser = response.data.user;
      
      // Get initial balances from wallet
      const balanceResponse = await api.post('/wallet/balance', { email });
      const initialOnlineBalance = balanceResponse.data.balance || 0;
      const initialOfflineBalance = balanceResponse.data.offline_balance || 0;
      
      // Add balances to user data
      const userWithBalances = { 
        ...remoteUser, 
        balance: initialOnlineBalance,
        offline_balance: initialOfflineBalance
      };
      
      // Save to localStorage
      localStorage.setItem('lastEmail', email);
      localStorage.setItem('offlineBalance', initialOfflineBalance.toString());
      
      // Update state
      setUser(userWithBalances);
      
      // Save user data directly
      setTimeout(() => {
        saveUser(email, userWithBalances).catch(err => console.error("Save error:", err));
      }, 0);
      
      toast({ title: "Login successful", description: "Welcome back!" });
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.response?.data?.error || "Invalid credentials",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', { 
        username, 
        email, 
        password
      });

      const remoteUser = response.data.user;
      setUser(remoteUser);
      localStorage.setItem('lastEmail', email);
      
      setTimeout(() => {
        saveUser(email, remoteUser).catch(err => console.error("Save error:", err));
      }, 0);
      
      toast({ title: "Registration successful", description: "Your account has been created" });
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.error || "Registration error",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const logout = useCallback(() => {
    // Clear all storage
    localStorage.removeItem('lastEmail');
    localStorage.removeItem('offlineBalance');
    sessionStorage.removeItem('sessionUser');
    clearUserStorage(); // Clear any additional storage
    
    // Clear user state
    setUser(null);
    
    // Show success message
    toast({ 
      title: "Logged out", 
      description: "You have been signed out successfully."
    });
  }, [toast]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser,
      isAuthenticated: !!user, 
      isLoading,
      login, 
      register, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};