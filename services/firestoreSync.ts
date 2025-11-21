/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp,
    onSnapshot,
    Unsubscribe,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { HistoryItem, Project } from '../types';
import { isBase64Url } from './storageService';

// ========================
// TYPES & INTERFACES
// ========================

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'conflict';

export type MergeStrategy = 'prefer-local' | 'prefer-remote' | 'smart';

export interface Conflict {
    field: string;
    local: any;
    remote: any;
    timestamp: number;
}

export interface SyncQueueItem {
    id: string;
    projectId: string;
    operation: 'save' | 'delete' | 'update';
    data: any;
    timestamp: number;
    retryCount: number;
    maxRetries: number;
}

/**
 * Sanitize object for Firestore by converting undefined to null
 * Firestore doesn't support undefined values, only null
 */
const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return null;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForFirestore);
    }
    if (typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value === undefined) {
                sanitized[key] = null; // Convert undefined to null
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeForFirestore(value);
            } else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
    return obj;
};

export interface ProjectState {
    id: string;
    modelDescription?: string;
    revisionPrompt?: string;
    selectedModelName?: string;
    generatedModelHistory?: HistoryItem[];
    currentHistoryItemId?: string | null;
    generationSettings?: any;
    hasSavedInstance?: boolean;
    stylingHistory?: { [baseModelId: string]: HistoryItem[] };
    wardrobe?: any[];
    updatedAt?: number;
    syncVersion?: number;
}

// ========================
// UTILITY FUNCTIONS
// ========================

/**
 * Get device ID (create if doesn't exist)
 */
export const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('formlab-device-id');
    if (!deviceId) {
        deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('formlab-device-id', deviceId);
    }
    return deviceId;
};

/**
 * Convert Firestore Timestamp to milliseconds
 */
const timestampToMs = (timestamp: any): number => {
    if (!timestamp) return 0;
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    if (typeof timestamp === 'number') {
        return timestamp;
    }
    return 0;
};

/**
 * Merge two arrays by ID, keeping latest per item based on timestamp
 */
const mergeArraysByIdAndTimestamp = (localArray: any[], remoteArray: any[]): any[] => {
    const merged = new Map<string, any>();

    // Add all local items
    localArray.forEach(item => {
        merged.set(item.id, item);
    });

    // Add/update with remote items if they're newer
    remoteArray.forEach(item => {
        const existing = merged.get(item.id);
        if (!existing) {
            merged.set(item.id, item);
        } else {
            // Compare timestamps (extract from ID if no explicit timestamp)
            const existingTime = parseInt(existing.id.split('-').pop() || '0');
            const remoteTime = parseInt(item.id.split('-').pop() || '0');

            if (remoteTime > existingTime) {
                merged.set(item.id, item);
            }
        }
    });

    return Array.from(merged.values()).sort((a, b) => {
        const aTime = parseInt(a.id.split('-').pop() || '0');
        const bTime = parseInt(b.id.split('-').pop() || '0');
        return aTime - bTime;
    });
};

// ========================
// CORE SYNC FUNCTIONS
// ========================

/**
 * Sync complete project to Firestore
 */
export const syncProjectToFirestore = async (
    projectId: string,
    userId: string,
    projectState: ProjectState
): Promise<void> => {
    try {
        console.log('[firestoreSync] Syncing project to Firestore:', projectId);

        // ===== VALIDATION: Prevent base64 images from reaching Firestore =====
        // Check generatedModelHistory for base64 images
        if (projectState.generatedModelHistory) {
            for (const item of projectState.generatedModelHistory) {
                if (item.imageUrl && isBase64Url(item.imageUrl)) {
                    const error = `[firestoreSync] BLOCKED: Project ${projectId} contains base64 images in generatedModelHistory. ` +
                                  `Item ${item.id} has base64 imageUrl. Migration to Firebase Storage required before Firestore sync.`;
                    console.error(error);
                    throw new Error('Cannot sync project with base64 images - migration needed');
                }
            }
        }

        // Check stylingHistory for base64 images
        if (projectState.stylingHistory) {
            for (const [baseModelId, historyItems] of Object.entries(projectState.stylingHistory)) {
                if (historyItems && Array.isArray(historyItems)) {
                    for (const item of historyItems) {
                        if (item.imageUrl && isBase64Url(item.imageUrl)) {
                            const error = `[firestoreSync] BLOCKED: Project ${projectId} contains base64 images in stylingHistory[${baseModelId}]. ` +
                                          `Item ${item.id} has base64 imageUrl. Migration to Firebase Storage required before Firestore sync.`;
                            console.error(error);
                            throw new Error('Cannot sync project with base64 images - migration needed');
                        }
                    }
                }
            }
        }

        // Check wardrobe for base64 images
        if (projectState.wardrobe) {
            for (const item of projectState.wardrobe) {
                if (item.url && isBase64Url(item.url)) {
                    const error = `[firestoreSync] BLOCKED: Project ${projectId} contains base64 images in wardrobe. ` +
                                  `Item ${item.id} has base64 url. Migration to Firebase Storage required before Firestore sync.`;
                    console.error(error);
                    throw new Error('Cannot sync project with base64 images - migration needed');
                }
            }
        }

        console.log('[firestoreSync] Validation passed: No base64 images detected');
        // ===== END VALIDATION =====

        const projectRef = doc(db, 'projects', projectId);

        // Prepare project metadata
        const projectMetadata = {
            id: projectId,
            userId: userId,
            modelDescription: projectState.modelDescription || '',
            revisionPrompt: projectState.revisionPrompt || '',
            selectedModelName: projectState.selectedModelName || '',
            currentHistoryItemId: projectState.currentHistoryItemId || null,
            hasSavedInstance: projectState.hasSavedInstance || false,
            generationSettings: projectState.generationSettings || {},
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncVersion: (projectState.syncVersion || 0) + 1,
        };

        // Sanitize metadata to convert undefined to null (Firestore requirement)
        const sanitizedMetadata = sanitizeForFirestore(projectMetadata);

        // Save project metadata
        await setDoc(projectRef, sanitizedMetadata, { merge: true });

        // Sync history items in batches
        if (projectState.generatedModelHistory && projectState.generatedModelHistory.length > 0) {
            await syncHistoryItems(projectId, 'generatedModelHistory', projectState.generatedModelHistory);
        }

        // Sync styling history
        if (projectState.stylingHistory) {
            for (const [baseModelId, historyItems] of Object.entries(projectState.stylingHistory)) {
                if (historyItems && historyItems.length > 0) {
                    await syncHistoryItems(projectId, baseModelId, historyItems);
                }
            }
        }

        // Sync wardrobe items
        if (projectState.wardrobe && projectState.wardrobe.length > 0) {
            await syncWardrobeItems(projectId, projectState.wardrobe);
        }

        console.log('[firestoreSync] Project synced successfully');
    } catch (error) {
        console.error('[firestoreSync] Error syncing project:', error);
        throw error;
    }
};

/**
 * Load project from Firestore
 */
export const loadProjectFromFirestore = async (
    projectId: string,
    userId: string
): Promise<ProjectState | null> => {
    try {
        console.log('[firestoreSync] Loading project from Firestore:', projectId);

        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            console.log('[firestoreSync] Project not found in Firestore');
            return null;
        }

        const projectData = projectSnap.data();

        // Verify ownership
        if (projectData.userId !== userId) {
            console.warn('[firestoreSync] Project belongs to different user');
            return null;
        }

        // Load history items
        const generatedModelHistory = await loadHistoryItems(projectId, 'generatedModelHistory');

        // Load styling history
        const stylingHistory: { [key: string]: HistoryItem[] } = {};
        const stylingHistoryCollections = await getDocs(
            query(collection(db, 'projects', projectId, 'stylingHistory'))
        );

        for (const baseModelDoc of stylingHistoryCollections.docs) {
            const baseModelId = baseModelDoc.id;
            stylingHistory[baseModelId] = await loadHistoryItems(projectId, `stylingHistory/${baseModelId}`);
        }

        // Load wardrobe items
        const wardrobe = await loadWardrobeItems(projectId);

        const projectState: ProjectState = {
            id: projectId,
            modelDescription: projectData.modelDescription,
            revisionPrompt: projectData.revisionPrompt,
            selectedModelName: projectData.selectedModelName,
            currentHistoryItemId: projectData.currentHistoryItemId,
            hasSavedInstance: projectData.hasSavedInstance,
            generationSettings: projectData.generationSettings,
            generatedModelHistory,
            stylingHistory: Object.keys(stylingHistory).length > 0 ? stylingHistory : undefined,
            wardrobe: wardrobe.length > 0 ? wardrobe : undefined,
            updatedAt: timestampToMs(projectData.updatedAt),
            syncVersion: projectData.syncVersion || 0,
        };

        console.log('[firestoreSync] Project loaded successfully');
        return projectState;
    } catch (error: any) {
        // Handle permission errors gracefully (document might not exist yet in Firestore)
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.log('[firestoreSync] Project not yet synced to Firestore (using local data)');
            return null;
        }
        console.error('[firestoreSync] Error loading project:', error);
        return null;
    }
};

/**
 * Sync history items to Firestore (batched)
 */
export const syncHistoryItems = async (
    projectId: string,
    collectionPath: string,
    historyItems: HistoryItem[]
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, 'projects', projectId, collectionPath);

        // STEP 1: Load all existing documents from Firestore
        const existingDocs = await getDocs(collectionRef);
        const currentIds = new Set(historyItems.map(item => item.id));

        // STEP 2: Delete documents that exist in Firestore but not in local state
        let deletedCount = 0;
        existingDocs.docs.forEach((docSnapshot) => {
            if (!currentIds.has(docSnapshot.id)) {
                console.log(`[firestoreSync] Deleting orphaned document: ${docSnapshot.id} from ${collectionPath}`);
                batch.delete(docSnapshot.ref);
                deletedCount++;
            }
        });

        // STEP 3: Add/update current items
        historyItems.forEach((item) => {
            const itemRef = doc(collectionRef, item.id);
            // Sanitize item to convert undefined to null (Firestore requirement)
            const sanitizedItem = sanitizeForFirestore({
                ...item,
                updatedAt: serverTimestamp(),
            });
            batch.set(itemRef, sanitizedItem, { merge: true });
        });

        await batch.commit();
        console.log(`[firestoreSync] Synced ${historyItems.length} history items to ${collectionPath}${deletedCount > 0 ? `, deleted ${deletedCount} orphaned items` : ''}`);
    } catch (error) {
        console.error('[firestoreSync] Error syncing history items:', error);
        throw error;
    }
};

/**
 * Load history items from Firestore
 */
const loadHistoryItems = async (
    projectId: string,
    collectionPath: string
): Promise<HistoryItem[]> => {
    try {
        const historySnapshot = await getDocs(
            collection(db, 'projects', projectId, collectionPath)
        );

        const historyItems: HistoryItem[] = [];
        historySnapshot.forEach((doc) => {
            const data = doc.data();
            historyItems.push({
                id: data.id,
                parentId: data.parentId,
                imageUrl: data.imageUrl,
                prompt: data.prompt,
                settings: data.settings,
                modelName: data.modelName,
                isStarred: data.isStarred || false,
                name: data.name,
                type: data.type,
                baseModelId: data.baseModelId,
            });
        });

        // Sort by timestamp in ID
        return historyItems.sort((a, b) => {
            const aTime = parseInt(a.id.split('-').pop() || '0');
            const bTime = parseInt(b.id.split('-').pop() || '0');
            return aTime - bTime;
        });
    } catch (error) {
        console.error('[firestoreSync] Error loading history items:', error);
        return [];
    }
};

/**
 * Sync wardrobe items to Firestore (batched)
 */
export const syncWardrobeItems = async (
    projectId: string,
    wardrobeItems: any[]
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, 'projects', projectId, 'wardrobe');

        wardrobeItems.forEach((item) => {
            const itemRef = doc(collectionRef, item.id || `item-${Date.now()}-${Math.random()}`);
            // Sanitize item to convert undefined to null (Firestore requirement)
            const sanitizedItem = sanitizeForFirestore({
                ...item,
                updatedAt: serverTimestamp(),
            });
            batch.set(itemRef, sanitizedItem, { merge: true });
        });

        await batch.commit();
        console.log(`[firestoreSync] Synced ${wardrobeItems.length} wardrobe items`);
    } catch (error) {
        console.error('[firestoreSync] Error syncing wardrobe items:', error);
        throw error;
    }
};

/**
 * Load wardrobe items from Firestore
 */
const loadWardrobeItems = async (projectId: string): Promise<any[]> => {
    try {
        const wardrobeSnapshot = await getDocs(
            collection(db, 'projects', projectId, 'wardrobe')
        );

        const wardrobeItems: any[] = [];
        wardrobeSnapshot.forEach((doc) => {
            wardrobeItems.push(doc.data());
        });

        return wardrobeItems;
    } catch (error) {
        console.error('[firestoreSync] Error loading wardrobe items:', error);
        return [];
    }
};

// ========================
// CONFLICT DETECTION & RESOLUTION
// ========================

/**
 * Detect conflicts between local and remote states
 */
export const detectConflicts = (
    localState: ProjectState,
    remoteState: ProjectState
): Conflict[] => {
    const conflicts: Conflict[] = [];

    // Check metadata conflicts (only if both were updated recently)
    const timeDiff = Math.abs((localState.updatedAt || 0) - (remoteState.updatedAt || 0));
    if (timeDiff < 30000) { // Within 30 seconds = potential conflict
        if (localState.modelDescription !== remoteState.modelDescription) {
            conflicts.push({
                field: 'modelDescription',
                local: localState.modelDescription,
                remote: remoteState.modelDescription,
                timestamp: Date.now(),
            });
        }

        if (localState.revisionPrompt !== remoteState.revisionPrompt) {
            conflicts.push({
                field: 'revisionPrompt',
                local: localState.revisionPrompt,
                remote: remoteState.revisionPrompt,
                timestamp: Date.now(),
            });
        }
    }

    // Check history conflicts (different items)
    if (localState.generatedModelHistory && remoteState.generatedModelHistory) {
        const localIds = new Set(localState.generatedModelHistory.map(h => h.id));
        const remoteIds = new Set(remoteState.generatedModelHistory.map(h => h.id));
        const uniqueToLocal = [...localIds].filter(id => !remoteIds.has(id));
        const uniqueToRemote = [...remoteIds].filter(id => !localIds.has(id));

        if (uniqueToLocal.length > 0 || uniqueToRemote.length > 0) {
            conflicts.push({
                field: 'generatedModelHistory',
                local: uniqueToLocal,
                remote: uniqueToRemote,
                timestamp: Date.now(),
            });
        }
    }

    return conflicts;
};

/**
 * Merge project states with specified strategy
 */
export const mergeProjectStates = (
    localState: ProjectState,
    remoteState: ProjectState,
    strategy: MergeStrategy = 'smart'
): ProjectState => {
    if (strategy === 'prefer-local') {
        return { ...localState, syncVersion: Math.max(localState.syncVersion || 0, remoteState.syncVersion || 0) + 1 };
    }

    if (strategy === 'prefer-remote') {
        return { ...remoteState, syncVersion: Math.max(localState.syncVersion || 0, remoteState.syncVersion || 0) + 1 };
    }

    // Smart merge
    const isLocalNewer = (localState.updatedAt || 0) > (remoteState.updatedAt || 0);

    return {
        id: localState.id,
        modelDescription: isLocalNewer ? localState.modelDescription : remoteState.modelDescription,
        revisionPrompt: isLocalNewer ? localState.revisionPrompt : remoteState.revisionPrompt,
        selectedModelName: isLocalNewer ? localState.selectedModelName : remoteState.selectedModelName,
        currentHistoryItemId: isLocalNewer ? localState.currentHistoryItemId : remoteState.currentHistoryItemId,
        hasSavedInstance: isLocalNewer ? localState.hasSavedInstance : remoteState.hasSavedInstance,
        generationSettings: isLocalNewer ? localState.generationSettings : remoteState.generationSettings,

        // Merge history arrays (union by ID, keep unique items)
        generatedModelHistory: mergeArraysByIdAndTimestamp(
            localState.generatedModelHistory || [],
            remoteState.generatedModelHistory || []
        ),

        // Merge styling history per baseModelId
        stylingHistory: mergeStylingHistories(
            localState.stylingHistory || {},
            remoteState.stylingHistory || {}
        ),

        // Merge wardrobe (union by ID)
        wardrobe: mergeArraysByIdAndTimestamp(
            localState.wardrobe || [],
            remoteState.wardrobe || []
        ),

        updatedAt: Math.max(localState.updatedAt || 0, remoteState.updatedAt || 0),
        syncVersion: Math.max(localState.syncVersion || 0, remoteState.syncVersion || 0) + 1,
    };
};

/**
 * Merge styling histories (per baseModelId)
 */
const mergeStylingHistories = (
    localStyling: { [key: string]: HistoryItem[] },
    remoteStyling: { [key: string]: HistoryItem[] }
): { [key: string]: HistoryItem[] } => {
    const merged: { [key: string]: HistoryItem[] } = {};

    // Get all baseModelIds
    const allBaseIds = new Set([
        ...Object.keys(localStyling),
        ...Object.keys(remoteStyling),
    ]);

    allBaseIds.forEach(baseId => {
        const localItems = localStyling[baseId] || [];
        const remoteItems = remoteStyling[baseId] || [];
        merged[baseId] = mergeArraysByIdAndTimestamp(localItems, remoteItems);
    });

    return merged;
};

// ========================
// REAL-TIME SUBSCRIPTIONS
// ========================

/**
 * Subscribe to project changes
 */
export const subscribeToProject = (
    projectId: string,
    userId: string,
    onUpdate: (remoteState: ProjectState | null) => void
): Unsubscribe => {
    console.log('[firestoreSync] Subscribing to project:', projectId);

    const projectRef = doc(db, 'projects', projectId);

    return onSnapshot(projectRef, async (snapshot) => {
        if (!snapshot.exists()) {
            onUpdate(null);
            return;
        }

        const projectData = snapshot.data();

        // Verify ownership
        if (projectData.userId !== userId) {
            console.warn('[firestoreSync] Project belongs to different user');
            onUpdate(null);
            return;
        }

        // Load full project state
        const remoteState = await loadProjectFromFirestore(projectId, userId);
        onUpdate(remoteState);
    }, (error: any) => {
        // Handle permission errors gracefully (document might not exist yet in Firestore)
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.log('[firestoreSync] Project not yet synced to Firestore, skipping real-time updates');
            return;
        }
        console.error('[firestoreSync] Error in project subscription:', error);
    });
};

/**
 * Mark device last sync timestamp
 */
export const markDeviceLastSync = async (userId: string, deviceId: string): Promise<void> => {
    try {
        const deviceRef = doc(db, 'sync', userId, 'devices', deviceId);
        await setDoc(deviceRef, {
            deviceId,
            lastSyncTimestamp: serverTimestamp(),
            deviceName: navigator.userAgent,
            platform: navigator.platform,
        }, { merge: true });
    } catch (error) {
        console.error('[firestoreSync] Error marking device sync:', error);
    }
};

/**
 * Get sync status for a project
 */
export const getSyncStatus = async (projectId: string): Promise<SyncStatus> => {
    try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
            return 'offline';
        }

        return 'synced';
    } catch (error) {
        console.error('[firestoreSync] Error getting sync status:', error);
        return 'error';
    }
};
