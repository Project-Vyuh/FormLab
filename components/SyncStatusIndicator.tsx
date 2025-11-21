/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncStatus, useSyncActions } from '../contexts/SyncContext';
import { CloudIcon, AlertCircleIcon, WifiOffIcon, CheckCircleIcon, RefreshCwIcon, XCircleIcon } from './icons';

const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, lastSyncTime, syncError } = useSyncStatus();
  const { forceSyncNow, retrySyncError } = useSyncActions();
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Get status display info
   */
  const getStatusInfo = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: CloudIcon,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: 'Synced',
          description: 'All changes saved to cloud',
        };
      case 'syncing':
        return {
          icon: RefreshCwIcon,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          label: 'Syncing...',
          description: 'Uploading changes to cloud',
          animate: true,
        };
      case 'offline':
        return {
          icon: WifiOffIcon,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: 'Offline',
          description: 'No connection, will sync when online',
        };
      case 'error':
        return {
          icon: XCircleIcon,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Error',
          description: syncError || 'Sync failed, click to retry',
        };
      case 'conflict':
        return {
          icon: AlertCircleIcon,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10',
          borderColor: 'border-orange-500/30',
          label: 'Conflict',
          description: 'Changes conflict, click to resolve',
        };
      default:
        return {
          icon: CloudIcon,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: 'Unknown',
          description: 'Sync status unknown',
        };
    }
  };

  /**
   * Format last sync time
   */
  const formatLastSyncTime = () => {
    if (!lastSyncTime) return 'Never';

    const now = Date.now();
    const diff = now - lastSyncTime;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  /**
   * Handle click on indicator
   */
  const handleClick = async () => {
    if (syncStatus === 'error') {
      await retrySyncError();
    } else if (syncStatus === 'conflict') {
      // Conflict modal will be triggered by parent component
      // This just toggles details
      setShowDetails(!showDetails);
    } else {
      setShowDetails(!showDetails);
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <div className="relative">
      {/* Main Status Badge */}
      <button
        onClick={handleClick}
        onMouseEnter={() => !showDetails && setShowDetails(true)}
        onMouseLeave={() => setShowDetails(false)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${statusInfo.bgColor} ${statusInfo.borderColor} ${statusInfo.color} hover:scale-105`}
        title={statusInfo.description}
      >
        <StatusIcon
          className={`w-4 h-4 ${statusInfo.animate ? 'animate-spin' : ''}`}
        />
        <span className="text-sm font-medium">{statusInfo.label}</span>
      </button>

      {/* Details Tooltip */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl p-3 z-50"
            onMouseEnter={() => setShowDetails(true)}
            onMouseLeave={() => setShowDetails(false)}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <div className={`p-2 rounded-lg ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
                <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-200">
                  {statusInfo.label}
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {statusInfo.description}
                </p>
              </div>
            </div>

            {/* Last Sync Time */}
            {lastSyncTime && syncStatus !== 'error' && (
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 pb-2 border-b border-gray-700">
                <span>Last synced</span>
                <span className="text-gray-300">{formatLastSyncTime()}</span>
              </div>
            )}

            {/* Error Details */}
            {syncStatus === 'error' && syncError && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                {syncError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {syncStatus === 'error' && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    await retrySyncError();
                  }}
                  className="flex-1 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded transition-colors"
                >
                  Retry
                </button>
              )}
              {(syncStatus === 'synced' || syncStatus === 'offline') && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    // Note: forceSyncNow needs projectId, will be passed from parent
                    setShowDetails(false);
                  }}
                  className="flex-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs rounded transition-colors flex items-center justify-center gap-1"
                >
                  <RefreshCwIcon className="w-3 h-3" />
                  Sync Now
                </button>
              )}
            </div>

            {/* Help Text */}
            {syncStatus === 'synced' && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Changes auto-sync to cloud
              </p>
            )}
            {syncStatus === 'offline' && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Will sync when connection restored
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SyncStatusIndicator;
