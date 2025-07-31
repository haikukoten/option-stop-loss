// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StopLossProtection
 * @dev Implements stop-loss predicates for protected option strategies
 */
contract StopLossProtection is Ownable {
    
    struct StopLossConfig {
        uint256 stopLossPrice;      // Price at which to trigger stop-loss
        uint256 maxLoss;            // Maximum loss percentage (in basis points)
        uint256 timeWindow;         // Time window for price checks
        address oracle;             // Price oracle address
        bool isActive;              // Whether stop-loss is active
        bool isLowerBound;          // true for stop-loss below, false for above
        uint256 createdAt;          // When the stop-loss was created
    }
    
    // Events
    event StopLossConfigured(
        bytes32 indexed stopLossId,
        uint256 stopLossPrice,
        uint256 maxLoss,
        bool isLowerBound
    );
    
    event StopLossTriggered(
        bytes32 indexed stopLossId,
        uint256 currentPrice,
        uint256 triggerPrice,
        uint256 timestamp
    );
    
    event StopLossDeactivated(bytes32 indexed stopLossId);
    
    // State variables
    mapping(bytes32 => StopLossConfig) public stopLossConfigs;
    mapping(address => bool) public authorizedCallers;
    
    // Constants
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_PRICE_AGE = 300; // 5 minutes for stop-loss
    uint256 private constant MIN_TIME_WINDOW = 60; // 1 minute minimum
    uint256 private constant MAX_LOSS_BP = 9000; // 90% max loss
    
    // Errors
    error InvalidStopLossConfig();
    error StopLossNotActive();
    error StalePrice();
    error UnauthorizedCaller();
    error InvalidMaxLoss();
    error InvalidTimeWindow();
    
    modifier onlyAuthorized() {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedCaller();
        }
        _;
    }
    
    constructor() Ownable(msg.sender) {
        authorizedCallers[msg.sender] = true;
    }
    
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }
    
    /**
     * @dev Configures a stop-loss protection
     * @param stopLossId Unique identifier for the stop-loss
     * @param stopLossPrice Price at which to trigger stop-loss
     * @param maxLoss Maximum loss percentage in basis points
     * @param timeWindow Time window for price validation
     * @param oracle Price oracle address
     * @param isLowerBound Whether this is a lower bound stop-loss
     */
    function configureStopLoss(
        bytes32 stopLossId,
        uint256 stopLossPrice,
        uint256 maxLoss,
        uint256 timeWindow,
        address oracle,
        bool isLowerBound
    ) external onlyAuthorized {
        if (stopLossPrice == 0) revert InvalidStopLossConfig();
        if (maxLoss == 0 || maxLoss > MAX_LOSS_BP) revert InvalidMaxLoss();
        if (timeWindow < MIN_TIME_WINDOW) revert InvalidTimeWindow();
        if (oracle == address(0)) revert InvalidStopLossConfig();
        
        stopLossConfigs[stopLossId] = StopLossConfig({
            stopLossPrice: stopLossPrice,
            maxLoss: maxLoss,
            timeWindow: timeWindow,
            oracle: oracle,
            isActive: true,
            isLowerBound: isLowerBound,
            createdAt: block.timestamp
        });
        
        emit StopLossConfigured(stopLossId, stopLossPrice, maxLoss, isLowerBound);
    }
    
    /**
     * @dev Deactivates a stop-loss configuration
     * @param stopLossId Stop-loss identifier to deactivate
     */
    function deactivateStopLoss(bytes32 stopLossId) external onlyAuthorized {
        stopLossConfigs[stopLossId].isActive = false;
        emit StopLossDeactivated(stopLossId);
    }
    
    /**
     * @dev Checks if stop-loss should be triggered
     * @param stopLossId Stop-loss configuration identifier
     * @return shouldTrigger Whether the stop-loss should be triggered
     */
    function checkStopLoss(bytes32 stopLossId) external view onlyAuthorized returns (bool shouldTrigger) {
        StopLossConfig memory config = stopLossConfigs[stopLossId];
        
        if (!config.isActive) revert StopLossNotActive();
        
        uint256 currentPrice = _getCurrentPrice(config.oracle);
        
        if (config.isLowerBound) {
            // Stop-loss triggers when price goes below threshold
            shouldTrigger = currentPrice <= config.stopLossPrice;
        } else {
            // Stop-loss triggers when price goes above threshold
            shouldTrigger = currentPrice >= config.stopLossPrice;
        }
        
        // Note: Event emission removed for view function compatibility
        // if (shouldTrigger) {
        //     emit StopLossTriggered(stopLossId, currentPrice, config.stopLossPrice, block.timestamp);
        // }
    }
    
    /**
     * @dev Predicate function for 1inch limit orders - checks if stop-loss is NOT triggered
     * @param stopLossId Stop-loss configuration identifier encoded in predicate data
     * @return isValid True if stop-loss is NOT triggered (order can proceed)
     */
    function stopLossPredicate(bytes32 stopLossId) external view returns (bool isValid) {
        StopLossConfig memory config = stopLossConfigs[stopLossId];
        
        if (!config.isActive) {
            return true; // If stop-loss is not active, allow order
        }
        
        uint256 currentPrice = _getCurrentPrice(config.oracle);
        
        if (config.isLowerBound) {
            // Order is valid if price is above stop-loss threshold
            isValid = currentPrice > config.stopLossPrice;
        } else {
            // Order is valid if price is below stop-loss threshold  
            isValid = currentPrice < config.stopLossPrice;
        }
    }
    
    /**
     * @dev Advanced predicate that combines multiple stop-loss conditions
     * @param stopLossIds Array of stop-loss IDs to check
     * @param requireAll Whether all conditions must be met (AND) or any (OR)
     * @return isValid True if conditions are met
     */
    function multiStopLossPredicate(
        bytes32[] calldata stopLossIds,
        bool requireAll
    ) external view returns (bool isValid) {
        if (stopLossIds.length == 0) return true;
        
        if (requireAll) {
            // AND logic - all stop-losses must be valid
            for (uint256 i = 0; i < stopLossIds.length; i++) {
                if (!this.stopLossPredicate(stopLossIds[i])) {
                    return false;
                }
            }
            return true;
        } else {
            // OR logic - at least one stop-loss must be valid
            for (uint256 i = 0; i < stopLossIds.length; i++) {
                if (this.stopLossPredicate(stopLossIds[i])) {
                    return true;
                }
            }
            return false;
        }
    }
    
    /**
     * @dev Calculates dynamic stop-loss price based on current market conditions
     * @param stopLossId Stop-loss configuration identifier
     * @param currentEntryPrice Current entry price for the position
     * @return dynamicStopPrice Calculated dynamic stop-loss price
     */
    function calculateDynamicStopLoss(
        bytes32 stopLossId,
        uint256 currentEntryPrice
    ) external view returns (uint256 dynamicStopPrice) {
        StopLossConfig memory config = stopLossConfigs[stopLossId];
        
        if (!config.isActive) revert StopLossNotActive();
        
        // Calculate stop-loss price based on max loss percentage
        if (config.isLowerBound) {
            // For lower bound, subtract max loss from entry price
            dynamicStopPrice = currentEntryPrice - 
                (currentEntryPrice * config.maxLoss) / BASIS_POINTS;
        } else {
            // For upper bound, add max loss to entry price
            dynamicStopPrice = currentEntryPrice + 
                (currentEntryPrice * config.maxLoss) / BASIS_POINTS;
        }
    }
    
    /**
     * @dev Gets the current price and age from oracle
     * @param stopLossId Stop-loss configuration identifier
     * @return price Current price from oracle
     * @return priceAge Age of the price data in seconds
     */
    function getPriceInfo(bytes32 stopLossId) 
        external 
        view 
        returns (uint256 price, uint256 priceAge) 
    {
        StopLossConfig memory config = stopLossConfigs[stopLossId];
        if (!config.isActive) revert StopLossNotActive();
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(config.oracle);
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        
        require(answer > 0, "Invalid price");
        
        price = uint256(answer);
        priceAge = block.timestamp - updatedAt;
    }
    
    /**
     * @dev Internal function to get current price from oracle
     * @param oracle Oracle address
     * @return price Current price
     */
    function _getCurrentPrice(address oracle) internal view returns (uint256 price) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracle);
        
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        require(answer > 0, "Invalid price");
        
        price = uint256(answer);
    }
} 