import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connect, disconnect, isConnected, getLocalStorage, request } from '@stacks/connect';

interface Address {
  address: string;
  publicKey?: string;
}

interface UserData {
  addresses: {
    stx: Address[];
    btc: Address[];
  };
}

interface WalletContextType {
  isAuthenticated: boolean;
  userData: UserData | null;
  stxAddress: string | null;
  btcAddress: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Load wallet state on mount
  useEffect(() => {
    const checkConnection = () => {
      const connected = isConnected();
      setIsAuthenticated(connected);

      if (connected) {
        const data = getLocalStorage();
        if (data?.addresses) {
          setUserData(data as UserData);
        }
      }
    };

    checkConnection();
  }, []);

  const connectWallet = async () => {
    if (isConnected()) {
      console.log('Already authenticated');
      return;
    }

    setIsConnecting(true);
    try {
      const response = await connect();
      console.log('Connected:', response.addresses);

      // Update state
      setIsAuthenticated(true);

      // Get full user data
      const data = getLocalStorage();
      if (data?.addresses) {
        setUserData(data as UserData);
      }

      // Optionally request full account details
      try {
        const accounts = await request('stx_getAccounts');
        console.log('Account details:', accounts);
      } catch (err) {
        console.log('Could not fetch full account details:', err);
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setIsAuthenticated(false);
    setUserData(null);
    console.log('User disconnected');
  };

  const stxAddress = userData?.addresses?.stx?.[0]?.address || null;
  const btcAddress = userData?.addresses?.btc?.[0]?.address || null;

  return (
    <WalletContext.Provider
      value={{
        isAuthenticated,
        userData,
        stxAddress,
        btcAddress,
        connectWallet,
        disconnectWallet,
        isConnecting,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
