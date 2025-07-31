import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WagmiConfig, createConfig } from 'wagmi';
import { getDefaultWallets, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { configureChains, mainnet, goerli, sepolia, base, baseSepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CreateOption from './components/CreateOption';
import OptionDetails from './components/OptionDetails';
import './index.css';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// Configure chains - including Base for cheap execution
const { chains, publicClient } = configureChains(
  [
    baseSepolia, // Base testnet - very cheap
    sepolia,     // Ethereum testnet
    base,        // Base mainnet
    ...(process.env.NODE_ENV === 'development' ? [mainnet, goerli] : []),
  ],
  [
    publicProvider(),
  ]
);

const { connectors } = getDefaultWallets({
  appName: '1inch Protected Options',
  projectId: process.env.REACT_APP_WALLET_CONNECT_PROJECT_ID || 'demo',
  chains,
});

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

function App() {
  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider chains={chains} theme="light">
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