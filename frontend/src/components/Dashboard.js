import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useContractRead, useNetwork } from 'wagmi';
import { formatEther, parseUnits } from 'ethers';
import { ArrowUpIcon, ArrowDownIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { getContractAddress, PROTECTED_OPTION_MANAGER_ABI, OPTIONS_CALCULATOR_ABI } from '../contracts';

const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Mock data for demonstration (in real app, this would come from events/subgraph)
  // Sample options data - will be replaced with real blockchain data on Polygon
  const sampleOptions = [
    {
      id: '0x1234...abcd',
      type: 'CALL',
      strikePrice: '3400', // ETH price in USD
      currentPrice: '3350',
      premium: '50',
      collateral: '1.0',
      asset: 'WETH/USDC', // Real Polygon tokens
      expires: new Date(Date.now() + 3600000), // 1 hour from now
      status: 'ACTIVE',
      isInMoney: false,
      stopLossPrice: '3200',
      stopLossTriggered: false,
      intrinsicValue: '0'
    },
    {
      id: '0x5678...efgh',
      type: 'PUT',
      strikePrice: '0.85', // MATIC price in USD  
      currentPrice: '0.90',
      premium: '0.05',
      collateral: '100',
      asset: 'WMATIC/USDC', // Real Polygon tokens
      expires: new Date(Date.now() + 7200000), // 2 hours from now
      status: 'ACTIVE',
      isInMoney: false,
      stopLossPrice: '0.95',
      stopLossTriggered: false,
      intrinsicValue: '0'
    }
  ];

  useEffect(() => {
    if (isConnected && chain) {
      setOptions(sampleOptions);
    }
  }, [isConnected, chain]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getStatusColor = (status, isInMoney, stopLossTriggered) => {
    if (stopLossTriggered) return 'text-red-600 bg-red-50';
    if (status === 'EXECUTED') return 'text-green-600 bg-green-50';
    if (status === 'EXPIRED') return 'text-gray-600 bg-gray-50';
    if (isInMoney) return 'text-green-600 bg-green-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getStatusIcon = (status, isInMoney, stopLossTriggered) => {
    if (stopLossTriggered) return <XCircleIcon className="w-4 h-4" />;
    if (status === 'EXECUTED') return <CheckCircleIcon className="w-4 h-4" />;
    if (status === 'EXPIRED') return <ClockIcon className="w-4 h-4" />;
    return <ClockIcon className="w-4 h-4" />;
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
          <p className="text-gray-500 mb-6">Connect your wallet to view and manage your protected options.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Protected Options Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage your options with built-in stop-loss protection</p>
        </div>
        <Link
          to="/create"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Create New Option
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowUpIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Options</p>
              <p className="text-2xl font-semibold text-gray-900">{options.filter(o => o.status === 'ACTIVE').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In The Money</p>
              <p className="text-2xl font-semibold text-gray-900">{options.filter(o => o.isInMoney).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Stop-Loss Triggered</p>
              <p className="text-2xl font-semibold text-gray-900">{options.filter(o => o.stopLossTriggered).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ArrowDownIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatPrice(options.reduce((sum, o) => sum + parseFloat(o.collateral) * parseFloat(o.currentPrice), 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Options List */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Your Protected Options</h2>
        </div>

        {options.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClockIcon className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">No options yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first protected option to get started.</p>
            <Link
              to="/create"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200"
            >
              Create Option
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Option
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type & Strike
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stop-Loss
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {options.map((option) => (
                  <tr key={option.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{option.asset}</div>
                        <div className="text-sm text-gray-500">ID: {option.id}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${
                          option.type === 'CALL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {option.type}
                        </span>
                        <span className="text-sm text-gray-900">{formatPrice(option.strikePrice)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(option.currentPrice)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatPrice(option.stopLossPrice)}</div>
                      {option.stopLossTriggered && (
                        <div className="text-xs text-red-600">Triggered</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {option.expires.toLocaleDateString()} {option.expires.toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(option.status, option.isInMoney, option.stopLossTriggered)}`}>
                        {getStatusIcon(option.status, option.isInMoney, option.stopLossTriggered)}
                        <span className="ml-1">
                          {option.stopLossTriggered ? 'Stop-Loss' : option.isInMoney ? 'In Money' : option.status}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`/option/${option.id}`}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </Link>
                      {option.status === 'ACTIVE' && option.isInMoney && !option.stopLossTriggered && (
                        <button className="text-green-600 hover:text-green-900">
                          Execute
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 