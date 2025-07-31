# 🚀 Deployment Guide - Protected Options

This guide covers deploying the Protected Options system to testnets and setting up the UI.

## 📋 Prerequisites

1. **Node.js** (v18+) and **npm**
2. **Hardhat** for smart contract deployment
3. **React** for frontend
4. **Wallet** with testnet ETH
5. **RPC endpoints** for target networks

## 🔧 Environment Setup

Create a `.env` file in the root directory:

```bash
# Network RPC URLs
MAINNET_RPC_URL=https://eth.llamarpc.com
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
POLYGON_RPC_URL=https://polygon-rpc.com

# Private key for deployment (DO NOT commit this!)
PRIVATE_KEY=your_private_key_here

# Etherscan API keys for contract verification
ETHERSCAN_API_KEY=your_etherscan_api_key
ARBISCAN_API_KEY=your_arbiscan_api_key
POLYGONSCAN_API_KEY=your_polygonscan_api_key
BASESCAN_API_KEY=your_basescan_api_key

# Frontend configuration
REACT_APP_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
```

## 🏗️ Smart Contract Deployment

### 1. Local Development

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Start local Hardhat network
npx hardhat node

# Deploy to local network (in another terminal)
npm run deploy:localhost

# Run demo
npm run demo
```

### 2. Base Sepolia Testnet (Recommended - Very Cheap!)

```bash
# Get testnet ETH from Base Sepolia faucet
# https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

# Deploy to Base Sepolia
npm run deploy:testnet

# Example output:
# ✅ ProtectedOptionManager deployed to: 0x1234...
# ✅ OptionsCalculator deployed to: 0x5678...
# etc.
```

### 3. Ethereum Sepolia Testnet

```bash
# Get testnet ETH from Sepolia faucet
# https://sepoliafaucet.com/

# Deploy to Ethereum Sepolia
npm run deploy:sepolia
```

### 4. Contract Verification

```bash
# Verify contracts on block explorer
npx hardhat verify --network baseSepolia DEPLOYED_ADDRESS

# Example:
npx hardhat verify --network baseSepolia 0x1234... 
```

## 🎨 Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Update Contract Addresses

After deployment, update `frontend/src/contracts/index.js` with your deployed addresses:

```javascript
export const CONTRACT_ADDRESSES = {
  // Base Sepolia testnet
  84532: {
    PROTECTED_OPTION_MANAGER: "0x1234...", // Your deployed address
    OPTIONS_CALCULATOR: "0x5678...",       // Your deployed address
    STOP_LOSS_PROTECTION: "0x9abc...",     // Your deployed address
    INTEGRATION: "0xdef0...",              // Your deployed address
    MOCK_WETH: "0x1111...",                // Your deployed address
    MOCK_DAI: "0x2222...",                 // Your deployed address
    MOCK_ORACLE: "0x3333...",              // Your deployed address
  },
  // Add other networks as needed
};
```

### 3. Start Frontend

```bash
cd frontend
npm start

# Opens http://localhost:3000
```

## 🌐 Network Information

### Base Sepolia (Recommended)
- **Chain ID**: 84532
- **RPC**: https://sepolia.base.org
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Explorer**: https://sepolia.basescan.org
- **Gas**: Very cheap (~0.001 gwei)

### Ethereum Sepolia
- **Chain ID**: 11155111
- **RPC**: Various (Infura, Alchemy, etc.)
- **Faucet**: https://sepoliafaucet.com/
- **Explorer**: https://sepolia.etherscan.io
- **Gas**: Moderate

## 📱 Using the UI

### 1. Connect Wallet
- Click "Connect Wallet" in the top right
- Select your preferred wallet (MetaMask, WalletConnect, etc.)
- Ensure you're on the correct network (Base Sepolia recommended)

### 2. Get Test Tokens
```bash
# If you deployed the contracts, you already have test tokens
# Otherwise, contact the deployer or use the mint function

# From contract interaction:
# mockWETH.mint(YOUR_ADDRESS, amount)
# mockDAI.mint(YOUR_ADDRESS, amount)
```

### 3. Create Protected Option
- Navigate to "Create Option"
- Choose Call or Put
- Set strike price, collateral amount, premium
- Configure stop-loss protection
- Submit transaction

### 4. Monitor Options
- View all your options on the Dashboard
- Check real-time status (in-the-money, stop-loss status)
- Execute profitable options
- Cancel if stop-loss triggers

## 🔧 Advanced Configuration

### Custom Oracle Prices
```bash
# Set custom price for testing
npx hardhat console --network baseSepolia

# In console:
const oracle = await ethers.getContractAt("MockChainlinkOracle", "ORACLE_ADDRESS");
await oracle.setLatestPrice(ethers.parseUnits("2500", 8)); // Set $2500
```

### Mint Additional Tokens
```bash
# Mint more test tokens
const weth = await ethers.getContractAt("MockERC20", "WETH_ADDRESS");
await weth.mint("USER_ADDRESS", ethers.parseUnits("100", 18));
```

## 🚨 Security Notes

- **Never commit private keys** to version control
- **Use separate wallets** for testing and mainnet
- **Verify contract addresses** before interacting
- **Test thoroughly** on testnets before mainnet deployment

## 🎯 Quick Start Checklist

- [ ] Clone repository and install dependencies
- [ ] Set up `.env` file with RPC URLs and private key
- [ ] Get testnet ETH from faucet
- [ ] Deploy contracts: `npm run deploy:testnet`
- [ ] Update frontend contract addresses
- [ ] Install frontend dependencies: `cd frontend && npm install`
- [ ] Start frontend: `npm start`
- [ ] Connect wallet and create your first protected option!

## 📞 Support

- **Issues**: Create GitHub issue
- **Discord**: [Your Discord]
- **Documentation**: See README.md for detailed technical docs

## 🎉 Demo Flow

1. **Connect wallet** to Base Sepolia
2. **Create a call option** with strike $2100, current price $2000
3. **Set stop-loss** at $1950 to protect downside
4. **Use oracle** to simulate price movement to $2200
5. **Execute option** for profit (instrinsic value = $100)
6. **Test stop-loss** by setting price to $1900
7. **Verify protection** - option automatically cancelled

## 💡 Tips

- Use **Base Sepolia** for cheapest gas costs
- **Test stop-loss protection** by manipulating oracle prices
- **Check transaction hashes** on block explorer
- **Monitor events** for debugging
- **Start with small amounts** for testing 