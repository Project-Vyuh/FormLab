/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useSync } from '../contexts/SyncContext';
import { subscribeToProject, detectConflicts, mergeProjectStates } from '../services/firestoreSync';
import { loadProjectState, saveProjectState } from '../services/dbService';
import { User } from '../types';

interface ProjectSyncListenerProps {
  projectId: string | null;
  currentUser: User | null;
}

/**
 * Component that sets up real-time sync listener for the current project
 * Must be used inside SyncProvider to access sync context
 */
const ProjectSyncListener: React.FC<ProjectSyncListenerProps> = ({ projectId, currentUser }) => {
  const { setConflictData, setSyncStatus, setLastSyncTime } = useSync();

  useEffect(() => {
    if (!projectId || !currentUser) return;

    console.log('[ProjectSyncListener] Setting up real-time listener for project:', projectId);
    setSyncStatus('syncing');

    const unsubscribe = subscribeToProject(
      projectId,
      currentUser.uid,
      async (remoteState) => {
        if (!remoteState) {
          setSyncStatus('synced');
          return;
        }

        try {
          // Load current local state
          const localState = await loadProjectState(projectId);
          if (!localState) {
            setSyncStatus('synced');
            return;
          }

          // Detect conflicts
          const conflicts = detectConflicts(localState, remoteState);

          if (conflicts.length > 0) {
            console.log('[ProjectSyncListener] Conflicts detected:', conflicts);

            // Check if auto-merge is enabled (default: true for better UX)
            const autoMergeEnabled = localStorage.getItem('formlab-auto-smart-merge') !== 'false';

            if (autoMergeEnabled) {
              // Auto-resolve with smart merge strategy
              console.log('[ProjectSyncListener] Auto-merging conflicts with smart strategy');
              const merged = mergeProjectStates(localState, remoteState, 'smart');
              await saveProjectState(projectId, merged);
              setSyncStatus('synced');
              setLastSyncTime(Date.now());
              console.log('[ProjectSyncListener] Auto-merge completed successfully');
            } else {
              // Show conflict resolution modal (for users who prefer manual control)
              setConflictData({
                projectId,
                local: localState,
                remote: remoteState,
                conflicts,
              });
              setSyncStatus('conflict');
            }
          } else {
            // No conflicts, check if remote is newer
            const remoteNewer = (remoteState.updatedAt || 0) > (localState.updatedAt || 0);

            if (remoteNewer) {
              console.log('[ProjectSyncListener] Remote version is newer, auto-merging');

              // Auto-merge with prefer-remote strategy
              const merged = mergeProjectStates(localState, remoteState, 'prefer-remote');

              // Save merged state locally (won't trigger another sync due to debounce)
              await saveProjectState(projectId, merged);

              // Update sync status
              setSyncStatus('synced');
              setLastSyncTime(Date.now());
              console.log('[ProjectSyncListener] State updated from remote');
            } else {
              // Local is up to date
              setSyncStatus('synced');
              setLastSyncTime(Date.now());
            }
          }
        } catch (error) {
          console.error('[ProjectSyncListener] Error handling remote update:', error);
          setSyncStatus('error');
        }
      }
    );

    // Initial sync complete
    setSyncStatus('synced');
    setLastSyncTime(Date.now());

    return () => {
      console.log('[ProjectSyncListener] Cleaning up real-time listener for project:', projectId);
      unsubscribe();
    };
  }, [projectId, currentUser, setConflictData, setSyncStatus, setLastSyncTime]);

  return null; // This component doesn't render anything
};

export default ProjectSyncListener;
