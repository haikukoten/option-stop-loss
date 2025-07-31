const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 1inch Protected Options Demo");
  console.log("================================\n");

  // Get signers
  const [deployer, alice, bob] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Alice (Option Creator): ${alice.address}`);
  console.log(`Bob (Option Executor): ${bob.address}\n`);

  // Deploy contracts
  console.log("📦 Deploying contracts...\n");

  const OptionsCalculator = await ethers.getContractFactory("OptionsCalculator");
  const optionsCalculator = await OptionsCalculator.deploy();
  
  const StopLossProtection = await ethers.getContractFactory("StopLossProtection");
  const stopLossProtection = await StopLossProtection.deploy();
  
  const ProtectedOptionManager = await ethers.getContractFactory("ProtectedOptionManager");
  const protectedOptionManager = await ProtectedOptionManager.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress()
  );
  
  const OneinchProtectedOptionsIntegration = await ethers.getContractFactory("OneinchProtectedOptionsIntegration");
  const integration = await OneinchProtectedOptionsIntegration.deploy(
    await optionsCalculator.getAddress(),
    await stopLossProtection.getAddress(),
    await protectedOptionManager.getAddress()
  );

  // Deploy mock tokens and oracle
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const weth = await MockERC20.deploy("Wrapped Ether", "WETH", 18);
  const dai = await MockERC20.deploy("DAI Stablecoin", "DAI", 18);
  
  const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
  const ethUsdOracle = await MockChainlinkOracle.deploy(
    ethers.parseUnits("2000", 8), // $2000 initial price
    8
  );

  console.log(`✅ Contracts deployed:`);
  console.log(`   OptionsCalculator: ${await optionsCalculator.getAddress()}`);
  console.log(`   StopLossProtection: ${await stopLossProtection.getAddress()}`);
  console.log(`   ProtectedOptionManager: ${await protectedOptionManager.getAddress()}`);
  console.log(`   Integration: ${await integration.getAddress()}`);
  console.log(`   WETH: ${await weth.getAddress()}`);
  console.log(`   DAI: ${await dai.getAddress()}`);
  console.log(`   ETH/USD Oracle: ${await ethUsdOracle.getAddress()}\n`);

  // Set up authorizations
  console.log("🔐 Setting up authorizations...\n");
  await optionsCalculator.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  await optionsCalculator.setAuthorizedCaller(await integration.getAddress(), true);
  await stopLossProtection.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
  await stopLossProtection.setAuthorizedCaller(await integration.getAddress(), true);

  // Mint tokens
  console.log("💰 Minting tokens...\n");
  await weth.mint(alice.address, ethers.parseUnits("10", 18)); // Alice gets 10 WETH
  await dai.mint(bob.address, ethers.parseUnits("25000", 18)); // Bob gets 25,000 DAI
  
  console.log(`   Alice WETH balance: ${ethers.formatUnits(await weth.balanceOf(alice.address), 18)} WETH`);
  console.log(`   Bob DAI balance: ${ethers.formatUnits(await dai.balanceOf(bob.address), 18)} DAI\n`);

  // Alice approves tokens
  await weth.connect(alice).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("10", 18));
  await dai.connect(bob).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("25000", 18));

  // Scenario: Alice creates a protected call option
  console.log("📈 Scenario: Alice creates a protected ETH call option");
  console.log("=" .repeat(50));
  console.log("Current ETH price: $2,000");
  console.log("Alice creates a call option:");
  console.log("  - Strike Price: $2,100");
  console.log("  - Collateral: 1 WETH");
  console.log("  - Premium: 50 DAI");
  console.log("  - Stop-Loss: $1,950 (protects against downside)");
  console.log("  - Duration: 1 hour\n");

  const tx = await protectedOptionManager.connect(alice).createProtectedOption(
    true, // isCall
    ethers.parseUnits("2100", 8), // strikePrice ($2,100)
    ethers.parseUnits("50", 18), // premium (50 DAI)
    3600, // 1 hour duration
    await weth.getAddress(), // makerAsset (WETH)
    await dai.getAddress(), // takerAsset (DAI)
    ethers.parseUnits("1", 18), // makingAmount (1 WETH)
    ethers.parseUnits("2000", 18), // minTakingAmount (2000 DAI)
    ethers.parseUnits("1950", 8), // stopLossPrice ($1,950)
    500, // maxLoss (5% = 500 basis points)
    await ethUsdOracle.getAddress()
  );

  const receipt = await tx.wait();
  const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
  const protectedOptionId = event.args[0];
  
  console.log(`✅ Protected option created with ID: ${protectedOptionId}\n`);

  // Check option status
  const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
  console.log("📊 Option Details:");
  console.log(`   Option ID: ${option.optionId}`);
  console.log(`   Stop-Loss ID: ${option.stopLossId}`);
  console.log(`   Is Call: ${option.isCall}`);
  console.log(`   Maker: ${option.maker}`);
  console.log(`   Is Active: ${option.isActive}\n`);

  // Test 1: Price stays below strike - option out of the money
  console.log("🔍 Test 1: Price stays at $2,000 (below strike)");
  console.log("-".repeat(40));
  
  const [canExecute1, reason1] = await protectedOptionManager.canExecuteOption(protectedOptionId);
  console.log(`   Can execute: ${canExecute1}`);
  console.log(`   Reason: ${reason1}`);
  
  const isInMoney1 = await optionsCalculator.isInTheMoney(option.optionId);
  console.log(`   Is in the money: ${isInMoney1}`);
  
  const stopLossStatus1 = await stopLossProtection.stopLossPredicate(option.stopLossId);
  console.log(`   Stop-loss OK: ${stopLossStatus1}\n`);

  // Test 2: Price goes up - option in the money
  console.log("🔍 Test 2: Price rises to $2,200 (above strike)");
  console.log("-".repeat(40));
  
  await ethUsdOracle.setLatestPrice(ethers.parseUnits("2200", 8));
  
  const [canExecute2, reason2] = await protectedOptionManager.canExecuteOption(protectedOptionId);
  console.log(`   Can execute: ${canExecute2}`);
  console.log(`   Reason: ${reason2}`);
  
  const isInMoney2 = await optionsCalculator.isInTheMoney(option.optionId);
  console.log(`   Is in the money: ${isInMoney2}`);
  
  const stopLossStatus2 = await stopLossProtection.stopLossPredicate(option.stopLossId);
  console.log(`   Stop-loss OK: ${stopLossStatus2}`);
  
  if (canExecute2) {
    console.log("\n   💡 Option can be executed! Let's do it...");
    
    // Bob executes the option
    await protectedOptionManager.connect(bob).executeProtectedOption(
      protectedOptionId,
      ethers.parseUnits("2200", 18) // Bob pays 2200 DAI
    );
    
    console.log("   ✅ Option executed successfully!");
    
    // Check final balances
    const aliceWethFinal = await weth.balanceOf(alice.address);
    const aliceDaiFinal = await dai.balanceOf(alice.address);
    const bobWethFinal = await weth.balanceOf(bob.address);
    const bobDaiFinal = await dai.balanceOf(bob.address);
    
    console.log("\n📊 Final Balances:");
    console.log(`   Alice WETH: ${ethers.formatUnits(aliceWethFinal, 18)} (-1 WETH transferred)`);
    console.log(`   Alice DAI: ${ethers.formatUnits(aliceDaiFinal, 18)} (+2200 DAI received)`);
    console.log(`   Bob WETH: ${ethers.formatUnits(bobWethFinal, 18)} (+1 WETH received)`);
    console.log(`   Bob DAI: ${ethers.formatUnits(bobDaiFinal, 18)} (-2200 DAI paid)`);
    
    const optionFinal = await protectedOptionManager.getProtectedOption(protectedOptionId);
    console.log(`\n   Option Status: ${optionFinal.isActive ? 'Active' : 'Executed'}`);
  }

  // Test 3: Create another option and test stop-loss
  console.log("\n🔍 Test 3: Creating option and testing stop-loss protection");
  console.log("=" .repeat(50));
  
  // Reset price and create new option
  await ethUsdOracle.setLatestPrice(ethers.parseUnits("2000", 8));
  await weth.mint(alice.address, ethers.parseUnits("1", 18)); // Give Alice more WETH
  await weth.connect(alice).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("1", 18));
  
  const tx2 = await protectedOptionManager.connect(alice).createProtectedOption(
    true, // isCall
    ethers.parseUnits("2100", 8), // strikePrice
    ethers.parseUnits("50", 18), // premium
    3600, // 1 hour
    await weth.getAddress(),
    await dai.getAddress(),
    ethers.parseUnits("1", 18), // 1 WETH
    ethers.parseUnits("2000", 18), // min 2000 DAI
    ethers.parseUnits("1950", 8), // stop-loss at $1,950
    500, // 5% max loss
    await ethUsdOracle.getAddress()
  );
  
  const receipt2 = await tx2.wait();
  const event2 = receipt2.logs.find(log => log.eventName === "ProtectedOptionCreated");
  const protectedOptionId2 = event2.args[0];
  
  console.log(`✅ Second option created: ${protectedOptionId2}`);
  
  // Price drops below stop-loss
  console.log("\n💔 Price drops to $1,900 (below stop-loss threshold)");
  await ethUsdOracle.setLatestPrice(ethers.parseUnits("1900", 8));
  
  const option2 = await protectedOptionManager.getProtectedOption(protectedOptionId2);
  const [canExecute3, reason3] = await protectedOptionManager.canExecuteOption(protectedOptionId2);
  const stopLossStatus3 = await stopLossProtection.stopLossPredicate(option2.stopLossId);
  
  console.log(`   Can execute option: ${canExecute3}`);
  console.log(`   Reason: ${reason3}`);
  console.log(`   Stop-loss triggered: ${!stopLossStatus3}`);
  
  if (!stopLossStatus3) {
    console.log("\n   🛡️ Stop-loss protection activated! Cancelling option...");
    await protectedOptionManager.connect(alice).cancelProtectedOption(protectedOptionId2);
    console.log("   ✅ Option cancelled due to stop-loss trigger");
    
    const aliceWethAfterCancel = await weth.balanceOf(alice.address);
    console.log(`   Alice WETH returned: ${ethers.formatUnits(aliceWethAfterCancel, 18)} WETH`);
  }

  // Demonstrate 1inch Integration
  console.log("\n🔗 Test 4: 1inch Integration Demonstration");
  console.log("=" .repeat(50));
  
  // Reset and create another option
  await ethUsdOracle.setLatestPrice(ethers.parseUnits("2000", 8));
  await weth.mint(alice.address, ethers.parseUnits("1", 18));
  await weth.connect(alice).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("1", 18));
  
  const tx3 = await protectedOptionManager.connect(alice).createProtectedOption(
    true,
    ethers.parseUnits("2100", 8),
    ethers.parseUnits("50", 18),
    3600,
    await weth.getAddress(),
    await dai.getAddress(),
    ethers.parseUnits("1", 18),
    ethers.parseUnits("2000", 18),
    ethers.parseUnits("1950", 8),
    500,
    await ethUsdOracle.getAddress()
  );
  
  const receipt3 = await tx3.wait();
  const event3 = receipt3.logs.find(log => log.eventName === "ProtectedOptionCreated");
  const protectedOptionId3 = event3.args[0];
  const option3 = await protectedOptionManager.getProtectedOption(protectedOptionId3);
  
  // Set price to make option profitable
  await ethUsdOracle.setLatestPrice(ethers.parseUnits("2200", 8));
  
  // Encode option data for 1inch
  const optionData = await integration.encodeProtectedOptionData(
    option3.optionId,
    option3.stopLossId,
    ethers.parseUnits("0.001", 18), // minPayoff
    true // enforceStopLoss
  );
  
  console.log("📋 1inch Integration Features:");
  
  // Test predicate
  const predicateResult = await integration.protectedOptionPredicate(optionData);
  console.log(`   ✅ Predicate check (can execute): ${predicateResult}`);
  
  // Test amount calculation
  const order = {
    salt: 0,
    maker: alice.address,
    receiver: alice.address,
    makerAsset: await weth.getAddress(),
    takerAsset: await dai.getAddress(),
    makingAmount: ethers.parseUnits("1", 18),
    takingAmount: ethers.parseUnits("2200", 18),
    makerTraits: 0
  };
  
  const calculatedMakingAmount = await integration.getMakingAmount(
    order,
    "0x",
    ethers.keccak256(ethers.toUtf8Bytes("test")),
    bob.address,
    ethers.parseUnits("2200", 18),
    ethers.parseUnits("1", 18),
    optionData
  );
  
  console.log(`   📊 Calculated making amount: ${ethers.formatUnits(calculatedMakingAmount, 18)} WETH`);
  
  // Get option status through integration
  const [canExec, currentPrice, intrinsicValue, stopLossOK] = 
    await integration.getProtectedOptionStatus(option3.optionId, option3.stopLossId);
  
  console.log(`   💰 Current ETH price: $${ethers.formatUnits(currentPrice, 8)}`);
  console.log(`   📈 Intrinsic value: $${ethers.formatUnits(intrinsicValue, 8)}`);
  console.log(`   🛡️ Stop-loss status: ${stopLossOK ? 'OK' : 'TRIGGERED'}`);
  console.log(`   ✅ Can execute via 1inch: ${canExec}`);

  console.log("\n🎉 Demo completed successfully!");
  console.log("\n💡 Key Features Demonstrated:");
  console.log("   ✅ Option creation with customizable parameters");
  console.log("   ✅ Call option payoff calculations");
  console.log("   ✅ Stop-loss protection with automatic triggering");
  console.log("   ✅ Option execution and settlement");
  console.log("   ✅ 1inch Limit Order Protocol integration");
  console.log("   ✅ Predicate-based conditional execution");
  console.log("   ✅ Custom amount calculations for option payoffs");
  console.log("   ✅ Real-time option status monitoring");
  
  console.log("\n🚀 This system enables:");
  console.log("   • Safe options trading with built-in risk management");
  console.log("   • Integration with 1inch's efficient order execution");
  console.log("   • Automated stop-loss protection");
  console.log("   • Gasless option strategies through limit orders");
  console.log("   • Composable DeFi building blocks for advanced strategies");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 