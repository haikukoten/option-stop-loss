import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, useContractWrite, useContractRead, useNetwork, usePrepareContractWrite } from 'wagmi';
import { parseUnits, formatUnits } from 'ethers';
import { toast } from 'react-hot-toast';
import { InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { getContractAddress, PROTECTED_OPTION_MANAGER_ABI, MOCK_ERC20_ABI } from '../contracts';

const CreateOption = () => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  
  // Form state
  const [formData, setFormData] = useState({
    optionType: 'call',
    strikePrice: '2100',
    premium: '50',
    duration: '3600', // 1 hour in seconds
    collateralAmount: '1',
    stopLossPrice: '1950',
    maxLoss: '500', // 5% in basis points
  });

  const [selectedAssets, setSelectedAssets] = useState({
    collateral: 'WETH',
    payment: 'USDC'
  });

  const [loading, setLoading] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [retryCount, setRetryCount] = useState(0);

  // Safe parsing function to handle empty values
  const safeParseUnits = (value, decimals = 18) => {
    if (!value || value === '' || isNaN(value)) return 0;
    try {
      return parseUnits(value, decimals);
    } catch (error) {
      console.warn('Parse error:', error);
      return 0;
    }
  };

  // Validate all required form fields
  const isFormValid = () => {
    return formData.strikePrice && 
           formData.premium && 
           formData.collateralAmount && 
           formData.stopLossPrice && 
           formData.duration && 
           formData.maxLoss &&
           parseFloat(formData.strikePrice) > 0 &&
           parseFloat(formData.premium) > 0 &&
           parseFloat(formData.collateralAmount) > 0 &&
           parseFloat(formData.stopLossPrice) > 0;
  };

  // Contract addresses
  const managerAddress = getContractAddress(chain?.id, 'PROTECTED_OPTION_MANAGER');
  const wethAddress = getContractAddress(chain?.id, 'WETH') || getContractAddress(chain?.id, 'MOCK_WETH');
  const usdcAddress = getContractAddress(chain?.id, 'USDC') || getContractAddress(chain?.id, 'MOCK_USDC');
  const oracleAddress = getContractAddress(chain?.id, 'ETH_USD_ORACLE') || getContractAddress(chain?.id, 'MOCK_ORACLE');

  // Standard ERC20 ABI for real tokens
  const ERC20_ABI = [
    {
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "balance", "type": "uint256"}],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [{"name": "_owner", "type": "address"}, {"name": "_spender", "type": "address"}],
      "name": "allowance",
      "outputs": [{"name": "remaining", "type": "uint256"}],
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [{"name": "_spender", "type": "address"}, {"name": "_value", "type": "uint256"}],
      "name": "approve",
      "outputs": [{"name": "success", "type": "bool"}],
      "type": "function"
    }
  ];

  // Debug logging (reduced frequency)
  useEffect(() => {
    if (address && chain?.id) {
      console.log('🔍 Debug Info:', {
        chainId: chain?.id,
        address,
        wethAddress,
        usdcAddress,
        managerAddress,
        isConnected: !!address
      });
    }
  }, [address, chain?.id, wethAddress, usdcAddress, managerAddress]);

  // Read token balances
  const { data: wethBalance, error: wethError } = useContractRead({
    address: wethAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address && !!wethAddress,
    watch: true,
  });

  const { data: usdcBalance, error: usdcError } = useContractRead({
    address: usdcAddress, 
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address && !!usdcAddress,
    watch: true,
  });

  // Check allowances
  const { data: wethAllowance } = useContractRead({
    address: wethAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address, managerAddress],
    enabled: !!address && !!wethAddress && !!managerAddress,
    watch: true,
  });

  // Debug balance info (reduced frequency)
  useEffect(() => {
    if (wethBalance || usdcBalance) {
      console.log('💰 Balance Info:', {
        wethBalance: wethBalance ? formatUnits(wethBalance, 18) : 'none',
        usdcBalance: usdcBalance ? formatUnits(usdcBalance, 6) : 'none', 
        wethError: wethError?.message,
        usdcError: usdcError?.message
      });
    }
  }, [wethBalance, usdcBalance, wethError, usdcError]);

  // Prepare contract write
  const { config } = usePrepareContractWrite({
    address: managerAddress,
    abi: PROTECTED_OPTION_MANAGER_ABI,
    functionName: 'createProtectedOption',
    args: [
      formData.optionType === 'call',
      safeParseUnits(formData.strikePrice, 8), // Strike price with 8 decimals
      safeParseUnits(formData.premium, selectedAssets.payment === 'USDC' ? 6 : 18), // Premium with proper decimals
      parseInt(formData.duration) || 0,
      selectedAssets.collateral === 'WETH' ? wethAddress : usdcAddress,
      selectedAssets.payment === 'USDC' ? usdcAddress : wethAddress,
      safeParseUnits(formData.collateralAmount, 18),
      safeParseUnits((parseFloat(formData.strikePrice || 0) * parseFloat(formData.collateralAmount || 0)).toString(), 18),
      safeParseUnits(formData.stopLossPrice, 8),
      parseInt(formData.maxLoss) || 0,
      oracleAddress
    ],
    enabled: !!managerAddress && !!wethAddress && !!usdcAddress && !!oracleAddress && isFormValid() && !!address && chain?.id === 137,
  });

  const { write: createOption, isLoading: isCreating } = useContractWrite({
    ...config,
    onSuccess: (data) => {
      toast.success('Protected option created successfully!');
      console.log('Transaction hash:', data.hash);
    },
    onError: (error) => {
      toast.error('Failed to create option: ' + error.message);
      console.error('Error:', error);
    },
  });

  // WETH Approval Configuration
  const { config: approveConfig } = usePrepareContractWrite({
    address: wethAddress,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [managerAddress, safeParseUnits(formData.collateralAmount, 18)],
    enabled: !!wethAddress && !!managerAddress && !!address && isFormValid(),
  });

  const { write: approveWeth, isLoading: isApproving } = useContractWrite({
    ...approveConfig,
    onSuccess: (data) => {
      toast.success('WETH approval successful! You can now create the option.');
      console.log('WETH approved:', data.hash);
      setRetryCount(0); // Reset retry count on success
    },
    onError: (error) => {
      console.error('Approval error:', error);
      
      // Handle specific circuit breaker error
      if (error.message.includes('circuit breaker is open') || 
          error.message.includes('internal error') ||
          error.message.includes('rate limit')) {
        
        if (retryCount < 2) {
          toast.error(`⚠️ Network congestion detected. Retrying in ${(retryCount + 1) * 2} seconds... (${retryCount + 1}/3)`, {
            duration: 3000,
          });
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            approveWeth?.();
          }, (retryCount + 1) * 2000); // Exponential backoff: 2s, 4s, 6s
        } else {
          toast.error('⚠️ Network is very congested. Please try again in a few minutes. Check status.polygon.technology for network issues.', {
            duration: 10000,
          });
          setRetryCount(0);
        }
      } else if (error.message.includes('user rejected')) {
        toast.error('Transaction cancelled by user.');
        setRetryCount(0);
      } else {
        toast.error('Failed to approve WETH: ' + (error.shortMessage || error.message));
        setRetryCount(0);
      }
    },
  });

  // Manual retry function for button click
  const handleApproveWithRetry = useCallback(() => {
    setRetryCount(0);
    approveWeth?.();
  }, [approveWeth]);

  // Handle form changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate estimated costs
  useEffect(() => {
    const collateralValue = parseFloat(formData.collateralAmount) * parseFloat(formData.strikePrice);
    setEstimatedCost(collateralValue.toString());
  }, [formData.collateralAmount, formData.strikePrice]);

  // Format balance display
  const formatBalance = (balance, decimals = 18) => {
    if (!balance) return '0';
    return parseFloat(formatUnits(balance, decimals)).toFixed(4);
  };

  // Check if user has sufficient balance
  const hasEnoughBalance = () => {
    if (!isFormValid()) return false;
    
    // Handle cases where balances might be undefined or zero
    const wethBal = wethBalance || 0n;
    const usdcBal = usdcBalance || 0n; 
    
    const requiredWeth = safeParseUnits(formData.collateralAmount, 18);
    const requiredUsdc = safeParseUnits(formData.premium, 6); // USDC has 6 decimals
    
    // Only log balance checks when there's an issue or when form is first validated
    const hasEnough = wethBal >= requiredWeth && usdcBal >= requiredUsdc;
    if (!hasEnough || !window.lastBalanceCheck || Date.now() - window.lastBalanceCheck > 5000) {
      console.log('💰 Balance Check:', {
        wethBalance: formatUnits(wethBal, 18),
        usdcBalance: formatUnits(usdcBal, 6),
        requiredWeth: formatUnits(requiredWeth, 18),
        requiredUsdc: formatUnits(requiredUsdc, 6),
        hasEnoughWeth: wethBal >= requiredWeth,
        hasEnoughUsdc: usdcBal >= requiredUsdc
      });
      window.lastBalanceCheck = Date.now();
    }
    
    return wethBal >= requiredWeth && usdcBal >= requiredUsdc;
  };

  // Check if allowance is sufficient
  const hasEnoughAllowance = () => {
    if (!wethAllowance || !isFormValid()) return false;
    const requiredAllowance = safeParseUnits(formData.collateralAmount, 18);
    return wethAllowance >= requiredAllowance;
  };

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500 mb-6">Connect your wallet to create protected options.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Create Protected Option</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create an option with built-in stop-loss protection
          </p>
        </div>

        <form className="p-6 space-y-6">
          {/* Option Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Option Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleInputChange('optionType', 'call')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  formData.optionType === 'call'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium">Call Option</div>
                  <div className="text-xs text-gray-500 mt-1">Profit when price goes up</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleInputChange('optionType', 'put')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  formData.optionType === 'put'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="font-medium">Put Option</div>
                  <div className="text-xs text-gray-500 mt-1">Profit when price goes down</div>
                </div>
              </button>
            </div>
          </div>

          {/* Strike Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Strike Price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.strikePrice}
              onChange={(e) => handleInputChange('strikePrice', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="2100.00"
            />
          </div>

          {/* Collateral Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Collateral Amount (WETH)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.001"
                value={formData.collateralAmount}
                onChange={(e) => handleInputChange('collateralAmount', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="1.0"
              />
              {wethBalance && (
                <div className="text-sm text-gray-500 mt-1">
                  Balance: {formatBalance(wethBalance)} WETH
                </div>
              )}
            </div>
          </div>

          {/* Premium */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Premium (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.premium}
              onChange={(e) => handleInputChange('premium', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="50.00"
            />
          </div>

          {/* Stop-Loss Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stop-Loss Price (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.stopLossPrice}
              onChange={(e) => handleInputChange('stopLossPrice', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1950.00"
            />
            <div className="text-sm text-gray-500 mt-1">
              Option will be automatically cancelled if price hits this level
            </div>
          </div>

          {/* Max Loss */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Loss (%)
            </label>
            <select
              value={formData.maxLoss}
              onChange={(e) => handleInputChange('maxLoss', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="250">2.5%</option>
              <option value="500">5%</option>
              <option value="750">7.5%</option>
              <option value="1000">10%</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration
            </label>
            <select
              value={formData.duration}
              onChange={(e) => handleInputChange('duration', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="3600">1 Hour</option>
              <option value="7200">2 Hours</option>
              <option value="14400">4 Hours</option>
              <option value="86400">1 Day</option>
              <option value="604800">1 Week</option>
            </select>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Option Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-medium capitalize">{formData.optionType} Option</span>
              </div>
              <div className="flex justify-between">
                <span>Strike Price:</span>
                <span className="font-medium">${formData.strikePrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Collateral:</span>
                <span className="font-medium">{formData.collateralAmount} WETH</span>
              </div>
              <div className="flex justify-between">
                <span>Stop-Loss:</span>
                <span className="font-medium">${formData.stopLossPrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Value:</span>
                <span className="font-medium">${estimatedCost}</span>
              </div>
            </div>
          </div>

          {/* Balance Display */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Your Balances</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">WETH:</span>
                <span className="ml-2 font-mono">
                  {wethBalance ? formatUnits(wethBalance, 18) : '0'} WETH
                </span>
                {wethError && <p className="text-red-500 text-xs">Error: {wethError.message}</p>}
              </div>
              <div>
                <span className="text-blue-700">USDC:</span>
                <span className="ml-2 font-mono">
                  {usdcBalance ? formatUnits(usdcBalance, 6) : '0'} USDC
                </span>
                {usdcError && <p className="text-red-500 text-xs">Error: {usdcError.message}</p>}
              </div>
            </div>
            <div className="mt-2 text-xs text-blue-600">
              <div>Chain: {chain?.name || 'Unknown'} (ID: {chain?.id || 'N/A'})</div>
              <div>WETH: {wethAddress || 'Not found'}</div>
              <div>USDC: {usdcAddress || 'Not found'}</div>
              <div>Manager: {managerAddress || 'Not found'}</div>
            </div>
          </div>

          {/* Network Warning */}
          {chain?.id !== 137 && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <InformationCircleIcon className="w-5 h-5 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    ⚠️ You're not on Polygon network. Please switch to Polygon for real trading.
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Current: {chain?.name} (ID: {chain?.id}). Required: Polygon (ID: 137)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Network Status */}
          {chain?.id === 137 && retryCount > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-4">
              <div className="flex">
                <InformationCircleIcon className="w-5 h-5 text-orange-400" />
                <div className="ml-3">
                  <p className="text-sm text-orange-700">
                    🌐 Polygon network is experiencing congestion. Transactions may take longer than usual.
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Retry {retryCount}/3 - Auto-retrying with exponential backoff
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {!hasEnoughBalance() && isFormValid() && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">
                    Insufficient balance. Required: {formData.collateralAmount} WETH and {formData.premium} USDC
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Your balance: {wethBalance ? formatUnits(wethBalance, 18) : '0'} WETH, {usdcBalance ? formatUnits(usdcBalance, 6) : '0'} USDC
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasEnoughAllowance() && hasEnoughBalance() && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex justify-between items-start">
                <div className="flex">
                  <InformationCircleIcon className="w-5 h-5 text-yellow-400" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      You need to approve WETH spending first.
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      This allows the contract to use your WETH for creating options.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApproveWithRetry}
                  disabled={!approveWeth || isApproving}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isApproving ? (retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Approving...') : 'Approve WETH'}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => createOption?.()}
            disabled={!createOption || isCreating || !hasEnoughBalance() || !hasEnoughAllowance()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creating Option...' : 'Create Protected Option'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateOption; 