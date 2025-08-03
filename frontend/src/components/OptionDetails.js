import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAccount, useContractRead, useContractWrite, useNetwork } from 'wagmi';
import { toast } from 'react-hot-toast';
import { formatUnits, parseUnits } from 'ethers';
import { 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { getContractAddress, PROTECTED_OPTION_MANAGER_ABI } from '../contracts';

const OptionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  
  const [executionAmount, setExecutionAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Contract address
  const managerAddress = getContractAddress(chain?.id, 'PROTECTED_OPTION_MANAGER');

  // Sample option data (in real app, fetch from contracts/events on Polygon)
  const sampleOption = {
    id: id,
    type: 'CALL',
    strikePrice: '3400', // ETH strike price in USD
    currentPrice: '3450', // Current ETH price moved up  
    premium: '50',
    collateral: '1.0',
    asset: 'WETH/USDC', // Real Polygon tokens
    expires: new Date(Date.now() + 2700000), // 45 minutes from now
    status: 'ACTIVE',
    isInMoney: true,
    stopLossPrice: '3200', // Stop loss at $3200
    stopLossTriggered: false,
    intrinsicValue: '50', // $3450 - $3400 = $50
    maker: '0x1234...5678',
    createdAt: new Date(Date.now() - 900000), // 15 minutes ago
    maxLoss: '5',
    payoff: '50'
  };

  // Read option data from contract (placeholder)
  const { data: optionData, refetch: refetchOption } = useContractRead({
    address: managerAddress,
    abi: PROTECTED_OPTION_MANAGER_ABI,
    functionName: 'getProtectedOption',
    args: [id],
    enabled: !!managerAddress && !!id,
  });

  // Check if can execute
  const { data: canExecuteData } = useContractRead({
    address: managerAddress,
    abi: PROTECTED_OPTION_MANAGER_ABI,
    functionName: 'canExecuteOption',
    args: [id],
    enabled: !!managerAddress && !!id,
  });

  // Execute option
  const { write: executeOption, isLoading: isExecuting } = useContractWrite({
    address: managerAddress,
    abi: PROTECTED_OPTION_MANAGER_ABI,
    functionName: 'executeProtectedOption',
    args: [id, parseUnits(executionAmount || '0', 18)],
    onSuccess: () => {
      toast.success('Option executed successfully!');
      refetchOption();
    },
    onError: (error) => {
      toast.error('Failed to execute option: ' + error.message);
    },
  });

  // Cancel option
  const { write: cancelOption, isLoading: isCancelling } = useContractWrite({
    address: managerAddress,
    abi: PROTECTED_OPTION_MANAGER_ABI,
    functionName: 'cancelProtectedOption',
    args: [id],
    onSuccess: () => {
      toast.success('Option cancelled successfully!');
      refetchOption();
    },
    onError: (error) => {
      toast.error('Failed to cancel option: ' + error.message);
    },
  });

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (option) => {
    if (option.stopLossTriggered) return 'text-red-600 bg-red-50';
    if (option.status === 'EXECUTED') return 'text-green-600 bg-green-50';
    if (option.status === 'EXPIRED') return 'text-gray-600 bg-gray-50';
    if (option.isInMoney) return 'text-green-600 bg-green-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getPayoffColor = (value) => {
    const numValue = parseFloat(value);
    if (numValue > 0) return 'text-green-600';
    if (numValue < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      await refetchOption();
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Connect Your Wallet</h3>
          <p className="text-gray-500 mb-6">Connect your wallet to view option details.</p>
        </div>
      </div>
    );
  }

  const option = sampleOption; // Use sample data for demonstration (will be replaced with real contract data)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Dashboard
        </button>
        
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Option Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Option Overview */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {option.asset} {option.type} Option
                </h1>
                <p className="text-sm text-gray-500">ID: {option.id}</p>
              </div>
              
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(option)}`}>
                {option.stopLossTriggered ? (
                  <XCircleIcon className="w-4 h-4 mr-1" />
                ) : option.isInMoney ? (
                  <CheckCircleIcon className="w-4 h-4 mr-1" />
                ) : (
                  <ClockIcon className="w-4 h-4 mr-1" />
                )}
                {option.stopLossTriggered ? 'Stop-Loss Triggered' : 
                 option.isInMoney ? 'In The Money' : option.status}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Strike Price</p>
                <p className="text-lg font-semibold">{formatPrice(option.strikePrice)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Current Price</p>
                <div className="flex items-center">
                  <p className="text-lg font-semibold">{formatPrice(option.currentPrice)}</p>
                  {parseFloat(option.currentPrice) > parseFloat(option.strikePrice) ? (
                    <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 ml-1" />
                  ) : (
                    <ArrowTrendingDownIcon className="w-4 h-4 text-red-500 ml-1" />
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Intrinsic Value</p>
                <p className={`text-lg font-semibold ${getPayoffColor(option.intrinsicValue)}`}>
                  {formatPrice(option.intrinsicValue)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Collateral</p>
                <p className="text-lg font-semibold">{option.collateral} WETH</p>
              </div>
            </div>
          </div>

          {/* Price Chart Placeholder */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Price Movement</h3>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowTrendingUpIcon className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-500">Price chart would be displayed here</p>
                <p className="text-sm text-gray-400 mt-1">Integration with price feeds coming soon</p>
              </div>
            </div>
          </div>

          {/* Option Timeline */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Option Created</p>
                  <p className="text-sm text-gray-500">{option.createdAt.toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <ClockIcon className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Expires</p>
                  <p className="text-sm text-gray-500">{option.expires.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {/* Stop-Loss Protection */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Stop-Loss Protection</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Stop-Loss Price</span>
                <span className="text-sm font-medium">{formatPrice(option.stopLossPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Max Loss</span>
                <span className="text-sm font-medium">{option.maxLoss}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`text-sm font-medium ${option.stopLossTriggered ? 'text-red-600' : 'text-green-600'}`}>
                  {option.stopLossTriggered ? 'Triggered' : 'Active'}
                </span>
              </div>
            </div>

            {option.stopLossTriggered && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                  <div className="ml-3">
                    <p className="text-sm text-red-700">
                      Stop-loss has been triggered. Option is protected from further losses.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Actions</h3>

            {option.status === 'ACTIVE' && !option.stopLossTriggered && (
              <div className="space-y-4">
                {option.isInMoney && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Execution Amount (USDC)
                    </label>
                    <input
                      type="number"
                      value={executionAmount}
                      onChange={(e) => setExecutionAmount(e.target.value)}
                      placeholder="2200.00"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => executeOption?.()}
                      disabled={!executeOption || isExecuting || !executionAmount}
                      className="w-full mt-2 bg-green-600 text-white py-2 px-4 rounded-md font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isExecuting ? 'Executing...' : 'Execute Option'}
                    </button>
                  </div>
                )}

                <button
                  onClick={() => cancelOption?.()}
                  disabled={!cancelOption || isCancelling}
                  className="w-full bg-red-600 text-white py-2 px-4 rounded-md font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Option'}
                </button>
              </div>
            )}

            {option.stopLossTriggered && (
              <button
                onClick={() => cancelOption?.()}
                disabled={!cancelOption || isCancelling}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700 disabled:bg-gray-300"
              >
                {isCancelling ? 'Processing...' : 'Claim Collateral'}
              </button>
            )}

            {(option.status === 'EXECUTED' || option.status === 'EXPIRED') && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">
                  This option has been {option.status.toLowerCase()}.
                </p>
              </div>
            )}
          </div>

          {/* Option Details */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Details</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Maker</span>
                <span className="font-mono">{option.maker}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Premium</span>
                <span>{option.premium} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time Left</span>
                <span>
                  {option.expires > new Date() 
                    ? Math.round((option.expires - new Date()) / 60000) + ' minutes'
                    : 'Expired'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionDetails; 