// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./OptionsCalculator.sol";
import "./StopLossProtection.sol";
import "./ProtectedOptionManager.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OneinchProtectedOptionsIntegration
 * @dev Integration contract for 1inch Limit Order Protocol with protected options
 * @notice This contract implements IAmountGetter interface and provides predicates for 1inch orders
 */
contract OneinchProtectedOptionsIntegration is Ownable {
    
    // Core contracts
    OptionsCalculator public immutable optionsCalculator;
    StopLossProtection public immutable stopLossProtection;
    ProtectedOptionManager public immutable protectedOptionManager;
    
    // Struct to decode extra data for protected options
    struct ProtectedOptionData {
        bytes32 optionId;        // Option configuration ID
        bytes32 stopLossId;      // Stop-loss configuration ID
        uint256 minPayoff;       // Minimum acceptable payoff
        bool enforceStopLoss;    // Whether to enforce stop-loss check
    }
    
    // Events
    event ProtectedOptionOrderProcessed(
        bytes32 indexed optionId,
        bytes32 indexed stopLossId,
        uint256 makingAmount,
        uint256 takingAmount,
        address taker
    );
    
    event StopLossPredicateChecked(
        bytes32 indexed stopLossId,
        bool isValid,
        uint256 currentPrice
    );
    
    // Errors
    error InvalidExtraData();
    error StopLossTriggered();
    error InsufficientPayoff();
    error OptionExpired();
    error OptionOutOfMoney();
    
    constructor(
        address _optionsCalculator,
        address _stopLossProtection,
        address _protectedOptionManager
    ) Ownable(msg.sender) {
        optionsCalculator = OptionsCalculator(_optionsCalculator);
        stopLossProtection = StopLossProtection(_stopLossProtection);
        protectedOptionManager = ProtectedOptionManager(_protectedOptionManager);
    }
    
    /**
     * @dev Calculates making amount for 1inch orders with option payoff logic
     * @param taker Taker address
     * @param takingAmount Amount being taken
     * @param remainingMakingAmount Remaining making amount
     * @param extraData Encoded ProtectedOptionData
     * @return makingAmount Calculated making amount based on option payoff
     */
    function getMakingAmount(
        Order calldata /* order */,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address taker,
        uint256 takingAmount,
        uint256 remainingMakingAmount,
        bytes calldata extraData
    ) external view returns (uint256 makingAmount) {
        // Decode protected option data
        ProtectedOptionData memory optionData = _decodeExtraData(extraData);
        
        // Check stop-loss if enforced
        if (optionData.enforceStopLoss) {
            bool stopLossValid = stopLossProtection.stopLossPredicate(optionData.stopLossId);
            if (!stopLossValid) revert StopLossTriggered();
        }
        
        // Calculate making amount using option payoff
        makingAmount = optionsCalculator.getMakingAmount(
            optionData.optionId,
            takingAmount
        );
        
        // Ensure minimum payoff is met
        if (makingAmount < optionData.minPayoff) {
            revert InsufficientPayoff();
        }
        
        // Ensure we don't exceed remaining amount
        if (makingAmount > remainingMakingAmount) {
            makingAmount = remainingMakingAmount;
        }
        
        // Note: Event emission removed for view function compatibility
    }
    
    /**
     * @dev Calculates taking amount for 1inch orders with option payoff logic
     * @param taker Taker address
     * @param makingAmount Amount being made
     * @param extraData Encoded ProtectedOptionData
     * @return takingAmount Calculated taking amount based on option payoff
     */
    function getTakingAmount(
        Order calldata /* order */,
        bytes calldata /* extension */,
        bytes32 /* orderHash */,
        address taker,
        uint256 makingAmount,
        uint256 /* remainingMakingAmount */,
        bytes calldata extraData
    ) external view returns (uint256 takingAmount) {
        // Decode protected option data
        ProtectedOptionData memory optionData = _decodeExtraData(extraData);
        
        // Check stop-loss if enforced
        if (optionData.enforceStopLoss) {
            bool stopLossValid = stopLossProtection.stopLossPredicate(optionData.stopLossId);
            if (!stopLossValid) revert StopLossTriggered();
        }
        
        // Calculate taking amount using option payoff
        takingAmount = optionsCalculator.getTakingAmount(
            optionData.optionId,
            makingAmount
        );
        
        // Note: Event emission removed for view function compatibility
    }
    
    /**
     * @dev Predicate function that checks if protected option can be executed
     * @param extraData Encoded option and stop-loss IDs
     * @return isValid Whether the protected option conditions are met
     */
    function protectedOptionPredicate(bytes calldata extraData) external view returns (bool isValid) {
        try this._internalProtectedOptionPredicate(extraData) returns (bool result) {
            return result;
        } catch {
            return false;
        }
    }
    
    /**
     * @dev Internal function for protected option predicate (to catch reverts)
     * @param extraData Encoded option and stop-loss IDs
     * @return isValid Whether conditions are met
     */
    function _internalProtectedOptionPredicate(bytes calldata extraData) external view returns (bool isValid) {
        ProtectedOptionData memory optionData = _decodeExtraData(extraData);
        
        // Check if option is in the money
        bool inTheMoney = optionsCalculator.isInTheMoney(optionData.optionId);
        if (!inTheMoney) return false;
        
        // Check stop-loss conditions
        if (optionData.enforceStopLoss) {
            bool stopLossValid = stopLossProtection.stopLossPredicate(optionData.stopLossId);
            
            // Note: Event emission removed for view function compatibility
            
            if (!stopLossValid) return false;
        }
        
        return true;
    }
    
    /**
     * @dev Combined predicate that checks multiple stop-loss conditions
     * @param stopLossIds Array of stop-loss IDs to check
     * @param requireAll Whether all must be valid (true) or just one (false)
     * @return isValid Whether the conditions are met
     */
    function multiStopLossPredicate(
        bytes32[] calldata stopLossIds,
        bool requireAll
    ) external view returns (bool isValid) {
        return stopLossProtection.multiStopLossPredicate(stopLossIds, requireAll);
    }
    
    /**
     * @dev Simple stop-loss predicate for a single stop-loss ID
     * @param stopLossId Stop-loss configuration ID
     * @return isValid Whether the stop-loss condition is met
     */
    function singleStopLossPredicate(bytes32 stopLossId) external view returns (bool isValid) {
        return stopLossProtection.stopLossPredicate(stopLossId);
    }
    
    /**
     * @dev Time-based predicate that checks if current time is before expiration
     * @param expirationTime Expiration timestamp
     * @return isValid Whether current time is before expiration
     */
    function timeBasedPredicate(uint256 expirationTime) external view returns (bool isValid) {
        return block.timestamp < expirationTime;
    }
    
    /**
     * @dev Combination predicate for protected options with time and stop-loss
     * @param optionId Option configuration ID
     * @param stopLossId Stop-loss configuration ID
     * @param expirationTime Expiration timestamp
     * @return isValid Whether all conditions are met
     */
    function combinedProtectedOptionPredicate(
        bytes32 optionId,
        bytes32 stopLossId,
        uint256 expirationTime
    ) external view returns (bool isValid) {
        // Check time
        if (block.timestamp >= expirationTime) return false;
        
        // Check if option is in the money
        if (!optionsCalculator.isInTheMoney(optionId)) return false;
        
        // Check stop-loss
        if (!stopLossProtection.stopLossPredicate(stopLossId)) return false;
        
        return true;
    }
    
    /**
     * @dev Encodes protected option data for use in extra data
     * @param optionId Option configuration ID
     * @param stopLossId Stop-loss configuration ID
     * @param minPayoff Minimum acceptable payoff
     * @param enforceStopLoss Whether to enforce stop-loss check
     * @return encodedData Encoded data for use in 1inch orders
     */
    function encodeProtectedOptionData(
        bytes32 optionId,
        bytes32 stopLossId,
        uint256 minPayoff,
        bool enforceStopLoss
    ) external pure returns (bytes memory encodedData) {
        return abi.encode(
            ProtectedOptionData({
                optionId: optionId,
                stopLossId: stopLossId,
                minPayoff: minPayoff,
                enforceStopLoss: enforceStopLoss
            })
        );
    }
    
    /**
     * @dev Gets detailed status of a protected option for 1inch integration
     * @param optionId Option configuration ID
     * @param stopLossId Stop-loss configuration ID
     * @return canExecute Whether the option can be executed
     * @return currentPrice Current asset price
     * @return intrinsicValue Current intrinsic value
     * @return stopLossStatus Stop-loss status
     */
    function getProtectedOptionStatus(
        bytes32 optionId,
        bytes32 stopLossId
    ) external view returns (
        bool canExecute,
        uint256 currentPrice,
        uint256 intrinsicValue,
        bool stopLossStatus
    ) {
        // Check if option is in the money
        bool inTheMoney = optionsCalculator.isInTheMoney(optionId);
        
        // Get option values
        (intrinsicValue, currentPrice) = optionsCalculator.getIntrinsicValue(optionId);
        
        // Check stop-loss status
        stopLossStatus = stopLossProtection.stopLossPredicate(stopLossId);
        
        // Can execute if in the money and stop-loss is not triggered
        canExecute = inTheMoney && stopLossStatus;
    }
    
    /**
     * @dev Internal function to decode extra data
     * @param extraData Encoded protected option data
     * @return optionData Decoded protected option data
     */
    function _decodeExtraData(bytes calldata extraData) internal view returns (ProtectedOptionData memory optionData) {
        if (extraData.length == 0) revert InvalidExtraData();
        
        try this._safeDecode(extraData) returns (ProtectedOptionData memory decoded) {
            return decoded;
        } catch {
            revert InvalidExtraData();
        }
    }
    
    /**
     * @dev Safe decode function to handle potential decode errors
     * @param extraData Data to decode
     * @return optionData Decoded data
     */
    function _safeDecode(bytes calldata extraData) external pure returns (ProtectedOptionData memory optionData) {
        return abi.decode(extraData, (ProtectedOptionData));
    }
}

// Required struct for IAmountGetter interface compatibility
struct Order {
    uint256 salt;
    address maker;
    address receiver;
    address makerAsset;
    address takerAsset;
    uint256 makingAmount;
    uint256 takingAmount;
    uint256 makerTraits;
} 