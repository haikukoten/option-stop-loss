const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Known oracle addresses for different networks
const ORACLES = {
  mainnet: {
    ETH_USD: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    BTC_USD: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    LINK_USD: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c"
  },
  arbitrum: {
    ETH_USD: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    BTC_USD: "0x6ce185860a4963106506C203335A2910413708e9",
    LINK_USD: "0x86E53CF1B870786351Da77A57575e79CB55812CB"
  },
  polygon: {
    ETH_USD: "0xF9680D99D6C9589e2a93a78A04A279e509205945",
    BTC_USD: "0xc907E116054Ad103354f2D350FD2514433D57F6f",
    MATIC_USD: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0"
  },
  base: {
    ETH_USD: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    BTC_USD: "0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F"
  }
};

async function main() {
  console.log(`Deploying to network: ${network.name}`);
  console.log(`Block number: ${await ethers.provider.getBlockNumber()}`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Account balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const deploymentData = {
    network: network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {}
  };

  // Step 1: Deploy OptionsCalculator
  console.log("\n1. Deploying OptionsCalculator...");
  const OptionsCalculator = await ethers.getContractFactory("OptionsCalculator");
  const optionsCalculator = await OptionsCalculator.deploy();
  await optionsCalculator.waitForDeployment();
  
  const optionsCalculatorAddress = await optionsCalculator.getAddress();
  console.log(`OptionsCalculator deployed to: ${optionsCalculatorAddress}`);
  deploymentData.contracts.OptionsCalculator = optionsCalculatorAddress;

  // Step 2: Deploy StopLossProtection
  console.log("\n2. Deploying StopLossProtection...");
  const StopLossProtection = await ethers.getContractFactory("StopLossProtection");
  const stopLossProtection = await StopLossProtection.deploy();
  await stopLossProtection.waitForDeployment();
  
  const stopLossProtectionAddress = await stopLossProtection.getAddress();
  console.log(`StopLossProtection deployed to: ${stopLossProtectionAddress}`);
  deploymentData.contracts.StopLossProtection = stopLossProtectionAddress;

  // Step 3: Deploy ProtectedOptionManager
  console.log("\n3. Deploying ProtectedOptionManager...");
  const ProtectedOptionManager = await ethers.getContractFactory("ProtectedOptionManager");
  const protectedOptionManager = await ProtectedOptionManager.deploy(
    optionsCalculatorAddress,
    stopLossProtectionAddress
  );
  await protectedOptionManager.waitForDeployment();
  
  const protectedOptionManagerAddress = await protectedOptionManager.getAddress();
  console.log(`ProtectedOptionManager deployed to: ${protectedOptionManagerAddress}`);
  deploymentData.contracts.ProtectedOptionManager = protectedOptionManagerAddress;

  // Step 4: Deploy OneinchProtectedOptionsIntegration
  console.log("\n4. Deploying OneinchProtectedOptionsIntegration...");
  const OneinchProtectedOptionsIntegration = await ethers.getContractFactory("OneinchProtectedOptionsIntegration");
  const integration = await OneinchProtectedOptionsIntegration.deploy(
    optionsCalculatorAddress,
    stopLossProtectionAddress,
    protectedOptionManagerAddress
  );
  await integration.waitForDeployment();
  
  const integrationAddress = await integration.getAddress();
  console.log(`OneinchProtectedOptionsIntegration deployed to: ${integrationAddress}`);
  deploymentData.contracts.OneinchProtectedOptionsIntegration = integrationAddress;

  // Step 5: Set up authorizations
  console.log("\n5. Setting up authorizations...");
  
  console.log("Authorizing ProtectedOptionManager in OptionsCalculator...");
  await optionsCalculator.setAuthorizedCaller(protectedOptionManagerAddress, true);
  
  console.log("Authorizing Integration in OptionsCalculator...");
  await optionsCalculator.setAuthorizedCaller(integrationAddress, true);
  
  console.log("Authorizing ProtectedOptionManager in StopLossProtection...");
  await stopLossProtection.setAuthorizedCaller(protectedOptionManagerAddress, true);
  
  console.log("Authorizing Integration in StopLossProtection...");
  await stopLossProtection.setAuthorizedCaller(integrationAddress, true);

  // Step 6: Deploy example/demo contracts (if not mainnet)
  if (network.name !== "mainnet") {
    console.log("\n6. Deploying example tokens for testing...");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
    await tokenA.waitForDeployment();
    const tokenAAddress = await tokenA.getAddress();
    console.log(`Token A deployed to: ${tokenAAddress}`);
    deploymentData.contracts.TokenA = tokenAAddress;
    
    const tokenB = await MockERC20.deploy("Token B", "TKB", 18);
    await tokenB.waitForDeployment();
    const tokenBAddress = await tokenB.getAddress();
    console.log(`Token B deployed to: ${tokenBAddress}`);
    deploymentData.contracts.TokenB = tokenBAddress;

    // Deploy mock oracle
    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    const mockOracle = await MockChainlinkOracle.deploy(
      ethers.parseUnits("2000", 8), // $2000 initial price
      8 // decimals
    );
    await mockOracle.waitForDeployment();
    const mockOracleAddress = await mockOracle.getAddress();
    console.log(`Mock Oracle deployed to: ${mockOracleAddress}`);
    deploymentData.contracts.MockOracle = mockOracleAddress;

    // Mint some tokens to deployer for testing
    console.log("Minting test tokens...");
    await tokenA.mint(deployer.address, ethers.parseUnits("10000", 18));
    await tokenB.mint(deployer.address, ethers.parseUnits("10000", 18));
  }

  // Step 7: Save deployment information
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));

  console.log("\n" + "=".repeat(50));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log(`Network: ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`\nCore Contracts:`);
  console.log(`OptionsCalculator: ${optionsCalculatorAddress}`);
  console.log(`StopLossProtection: ${stopLossProtectionAddress}`);
  console.log(`ProtectedOptionManager: ${protectedOptionManagerAddress}`);
  console.log(`OneinchProtectedOptionsIntegration: ${integrationAddress}`);

  if (deploymentData.contracts.TokenA) {
    console.log(`\nTest Contracts:`);
    console.log(`Token A: ${deploymentData.contracts.TokenA}`);
    console.log(`Token B: ${deploymentData.contracts.TokenB}`);
    console.log(`Mock Oracle: ${deploymentData.contracts.MockOracle}`);
  }

  console.log(`\nKnown Oracles for ${network.name}:`);
  if (ORACLES[network.name]) {
    Object.entries(ORACLES[network.name]).forEach(([pair, address]) => {
      console.log(`${pair}: ${address}`);
    });
  } else {
    console.log("No known oracles for this network");
  }

  console.log(`\nDeployment data saved to: ${deploymentFile}`);
  console.log("=".repeat(50));

  // Verify contracts on Etherscan (if API key is provided)
  if (process.env.ETHERSCAN_API_KEY && network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: optionsCalculatorAddress,
        constructorArguments: []
      });

      await hre.run("verify:verify", {
        address: stopLossProtectionAddress,
        constructorArguments: []
      });

      await hre.run("verify:verify", {
        address: protectedOptionManagerAddress,
        constructorArguments: [optionsCalculatorAddress, stopLossProtectionAddress]
      });

      await hre.run("verify:verify", {
        address: integrationAddress,
        constructorArguments: [optionsCalculatorAddress, stopLossProtectionAddress, protectedOptionManagerAddress]
      });

      console.log("Contract verification completed!");
    } catch (error) {
      console.log("Contract verification failed:", error.message);
    }
  }

  return deploymentData;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 