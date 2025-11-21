/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConflictResolution } from '../contexts/SyncContext';
import { AlertCircleIcon, CheckCircleIcon, XIcon, MonitorIcon, CloudIcon, GitMergeIcon } from './icons';
import { MergeStrategy } from '../types';

const ConflictResolutionModal: React.FC = () => {
  const { conflictData, setConflictData, resolveConflict } = useConflictResolution();
  const [selectedStrategy, setSelectedStrategy] = useState<MergeStrategy | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  if (!conflictData) return null;

  const { local, remote, conflicts } = conflictData;

  /**
   * Format timestamp
   */
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;

    return date.toLocaleString();
  };

  /**
   * Get conflict summary
   */
  const getConflictSummary = () => {
    const summary: string[] = [];

    conflicts.forEach(conflict => {
      switch (conflict.field) {
        case 'modelDescription':
          summary.push('Model description changed');
          break;
        case 'revisionPrompt':
          summary.push('Revision prompt changed');
          break;
        case 'generatedModelHistory':
          const uniqueLocal = conflict.local?.length || 0;
          const uniqueRemote = conflict.remote?.length || 0;
          if (uniqueLocal > 0) summary.push(`${uniqueLocal} new local items`);
          if (uniqueRemote > 0) summary.push(`${uniqueRemote} new cloud items`);
          break;
        default:
          summary.push(`${conflict.field} changed`);
      }
    });

    return summary;
  };

  /**
   * Handle resolution
   */
  const handleResolve = async (strategy: 'local' | 'remote' | 'merge') => {
    setIsResolving(true);
    setSelectedStrategy(strategy);

    try {
      await resolveConflict(strategy);
      // Modal will close automatically when conflictData is cleared
    } catch (error) {
      console.error('[ConflictResolutionModal] Resolution failed:', error);
      setIsResolving(false);
      setSelectedStrategy(null);
    }
  };

  /**
   * Close modal
   */
  const handleClose = () => {
    if (!isResolving) {
      setConflictData(null);
    }
  };

  const conflictSummary = getConflictSummary();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-700">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <AlertCircleIcon className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-200">
                  Sync Conflict Detected
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Changes on this device conflict with cloud data
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isResolving}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <XIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Conflict Summary */}
          <div className="p-6 border-b border-gray-700 bg-orange-500/5">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Conflicts Found:</h3>
            <ul className="space-y-1">
              {conflictSummary.map((item, index) => (
                <li key={index} className="text-sm text-gray-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Comparison */}
          <div className="p-6 grid grid-cols-2 gap-6 max-h-64 overflow-y-auto">
            {/* Local (This Device) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MonitorIcon className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-gray-200">This Device</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Modified:</span>
                  <span className="text-gray-300">{formatTime(local.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">History items:</span>
                  <span className="text-gray-300">
                    {local.generatedModelHistory?.length || 0}
                  </span>
                </div>
                {local.stylingHistory && Object.keys(local.stylingHistory).length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Try-ons:</span>
                    <span className="text-gray-300">
                      {Object.values(local.stylingHistory).reduce((sum, items) => sum + items.length, 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Wardrobe items:</span>
                  <span className="text-gray-300">{local.wardrobe?.length || 0}</span>
                </div>
              </div>

              {conflicts.some(c => c.field === 'modelDescription') && (
                <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                  <p className="text-xs text-gray-400 mb-1">Description:</p>
                  <p className="text-xs text-gray-300 line-clamp-2">
                    {local.modelDescription || '(empty)'}
                  </p>
                </div>
              )}
            </div>

            {/* Remote (Cloud) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CloudIcon className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-gray-200">Cloud</h3>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Modified:</span>
                  <span className="text-gray-300">{formatTime(remote.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">History items:</span>
                  <span className="text-gray-300">
                    {remote.generatedModelHistory?.length || 0}
                  </span>
                </div>
                {remote.stylingHistory && Object.keys(remote.stylingHistory).length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Try-ons:</span>
                    <span className="text-gray-300">
                      {Object.values(remote.stylingHistory).reduce((sum, items) => sum + items.length, 0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Wardrobe items:</span>
                  <span className="text-gray-300">{remote.wardrobe?.length || 0}</span>
                </div>
              </div>

              {conflicts.some(c => c.field === 'modelDescription') && (
                <div className="mt-3 p-2 bg-purple-500/10 border border-purple-500/30 rounded">
                  <p className="text-xs text-gray-400 mb-1">Description:</p>
                  <p className="text-xs text-gray-300 line-clamp-2">
                    {remote.modelDescription || '(empty)'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Resolution Options */}
          <div className="p-6 border-t border-gray-700 space-y-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Choose Resolution:
            </h3>

            {/* Keep Local */}
            <button
              onClick={() => handleResolve('local')}
              disabled={isResolving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-all ${
                isResolving && selectedStrategy === 'local'
                  ? 'bg-blue-500/20 border-blue-500'
                  : 'bg-blue-500/5 border-blue-500/30 hover:bg-blue-500/10'
              } disabled:opacity-50`}
            >
              <MonitorIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-left flex-1">
                <div className="font-medium text-gray-200 text-sm">Keep This Device</div>
                <div className="text-xs text-gray-400 mt-1">
                  Discard cloud changes and use local version
                </div>
              </div>
              {isResolving && selectedStrategy === 'local' && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent" />
              )}
            </button>

            {/* Keep Remote */}
            <button
              onClick={() => handleResolve('remote')}
              disabled={isResolving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-all ${
                isResolving && selectedStrategy === 'remote'
                  ? 'bg-purple-500/20 border-purple-500'
                  : 'bg-purple-500/5 border-purple-500/30 hover:bg-purple-500/10'
              } disabled:opacity-50`}
            >
              <CloudIcon className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <div className="text-left flex-1">
                <div className="font-medium text-gray-200 text-sm">Keep Cloud</div>
                <div className="text-xs text-gray-400 mt-1">
                  Discard local changes and use cloud version
                </div>
              </div>
              {isResolving && selectedStrategy === 'remote' && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-400 border-t-transparent" />
              )}
            </button>

            {/* Smart Merge */}
            <button
              onClick={() => handleResolve('merge')}
              disabled={isResolving}
              className={`w-full flex items-start gap-3 p-4 rounded-lg border transition-all ${
                isResolving && selectedStrategy === 'merge'
                  ? 'bg-green-500/20 border-green-500'
                  : 'bg-green-500/5 border-green-500/30 hover:bg-green-500/10'
              } disabled:opacity-50`}
            >
              <GitMergeIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div className="text-left flex-1">
                <div className="font-medium text-gray-200 text-sm flex items-center gap-2">
                  Smart Merge
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                    Recommended
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Automatically combine both versions, keeping all unique changes
                </div>
              </div>
              {isResolving && selectedStrategy === 'merge' && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-green-400 border-t-transparent" />
              )}
            </button>
          </div>

          {/* Footer Help Text */}
          <div className="px-6 pb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
              <p className="text-xs text-gray-400 leading-relaxed">
                <strong className="text-gray-300">Tip:</strong> Smart Merge is usually the best choice.
                It combines history items from both versions and keeps the latest metadata.
                No data will be lost.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ConflictResolutionModal;
