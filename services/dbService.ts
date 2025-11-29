/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Project, ProjectState } from '../types';
import { syncProjectToFirestore, loadProjectFromFirestore, mergeProjectStates } from './firestoreSync';
import { uploadBase64Image, isBase64Url } from './storageService';

// --- IndexedDB Service for Project Persistence ---
const DB_NAME = 'FormLabProjectsDB';
const DB_VERSION = 1;
const STATE_STORE_NAME = 'modelProjects';
const METADATA_STORE_NAME = 'projectMetadata';
let db: IDBDatabase;

// --- Firestore Sync Queue ---
const syncQueue = new Map<string, NodeJS.Timeout>();
const syncInProgress = new Set<string>(); // Track projects currently syncing to prevent concurrent writes
let currentUserId: string | null = null;

/**
 * Set current user ID for Firestore sync
 */
export const setCurrentUserId = (userId: string | null) => {
    currentUserId = userId;
};

/**
 * Clear all pending Firestore sync operations
 * Useful during migrations to prevent stale data from being synced
 */
export const clearSyncQueue = () => {
    console.log('[dbService] Clearing sync queue, canceling', syncQueue.size, 'pending syncs');
    syncQueue.forEach((timer) => clearTimeout(timer));
    syncQueue.clear();
};

/**
 * Queue Firestore sync (debounced 2 seconds)
 * Always reloads fresh state from IndexedDB before syncing to ensure migrated data is used
 */
const queueFirestoreSync = (projectId: string, state: any) => {
    // Skip if no user logged in
    if (!currentUserId) {
        console.warn('[dbService] Skipping Firestore sync - user not authenticated yet. Project:', projectId);
        return;
    }

    // Clear existing timer for this project
    if (syncQueue.has(projectId)) {
        clearTimeout(syncQueue.get(projectId)!);
    }

    // Queue new sync (debounced 5 seconds - increased from 2s to reduce Firestore write stream pressure)
    const timer = setTimeout(async () => {
        try {
            // Re-check userId before sync (in case user logged out during debounce period)
            if (!currentUserId) {
                console.warn('[dbService] User logged out before sync could complete. Skipping sync for project:', projectId);
                syncQueue.delete(projectId);
                return;
            }

            // Check if sync already in progress for this project
            if (syncInProgress.has(projectId)) {
                console.log('[dbService] Sync already in progress for project:', projectId, '- will retry after completion');
                syncQueue.delete(projectId);
                // Re-queue the sync to try again after current sync completes
                queueFirestoreSync(projectId, state);
                return;
            }

            console.log('[dbService] Starting background Firestore sync for project:', projectId);
            syncInProgress.add(projectId); // Mark as in progress

            // CRITICAL: Reload fresh state from IndexedDB to ensure we sync migrated data
            // This prevents race conditions where in-memory state is stale (e.g., contains base64 before migration)
            const freshState = await new Promise<any>((resolve, reject) => {
                const transaction = db.transaction([STATE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(STATE_STORE_NAME);
                const request = store.get(projectId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });

            // Load project metadata from IndexedDB
            const projectMetadata = await new Promise<any>((resolve, reject) => {
                const transaction = db.transaction([METADATA_STORE_NAME], 'readonly');
                const store = transaction.objectStore(METADATA_STORE_NAME);
                const request = store.get(projectId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });

            // Use fresh state if available, otherwise fall back to the state passed in
            const stateToSync = freshState || state;

            const projectState: ProjectState = {
                id: projectId,
                ...stateToSync,
                updatedAt: Date.now(),
            };

            await syncProjectToFirestore(projectId, currentUserId, projectState, projectMetadata);
            syncQueue.delete(projectId);
            syncInProgress.delete(projectId); // Mark as complete
            console.log('[dbService] Firestore sync completed successfully');
        } catch (error: any) {
            // Provide more detailed error logging
            if (error?.code === 'permission-denied') {
                console.error('[dbService] Firestore sync failed: Permission denied. Check Firestore rules and ensure user is authenticated.');
            } else if (error?.message?.includes('Missing or insufficient permissions')) {
                console.error('[dbService] Firestore sync failed: Missing required fields or userId mismatch. Error:', error.message);
            } else {
                console.error('[dbService] Firestore sync failed:', error);
            }
            // Keep in IndexedDB, will retry next time
            syncQueue.delete(projectId);
            syncInProgress.delete(projectId); // Mark as complete even on error
        }
    }, 5000); // Increased from 2000ms to 5000ms to reduce sync frequency and prevent write stream exhaustion

    syncQueue.set(projectId, timer);
};

/**
 * Force immediate Firestore sync (no debounce)
 * Use for critical operations like project creation to prevent data loss
 */
export const forceImmediateSync = async (projectId: string, state: any): Promise<void> => {
    if (!currentUserId) {
        console.warn('[dbService] Cannot force sync - no user logged in');
        return;
    }

    // Cancel any pending debounced sync
    if (syncQueue.has(projectId)) {
        clearTimeout(syncQueue.get(projectId)!);
        syncQueue.delete(projectId);
    }

    // Check if sync already in progress
    if (syncInProgress.has(projectId)) {
        console.log('[dbService] Sync already in progress, skipping force sync');
        return;
    }

    try {
        console.log('[dbService] Force immediate sync:', projectId);
        syncInProgress.add(projectId);

        // Load fresh metadata from IndexedDB
        const projectMetadata = await new Promise<any>((resolve, reject) => {
            const transaction = db.transaction([METADATA_STORE_NAME], 'readonly');
            const store = transaction.objectStore(METADATA_STORE_NAME);
            const request = store.get(projectId);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });

        const projectState: ProjectState = {
            id: projectId,
            ...state,
            updatedAt: Date.now(),
        };

        await syncProjectToFirestore(projectId, currentUserId, projectState, projectMetadata);
        console.log('[dbService] Force sync completed successfully');
    } catch (error) {
        console.error('[dbService] Force sync failed:', error);
        throw error;
    } finally {
        syncInProgress.delete(projectId);
    }
};

export const initDB = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (db) return resolve(true);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject('Error opening DB');
        request.onsuccess = () => { db = request.result; resolve(true); };
        request.onupgradeneeded = e => {
            const dbInstance = (e.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STATE_STORE_NAME)) {
                dbInstance.createObjectStore(STATE_STORE_NAME, { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains(METADATA_STORE_NAME)) {
                dbInstance.createObjectStore(METADATA_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveProjectState = async (id: string, state: object) => {
    if (!id.trim()) return;
    if (!db) await initDB();

    // Save to IndexedDB (instant, no network latency)
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STATE_STORE_NAME);
        const request = store.put({ id, ...state });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });

    // Queue Firestore sync (background, debounced 2 seconds)
    queueFirestoreSync(id, state);
};

export const saveProjectMetadata = async (project: Project) => {
    if (!project.id.trim()) return;
    if (!db) await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([METADATA_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(METADATA_STORE_NAME);
        const request = store.put(project);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const loadProjectState = async (id: string): Promise<any | null> => {
    if (!db) await initDB();

    // Load from IndexedDB first (instant)
    const localState = await new Promise<any>((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(STATE_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });

    // Skip Firestore check if no user logged in
    if (!currentUserId) {
        return localState;
    }

    // Check Firestore for newer version (background, don't block UI)
    try {
        const remoteState = await loadProjectFromFirestore(id, currentUserId);

        if (remoteState && (!localState || (remoteState.updatedAt || 0) > (localState.updatedAt || 0))) {
            console.log('[dbService] Remote version is newer, merging with local');
            // Remote is newer, merge and save locally
            const merged = mergeProjectStates(localState || { id }, remoteState, 'prefer-remote');

            // Save merged state to IndexedDB (don't trigger another Firestore sync)
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([STATE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STATE_STORE_NAME);
                const request = store.put(merged);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });

            return merged;
        }
    } catch (error) {
        console.warn('[dbService] Failed to check Firestore, using local state:', error);
    }

    return localState;
};

export const getAllProjectMetadata = async (): Promise<Project[]> => {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([METADATA_STORE_NAME], 'readonly');
        const store = transaction.objectStore(METADATA_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const deleteProjectState = async (id: string) => {
    if (!db) await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STATE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STATE_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const deleteProjectMetadata = async (id: string) => {
    if (!db) await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([METADATA_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(METADATA_STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

/**
 * Migration: Clean up invalid blob URLs from wardrobe items
 * This removes wardrobe items that have blob: URLs which are no longer valid
 */
export const cleanupBlobUrls = async (): Promise<void> => {
    if (!db) await initDB();

    try {
        // Get all project metadata
        const projects = await getAllProjectMetadata();

        for (const project of projects) {
            // Load project state
            const state = await loadProjectState(project.id);

            if (state?.wardrobe && Array.isArray(state.wardrobe)) {
                // Filter out wardrobe items with blob URLs
                const originalCount = state.wardrobe.length;
                state.wardrobe = state.wardrobe.filter((item: any) => {
                    return !item.url || !item.url.startsWith('blob:');
                });

                const removedCount = originalCount - state.wardrobe.length;

                // Save back if we removed any items
                if (removedCount > 0) {
                    await saveProjectState(project.id, state);
                    console.log(`Cleaned up ${removedCount} blob URL(s) from project ${project.id}`);
                }
            }
        }

        console.log('Blob URL cleanup completed');
    } catch (error) {
        console.error('Error during blob URL cleanup:', error);
    }
};

/**
 * Save styling history (try-ons) for a specific base model in a project
 */
export const saveStylingHistory = async (
    projectId: string,
    baseModelId: string,
    history: any[]
): Promise<void> => {
    if (!projectId.trim() || !baseModelId.trim()) return;
    if (!db) await initDB();

    try {
        const state = await loadProjectState(projectId);
        if (!state) {
            console.error(`Project ${projectId} not found`);
            return;
        }

        // Initialize history objects if they don't exist
        if (!state.stylingHistory) {
            state.stylingHistory = {};
        }
        if (!state.generatedModelHistory) {
            state.generatedModelHistory = [];
        }

        // Split unified history back into separate storage locations
        // Create Model history: model-generation, model-revision
        // Image Studio history: try-on, try-on-revision

        // DEBUG: Log items without type field
        const itemsWithoutType = history.filter((item: any) => !item.type);
        if (itemsWithoutType.length > 0) {
            console.warn('[saveStylingHistory] WARNING: Found items without type field:', itemsWithoutType.map(h => ({ id: h.id, parentId: h.parentId })));
        }

        const createModelHistory = history.filter((item: any) =>
            item.type === 'model-generation' || item.type === 'model-revision'
        );
        const stylingOnlyHistory = history.filter((item: any) =>
            item.type === 'try-on' || item.type === 'try-on-revision'
        );

        console.log('[saveStylingHistory] baseModelId:', baseModelId);
        console.log('[saveStylingHistory] total history items:', history.length);
        console.log('[saveStylingHistory] createModelHistory:', createModelHistory.map(h => ({ id: h.id, type: h.type })));
        console.log('[saveStylingHistory] stylingOnlyHistory:', stylingOnlyHistory.map(h => ({ id: h.id, type: h.type })));

        // Update Create Model history (merge with existing, deduplicate by ID)
        const existingCreateModelIds = new Set(state.generatedModelHistory.map((item: any) => item.id));
        createModelHistory.forEach((item: any) => {
            if (!existingCreateModelIds.has(item.id)) {
                state.generatedModelHistory.push(item);
            } else {
                // Update existing item
                const index = state.generatedModelHistory.findIndex((h: any) => h.id === item.id);
                if (index !== -1) {
                    state.generatedModelHistory[index] = item;
                }
            }
        });

        // Save Image Studio history for this base model
        state.stylingHistory[baseModelId] = stylingOnlyHistory;

        console.log('[saveStylingHistory] Saving stylingHistory[' + baseModelId + '] with', stylingOnlyHistory.length, 'items');

        await saveProjectState(projectId, state);
        console.log('[saveStylingHistory] Saved successfully');
    } catch (error) {
        console.error('Error saving styling history:', error);
    }
};

/**
 * Load styling history (try-ons) for a specific base model in a project
 */
export const loadStylingHistory = async (
    projectId: string,
    baseModelId: string
): Promise<any[] | null> => {
    if (!projectId.trim() || !baseModelId.trim()) return null;
    if (!db) await initDB();

    try {
        const state = await loadProjectState(projectId);
        if (!state || !state.stylingHistory) {
            return null;
        }

        return state.stylingHistory[baseModelId] || null;
    } catch (error) {
        console.error('Error loading styling history:', error);
        return null;
    }
};

/**
 * Load unified history for a base model (Create Model + Image Studio history merged)
 * Returns chronologically sorted history including all workflow stages
 */
export const loadUnifiedHistory = async (
    projectId: string,
    baseModelId: string
): Promise<any[] | null> => {
    if (!projectId.trim() || !baseModelId.trim()) return null;
    if (!db) await initDB();

    try {
        const state = await loadProjectState(projectId);
        if (!state) {
            return null;
        }

        const createModelHistory: any[] = [];
        const stylingHistory: any[] = [];

        // Get Create Model history for this base model tree
        if (state.generatedModelHistory && Array.isArray(state.generatedModelHistory)) {
            // Helper function to find root ancestor
            const findRootAncestor = (itemId: string, historyArray: any[]): string => {
                const item = historyArray.find((h: any) => h.id === itemId);
                if (!item || !item.parentId) return itemId;
                return findRootAncestor(item.parentId, historyArray);
            };

            // Get all history items that belong to this base model tree
            createModelHistory.push(
                ...state.generatedModelHistory.filter((item: any) => {
                    const rootId = findRootAncestor(item.id, state.generatedModelHistory);
                    return rootId === baseModelId;
                })
            );
        }

        // Get Image Studio styling history for this base model
        if (state.stylingHistory && state.stylingHistory[baseModelId]) {
            stylingHistory.push(...state.stylingHistory[baseModelId]);
        }

        console.log('[loadUnifiedHistory] baseModelId:', baseModelId);
        console.log('[loadUnifiedHistory] createModelHistory count:', createModelHistory.length);
        console.log('[loadUnifiedHistory] stylingHistory count:', stylingHistory.length);
        console.log('[loadUnifiedHistory] createModelHistory:', createModelHistory.map(h => ({ id: h.id, type: h.type })));
        console.log('[loadUnifiedHistory] stylingHistory:', stylingHistory.map(h => ({ id: h.id, type: h.type })));

        // Merge and sort chronologically by timestamp in ID
        const unifiedHistory = [...createModelHistory, ...stylingHistory].sort((a, b) => {
            const aTime = parseInt(a.id.split('-').pop() || '0');
            const bTime = parseInt(b.id.split('-').pop() || '0');
            return aTime - bTime;
        });

        console.log('[loadUnifiedHistory] unifiedHistory count:', unifiedHistory.length);
        console.log('[loadUnifiedHistory] unifiedHistory:', unifiedHistory.map(h => ({ id: h.id, type: h.type })));

        return unifiedHistory.length > 0 ? unifiedHistory : null;
    } catch (error) {
        console.error('Error loading unified history:', error);
        return null;
    }
};

/**
 * Delete styling history for a specific base model (used when model is deleted)
 */
export const deleteStylingHistory = async (
    projectId: string,
    baseModelId: string
): Promise<void> => {
    if (!projectId.trim() || !baseModelId.trim()) return;
    if (!db) await initDB();

    try {
        const state = await loadProjectState(projectId);
        if (!state || !state.stylingHistory) {
            return;
        }

        delete state.stylingHistory[baseModelId];
        await saveProjectState(projectId, state);
    } catch (error) {
        console.error('Error deleting styling history:', error);
    }
};

/**
 * Migration: Migrate all existing IndexedDB projects to Firestore
 * This should be run once when user logs in for the first time
 * Only syncs projects that don't already exist in Firestore
 */
export const migrateIndexedDBToFirestore = async (): Promise<{
    total: number;
    migrated: number;
    skipped: number;
    errors: number;
}> => {
    if (!db) await initDB();

    const result = {
        total: 0,
        migrated: 0,
        skipped: 0,
        errors: 0,
    };

    // Skip if no user logged in
    if (!currentUserId) {
        console.log('[migrateIndexedDBToFirestore] No user logged in, skipping migration');
        return result;
    }

    try {
        console.log('[migrateIndexedDBToFirestore] Starting migration to Firestore...');

        // Get all project metadata
        const projects = await getAllProjectMetadata();
        result.total = projects.length;

        for (const project of projects) {
            try {
                console.log(`[migrateIndexedDBToFirestore] Migrating project: ${project.id}`);

                // Load project state from IndexedDB
                const state = await loadProjectState(project.id);
                if (!state) {
                    console.warn(`[migrateIndexedDBToFirestore] No state found for project ${project.id}`);
                    result.skipped++;
                    continue;
                }

                // Check if project already exists in Firestore
                const remoteState = await loadProjectFromFirestore(project.id, currentUserId);
                if (remoteState) {
                    console.log(`[migrateIndexedDBToFirestore] Project ${project.id} already exists in Firestore, skipping`);
                    result.skipped++;
                    continue;
                }

                // Prepare project state for Firestore
                const projectState: ProjectState = {
                    id: project.id,
                    ...state,
                    updatedAt: Date.now(),
                };

                // Sync to Firestore
                await syncProjectToFirestore(project.id, currentUserId, projectState);

                console.log(`[migrateIndexedDBToFirestore] Successfully migrated project ${project.id}`);
                result.migrated++;
            } catch (error) {
                console.error(`[migrateIndexedDBToFirestore] Error migrating project ${project.id}:`, error);
                result.errors++;
            }
        }

        console.log('[migrateIndexedDBToFirestore] Migration complete:', result);
        return result;
    } catch (error) {
        console.error('[migrateIndexedDBToFirestore] Migration failed:', error);
        throw error;
    }
};

/**
 * Migration: Add type field to existing history items
 * Base models (parentId === null) get type 'model-generation'
 * All other models get type 'model-revision'
 * Try-on items get type 'try-on' or 'try-on-revision'
 */
export const migrateHistoryItemTypes = async (): Promise<void> => {
    if (!db) await initDB();

    try {
        const projects = await getAllProjectMetadata();
        let totalMigrated = 0;

        for (const project of projects) {
            const state = await loadProjectState(project.id);
            let needsUpdate = false;

            // Migrate generatedModelHistory (Create Model items)
            if (state?.generatedModelHistory && Array.isArray(state.generatedModelHistory)) {
                // Update history items that don't have a type field
                state.generatedModelHistory = state.generatedModelHistory.map((item: any) => {
                    if (!item.type) {
                        needsUpdate = true;
                        totalMigrated++;

                        // Base models (no parent) are 'model-generation'
                        // Everything else is 'model-revision'
                        return {
                            ...item,
                            type: item.parentId === null ? 'model-generation' : 'model-revision',
                        };
                    }
                    return item;
                });
            }

            // Migrate stylingHistory (Image Studio try-on items)
            if (state?.stylingHistory && typeof state.stylingHistory === 'object') {
                // Loop through each baseModelId key
                Object.keys(state.stylingHistory).forEach((baseModelId: string) => {
                    const stylingItems = state.stylingHistory[baseModelId];

                    if (Array.isArray(stylingItems)) {
                        state.stylingHistory[baseModelId] = stylingItems.map((item: any) => {
                            if (!item.type) {
                                needsUpdate = true;
                                totalMigrated++;

                                // Try-on items with no parent are base try-ons
                                // Try-on items with a parent are try-on revisions
                                return {
                                    ...item,
                                    type: item.parentId === null ? 'try-on' : 'try-on-revision',
                                };
                            }
                            return item;
                        });
                    }
                });
            }

            if (needsUpdate) {
                await saveProjectState(project.id, state);
                console.log(`Migrated history items in project ${project.id}`);
            }
        }

        console.log(`History item type migration completed. Total items migrated: ${totalMigrated}`);
    } catch (error) {
        console.error('Error during history item type migration:', error);
    }
};

/**
 * Migration: Upload existing base64 images to Firebase Storage
 * This converts base64 data URLs to Storage URLs before Firestore sync
 * Required because Firestore has a 1MB document size limit
 */
export const migrateBase64ImagesToStorage = async (): Promise<{
    total: number;
    uploaded: number;
    skipped: number;
    errors: number;
}> => {
    if (!db) await initDB();

    const result = {
        total: 0,
        uploaded: 0,
        skipped: 0,
        errors: 0,
    };

    // Skip if no user logged in
    if (!currentUserId) {
        console.log('[migrateBase64ImagesToStorage] No user logged in, skipping migration');
        return result;
    }

    try {
        console.log('[migrateBase64ImagesToStorage] Starting base64 image migration...');

        // Clear any pending Firestore syncs to prevent stale data from being synced
        clearSyncQueue();

        // Get all project metadata
        const projects = await getAllProjectMetadata();

        for (const project of projects) {
            try {
                console.log(`[migrateBase64ImagesToStorage] Processing project: ${project.id}`);

                // Load project state from IndexedDB
                const state = await loadProjectState(project.id);
                if (!state) {
                    console.warn(`[migrateBase64ImagesToStorage] No state found for project ${project.id}`);
                    continue;
                }

                let stateChanged = false;

                // Process generatedModelHistory (Create Model history)
                if (state.generatedModelHistory && Array.isArray(state.generatedModelHistory)) {
                    for (let i = 0; i < state.generatedModelHistory.length; i++) {
                        const item = state.generatedModelHistory[i];
                        result.total++;

                        if (item.imageUrl && isBase64Url(item.imageUrl)) {
                            try {
                                console.log(`[migrateBase64ImagesToStorage] Uploading base64 image for history item ${item.id}`);

                                const storageUrl = await uploadBase64Image(
                                    item.imageUrl,
                                    currentUserId,
                                    'tryons',
                                    `history_${item.id}_${Date.now()}.jpg`,
                                    project.id
                                );

                                // Update the imageUrl in the state
                                state.generatedModelHistory[i].imageUrl = storageUrl;
                                stateChanged = true;
                                result.uploaded++;

                                console.log(`[migrateBase64ImagesToStorage] Successfully uploaded: ${item.id}`);
                            } catch (error) {
                                console.error(`[migrateBase64ImagesToStorage] Failed to upload image for ${item.id}:`, error);
                                result.errors++;
                            }
                        } else {
                            result.skipped++;
                        }
                    }
                }

                // Process stylingHistory (Image Studio try-on history)
                if (state.stylingHistory && typeof state.stylingHistory === 'object') {
                    for (const baseModelId of Object.keys(state.stylingHistory)) {
                        const stylingItems = state.stylingHistory[baseModelId];

                        if (Array.isArray(stylingItems)) {
                            for (let i = 0; i < stylingItems.length; i++) {
                                const item = stylingItems[i];
                                result.total++;

                                if (item.imageUrl && isBase64Url(item.imageUrl)) {
                                    try {
                                        console.log(`[migrateBase64ImagesToStorage] Uploading base64 image for styling item ${item.id}`);

                                        const storageUrl = await uploadBase64Image(
                                            item.imageUrl,
                                            currentUserId,
                                            'tryons',
                                            `styling_${item.id}_${Date.now()}.jpg`,
                                            project.id
                                        );

                                        // Update the imageUrl in the state
                                        state.stylingHistory[baseModelId][i].imageUrl = storageUrl;
                                        stateChanged = true;
                                        result.uploaded++;

                                        console.log(`[migrateBase64ImagesToStorage] Successfully uploaded: ${item.id}`);
                                    } catch (error) {
                                        console.error(`[migrateBase64ImagesToStorage] Failed to upload image for ${item.id}:`, error);
                                        result.errors++;
                                    }
                                } else {
                                    result.skipped++;
                                }
                            }
                        }
                    }
                }

                // Save updated state back to IndexedDB if any changes were made
                if (stateChanged) {
                    // Save without triggering Firestore sync (use direct IndexedDB write)
                    await new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction([STATE_STORE_NAME], 'readwrite');
                        const store = transaction.objectStore(STATE_STORE_NAME);
                        const request = store.put({ id: project.id, ...state });
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });

                    console.log(`[migrateBase64ImagesToStorage] Updated project ${project.id} with Storage URLs`);
                }
            } catch (error) {
                console.error(`[migrateBase64ImagesToStorage] Error processing project ${project.id}:`, error);
            }
        }

        console.log('[migrateBase64ImagesToStorage] Migration complete:', result);
        return result;
    } catch (error) {
        console.error('[migrateBase64ImagesToStorage] Migration failed:', error);
        throw error;
    }
};