const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Protected Options System", function () {
  let optionsCalculator;
  let stopLossProtection;
  let protectedOptionManager;
  let integration;
  let mockOracle;
  let mockToken1;
  let mockToken2;
  let owner;
  let user1;
  let user2;

  const INITIAL_PRICE = ethers.parseUnits("2000", 8); // $2000 with 8 decimals
  const STRIKE_PRICE = ethers.parseUnits("2100", 8); // $2100 with 8 decimals
  const PREMIUM = ethers.parseUnits("50", 18); // 50 tokens premium
  const STOP_LOSS_PRICE = ethers.parseUnits("1950", 8); // $1950 with 8 decimals
  const MAX_LOSS = 1000; // 10% in basis points

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock contracts
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken1 = await MockERC20.deploy("Token1", "TK1", 18);
    mockToken2 = await MockERC20.deploy("Token2", "TK2", 18);

    const MockChainlinkOracle = await ethers.getContractFactory("MockChainlinkOracle");
    mockOracle = await MockChainlinkOracle.deploy(INITIAL_PRICE, 8);

    // Deploy core contracts
    const OptionsCalculator = await ethers.getContractFactory("OptionsCalculator");
    optionsCalculator = await OptionsCalculator.deploy();

    const StopLossProtection = await ethers.getContractFactory("StopLossProtection");
    stopLossProtection = await StopLossProtection.deploy();

    const ProtectedOptionManager = await ethers.getContractFactory("ProtectedOptionManager");
    protectedOptionManager = await ProtectedOptionManager.deploy(
      await optionsCalculator.getAddress(),
      await stopLossProtection.getAddress()
    );

    const OneinchProtectedOptionsIntegration = await ethers.getContractFactory("OneinchProtectedOptionsIntegration");
    integration = await OneinchProtectedOptionsIntegration.deploy(
      await optionsCalculator.getAddress(),
      await stopLossProtection.getAddress(),
      await protectedOptionManager.getAddress()
    );

    // Set up authorizations
    await optionsCalculator.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
    await optionsCalculator.setAuthorizedCaller(await integration.getAddress(), true);
    await stopLossProtection.setAuthorizedCaller(await protectedOptionManager.getAddress(), true);
    await stopLossProtection.setAuthorizedCaller(await integration.getAddress(), true);

    // Mint tokens for testing
    await mockToken1.mint(user1.address, ethers.parseUnits("1000", 18));
    await mockToken2.mint(user2.address, ethers.parseUnits("10000", 18));

    // Approve tokens
    await mockToken1.connect(user1).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("1000", 18));
    await mockToken2.connect(user2).approve(await protectedOptionManager.getAddress(), ethers.parseUnits("10000", 18));
  });

  describe("OptionsCalculator", function () {
    let optionId;

    beforeEach(async function () {
      optionId = ethers.keccak256(ethers.toUtf8Bytes("test-option"));
      
      await optionsCalculator.setOptionConfig(
        optionId,
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        await mockOracle.getAddress(),
        1 // multiplier
      );
    });

    it("Should create option configuration correctly", async function () {
      const config = await optionsCalculator.optionConfigs(optionId);
      expect(config.isCall).to.be.true;
      expect(config.strikePrice).to.equal(STRIKE_PRICE);
      expect(config.premium).to.equal(PREMIUM);
      expect(config.isActive).to.be.true;
    });

    it("Should calculate call option payoff correctly when in the money", async function () {
      // Set price above strike
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));
      
      const takingAmount = ethers.parseUnits("100", 18);
      const makingAmount = await optionsCalculator.getMakingAmount(optionId, takingAmount);
      
      expect(makingAmount).to.be.gt(0);
    });

    it("Should return premium when option is out of the money", async function () {
      // Set price below strike for call option
      await mockOracle.setLatestPrice(ethers.parseUnits("2000", 8));
      
      const takingAmount = ethers.parseUnits("100", 18);
      const makingAmount = await optionsCalculator.getMakingAmount(optionId, takingAmount);
      
      // Should return premium equivalent
      expect(makingAmount).to.be.gt(0);
    });

    it("Should correctly identify in-the-money status", async function () {
      // Out of the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2000", 8));
      expect(await optionsCalculator.isInTheMoney(optionId)).to.be.false;
      
      // In the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));
      expect(await optionsCalculator.isInTheMoney(optionId)).to.be.true;
    });
  });

  describe("StopLossProtection", function () {
    let stopLossId;

    beforeEach(async function () {
      stopLossId = ethers.keccak256(ethers.toUtf8Bytes("test-stoploss"));
      
      await stopLossProtection.configureStopLoss(
        stopLossId,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        3600, // 1 hour time window
        await mockOracle.getAddress(),
        true // isLowerBound
      );
    });

    it("Should create stop-loss configuration correctly", async function () {
      const config = await stopLossProtection.stopLossConfigs(stopLossId);
      expect(config.stopLossPrice).to.equal(STOP_LOSS_PRICE);
      expect(config.maxLoss).to.equal(MAX_LOSS);
      expect(config.isActive).to.be.true;
      expect(config.isLowerBound).to.be.true;
    });

    it("Should return true when price is above stop-loss threshold", async function () {
      await mockOracle.setLatestPrice(ethers.parseUnits("2000", 8));
      expect(await stopLossProtection.stopLossPredicate(stopLossId)).to.be.true;
    });

    it("Should return false when stop-loss is triggered", async function () {
      await mockOracle.setLatestPrice(ethers.parseUnits("1900", 8)); // Below stop-loss
      expect(await stopLossProtection.stopLossPredicate(stopLossId)).to.be.false;
    });

    it("Should calculate dynamic stop-loss correctly", async function () {
      const entryPrice = ethers.parseUnits("2000", 8);
      const dynamicStopPrice = await stopLossProtection.calculateDynamicStopLoss(stopLossId, entryPrice);
      
      // Should be 10% below entry price
      const expectedStopPrice = entryPrice - (entryPrice * BigInt(MAX_LOSS)) / BigInt(10000);
      expect(dynamicStopPrice).to.equal(expectedStopPrice);
    });
  });

  describe("ProtectedOptionManager", function () {
    it("Should create protected option successfully", async function () {
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600; // 1 hour

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      
      expect(event).to.not.be.undefined;
      
      const protectedOptionId = event.args[0];
      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      
      expect(option.maker).to.equal(user1.address);
      expect(option.makingAmount).to.equal(makingAmount);
      expect(option.isActive).to.be.true;
      expect(option.isCall).to.be.true;
    });

    it("Should execute protected option when conditions are met", async function () {
      // Create option first
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600;

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      const protectedOptionId = event.args[0];

      // Set price to make option in the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));

      // Execute option
      const takingAmount = ethers.parseUnits("200", 18);
      await protectedOptionManager.connect(user2).executeProtectedOption(
        protectedOptionId,
        takingAmount
      );

      // Check that option is no longer active
      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      expect(option.isActive).to.be.false;
    });

    it("Should prevent execution when stop-loss is triggered", async function () {
      // Create option
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600;

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      const protectedOptionId = event.args[0];

      // Trigger stop-loss by setting price below threshold
      await mockOracle.setLatestPrice(ethers.parseUnits("1900", 8));

      // Try to execute - should fail
      const takingAmount = ethers.parseUnits("200", 18);
      await expect(
        protectedOptionManager.connect(user2).executeProtectedOption(
          protectedOptionId,
          takingAmount
        )
      ).to.be.revertedWithCustomError(protectedOptionManager, "StopLossTriggered");
    });

    it("Should allow cancellation when stop-loss is triggered", async function () {
      // Create option
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600;

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      const protectedOptionId = event.args[0];

      // Trigger stop-loss
      await mockOracle.setLatestPrice(ethers.parseUnits("1900", 8));

      // Cancel option
      await protectedOptionManager.connect(user2).cancelProtectedOption(protectedOptionId);

      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      expect(option.isActive).to.be.false;
    });

    it("Should check option execution conditions correctly", async function () {
      // Create option
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600;

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      const protectedOptionId = event.args[0];

      // Check when out of the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2000", 8));
      let [canExecute, reason] = await protectedOptionManager.canExecuteOption(protectedOptionId);
      expect(canExecute).to.be.false;
      expect(reason).to.equal("Option out of the money");

      // Check when in the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));
      [canExecute, reason] = await protectedOptionManager.canExecuteOption(protectedOptionId);
      expect(canExecute).to.be.true;
      expect(reason).to.equal("Can execute");
    });
  });

  describe("1inch Integration", function () {
    let protectedOptionId;
    let optionData;

    beforeEach(async function () {
      // Create a protected option
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600;

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true, // isCall
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      protectedOptionId = event.args[0];

      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      
      // Encode option data for 1inch integration
      optionData = await integration.encodeProtectedOptionData(
        option.optionId,
        option.stopLossId,
        ethers.parseUnits("0.001", 18), // minPayoff (very small)
        true // enforceStopLoss
      );
    });

    it("Should encode and decode protected option data correctly", async function () {
      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      
      const encoded = await integration.encodeProtectedOptionData(
        option.optionId,
        option.stopLossId,
        ethers.parseUnits("1", 18),
        true
      );

      expect(encoded.length).to.be.gt(0);
    });

    it("Should calculate making amount via 1inch integration", async function () {
      // Set price to make option in the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));

      const order = {
        salt: 0,
        maker: user1.address,
        receiver: user1.address,
        makerAsset: await mockToken1.getAddress(),
        takerAsset: await mockToken2.getAddress(),
        makingAmount: ethers.parseUnits("10", 18),
        takingAmount: ethers.parseUnits("100", 18),
        makerTraits: 0
      };

      const takingAmount = ethers.parseUnits("100", 18);
      const remainingMakingAmount = ethers.parseUnits("10", 18);

      const makingAmount = await integration.getMakingAmount(
        order,
        "0x", // extension
        ethers.keccak256(ethers.toUtf8Bytes("test")), // orderHash
        user2.address, // taker
        takingAmount,
        remainingMakingAmount,
        optionData
      );

      expect(makingAmount).to.be.gt(0);
      expect(makingAmount).to.be.lte(remainingMakingAmount);
    });

    it("Should reject execution when stop-loss is triggered in 1inch integration", async function () {
      // Trigger stop-loss
      await mockOracle.setLatestPrice(ethers.parseUnits("1900", 8));

      const order = {
        salt: 0,
        maker: user1.address,
        receiver: user1.address,
        makerAsset: await mockToken1.getAddress(),
        takerAsset: await mockToken2.getAddress(),
        makingAmount: ethers.parseUnits("10", 18),
        takingAmount: ethers.parseUnits("100", 18),
        makerTraits: 0
      };

      const takingAmount = ethers.parseUnits("100", 18);
      const remainingMakingAmount = ethers.parseUnits("10", 18);

      await expect(
        integration.getMakingAmount(
          order,
          "0x",
          ethers.keccak256(ethers.toUtf8Bytes("test")),
          user2.address,
          takingAmount,
          remainingMakingAmount,
          optionData
        )
      ).to.be.revertedWithCustomError(integration, "StopLossTriggered");
    });

    it("Should validate protected option predicate correctly", async function () {
      // When in the money and stop-loss not triggered
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));
      expect(await integration.protectedOptionPredicate(optionData)).to.be.true;

      // When stop-loss is triggered
      await mockOracle.setLatestPrice(ethers.parseUnits("1900", 8));
      expect(await integration.protectedOptionPredicate(optionData)).to.be.false;

      // When out of the money
      await mockOracle.setLatestPrice(ethers.parseUnits("2000", 8));
      expect(await integration.protectedOptionPredicate(optionData)).to.be.false;
    });

    it("Should get protected option status correctly", async function () {
      await mockOracle.setLatestPrice(ethers.parseUnits("2200", 8));
      
      const option = await protectedOptionManager.getProtectedOption(protectedOptionId);
      const [canExecute, currentPrice, intrinsicValue, stopLossStatus] = 
        await integration.getProtectedOptionStatus(option.optionId, option.stopLossId);

      expect(canExecute).to.be.true;
      expect(currentPrice).to.equal(ethers.parseUnits("2200", 8));
      expect(intrinsicValue).to.be.gt(0);
      expect(stopLossStatus).to.be.true;
    });
  });

  describe("Edge Cases and Error Handling", function () {
    it("Should revert when creating option with invalid duration", async function () {
      await expect(
        protectedOptionManager.connect(user1).createProtectedOption(
          true,
          STRIKE_PRICE,
          PREMIUM,
          30, // Too short duration
          await mockToken1.getAddress(),
          await mockToken2.getAddress(),
          ethers.parseUnits("10", 18),
          ethers.parseUnits("100", 18),
          STOP_LOSS_PRICE,
          MAX_LOSS,
          await mockOracle.getAddress()
        )
      ).to.be.revertedWithCustomError(protectedOptionManager, "InvalidOptionDuration");
    });

    it("Should handle stale oracle price correctly", async function () {
      const stopLossId = ethers.keccak256(ethers.toUtf8Bytes("test-stoploss-stale"));
      
      await stopLossProtection.configureStopLoss(
        stopLossId,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        3600,
        await mockOracle.getAddress(),
        true
      );

      // Make oracle price stale
      await mockOracle.setStalePrice();

      await expect(
        stopLossProtection.checkStopLoss(stopLossId)
      ).to.be.revertedWithCustomError(stopLossProtection, "StalePrice");
    });

    it("Should handle expired options correctly", async function () {
      // Create option with short duration
      const makingAmount = ethers.parseUnits("10", 18);
      const minTakingAmount = ethers.parseUnits("100", 18);
      const optionDuration = 3600; // 1 hour (minimum allowed)

      const tx = await protectedOptionManager.connect(user1).createProtectedOption(
        true,
        STRIKE_PRICE,
        PREMIUM,
        optionDuration,
        await mockToken1.getAddress(),
        await mockToken2.getAddress(),
        makingAmount,
        minTakingAmount,
        STOP_LOSS_PRICE,
        MAX_LOSS,
        await mockOracle.getAddress()
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(log => log.eventName === "ProtectedOptionCreated");
      const protectedOptionId = event.args[0];

      // Wait for expiration (advance time by more than 1 hour)
      await time.increase(3700);

      await expect(
        protectedOptionManager.connect(user2).executeProtectedOption(
          protectedOptionId,
          ethers.parseUnits("200", 18)
        )
      ).to.be.revertedWithCustomError(protectedOptionManager, "OptionExpired");
    });
  });
}); 