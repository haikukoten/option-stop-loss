import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiConfig, createConfig } from 'wagmi';
import { getDefaultWallets, RainbowKitProvider, lightTheme, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet, metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { mainnet, goerli, sepolia, base, baseSepolia, polygon } from 'wagmi/chains';
import { configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CreateOption from './components/CreateOption';
import OptionDetails from './components/OptionDetails';
import './index.css';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// Configure chains with multiple RPC providers for reliability
const { chains, publicClient } = configureChains(
  [
    polygon,     // Polygon mainnet - cheapest with 1inch support
    baseSepolia, // Base testnet - very cheap
    sepolia,     // Ethereum testnet
    base,        // Base mainnet
    ...(process.env.NODE_ENV === 'development' ? [mainnet, goerli] : []),
  ],
  [
    // Multiple Polygon RPC providers for reliability
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === 137) { // Polygon mainnet
          return {
            http: 'https://polygon-rpc.com',
            webSocket: 'wss://polygon-rpc.com/ws',
          }
        }
        return null
      },
    }),
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === 137) { // Polygon mainnet - backup
          return {
            http: 'https://rpc-mainnet.maticvigil.com',
          }
        }
        return null
      },
    }),
    publicProvider(), // Fallback to default public provider
  ]
);

// Configure wallets without WalletConnect to avoid connection issues
const projectId = process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID;

let connectors;
if (projectId && projectId !== 'demo') {
  // Use full wallet support if WalletConnect is properly configured
  console.log('🔗 Using WalletConnect with project ID:', projectId);
  const walletConfig = getDefaultWallets({
    appName: '1inch Protected Options',
    projectId,
    chains,
  });
  connectors = walletConfig.connectors;
} else {
  // Fallback to injected wallets only (MetaMask, browser wallets) 
  console.log('🦊 Using browser wallets only (no WalletConnect)');
  connectors = connectorsForWallets([
    {
      groupName: 'Browser Wallets',
      wallets: [
        injectedWallet({ chains }),
        metaMaskWallet({ projectId: 'demo-fallback', chains }),
      ],
    },
  ]);
}

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

function App() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains} theme={lightTheme()}>
          <Router>
            <div className="min-h-screen bg-gray-50">
              <Header />
              
              <main className="container mx-auto px-4 py-8">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/create" element={<CreateOption />} />
                  <Route path="/option/:id" element={<OptionDetails />} />
                </Routes>
              </main>
              
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </div>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiConfig>
  );
}

export default App; 