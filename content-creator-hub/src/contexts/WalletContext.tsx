import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';

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
      return;
    }

    setIsConnecting(true);
    try {
      await connect();
      setIsAuthenticated(true);

      const data = getLocalStorage();
      if (data?.addresses) {
        setUserData(data as UserData);
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    disconnect();
    setIsAuthenticated(false);
    setUserData(null);
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
