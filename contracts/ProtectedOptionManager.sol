// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./OptionsCalculator.sol";
import "./StopLossProtection.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ProtectedOptionManager
 * @dev Main contract that orchestrates protected option strategies using 1inch Limit Order Protocol
 */
contract ProtectedOptionManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    struct ProtectedOption {
        bytes32 optionId;           // Option configuration ID
        bytes32 stopLossId;         // Stop-loss configuration ID
        address maker;              // Option creator
        address makerAsset;         // Asset being sold
        address takerAsset;         // Asset being bought
        uint256 makingAmount;       // Amount of maker asset
        uint256 minTakingAmount;    // Minimum taking amount
        uint256 createdAt;          // Creation timestamp
        uint256 expiresAt;          // Expiration timestamp
        bool isActive;              // Whether the option is active
        bool isCall;                // true for call, false for put
    }
    
    // Events
    event ProtectedOptionCreated(
        bytes32 indexed protectedOptionId,
        bytes32 indexed optionId,
        bytes32 indexed stopLossId,
        address maker,
        bool isCall
    );
    
    event ProtectedOptionExecuted(
        bytes32 indexed protectedOptionId,
        address taker,
        uint256 makingAmount,
        uint256 takingAmount
    );
    
    event ProtectedOptionCancelled(
        bytes32 indexed protectedOptionId,
        address maker,
        string reason
    );
    
    event StopLossActivated(
        bytes32 indexed protectedOptionId,
        uint256 triggerPrice,
        uint256 timestamp
    );
    
    // State variables
    OptionsCalculator public immutable optionsCalculator;
    StopLossProtection public immutable stopLossProtection;
    
    mapping(bytes32 => ProtectedOption) public protectedOptions;
    mapping(address => bytes32[]) public userOptions;
    mapping(bytes32 => bool) public executedOptions;
    
    uint256 public protectedOptionCounter;
    uint256 public constant MAX_OPTION_DURATION = 30 days;
    uint256 public constant MIN_OPTION_DURATION = 1 hours;
    
    // Errors
    error InvalidOptionDuration();
    error OptionNotFound();
    error OptionNotActive();
    error OptionExpired();
    error UnauthorizedAccess();
    error StopLossTriggered();
    error InsufficientAmount();
    error InvalidConfiguration();
    
    constructor(
        address _optionsCalculator,
        address _stopLossProtection
    ) Ownable(msg.sender) {
        optionsCalculator = OptionsCalculator(_optionsCalculator);
        stopLossProtection = StopLossProtection(_stopLossProtection);
    }
    
    /**
     * @dev Creates a new protected option strategy
     * @param isCall Whether this is a call (true) or put (false) option
     * @param strikePrice Strike price for the option
     * @param premium Premium amount for the option
     * @param optionDuration Duration of the option in seconds
     * @param makerAsset Asset being sold by the maker
     * @param takerAsset Asset being bought by the maker
     * @param makingAmount Amount of maker asset
     * @param minTakingAmount Minimum amount of taker asset
     * @param stopLossPrice Price at which to trigger stop-loss
     * @param maxLoss Maximum loss percentage (basis points)
     * @param oracle Price oracle address
     * @return protectedOptionId ID of the created protected option
     */
    function createProtectedOption(
        bool isCall,
        uint256 strikePrice,
        uint256 premium,
        uint256 optionDuration,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 minTakingAmount,
        uint256 stopLossPrice,
        uint256 maxLoss,
        address oracle
    ) external nonReentrant returns (bytes32 protectedOptionId) {
        // Validate inputs
        if (optionDuration < MIN_OPTION_DURATION || optionDuration > MAX_OPTION_DURATION) {
            revert InvalidOptionDuration();
        }
        if (makingAmount == 0 || minTakingAmount == 0) revert InsufficientAmount();
        if (makerAsset == address(0) || takerAsset == address(0)) revert InvalidConfiguration();
        
        // Generate unique IDs
        protectedOptionId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            protectedOptionCounter++
        ));
        
        bytes32 optionId = keccak256(abi.encodePacked(protectedOptionId, "option"));
        bytes32 stopLossId = keccak256(abi.encodePacked(protectedOptionId, "stoploss"));
        
        uint256 expiresAt = block.timestamp + optionDuration;
        
        // Configure option in calculator
        optionsCalculator.setOptionConfig(
            optionId,
            isCall,
            strikePrice,
            premium,
            expiresAt,
            oracle,
            1 // Default multiplier
        );
        
        // Configure stop-loss
        stopLossProtection.configureStopLoss(
            stopLossId,
            stopLossPrice,
            maxLoss,
            3600, // 1 hour time window
            oracle,
            isCall ? true : false // Call uses lower bound, put uses upper bound
        );
        
        // Create protected option
        protectedOptions[protectedOptionId] = ProtectedOption({
            optionId: optionId,
            stopLossId: stopLossId,
            maker: msg.sender,
            makerAsset: makerAsset,
            takerAsset: takerAsset,
            makingAmount: makingAmount,
            minTakingAmount: minTakingAmount,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true,
            isCall: isCall
        });
        
        // Add to user's options
        userOptions[msg.sender].push(protectedOptionId);
        
        // Transfer maker asset to this contract for escrow
        IERC20(makerAsset).safeTransferFrom(msg.sender, address(this), makingAmount);
        
        emit ProtectedOptionCreated(protectedOptionId, optionId, stopLossId, msg.sender, isCall);
    }
    
    /**
     * @dev Executes a protected option if conditions are met
     * @param protectedOptionId ID of the protected option to execute
     * @param takingAmount Amount of taker asset being provided
     */
    function executeProtectedOption(
        bytes32 protectedOptionId,
        uint256 takingAmount
    ) external nonReentrant {
        ProtectedOption storage option = protectedOptions[protectedOptionId];
        
        if (!option.isActive) revert OptionNotActive();
        if (block.timestamp >= option.expiresAt) revert OptionExpired();
        if (executedOptions[protectedOptionId]) revert OptionNotActive();
        if (takingAmount < option.minTakingAmount) revert InsufficientAmount();
        
        // Check stop-loss conditions
        if (!stopLossProtection.stopLossPredicate(option.stopLossId)) {
            revert StopLossTriggered();
        }
        
        // Check if option is in the money
        if (!optionsCalculator.isInTheMoney(option.optionId)) {
            revert OptionNotActive();
        }
        
        // Calculate actual making amount based on option payoff
        uint256 actualMakingAmount = optionsCalculator.getMakingAmount(
            option.optionId,
            takingAmount
        );
        
        // Ensure we have enough maker asset
        if (actualMakingAmount > option.makingAmount) {
            actualMakingAmount = option.makingAmount;
        }
        
        // Transfer assets
        IERC20(option.takerAsset).safeTransferFrom(msg.sender, option.maker, takingAmount);
        IERC20(option.makerAsset).safeTransfer(msg.sender, actualMakingAmount);
        
        // Mark as executed
        executedOptions[protectedOptionId] = true;
        option.isActive = false;
        
        emit ProtectedOptionExecuted(protectedOptionId, msg.sender, actualMakingAmount, takingAmount);
    }
    
    /**
     * @dev Cancels a protected option (only by maker or if stop-loss triggered)
     * @param protectedOptionId ID of the protected option to cancel
     */
    function cancelProtectedOption(bytes32 protectedOptionId) external nonReentrant {
        ProtectedOption storage option = protectedOptions[protectedOptionId];
        
        if (!option.isActive) revert OptionNotActive();
        
        bool isOwner = msg.sender == option.maker;
        bool isExpired = block.timestamp >= option.expiresAt;
        bool stopLossTriggered = !stopLossProtection.stopLossPredicate(option.stopLossId);
        
        if (!isOwner && !isExpired && !stopLossTriggered) {
            revert UnauthorizedAccess();
        }
        
        // Deactivate configurations
        optionsCalculator.deactivateOption(option.optionId);
        stopLossProtection.deactivateStopLoss(option.stopLossId);
        
        // Return maker asset to maker
        IERC20(option.makerAsset).safeTransfer(option.maker, option.makingAmount);
        
        option.isActive = false;
        
        string memory reason = isExpired ? "expired" : stopLossTriggered ? "stop-loss" : "cancelled";
        emit ProtectedOptionCancelled(protectedOptionId, option.maker, reason);
    }
    
    /**
     * @dev Gets protected option details
     * @param protectedOptionId ID of the protected option
     * @return option Protected option details
     */
    function getProtectedOption(bytes32 protectedOptionId) 
        external 
        view 
        returns (ProtectedOption memory option) 
    {
        option = protectedOptions[protectedOptionId];
    }
    
    /**
     * @dev Gets all protected options for a user
     * @param user User address
     * @return optionIds Array of protected option IDs
     */
    function getUserOptions(address user) external view returns (bytes32[] memory optionIds) {
        optionIds = userOptions[user];
    }
    
    /**
     * @dev Checks if a protected option can be executed
     * @param protectedOptionId ID of the protected option
     * @return canExecute Whether the option can be executed
     * @return reason Reason if it cannot be executed
     */
    function canExecuteOption(bytes32 protectedOptionId) 
        external 
        view 
        returns (bool canExecute, string memory reason) 
    {
        ProtectedOption memory option = protectedOptions[protectedOptionId];
        
        if (!option.isActive) return (false, "Option not active");
        if (block.timestamp >= option.expiresAt) return (false, "Option expired");
        if (executedOptions[protectedOptionId]) return (false, "Already executed");
        
        if (!stopLossProtection.stopLossPredicate(option.stopLossId)) {
            return (false, "Stop-loss triggered");
        }
        
        if (!optionsCalculator.isInTheMoney(option.optionId)) {
            return (false, "Option out of the money");
        }
        
        return (true, "Can execute");
    }
    
    /**
     * @dev Gets current option status including prices and payoffs
     * @param protectedOptionId ID of the protected option
     * @return isInTheMoney Whether option is in the money
     * @return currentPrice Current asset price
     * @return intrinsicValue Current intrinsic value
     * @return stopLossStatus Whether stop-loss is triggered
     */
    function getOptionStatus(bytes32 protectedOptionId) 
        external 
        view 
        returns (
            bool isInTheMoney,
            uint256 currentPrice,
            uint256 intrinsicValue,
            bool stopLossStatus
        ) 
    {
        ProtectedOption memory option = protectedOptions[protectedOptionId];
        
        if (option.isActive) {
            isInTheMoney = optionsCalculator.isInTheMoney(option.optionId);
            (intrinsicValue, currentPrice) = optionsCalculator.getIntrinsicValue(option.optionId);
            stopLossStatus = stopLossProtection.stopLossPredicate(option.stopLossId);
        }
    }
    
    /**
     * @dev Emergency function to recover tokens (only owner)
     * @param token Token address to recover
     * @param amount Amount to recover
     */
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
} 