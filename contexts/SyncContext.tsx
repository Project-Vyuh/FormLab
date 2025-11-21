/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { SyncStatus, Conflict, ProjectState } from '../types';
import { getSyncStatus, mergeProjectStates } from '../services/firestoreSync';
import { loadProjectState, saveProjectState } from '../services/dbService';

// =======================
// CONTEXT TYPES
// =======================

interface SyncContextType {
  syncStatus: SyncStatus;
  setSyncStatus: (status: SyncStatus) => void;
  lastSyncTime: number | null;
  setLastSyncTime: (time: number) => void;
  conflictData: ConflictData | null;
  setConflictData: (data: ConflictData | null) => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  syncError: string | null;
  setSyncError: (error: string | null) => void;

  // Actions
  forceSyncNow: (projectId: string) => Promise<void>;
  resolveConflict: (resolution: 'local' | 'remote' | 'merge') => Promise<void>;
  retrySyncError: () => Promise<void>;
  checkSyncStatus: (projectId: string) => Promise<void>;
}

interface ConflictData {
  projectId: string;
  local: ProjectState;
  remote: ProjectState;
  conflicts: Conflict[];
}

// =======================
// CREATE CONTEXT
// =======================

const SyncContext = createContext<SyncContextType | undefined>(undefined);

// =======================
// PROVIDER COMPONENT
// =======================

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [conflictData, setConflictData] = useState<ConflictData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  /**
   * Force immediate sync for a project
   */
  const forceSyncNow = useCallback(async (projectId: string) => {
    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setSyncError(null);

      console.log('[SyncContext] Force syncing project:', projectId);

      // Load current state from IndexedDB
      const state = await loadProjectState(projectId);
      if (!state) {
        throw new Error('Project not found');
      }

      // Trigger immediate save (which will sync to Firestore)
      await saveProjectState(projectId, state);

      setLastSyncTime(Date.now());
      setSyncStatus('synced');
      setIsSyncing(false);

      console.log('[SyncContext] Force sync completed');
    } catch (error) {
      console.error('[SyncContext] Force sync failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
      setSyncStatus('error');
      setIsSyncing(false);
    }
  }, []);

  /**
   * Resolve conflict with user's choice
   */
  const resolveConflict = useCallback(async (resolution: 'local' | 'remote' | 'merge') => {
    if (!conflictData) return;

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');

      console.log('[SyncContext] Resolving conflict with strategy:', resolution);

      let resolvedState: ProjectState;

      switch (resolution) {
        case 'local':
          resolvedState = mergeProjectStates(conflictData.local, conflictData.remote, 'prefer-local');
          break;
        case 'remote':
          resolvedState = mergeProjectStates(conflictData.local, conflictData.remote, 'prefer-remote');
          break;
        case 'merge':
          resolvedState = mergeProjectStates(conflictData.local, conflictData.remote, 'smart');
          break;
      }

      // Save resolved state
      await saveProjectState(conflictData.projectId, resolvedState);

      // Clear conflict
      setConflictData(null);
      setSyncStatus('synced');
      setLastSyncTime(Date.now());
      setIsSyncing(false);

      console.log('[SyncContext] Conflict resolved successfully');
    } catch (error) {
      console.error('[SyncContext] Failed to resolve conflict:', error);
      setSyncError(error instanceof Error ? error.message : 'Failed to resolve conflict');
      setSyncStatus('error');
      setIsSyncing(false);
    }
  }, [conflictData]);

  /**
   * Retry after sync error
   */
  const retrySyncError = useCallback(async () => {
    if (!conflictData?.projectId) return;

    try {
      setSyncError(null);
      await forceSyncNow(conflictData.projectId);
    } catch (error) {
      console.error('[SyncContext] Retry failed:', error);
      setSyncError(error instanceof Error ? error.message : 'Retry failed');
    }
  }, [conflictData, forceSyncNow]);

  /**
   * Check sync status for a project
   */
  const checkSyncStatus = useCallback(async (projectId: string) => {
    try {
      const status = await getSyncStatus(projectId);
      setSyncStatus(status);
    } catch (error) {
      console.error('[SyncContext] Failed to check sync status:', error);
      setSyncStatus('error');
    }
  }, []);

  /**
   * Update sync status when conflict data changes
   */
  useEffect(() => {
    if (conflictData) {
      setSyncStatus('conflict');
    }
  }, [conflictData]);

  /**
   * Auto-check online/offline status
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('[SyncContext] Network online');
      if (syncStatus === 'offline') {
        setSyncStatus('synced');
      }
    };

    const handleOffline = () => {
      console.log('[SyncContext] Network offline');
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial status
    if (!navigator.onLine) {
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncStatus]);

  const value: SyncContextType = {
    syncStatus,
    setSyncStatus,
    lastSyncTime,
    setLastSyncTime,
    conflictData,
    setConflictData,
    isSyncing,
    setIsSyncing,
    syncError,
    setSyncError,
    forceSyncNow,
    resolveConflict,
    retrySyncError,
    checkSyncStatus,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

// =======================
// CUSTOM HOOK
// =======================

/**
 * Hook to use sync context
 */
export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

// =======================
// HELPER HOOKS
// =======================

/**
 * Hook for components that just need to display sync status
 */
export const useSyncStatus = () => {
  const { syncStatus, lastSyncTime, syncError } = useSync();
  return { syncStatus, lastSyncTime, syncError };
};

/**
 * Hook for components that need to trigger sync actions
 */
export const useSyncActions = () => {
  const { forceSyncNow, resolveConflict, retrySyncError, checkSyncStatus } = useSync();
  return { forceSyncNow, resolveConflict, retrySyncError, checkSyncStatus };
};

/**
 * Hook for handling conflicts
 */
export const useConflictResolution = () => {
  const { conflictData, setConflictData, resolveConflict } = useSync();
  return { conflictData, setConflictData, resolveConflict };
};
