/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Project } from '../types';

// --- IndexedDB Service for Project Persistence ---
const DB_NAME = 'FormLabProjectsDB';
const DB_VERSION = 1;
const STATE_STORE_NAME = 'modelProjects';
const METADATA_STORE_NAME = 'projectMetadata';
let db: IDBDatabase;

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
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STATE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STATE_STORE_NAME);
    const request = store.put({ id, ...state });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STATE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(STATE_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
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

        // Initialize stylingHistory if it doesn't exist
        if (!state.stylingHistory) {
            state.stylingHistory = {};
        }

        // Save the history for this base model
        state.stylingHistory[baseModelId] = history;

        await saveProjectState(projectId, state);
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
 * Migration: Add type field to existing history items
 * Base models (parentId === null) get type 'model-generation'
 * All other models get type 'model-revision'
 */
export const migrateHistoryItemTypes = async (): Promise<void> => {
    if (!db) await initDB();

    try {
        const projects = await getAllProjectMetadata();
        let totalMigrated = 0;

        for (const project of projects) {
            const state = await loadProjectState(project.id);

            if (state?.generatedModelHistory && Array.isArray(state.generatedModelHistory)) {
                let needsUpdate = false;

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

                if (needsUpdate) {
                    await saveProjectState(project.id, state);
                    console.log(`Migrated ${totalMigrated} history item(s) in project ${project.id}`);
                }
            }
        }

        console.log(`History item type migration completed. Total items migrated: ${totalMigrated}`);
    } catch (error) {
        console.error('Error during history item type migration:', error);
    }
};