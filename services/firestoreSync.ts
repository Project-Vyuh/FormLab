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
    Timestamp,
    deleteDoc
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
    projectState: ProjectState,
    projectMetadata?: Project
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

        // Validate userId matches authenticated user
        if (!userId || typeof userId !== 'string') {
            throw new Error('[firestoreSync] Invalid userId provided. Cannot sync to Firestore.');
        }

        // CRITICAL: Verify authenticated user matches the userId we're syncing
        // This must match or Firestore rules will reject the write
        const { auth } = await import('./firebase');
        const currentUser = auth.currentUser;

        if (!currentUser) {
            throw new Error('[firestoreSync] No authenticated user found. Cannot sync to Firestore.');
        }

        if (currentUser.uid !== userId) {
            console.error('[firestoreSync] UserId mismatch!', {
                authenticatedUid: currentUser.uid,
                providedUserId: userId,
                message: 'The userId being synced does not match the authenticated user'
            });
            throw new Error(`[firestoreSync] UserId mismatch: auth.uid=${currentUser.uid} but syncing userId=${userId}`);
        }

        console.log('[firestoreSync] Authentication verified - user matches:', currentUser.uid);

        const projectRef = doc(db, 'projects', projectId);

        // Prepare project metadata with all required fields
        const projectData = {
            id: projectId,
            userId: userId, // Required by Firestore rules

            // Project Metadata (from IndexedDB projectMetadata store)
            title: projectMetadata?.title || 'Untitled Project',
            description: projectMetadata?.description || '',
            organization: projectMetadata?.organization || '',
            clientDetails: projectMetadata?.clientDetails || { name: '', email: '', phone: '', location: '' },
            deadline: projectMetadata?.deadline || '',
            tags: projectMetadata?.tags || [],
            status: projectMetadata?.status || 'Draft',
            selectedForStyling: projectMetadata?.selectedForStyling || null,

            // Project State (from IndexedDB modelProjects store)
            modelDescription: projectState.modelDescription || '',
            revisionPrompt: projectState.revisionPrompt || '',
            selectedModelName: projectState.selectedModelName || '',
            currentHistoryItemId: projectState.currentHistoryItemId || null,
            hasSavedInstance: projectState.hasSavedInstance || false,
            generationSettings: projectState.generationSettings || {},

            createdAt: serverTimestamp(), // Required by Firestore rules
            updatedAt: serverTimestamp(), // Required by Firestore rules
            syncVersion: (projectState.syncVersion || 0) + 1,
            // Save list of styling model IDs to help with loading
            stylingModelIds: projectState.stylingHistory ? Object.keys(projectState.stylingHistory) : [],
        };

        // Sanitize metadata to convert undefined to null (Firestore requirement)
        const sanitizedMetadata = sanitizeForFirestore(projectData);

        // Validate all required fields are present before write
        if (!sanitizedMetadata.userId || !sanitizedMetadata.createdAt || !sanitizedMetadata.updatedAt) {
            console.error('[firestoreSync] Missing required fields:', {
                hasUserId: !!sanitizedMetadata.userId,
                hasCreatedAt: !!sanitizedMetadata.createdAt,
                hasUpdatedAt: !!sanitizedMetadata.updatedAt
            });
            throw new Error('[firestoreSync] Missing required fields (userId, createdAt, or updatedAt)');
        }

        console.log('[firestoreSync] Syncing project metadata for userId:', userId);

        // Check if document exists to determine create vs update operation
        // This is critical because Firestore rules differ for create vs update
        let existingDoc;
        let canReadExistingDoc = false;

        try {
            existingDoc = await getDoc(projectRef);
            canReadExistingDoc = true;
        } catch (error: any) {
            // If we can't read the document (permission-denied), it might exist but with wrong userId
            // OR it might not exist at all. Either way, we should try CREATE operation.
            if (error?.code === 'permission-denied') {
                console.warn('[firestoreSync] Cannot read existing document (permission-denied). Will attempt CREATE operation.');
                canReadExistingDoc = false;
            } else {
                // Some other error - rethrow it
                throw error;
            }
        }

        if (!canReadExistingDoc || !existingDoc?.exists()) {
            // Document doesn't exist OR we can't read it
            // Use merge: true to handle migration case where document exists but we can't read it
            console.log('[firestoreSync] Creating/updating project document (cannot verify existence due to permissions)');
            console.log('[firestoreSync] Document data keys:', Object.keys(sanitizedMetadata));
            console.log('[firestoreSync] Document data (sanitized):', {
                hasUserId: 'userId' in sanitizedMetadata,
                hasCreatedAt: 'createdAt' in sanitizedMetadata,
                hasUpdatedAt: 'updatedAt' in sanitizedMetadata,
                userIdValue: sanitizedMetadata.userId,
                createdAtValue: sanitizedMetadata.createdAt,
                updatedAtValue: sanitizedMetadata.updatedAt,
                createdAtType: typeof sanitizedMetadata.createdAt,
                updatedAtType: typeof sanitizedMetadata.updatedAt
            });
            // Use merge: true to trigger UPDATE rule which now allows migration
            await setDoc(projectRef, sanitizedMetadata, { merge: true });
        } else {
            // Document exists and we can read it - use UPDATE operation (triggers update rules)
            // Remove createdAt from update to preserve original creation timestamp
            console.log('[firestoreSync] Updating existing project document');
            const { createdAt, ...updateData } = sanitizedMetadata;
            await setDoc(projectRef, updateData, { merge: true });
        }

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
    } catch (error: any) {
        // Enhanced error logging with specific details
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.error('[firestoreSync] Permission Error Details:', {
                error: error.message,
                code: error.code,
                projectId: projectId,
                userId: userId,
                hint: 'Check: 1) User is authenticated, 2) userId matches auth.uid, 3) All required fields present'
            });
        } else {
            console.error('[firestoreSync] Error syncing project:', error);
        }
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

        // Determine which baseModelIds to fetch
        // 1. Use the explicit list from project data if available
        const stylingModelIds = new Set<string>(projectData.stylingModelIds || []);

        // 2. Infer from generatedModelHistory (find all root ancestors)
        if (generatedModelHistory.length > 0) {
            generatedModelHistory.forEach(item => {
                if (item.baseModelId) {
                    stylingModelIds.add(item.baseModelId);
                }
            });
        }

        console.log(`[firestoreSync] Loading styling history for ${stylingModelIds.size} models:`, Array.from(stylingModelIds));

        // Fetch each styling history collection
        for (const baseModelId of stylingModelIds) {
            // Skip if invalid ID
            if (!baseModelId) continue;

            const historyItems = await loadHistoryItems(projectId, baseModelId);
            if (historyItems.length > 0) {
                stylingHistory[baseModelId] = historyItems;
            }
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
 * Load all projects for a user from Firestore
 * Used when logging in on a new device to populate IndexedDB
 */
export const loadAllUserProjectsFromFirestore = async (
    userId: string
): Promise<Project[]> => {
    try {
        console.log('[firestoreSync] Loading all projects for user from Firestore:', userId);

        // Query all projects where userId matches
        const projectsQuery = query(
            collection(db, 'projects'),
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(projectsQuery);

        const projects: Project[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            projects.push({
                id: doc.id,
                title: data.title || 'Untitled Project',
                description: data.description || '',
                organization: data.organization || '',
                clientDetails: data.clientDetails || { name: '', email: '', phone: '', location: '' },
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                deadline: data.deadline || '',
                tags: data.tags || [],
                status: data.status || 'Draft',
            });
        });

        console.log(`[firestoreSync] Loaded ${projects.length} projects from Firestore`);
        return projects;
    } catch (error: any) {
        console.error('[firestoreSync] Error loading projects from Firestore:', error);
        return [];
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

        // STEP 3: Add/update current items with validation
        let skippedCount = 0;
        historyItems.forEach((item) => {
            // Validate required fields per Firestore rules
            if (!item.type || !item.imageUrl) {
                console.warn(`[firestoreSync] Skipping history item ${item.id} - missing required fields (type: ${!!item.type}, imageUrl: ${!!item.imageUrl})`);
                skippedCount++;
                return;
            }

            // Validate type is one of allowed values
            const allowedTypes = ['model-generation', 'model-revision', 'try-on', 'try-on-revision'];
            if (!allowedTypes.includes(item.type)) {
                console.warn(`[firestoreSync] Skipping history item ${item.id} - invalid type: ${item.type}`);
                skippedCount++;
                return;
            }

            // Validate imageUrl format (must be Firebase Storage or data:image URL)
            const isValidUrl = item.imageUrl.startsWith('https://firebasestorage.googleapis.com/') ||
                item.imageUrl.startsWith('https://storage.googleapis.com/') ||
                item.imageUrl.startsWith('data:image/');

            if (!isValidUrl) {
                console.warn(`[firestoreSync] Skipping history item ${item.id} - invalid imageUrl format (must be Firebase Storage or data:image URL)`);
                skippedCount++;
                return;
            }

            const itemRef = doc(collectionRef, item.id);
            // Sanitize item to convert undefined to null (Firestore requirement)
            const sanitizedItem = sanitizeForFirestore({
                ...item,
                updatedAt: serverTimestamp(),
            });
            batch.set(itemRef, sanitizedItem, { merge: true });
        });

        await batch.commit();
        console.log(`[firestoreSync] Synced ${historyItems.length - skippedCount} history items to ${collectionPath}${skippedCount > 0 ? ` (skipped ${skippedCount} invalid items)` : ''}${deletedCount > 0 ? `, deleted ${deletedCount} orphaned items` : ''}`);
    } catch (error: any) {
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.error('[firestoreSync] Permission error syncing history items. Check that all items have valid type and imageUrl fields.');
        }
        console.error('[firestoreSync] Error syncing history items:', error);
        throw error;
    }
};

/**
 * Load history items from Firestore
 */
export const loadHistoryItems = async (
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
                outfitGarmentIds: data.outfitGarmentIds, // Added for outfit persistence
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

/**
 * Delete a single history item from Firestore
 * @param projectId - Project ID
 * @param collectionPath - Path to history collection (e.g., 'generatedModelHistory' or 'stylingHistory/baseModelId')
 * @param itemId - History item ID to delete
 */
export const deleteHistoryItemFromFirestore = async (
    projectId: string,
    collectionPath: string,
    itemId: string
): Promise<void> => {
    try {
        const itemRef = doc(db, 'projects', projectId, collectionPath, itemId);
        await deleteDoc(itemRef);
        console.log(`[firestoreSync] Deleted history item ${itemId} from ${collectionPath}`);
    } catch (error) {
        console.error('[firestoreSync] Error deleting history item:', error);
        throw error;
    }
};

/**
 * Delete a project and all its subcollections from Firestore
 * @param projectId - Project ID to delete
 * @param userId - User ID (for verification)
 */
export const deleteProjectFromFirestore = async (
    projectId: string,
    userId: string
): Promise<void> => {
    try {
        console.log('[firestoreSync] Deleting project from Firestore:', projectId);

        // Verify authentication
        const { auth } = await import('./firebase');
        const currentUser = auth.currentUser;

        if (!currentUser || currentUser.uid !== userId) {
            throw new Error('[firestoreSync] User not authenticated or userId mismatch');
        }

        // Use batch for atomic deletion
        const batch = writeBatch(db);

        // 1. Delete all history items in generatedModelHistory subcollection
        const historySnapshot = await getDocs(
            collection(db, 'projects', projectId, 'generatedModelHistory')
        );
        historySnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. Delete all styling history subcollections
        try {
            // Determine which collections to delete
            // We need to know the baseModelIds to find the collections
            // Since we can't list collections in client SDK, we rely on:
            // 1. stylingModelIds field in project doc (if we can read it first)
            // 2. generatedModelHistory to infer baseModelIds

            const stylingModelIds = new Set<string>();

            // Try to read project doc first to get stylingModelIds
            try {
                const projectSnap = await getDoc(doc(db, 'projects', projectId));
                if (projectSnap.exists()) {
                    const data = projectSnap.data();
                    if (data.stylingModelIds && Array.isArray(data.stylingModelIds)) {
                        data.stylingModelIds.forEach((id: string) => stylingModelIds.add(id));
                    }
                }
            } catch (e) {
                console.warn('[firestoreSync] Could not read project doc for deletion cleanup:', e);
            }

            // Also infer from generatedModelHistory (which we just deleted, but we can't read it now)
            // Ideally we should have read it before deleting, but for now we rely on the project doc
            // or we could query the generatedModelHistory before deleting it.

            // Let's try to be thorough: if we have the list, delete them.
            // If not, we might leave some orphaned collections, but that's a limitation of client SDK.

            console.log(`[firestoreSync] Deleting styling history collections for:`, Array.from(stylingModelIds));

            for (const baseModelId of stylingModelIds) {
                const itemsSnapshot = await getDocs(
                    collection(db, 'projects', projectId, baseModelId)
                );
                itemsSnapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }
        } catch (error) {
            console.warn('[firestoreSync] Styling history deletion failed:', error);
        }

        // 3. Delete all wardrobe items
        const wardrobeSnapshot = await getDocs(
            collection(db, 'projects', projectId, 'wardrobe')
        );
        wardrobeSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 4. Delete the project document itself
        batch.delete(doc(db, 'projects', projectId));

        // Commit the batch
        await batch.commit();

        console.log('[firestoreSync] Project deleted successfully from Firestore');
    } catch (error) {
        console.error('[firestoreSync] Error deleting project from Firestore:', error);
        throw error;
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
 * Subscribe to styling history changes for a specific base model
 * Enables real-time sync of Image Studio version history across devices
 */
export const subscribeToStylingHistory = (
    projectId: string,
    baseModelId: string,
    onUpdate: (historyItems: HistoryItem[]) => void
): Unsubscribe => {
    console.log('[firestoreSync] Subscribing to styling history:', { projectId, baseModelId });

    const stylingHistoryRef = collection(db, 'projects', projectId, baseModelId);

    return onSnapshot(stylingHistoryRef, (snapshot) => {
        const historyItems: HistoryItem[] = [];

        snapshot.forEach((doc) => {
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
                outfitGarmentIds: data.outfitGarmentIds, // Added for outfit persistence
            });
        });

        // Sort by timestamp in ID
        const sortedItems = historyItems.sort((a, b) => {
            const aTime = parseInt(a.id.split('-').pop() || '0');
            const bTime = parseInt(b.id.split('-').pop() || '0');
            return aTime - bTime;
        });

        console.log(`[firestoreSync] Styling history updated: ${sortedItems.length} items for ${baseModelId}`);
        onUpdate(sortedItems);
    }, (error: any) => {
        // Handle permission errors gracefully
        if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
            console.log('[firestoreSync] Styling history not yet synced to Firestore, skipping real-time updates');
            onUpdate([]);
            return;
        }
        console.error('[firestoreSync] Error in styling history subscription:', error);
        onUpdate([]);
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
