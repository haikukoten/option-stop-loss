// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OptionsCalculator
 * @dev Implements option payoff calculations for protected option strategies
 */
contract OptionsCalculator is Ownable {
    
    struct OptionParams {
        bool isCall;           // true for call, false for put
        uint256 strikePrice;   // Strike price in USD (8 decimals)
        uint256 premium;       // Option premium amount
        uint256 expiration;    // Option expiration timestamp
        address oracle;        // Chainlink price feed address
        uint256 multiplier;    // Position size multiplier
        bool isActive;         // Whether this option configuration is active
    }
    
    // Events
    event OptionParamsUpdated(bytes32 indexed optionId, bool isCall, uint256 strikePrice);
    event PayoffCalculated(bytes32 indexed optionId, uint256 currentPrice, uint256 payoff);
    
    // State variables
    mapping(bytes32 => OptionParams) public optionConfigs;
    mapping(address => bool) public authorizedCallers;
    
    // Constants
    uint256 private constant PRICE_DECIMALS = 8;
    uint256 private constant MAX_PRICE_AGE = 3600; // 1 hour
    uint256 private constant MIN_INTRINSIC_VALUE = 1e6; // Minimum intrinsic value for 8-decimal price feeds
    
    // Errors
    error InvalidOptionConfig();
    error OptionExpired();
    error StalePrice();
    error UnauthorizedCaller();
    
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
    
    function setOptionConfig(
        bytes32 optionId,
        bool isCall,
        uint256 strikePrice,
        uint256 premium,
        uint256 expiration,
        address oracle,
        uint256 multiplier
    ) external onlyAuthorized {
        require(strikePrice > 0, "Invalid strike price");
        require(multiplier > 0 && multiplier <= 100, "Invalid multiplier");
        require(expiration > block.timestamp, "Invalid expiration");
        require(oracle != address(0), "Invalid oracle");
        
        optionConfigs[optionId] = OptionParams({
            isCall: isCall,
            strikePrice: strikePrice,
            premium: premium,
            expiration: expiration,
            oracle: oracle,
            multiplier: multiplier,
            isActive: true
        });
        
        emit OptionParamsUpdated(optionId, isCall, strikePrice);
    }
    
    function getMakingAmount(
        bytes32 optionId,
        uint256 takingAmount
    ) external view onlyAuthorized returns (uint256 makingAmount) {
        OptionParams memory option = optionConfigs[optionId];
        
        if (!option.isActive) revert InvalidOptionConfig();
        if (block.timestamp >= option.expiration) revert OptionExpired();
        
        uint256 currentPrice = _getCurrentPrice(option.oracle);
        uint256 intrinsicValue = _calculateIntrinsicValue(option, currentPrice);
        
        if (intrinsicValue > MIN_INTRINSIC_VALUE) {
            makingAmount = (takingAmount * intrinsicValue * option.multiplier) / (option.strikePrice * 100);
        } else {
            makingAmount = (takingAmount * option.premium) / 1e18;
        }
        
        // Note: Event emission removed for view function compatibility
    }
    
    function getTakingAmount(
        bytes32 optionId,
        uint256 makingAmount
    ) external view onlyAuthorized returns (uint256 takingAmount) {
        OptionParams memory option = optionConfigs[optionId];
        
        if (!option.isActive) revert InvalidOptionConfig();
        if (block.timestamp >= option.expiration) revert OptionExpired();
        
        uint256 currentPrice = _getCurrentPrice(option.oracle);
        uint256 intrinsicValue = _calculateIntrinsicValue(option, currentPrice);
        
        if (intrinsicValue > MIN_INTRINSIC_VALUE) {
            takingAmount = (makingAmount * option.strikePrice * 100) / (intrinsicValue * option.multiplier);
        } else {
            takingAmount = (makingAmount * 1e18) / option.premium;
        }
        
        // Note: Event emission removed for view function compatibility
    }
    
    function isInTheMoney(bytes32 optionId) external view returns (bool) {
        OptionParams memory option = optionConfigs[optionId];
        if (!option.isActive) revert InvalidOptionConfig();
        
        uint256 currentPrice = _getCurrentPrice(option.oracle);
        uint256 intrinsicValue = _calculateIntrinsicValue(option, currentPrice);
        
        return intrinsicValue > MIN_INTRINSIC_VALUE;
    }
    
    /**
     * @dev Gets the current intrinsic value of an option
     * @param optionId Option configuration identifier
     * @return intrinsicValue Current intrinsic value of the option
     * @return currentPrice Current asset price from oracle
     */
    function getIntrinsicValue(bytes32 optionId) 
        external 
        view 
        returns (uint256 intrinsicValue, uint256 currentPrice) 
    {
        OptionParams memory option = optionConfigs[optionId];
        if (!option.isActive) revert InvalidOptionConfig();
        
        currentPrice = _getCurrentPrice(option.oracle);
        intrinsicValue = _calculateIntrinsicValue(option, currentPrice);
    }
    
    /**
     * @dev Deactivates an option configuration
     * @param optionId Option identifier to deactivate
     */
    function deactivateOption(bytes32 optionId) external onlyAuthorized {
        optionConfigs[optionId].isActive = false;
    }
    
    function _getCurrentPrice(address oracle) internal view returns (uint256 price) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(oracle);
        
        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        
        if (block.timestamp - updatedAt > MAX_PRICE_AGE) revert StalePrice();
        require(answer > 0, "Invalid price");
        
        price = uint256(answer);
    }
    
    function _calculateIntrinsicValue(
        OptionParams memory option,
        uint256 currentPrice
    ) internal pure returns (uint256 intrinsicValue) {
        if (option.isCall) {
            // Call option: max(currentPrice - strikePrice, 0)
            if (currentPrice > option.strikePrice) {
                intrinsicValue = currentPrice - option.strikePrice;
            }
        } else {
            // Put option: max(strikePrice - currentPrice, 0)
            if (option.strikePrice > currentPrice) {
                intrinsicValue = option.strikePrice - currentPrice;
            }
        }
    }
} 