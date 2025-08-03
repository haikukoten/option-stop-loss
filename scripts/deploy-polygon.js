const { ethers } = require("hardhat");

/**
 * @title Polygon Mainnet Deployment Script
 * @dev Deploys contracts to Polygon mainnet using real infrastructure
 */

// Real Polygon mainnet addresses - WETH/USDC focused
const POLYGON_ADDRESSES = {
  // Real token addresses on Polygon
  WMATIC: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // Wrapped MATIC
  WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",   // Wrapped Ethereum  
  USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",   // USD Coin (bridged)
  USDC_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Native USDC
  
  // Real Chainlink oracle addresses on Polygon
  ORACLES: {
    MATIC_USD: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", // MATIC/USD
    ETH_USD: "0xF9680D99D6C9589e2a93a78A04A279e509205945",   // ETH/USD  
    USDC_USD: "0xfE4A8FD3EE02d90A6aCa4c623d1BF2425C2e9bB7",  // USDC/USD
  }
};

async function main() {
  console.log("🚀 Deploying to Polygon Mainnet with REAL infrastructure...");
  console.log("=====================================");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "MATIC");

  // Deploy OptionsCalculator (oracle addresses set per option via setOptionConfig)
  console.log("\n📊 Deploying OptionsCalculator...");
  const OptionsCalculator = await ethers.getContractFactory("OptionsCalculator");
  const optionsCalculator = await OptionsCalculator.deploy();
  await optionsCalculator.waitForDeployment();
  console.log("✅ OptionsCalculator deployed to:", await optionsCalculator.getAddress());
  
  // Deploy StopLossProtection (oracle addresses set per stop-loss via configureStopLoss)
  console.log("\n🛡️ Deploying StopLossProtection...");
  const StopLossProtection = await ethers.getContractFactory("StopLossProtection");
  const stopLossProtection = await StopLossProtection.deploy();
  await stopLossProtection.waitForDeployment();
  console.log("✅ StopLossProtection deployed to:", await stopLossProtection.getAddress());
  
  // Deploy ProtectedOptionManager
  console.log("\n🎯 Deploying ProtectedOptionManager...");
  const ProtectedOptionManager = await ethers.getContractFactory("ProtectedOptionManager");
  const protectedOptionManager = await ProtectedOptionManager.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress()
  );
  await protectedOptionManager.waitForDeployment();
  console.log("✅ ProtectedOptionManager deployed to:", await protectedOptionManager.getAddress());
  
  // Deploy OneinchProtectedOptionsIntegration
  console.log("\n🔗 Deploying OneinchProtectedOptionsIntegration...");
  const OneinchProtectedOptionsIntegration = await ethers.getContractFactory("OneinchProtectedOptionsIntegration");
  const integration = await OneinchProtectedOptionsIntegration.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress(),
    await protectedOptionManager.getAddress()
  );
  await integration.waitForDeployment();
  console.log("✅ OneinchProtectedOptionsIntegration deployed to:", await integration.getAddress());
  
  // Setup permissions for contracts to interact with each other
  console.log("\n⚙️ Setting up contract permissions...");
  
  // Authorize ProtectedOptionManager to interact with OptionsCalculator
  await optionsCalculator.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  console.log("✅ ProtectedOptionManager authorized on OptionsCalculator");
  
  // Authorize ProtectedOptionManager to interact with StopLossProtection
  await stopLossProtection.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  console.log("✅ ProtectedOptionManager authorized on StopLossProtection");

  // Authorize Integration contract to interact with core contracts
  await optionsCalculator.setAuthorizedCaller(await integration.getAddress(), true);
  await stopLossProtection.setAuthorizedCaller(await integration.getAddress(), true);
  console.log("✅ Integration contract authorized on core contracts");

  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("=====================================");
  console.log("📋 Contract Addresses:");
  console.log("OptionsCalculator:", await optionsCalculator.getAddress());
  console.log("StopLossProtection:", await stopLossProtection.getAddress());
  console.log("ProtectedOptionManager:", await protectedOptionManager.getAddress());
  console.log("OneinchProtectedOptionsIntegration:", await integration.getAddress());
  
  console.log("\n🌐 Real Polygon Infrastructure Used:");
  console.log("WMATIC:", POLYGON_ADDRESSES.WMATIC);
  console.log("WETH:", POLYGON_ADDRESSES.WETH);
  console.log("USDC:", POLYGON_ADDRESSES.USDC);
  console.log("USDC Native:", POLYGON_ADDRESSES.USDC_NATIVE);
  console.log("MATIC/USD Oracle:", POLYGON_ADDRESSES.ORACLES.MATIC_USD);
  console.log("ETH/USD Oracle:", POLYGON_ADDRESSES.ORACLES.ETH_USD);
  console.log("USDC/USD Oracle:", POLYGON_ADDRESSES.ORACLES.USDC_USD);
  
  console.log("\n📝 Frontend Configuration:");
  console.log("Update frontend/src/contracts/index.js with these addresses for chain ID 137");
  
  console.log("\n🚀 Next Steps:");
  console.log("1. Verify contracts on Polygonscan");
  console.log("2. Update frontend configuration with deployed addresses");
  console.log("3. Test with real MATIC, USDC, and other Polygon tokens");
  console.log("4. Integrate with 1inch Limit Order Protocol on Polygon");

  return {
    optionsCalculator: await optionsCalculator.getAddress(),
    stopLossProtection: await stopLossProtection.getAddress(),
    protectedOptionManager: await protectedOptionManager.getAddress(),
    integration: await integration.getAddress(),
    realAddresses: POLYGON_ADDRESSES
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;