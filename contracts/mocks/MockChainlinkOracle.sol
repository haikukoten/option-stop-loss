// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockChainlinkOracle
 * @dev Mock Chainlink oracle for testing purposes
 */
contract MockChainlinkOracle is AggregatorV3Interface {
    int256 private _latestPrice;
    uint256 private _latestTimestamp;
    uint8 private _decimals;
    uint80 private _latestRoundId;
    bool private _isStale;

    string private constant _description = "Mock Oracle";
    uint256 private constant _version = 1;

    constructor(int256 initialPrice, uint8 decimals_) {
        _latestPrice = initialPrice;
        _latestTimestamp = block.timestamp;
        _decimals = decimals_;
        _latestRoundId = 1;
        _isStale = false;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return _description;
    }

    function version() external pure override returns (uint256) {
        return _version;
    }

    function getRoundData(uint80 _roundId)
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (_roundId == _latestRoundId) {
            return latestRoundData();
        }
        
        // Return mock historical data
        return (
            _roundId,
            _latestPrice,
            _latestTimestamp,
            _latestTimestamp,
            _roundId
        );
    }

    function latestRoundData()
        public
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        uint256 timestamp = _isStale ? block.timestamp - 7200 : _latestTimestamp; // 2 hours ago if stale
        
        return (
            _latestRoundId,
            _latestPrice,
            timestamp,
            timestamp,
            _latestRoundId
        );
    }

    // Test helper functions
    function setLatestPrice(int256 newPrice) external {
        _latestPrice = newPrice;
        _latestTimestamp = block.timestamp;
        _latestRoundId++;
        _isStale = false;
    }

    function setStalePrice() external {
        _isStale = true;
    }

    function setFreshPrice() external {
        _isStale = false;
        _latestTimestamp = block.timestamp;
    }

    function setLatestTimestamp(uint256 timestamp) external {
        _latestTimestamp = timestamp;
    }

    function getCurrentPrice() external view returns (int256) {
        return _latestPrice;
    }

    function setDecimals(uint8 newDecimals) external {
        _decimals = newDecimals;
    }
} 