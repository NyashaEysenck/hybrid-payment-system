// AuthContext.tsx  
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import api from "@/utils/api";
import { getUser, saveUser, clearUserStorage } from "@/utils/storage";
import { encryptData, decryptData, deriveMasterKey, generateSalt } from "@/utils/crypto";

interface User {
  _id: string;
  username: string;
  email: string;
  balance: number;
  offline_credits: number;
  crypto_salt?: string;
}

interface AuthContextType {
  user: User | null;
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
      const localUser = await getUser(email);
      console.log(localUser)
      if (localUser && localUser.crypto_salt) {
        try {
          const encryptionKey = deriveMasterKey(password, localUser.crypto_salt);
          const decryptedUser = decryptData(localUser.encryptedData, encryptionKey);
          
          if (decryptedUser) {
            setUser(decryptedUser);
            localStorage.setItem('lastEmail', email);
            toast({ title: "Login successful", description: "Using cached credentials" });
            return;
          }
        } catch (decryptError) {
          console.log("Local decryption failed, trying server login...");
        }
      }

      const response = await api.post('/auth/login', { email, password });
      const remoteUser = response.data.user;
      
      const salt = remoteUser.crypto_salt || generateSalt();
      const encryptionKey = deriveMasterKey(password, salt);
      const encryptedUser = encryptData(remoteUser, encryptionKey);
      
      const userToSave = { ...remoteUser, crypto_salt: salt };
      
      setUser(userToSave);
      localStorage.setItem('lastEmail', email);
      
      setTimeout(() => {
        saveUser(email, {
          ...userToSave,
          encryptedData: encryptedUser
        }).catch(err => console.error("Save error:", err));
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
      const salt = generateSalt();
      const response = await api.post('/auth/register', { 
        username, 
        email, 
        password,
        crypto_salt: salt
      });

      const remoteUser = response.data.user;
      const encryptionKey = deriveMasterKey(password, salt);
      const encryptedUser = encryptData(remoteUser, encryptionKey);
      
      const userToSave = { ...remoteUser, crypto_salt: salt };
      setUser(userToSave);
      localStorage.setItem('lastEmail', email);
      
      setTimeout(() => {
        saveUser(email, {
          ...userToSave,
          encryptedData: encryptedUser
        }).catch(err => console.error("Save error:", err));
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

    localStorage.removeItem('lastEmail');
    sessionStorage.removeItem('sessionUser');
    setUser(null);
    toast({ title: "Logged out", description: "You have been signed out" });
  }, [toast]);

  return (
    <AuthContext.Provider value={{ 
      user, 
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