// Contract ABIs (simplified for frontend use)
export const PROTECTED_OPTION_MANAGER_ABI = [
  "function createProtectedOption(bool isCall, uint256 strikePrice, uint256 premium, uint256 optionDuration, address makerAsset, address takerAsset, uint256 makingAmount, uint256 minTakingAmount, uint256 stopLossPrice, uint256 maxLoss, address oracle) external returns (bytes32)",
  "function executeProtectedOption(bytes32 protectedOptionId, uint256 takingAmount) external",
  "function cancelProtectedOption(bytes32 protectedOptionId) external", 
  "function getProtectedOption(bytes32 protectedOptionId) external view returns (tuple(bytes32 optionId, bytes32 stopLossId, bool isCall, address maker, bool isActive, uint256 createdAt, uint256 expiresAt))",
  "function canExecuteOption(bytes32 protectedOptionId) external view returns (bool canExecute, string memory reason)",
  "event ProtectedOptionCreated(bytes32 indexed protectedOptionId, address indexed maker, bool isCall, uint256 strikePrice)",
  "event ProtectedOptionExecuted(bytes32 indexed protectedOptionId, address indexed executor, uint256 payoff)",
  "event ProtectedOptionCancelled(bytes32 indexed protectedOptionId, string reason)"
];

export const OPTIONS_CALCULATOR_ABI = [
  "function isInTheMoney(bytes32 optionId) external view returns (bool)",
  "function getIntrinsicValue(bytes32 optionId) external view returns (uint256 intrinsicValue, uint256 currentPrice)",
  "function getMakingAmount(bytes32 optionId, uint256 takingAmount) external view returns (uint256)",
  "function getTakingAmount(bytes32 optionId, uint256 makingAmount) external view returns (uint256)"
];

export const STOP_LOSS_PROTECTION_ABI = [
  "function stopLossPredicate(bytes32 stopLossId) external view returns (bool isValid)",
  "function checkStopLoss(bytes32 stopLossId) external view returns (bool isTriggered, uint256 currentPrice, uint256 threshold)"
];

export const MOCK_ERC20_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 value) external returns (bool)",
  "function transfer(address to, uint256 value) external returns (bool)",
  "function transferFrom(address from, address to, uint256 value) external returns (bool)",
  "function mint(address to, uint256 amount) external"
];

export const MOCK_ORACLE_ABI = [
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function setLatestPrice(int256 price) external",
  "function decimals() external view returns (uint8)"
];

// Contract addresses (will be updated after deployment)
export const CONTRACT_ADDRESSES = {
  // Base Sepolia testnet
  84532: {
    PROTECTED_OPTION_MANAGER: "0x0000000000000000000000000000000000000000", // Update after deployment
    OPTIONS_CALCULATOR: "0x0000000000000000000000000000000000000000",
    STOP_LOSS_PROTECTION: "0x0000000000000000000000000000000000000000", 
    INTEGRATION: "0x0000000000000000000000000000000000000000",
    MOCK_WETH: "0x0000000000000000000000000000000000000000",
    MOCK_USDC: "0x0000000000000000000000000000000000000000",
    MOCK_ORACLE: "0x0000000000000000000000000000000000000000",
  },
  // Polygon mainnet - REAL infrastructure - DEPLOYED! ✅
  137: {
    PROTECTED_OPTION_MANAGER: "0x3dD6101E01Ae44FFC642b65E0F9F92218EB5487a", // ✅ DEPLOYED  
    OPTIONS_CALCULATOR: "0xF4bB79d53E5ce1D955e62aB0da851E1621B92884",     // ✅ DEPLOYED
    STOP_LOSS_PROTECTION: "0x609DEb414D76D67ca6CC44E911254ba83FBa3009",  // ✅ DEPLOYED
    INTEGRATION: "0x53597B830E8711a42Ebb965b6A4c236A7fdb5Dcb",          // ✅ DEPLOYED
    // Real Polygon token addresses - WETH/USDC focused
    WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",              // Wrapped MATIC
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",                // Wrapped Ethereum  
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",                // USD Coin (bridged)
    USDC_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",         // Native USDC
    // Real Chainlink oracle addresses  
    MATIC_USD_ORACLE: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0",     // MATIC/USD Price Feed
    ETH_USD_ORACLE: "0xF9680D99D6C9589e2a93a78A04A279e509205945",       // ETH/USD Price Feed
    USDC_USD_ORACLE: "0xfE4A8FD3EE02d90A6aCa4c623d1BF2425C2e9bB7",      // USDC/USD Price Feed
  },
  // Ethereum Sepolia testnet (for testing only - limited real infrastructure)
  11155111: {
    PROTECTED_OPTION_MANAGER: "0x0000000000000000000000000000000000000000",
    OPTIONS_CALCULATOR: "0x0000000000000000000000000000000000000000",
    STOP_LOSS_PROTECTION: "0x0000000000000000000000000000000000000000",
    INTEGRATION: "0x0000000000000000000000000000000000000000", 
    // Sepolia has limited real tokens - using testnet versions
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",                 // WETH on Sepolia
    // Note: Limited oracle and token availability on testnets
  },
  // Local hardhat network
  31337: {
    PROTECTED_OPTION_MANAGER: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    OPTIONS_CALCULATOR: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    STOP_LOSS_PROTECTION: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    INTEGRATION: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    MOCK_WETH: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    MOCK_USDC: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    MOCK_ORACLE: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
  }
};

export const getContractAddress = (chainId, contractName) => {
  return CONTRACT_ADDRESSES[chainId]?.[contractName] || "0x0000000000000000000000000000000000000000";
};

export const CHAIN_NAMES = {
  84532: "Base Sepolia",
  11155111: "Ethereum Sepolia", 
  31337: "Hardhat Local",
  8453: "Base Mainnet",
  1: "Ethereum Mainnet"
};

export const SUPPORTED_CHAINS = [84532, 11155111, 31337]; // Base Sepolia, Ethereum Sepolia, Local 