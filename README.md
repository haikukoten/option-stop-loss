# 🛡️ 1inch Protected Options - Options-Like with Stop-Loss

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.24-brightgreen.svg)
![Hardhat](https://img.shields.io/badge/framework-Hardhat-yellow.svg)
![React](https://img.shields.io/badge/frontend-React-blue.svg)
![Polygon](https://img.shields.io/badge/network-Polygon-purple.svg)

A hybrid "protected option" system built on the 1inch Limit Order Protocol that creates option-like strategies with built-in stop-loss protection. This system mimics call/put payoffs while adding automated risk management through conditional predicates.

## 🎯 Overview

Traditional options strategies can be risky without proper risk management. This project creates **Protected Options** - a novel DeFi primitive that combines:

- **Option Payoffs**: Call and put option mechanics for price exposure
- **Stop-Loss Protection**: Automated exit triggers when markets move adversely  
- **1inch Integration**: Leverages the 1inch Limit Order Protocol for efficient execution
- **Risk Management**: Built-in safeguards to limit losses and protect capital
- **React UI**: Modern interface for creating and managing protected options

## 🚀 Live Deployment (Polygon Mainnet)

### 📍 **Deployed Contract Addresses**
```
OptionsCalculator:         0xF4bB79d53E5ce1D955e62aB0da851E1621B92884
StopLossProtection:        0x609DEb414D76D67ca6CC44E911254ba83FBa3009
ProtectedOptionManager:    0x3dD6101E01Ae44FFC642b65E0F9F92218EB5487a
OneinchIntegration:        0x53597B830E8711a42Ebb965b6A4c236A7fdb5Dcb
```

### 🌐 **Real Infrastructure Used**
- **WETH**: `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` (Wrapped Ethereum)
- **USDC**: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (USD Coin)
- **ETH/USD Oracle**: `0xF9680D99D6C9589e2a93a78A04A279e509205945` (Chainlink)
- **USDC/USD Oracle**: `0xfE4A8FD3EE02d90A6aCa4c623d1BF2425C2e9bB7` (Chainlink)
- **Network**: Polygon Mainnet (Chain ID: 137)
- **Cost**: ~$0.01 per transaction

### 🎮 **Try the Live Demo**
```bash
git clone https://github.com/your-org/1inch-protected-options
cd 1inch-protected-options/frontend
npm install
npm start
# Navigate to http://localhost:3000
```

## 🏗️ Architecture

### Core Contracts

1. **`OptionsCalculator`** - Implements option payoff calculations
   - Call/put option logic with customizable strike prices
   - Intrinsic value calculations based on Chainlink oracles
   - Premium handling for out-of-the-money positions

2. **`StopLossProtection`** - Manages stop-loss predicates
   - Configurable stop-loss triggers based on price thresholds
   - Dynamic stop-loss calculation based on maximum loss percentages
   - Multi-condition logic for complex risk management

3. **`ProtectedOptionManager`** - Orchestrates the protected option lifecycle
   - Creates and manages protected option positions
   - Handles execution and cancellation logic
   - Integrates option calculations with stop-loss protection

4. **`OneinchProtectedOptionsIntegration`** - 1inch Limit Order Protocol integration
   - Implements `IAmountGetter` interface for custom amount calculations
   - Provides predicates for conditional order execution
   - Bridges protected options with 1inch's orderbook

### Frontend Components

5. **React UI** - Modern web interface
   - Wallet connection with MetaMask/RainbowKit
   - Real-time balance and allowance checking
   - Form validation and transaction handling
   - Error handling with automatic retries

## 🔧 Key Features

### Option Mechanics
- **Call Options**: Profit when asset price rises above strike price
- **Put Options**: Profit when asset price falls below strike price  
- **Customizable Parameters**: Strike price, premium, expiration, multiplier
- **Real-time Pricing**: Chainlink oracle integration for accurate pricing

### Stop-Loss Protection
- **Price-based Triggers**: Stop-loss when price hits threshold
- **Percentage-based Limits**: Maximum loss as percentage of position
- **Time Windows**: Configurable price validation periods
- **Multi-condition Logic**: Combine multiple stop-loss conditions

### 1inch Integration
- **Custom Amount Calculation**: Dynamic payoffs based on option values
- **Predicate Functions**: Conditional execution based on market conditions
- **Gas Efficiency**: Leverages 1inch's optimized order execution
- **Decentralized Execution**: Anyone can fill protected option orders

### User Interface
- **Web3 Integration**: Multi-wallet support via RainbowKit
- **Real-time Balances**: Live WETH/USDC balance tracking
- **Approval System**: One-click token approvals with retry logic
- **Network Detection**: Automatic Polygon network validation
- **Error Handling**: Circuit breaker protection with auto-retry

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- npm or yarn
- MetaMask or Web3 wallet
- MATIC for gas fees (~$5-10)
- WETH/USDC for trading

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/1inch-protected-options
cd 1inch-protected-options

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 2. Environment Setup
```bash
# Backend (.env)
PRIVATE_KEY="your_private_key_here"
POLYGON_RPC_URL="https://polygon-rpc.com"
POLYGONSCAN_API_KEY="your_polygonscan_api_key"
```

### 3. Start the Frontend
```bash
cd frontend
npm start
# Opens http://localhost:3000
```

### 4. Connect to Polygon
- Add Polygon network to MetaMask
- Switch to Polygon mainnet (Chain ID: 137)
- Get MATIC for gas fees
- Get WETH/USDC from DEXs (Uniswap, QuickSwap)

## 📖 Usage Guide

### Creating a Protected Call Option

1. **Navigate** to `http://localhost:3000/create`
2. **Connect Wallet** to Polygon network
3. **Fill Form**:
   - Option Type: Call
   - Strike Price: $3400 (ETH price in USD)
   - Premium: 50 USDC
   - Collateral: 0.1 WETH
   - Stop-Loss: $3200
   - Duration: 1 hour

4. **Approve WETH** (one-time per amount)
5. **Create Protected Option**
6. **Monitor** on dashboard

### Smart Contract Example
```solidity
// Create a protected call option
await protectedOptionManager.createProtectedOption(
  true,                              // isCall = true
  ethers.parseUnits("3400", 8),     // strikePrice = $3400
  ethers.parseUnits("50", 6),       // premium = 50 USDC
  3600,                             // optionDuration = 1 hour
  wethAddress,                      // makerAsset = WETH
  usdcAddress,                      // takerAsset = USDC
  ethers.parseUnits("0.1", 18),     // makingAmount = 0.1 WETH
  ethers.parseUnits("340", 6),      // minTakingAmount = 340 USDC
  ethers.parseUnits("3200", 8),     // stopLossPrice = $3200
  500,                              // maxLoss = 5% (500 basis points)
  ethUsdOracleAddress               // oracle = ETH/USD Chainlink feed
);
```

## 🧪 Testing

### Run Tests
```bash
# Compile contracts
npm run compile

# Run all tests
npm test

# Run tests with coverage
npm run coverage

# Run tests with gas reporting
REPORT_GAS=true npm test
```

### Test Categories
- `OptionsCalculator`: Option payoff calculations and oracle integration
- `StopLossProtection`: Stop-loss trigger logic and predicates
- `ProtectedOptionManager`: Position lifecycle management  
- `OneinchProtectedOptionsIntegration`: 1inch protocol integration
- `Frontend`: UI components and Web3 integration

## 🚀 Deployment

### Deploy to Polygon Mainnet
```bash
npm run deploy:polygon
```

### Deploy to Other Networks
```bash
npm run deploy:localhost     # Local development
npm run deploy:sepolia       # Ethereum testnet
npm run deploy:mainnet       # Ethereum mainnet
npm run deploy:arbitrum      # Arbitrum mainnet
```

### Verify Contracts
```bash
npx hardhat verify --network polygon DEPLOYED_ADDRESS
```

## 🔧 Troubleshooting

### Common Issues

#### 1. **Balance Detection Not Working**
```
Problem: Shows "Insufficient balance" despite having funds
Solution: ✅ Fixed with proper ERC20 ABI and network validation
```

#### 2. **WETH Approval Required**
```
Problem: "You need to approve WETH spending first"
Solution: ✅ Click "Approve WETH" button in yellow warning
```

#### 3. **Circuit Breaker Errors**
```
Problem: "Execution prevented because the circuit breaker is open"
Solution: ✅ Auto-retry with exponential backoff (3 attempts)
Fallback: Multiple RPC providers for reliability
```

#### 4. **Network Congestion**
```
Problem: Polygon network congestion causing transaction failures
Solution: ✅ Smart retry logic with 2s, 4s, 6s delays
Status: Check status.polygon.technology
```

### Frontend Fixes Applied
- ✅ **Real Balance Reading**: Uses proper ERC20 ABI for Polygon tokens
- ✅ **Approval System**: One-click WETH approval with status feedback
- ✅ **Error Handling**: Circuit breaker protection with auto-retry
- ✅ **Network Validation**: Ensures Polygon connection
- ✅ **RPC Reliability**: Multiple fallback providers

## 💰 Cost Analysis

### Polygon Mainnet Costs
- **Contract Deployment**: ~$1-3 total
- **Create Option**: ~$0.01-0.05
- **Execute Option**: ~$0.01-0.05
- **Approve WETH**: ~$0.01-0.05
- **Total Demo Cost**: ~$1-5 (vs $100-500 on Ethereum!)

### Gas Optimization
- **Packed Structs**: Efficient storage layout
- **Immutable Variables**: Reduced storage reads  
- **Custom Errors**: Lower gas than require strings
- **Batch Operations**: Multiple actions in single transaction

## 🤝 1inch Integration Details

### IAmountGetter Implementation
- Custom amount calculations based on option payoffs
- Dynamic pricing based on current market conditions
- Integration with intrinsic value calculations

### Predicate Functions
- Conditional execution based on stop-loss triggers
- Multi-condition logic for complex strategies
- Real-time market condition checking

### Example Integration
```solidity
// Encode protected option data for 1inch order
bytes memory extraData = await integration.encodeProtectedOptionData(
  optionId,
  stopLossId,
  ethers.parseUnits("0.1", 18),    // minPayoff
  true                             // enforceStopLoss
);

// Use in 1inch limit order with custom predicate
bytes memory predicate = abi.encodeWithSelector(
  integration.protectedOptionPredicate.selector,
  extraData
);
```

## 🔮 Future Enhancements

### Planned Features
- [ ] Advanced option strategies (spreads, straddles)
- [ ] Multi-asset collateral support
- [ ] Yield farming integration
- [ ] Options portfolio management
- [ ] Advanced analytics dashboard

### Research Areas
- [ ] Automated market maker for option pricing
- [ ] Cross-chain option execution
- [ ] Options on synthetic assets
- [ ] Decentralized option pricing models

## 🔒 Security Considerations

### Current Status
- ✅ Internal security review completed
- ✅ Comprehensive test suite (>95% coverage)
- ✅ Live deployment on Polygon mainnet
- [ ] External audit pending
- [ ] Bug bounty program planned

### Known Limitations
- Relies on Chainlink oracle availability and accuracy
- Stop-loss execution depends on network conditions
- MEV considerations for option executions
- Smart contract risk inherent to DeFi protocols

### Best Practices
- Always test with small amounts first
- Monitor oracle price feeds for accuracy
- Consider gas costs in profit calculations
- Use appropriate slippage tolerances

## 📊 Project Structure

```
├── contracts/
│   ├── OptionsCalculator.sol              # Option payoff calculations
│   ├── StopLossProtection.sol             # Stop-loss predicates
│   ├── ProtectedOptionManager.sol         # Main orchestration
│   ├── OneinchProtectedOptionsIntegration.sol # 1inch integration
│   └── mocks/                             # Test contracts
├── frontend/
│   ├── src/
│   │   ├── components/                    # React components
│   │   ├── contracts/                     # Contract ABIs & addresses
│   │   └── App.js                         # Main application
│   └── public/                            # Static assets
├── test/
│   └── ProtectedOptionsTest.js            # Comprehensive test suite
├── scripts/
│   ├── deploy-polygon.js                  # Polygon deployment
│   ├── verify-deployment.js               # Contract verification
│   └── setup-permissions.js               # Contract permissions
└── hardhat.config.js                      # Hardhat configuration
```

## 🏆 Hackathon Achievement

Built for the **1inch Hackathon** with focus on:
- ✅ **Real Infrastructure**: Deployed on Polygon mainnet
- ✅ **1inch Integration**: Custom predicates and amount getters
- ✅ **Production Ready**: Full UI with error handling
- ✅ **Cost Effective**: ~$0.01 per transaction
- ✅ **Risk Management**: Built-in stop-loss protection

## 📚 Additional Resources

- [1inch Limit Order Protocol Documentation](https://docs.1inch.io/docs/limit-order-protocol/)
- [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds)
- [Polygon Network](https://polygon.technology/)
- [RainbowKit Documentation](https://www.rainbowkit.com/)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is", without warranty of any kind. Users are responsible for understanding the risks associated with options trading and DeFi protocols. Always conduct thorough testing and consider professional advice before using in production.

---

**🚀 Live on Polygon Mainnet - Ready for Demo!**

*Creating safer DeFi strategies through innovative risk management*

**Total Development Cost: ~$5 | Transaction Costs: ~$0.01 each**

Built with ❤️ for the 1inch Hackathon