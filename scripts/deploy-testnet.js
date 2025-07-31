const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Protected Options to testnet...");
  console.log("Network:", network.name);
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // Deploy contracts
  console.log("\n📦 Deploying core contracts...");

  // 1. Deploy OptionsCalculator
  const OptionsCalculator = await ethers.getContractFactory("OptionsCalculator");
  const optionsCalculator = await OptionsCalculator.deploy();
  await optionsCalculator.waitForDeployment();
  console.log("✅ OptionsCalculator deployed to:", await optionsCalculator.getAddress());

  // 2. Deploy StopLossProtection
  const StopLossProtection = await ethers.getContractFactory("StopLossProtection");
  const stopLossProtection = await StopLossProtection.deploy();
  await stopLossProtection.waitForDeployment();
  console.log("✅ StopLossProtection deployed to:", await stopLossProtection.getAddress());

  // 3. Deploy ProtectedOptionManager
  const ProtectedOptionManager = await ethers.getContractFactory("ProtectedOptionManager");
  const protectedOptionManager = await ProtectedOptionManager.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress()
  );
  await protectedOptionManager.waitForDeployment();
  console.log("✅ ProtectedOptionManager deployed to:", await protectedOptionManager.getAddress());

  // 4. Deploy 1inch Integration
  const OneinchProtectedOptionsIntegration = await ethers.getContractFactory("OneinchProtectedOptionsIntegration");
  const integration = await OneinchProtectedOptionsIntegration.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress(),
    await protectedOptionManager.getAddress()
  );
  await integration.waitForDeployment();
  console.log("✅ OneinchProtectedOptionsIntegration deployed to:", await integration.getAddress());

  // Deploy mock tokens and oracle for testing
  console.log("\n🧪 Deploying test infrastructure...");

  // Deploy mock WETH
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockWETH = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  await mockWETH.waitForDeployment();
  console.log("✅ Mock WETH deployed to:", await mockWETH.getAddress());

  // Deploy mock DAI
  const mockDAI = await MockERC20.deploy("DAI Stablecoin", "DAI", 18);
  await mockDAI.waitForDeployment();
  console.log("✅ Mock DAI deployed to:", await mockDAI.getAddress());

  // Deploy mock Chainlink oracle
  const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
  const mockOracle = await MockChainlinkOracle.deploy(
    ethers.parseUnits("2000", 8), // $2000 initial price
    8 // decimals
  );
  await mockOracle.waitForDeployment();
  console.log("✅ Mock Oracle deployed to:", await mockOracle.getAddress());

  // Set up authorizations
  console.log("\n🔐 Setting up authorizations...");
  
  await optionsCalculator.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  console.log("✅ ProtectedOptionManager authorized on OptionsCalculator");
  
  await optionsCalculator.setAuthorizedCaller(await integration.getAddress(), true);
  console.log("✅ Integration authorized on OptionsCalculator");
  
  await stopLossProtection.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  console.log("✅ ProtectedOptionManager authorized on StopLossProtection");
  
  await stopLossProtection.setAuthorizedCaller(await integration.getAddress(), true);
  console.log("✅ Integration authorized on StopLossProtection");

  // Mint test tokens to deployer
  console.log("\n💰 Minting test tokens...");
  
  const mintAmount = ethers.parseUnits("1000", 18);
  await mockWETH.mint(deployer.address, mintAmount);
  await mockDAI.mint(deployer.address, mintAmount);
  console.log("✅ Minted 1000 WETH and 1000 DAI to deployer");

  // Summary
  console.log("\n📋 Deployment Summary");
  console.log("=" .repeat(50));
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId || "Unknown");
  console.log("");
  console.log("Core Contracts:");
  console.log("- OptionsCalculator:", await optionsCalculator.getAddress());
  console.log("- StopLossProtection:", await stopLossProtection.getAddress());
  console.log("- ProtectedOptionManager:", await protectedOptionManager.getAddress());
  console.log("- Integration:", await integration.getAddress());
  console.log("");
  console.log("Test Infrastructure:");
  console.log("- Mock WETH:", await mockWETH.getAddress());
  console.log("- Mock DAI:", await mockDAI.getAddress());
  console.log("- Mock Oracle:", await mockOracle.getAddress());
  
  console.log("");
  console.log("🎉 Deployment completed successfully!");
  console.log("");
  console.log("📝 Update frontend/src/contracts/index.js with these addresses:");
  console.log(`
  // ${network.name} (Chain ID: ${network.config.chainId})
  ${network.config.chainId}: {
    PROTECTED_OPTION_MANAGER: "${await protectedOptionManager.getAddress()}",
    OPTIONS_CALCULATOR: "${await optionsCalculator.getAddress()}",
    STOP_LOSS_PROTECTION: "${await stopLossProtection.getAddress()}",
    INTEGRATION: "${await integration.getAddress()}",
    MOCK_WETH: "${await mockWETH.getAddress()}",
    MOCK_DAI: "${await mockDAI.getAddress()}",
    MOCK_ORACLE: "${await mockOracle.getAddress()}",
  },`);

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ProtectedOptionManager: await protectedOptionManager.getAddress(),
      OptionsCalculator: await optionsCalculator.getAddress(),
      StopLossProtection: await stopLossProtection.getAddress(),
      Integration: await integration.getAddress(),
      MockWETH: await mockWETH.getAddress(),
      MockDAI: await mockDAI.getAddress(),
      MockOracle: await mockOracle.getAddress(),
    }
  };

  const fs = require('fs');
  fs.writeFileSync(
    `deployments/${network.name}-${Date.now()}.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Deployment info saved to deployments/ directory");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 