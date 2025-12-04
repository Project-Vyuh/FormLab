/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, getDocs, doc, setDoc, getDoc, query, where, DocumentData, onSnapshot, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Collection names
export const PREDEFINED_MODELS_COLLECTION = 'predefined_models';
export const PREDEFINED_WARDROBE_COLLECTION = 'predefined_wardrobe';
export const PREDEFINED_TEMPLATES_COLLECTION = 'predefined_templates';
export const USER_TEMPLATES_COLLECTION = 'user_templates';

// Cache keys and duration
const CACHE_KEY_PREFIX = 'formlab-predefined';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * Generic cache helper
 */
function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}-${key}`);
    if (!cached) return null;

    const { data, timestamp }: CachedData<T> = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_DURATION) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}-${key}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`Error reading cache for ${key}:`, error);
    return null;
  }
}

function setCachedData<T>(key: string, data: T): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${CACHE_KEY_PREFIX}-${key}`, JSON.stringify(cached));
  } catch (error) {
    console.error(`Error setting cache for ${key}:`, error);
  }
}

/**
 * Pre-Defined Models
 */

export interface PredefinedModel {
  id: string;
  url: string;
  thumbnail?: string;
  gender: 'male' | 'female' | 'non-binary';
  tags: string[];
  name: string;
  source: 'predefined';
}

export async function loadPredefinedModels(): Promise<PredefinedModel[]> {
  // Check cache first
  const cached = getCachedData<PredefinedModel[]>('models');
  if (cached) {
    console.log('Loading pre-defined models from cache');
    return cached;
  }

  try {
    console.log('Fetching pre-defined models from Firestore');
    const querySnapshot = await getDocs(collection(db, PREDEFINED_MODELS_COLLECTION));
    const models: PredefinedModel[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedModel, 'id' | 'source'>),
      source: 'predefined' as const,
    }));

    // Cache the result
    setCachedData('models', models);
    console.log(`Loaded ${models.length} pre-defined models`);
    return models;
  } catch (error) {
    console.error('Error loading pre-defined models:', error);
    return [];
  }
}

export async function loadPredefinedModelsByGender(gender: 'male' | 'female' | 'non-binary'): Promise<PredefinedModel[]> {
  try {
    const q = query(collection(db, PREDEFINED_MODELS_COLLECTION), where('gender', '==', gender));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedModel, 'id' | 'source'>),
      source: 'predefined' as const,
    }));
  } catch (error) {
    console.error(`Error loading pre-defined models for gender ${gender}:`, error);
    return [];
  }
}

/**
 * Pre-Defined Wardrobe Items
 */

export interface PredefinedWardrobeItem {
  id: string;
  sku: string;
  name: string;
  url: string;
  images?: { front: string; back?: string; detail?: string };
  colorways?: string[];
  category: string;
  subcategory: string;
  color: string;
  fabric: string;
  print: string;
  fit: 'oversized' | 'cropped' | 'slim' | 'relaxed' | 'tailored';
  season: string;
  gender: 'menswear' | 'womenswear' | 'unisex';
  priceTier: 'basic' | 'premium' | 'luxury';
  tags: {
    styling: string[];
    campaign: string[];
  };
  notes?: string;
  source: 'predefined';
}

export async function loadPredefinedWardrobe(): Promise<PredefinedWardrobeItem[]> {
  // Check cache first
  const cached = getCachedData<PredefinedWardrobeItem[]>('wardrobe');
  if (cached) {
    console.log('Loading pre-defined wardrobe from cache');
    return cached;
  }

  try {
    console.log('Fetching pre-defined wardrobe from Firestore');
    const querySnapshot = await getDocs(collection(db, PREDEFINED_WARDROBE_COLLECTION));
    const wardrobe: PredefinedWardrobeItem[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedWardrobeItem, 'id' | 'source'>),
      source: 'predefined' as const,
    }));

    // Cache the result
    setCachedData('wardrobe', wardrobe);
    console.log(`Loaded ${wardrobe.length} pre-defined wardrobe items`);
    return wardrobe;
  } catch (error) {
    console.error('Error loading pre-defined wardrobe:', error);
    return [];
  }
}

export async function loadPredefinedWardrobeByCategory(category: string): Promise<PredefinedWardrobeItem[]> {
  try {
    const q = query(collection(db, PREDEFINED_WARDROBE_COLLECTION), where('category', '==', category));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedWardrobeItem, 'id' | 'source'>),
      source: 'predefined' as const,
    }));
  } catch (error) {
    console.error(`Error loading pre-defined wardrobe for category ${category}:`, error);
    return [];
  }
}

/**
 * Pre-Defined Templates
 */

export interface PredefinedTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: 'models' | 'wardrobe';
  type: 'model' | 'outfit' | 'complete';

  // References
  modelId?: string;
  wardrobeItemIds?: string[];

  // Metadata
  gender?: 'male' | 'female' | 'lgbtq+';
  wardrobeCategory?: string;
  tags: string[];
  downloads: number;
  createdAt: string;
  source: 'predefined';
}

export async function loadPredefinedTemplates(): Promise<PredefinedTemplate[]> {
  // Check cache first
  const cached = getCachedData<PredefinedTemplate[]>('templates');
  if (cached) {
    console.log('Loading pre-defined templates from cache');
    return cached;
  }

  try {
    console.log('Fetching pre-defined templates from Firestore');
    const querySnapshot = await getDocs(collection(db, PREDEFINED_TEMPLATES_COLLECTION));
    const templates: PredefinedTemplate[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as Omit<PredefinedTemplate, 'id' | 'source'>),
      source: 'predefined' as const,
    }));

    // Cache the result
    setCachedData('templates', templates);
    console.log(`Loaded ${templates.length} pre-defined templates`);
    return templates;
  } catch (error) {
    console.error('Error loading pre-defined templates:', error);
    return [];
  }
}

/**
 * User Templates (user-created templates saved to Firestore)
 */

export interface UserTemplate extends Omit<PredefinedTemplate, 'source' | 'downloads'> {
  userId: string;
  source: 'user';
  isStarred: boolean;
}

export async function saveUserTemplate(userId: string, template: Omit<UserTemplate, 'id' | 'userId' | 'createdAt' | 'source'>): Promise<string> {
  try {
    const templateId = `template-${Date.now()}`;
    const templateData: UserTemplate = {
      ...template,
      id: templateId,
      userId,
      createdAt: new Date().toISOString(),
      source: 'user',
    };

    await setDoc(doc(db, USER_TEMPLATES_COLLECTION, `${userId}_${templateId}`), templateData);
    console.log('User template saved:', templateId);
    return templateId;
  } catch (error) {
    console.error('Error saving user template:', error);
    throw error;
  }
}

export async function loadUserTemplates(userId: string): Promise<UserTemplate[]> {
  try {
    const q = query(collection(db, USER_TEMPLATES_COLLECTION), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as UserTemplate);
  } catch (error) {
    console.error('Error loading user templates:', error);
    return [];
  }
}

export async function getUserTemplate(userId: string, templateId: string): Promise<UserTemplate | null> {
  try {
    const docRef = doc(db, USER_TEMPLATES_COLLECTION, `${userId}_${templateId}`);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as UserTemplate;
    }
    return null;
  } catch (error) {
    console.error('Error getting user template:', error);
    return null;
  }
}

/**
 * Clear all cached pre-defined content
 */
export function clearPredefinedCache(): void {
  ['models', 'wardrobe', 'templates'].forEach(key => {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}-${key}`);
  });
  console.log('Pre-defined content cache cleared');
}

/**
 * Load all pre-defined content at once
 */
export async function loadAllPredefinedContent() {
  const [models, wardrobe, templates] = await Promise.all([
    loadPredefinedModels(),
    loadPredefinedWardrobe(),
    loadPredefinedTemplates(),
  ]);

  return {
    models,
    wardrobe,
    templates,
  };
}
/**
 * Upscale Requests
 */

export const UPSCALE_REQUESTS_COLLECTION = 'upscale_requests';

export interface UpscaleRequest {
  id: string;
  userId: string;
  imageUrl: string;
  resolution: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createUpscaleRequest(userId: string, imageUrl: string, resolution: string): Promise<string> {
  try {
    const requestId = `upscale-${Date.now()}`;
    const requestData: UpscaleRequest = {
      id: requestId,
      userId,
      imageUrl,
      resolution,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, UPSCALE_REQUESTS_COLLECTION, requestId), requestData);
    console.log('Upscale request created:', requestId);
    return requestId;
  } catch (error) {
    console.error('Error creating upscale request:', error);
    throw error;
  }
}

export function listenToUpscaleRequest(requestId: string, onUpdate: (request: UpscaleRequest) => void): () => void {
  const docRef = doc(db, UPSCALE_REQUESTS_COLLECTION, requestId);

  const unsubscribe = onSnapshot(docRef, (doc: any) => {
    if (doc.exists()) {
      onUpdate(doc.data() as UpscaleRequest);
    }
  });

  return unsubscribe;
}

/**
 * Global Assets (Enterprise Data Sync)
 */

export interface GlobalModel {
  id: string;
  userId: string;
  url: string;
  name: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  source: 'user-global';
  projectId?: string; // Origin project
  historyItemId?: string; // Origin history item
  sourceTemplateId?: string; // ID of the template this model was created from
}

export interface GlobalWardrobeItem {
  id: string;
  userId: string;
  url: string;
  name: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  source: 'user-global';
  projectId?: string; // Origin project
}

// --- Global Models Functions ---

export async function saveGlobalModel(userId: string, model: Omit<GlobalModel, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'source'>): Promise<string> {
  try {
    const modelId = `model-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const modelData: GlobalModel = {
      ...model,
      id: modelId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'user-global',
    };

    await setDoc(doc(db, 'users', userId, 'models', modelId), modelData);
    console.log('Global model saved:', modelId);
    return modelId;
  } catch (error) {
    console.error('Error saving global model:', error);
    throw error;
  }
}

export async function getGlobalModels(userId: string, projectId?: string): Promise<GlobalModel[]> {
  try {
    let q = query(collection(db, 'users', userId, 'models'));
    if (projectId) {
      q = query(q, where('projectId', '==', projectId));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as GlobalModel);
  } catch (error) {
    console.error('Error loading global models:', error);
    return [];
  }
}

export async function deleteGlobalModel(userId: string, modelId: string): Promise<void> {
  try {
    console.log('[deleteGlobalModel] Attempting to delete model:', { userId, modelId });

    // Validate inputs
    if (!userId || !modelId) {
      throw new Error(`Invalid parameters: userId=${userId}, modelId=${modelId}`);
    }

    // Check if modelId contains invalid characters for Firestore
    if (modelId.includes('/')) {
      console.warn('[deleteGlobalModel] Model ID contains invalid characters:', modelId);
      throw new Error(`Invalid model ID format: ${modelId}`);
    }

    // Try direct deletion first (for new models with Firestore IDs)
    try {
      const directRef = doc(db, 'users', userId, 'models', modelId);
      const directDoc = await getDoc(directRef);

      if (directDoc.exists()) {
        await deleteDoc(directRef);
        console.log('[deleteGlobalModel] Model deleted (direct):', modelId);
        return;
      }
      console.log('[deleteGlobalModel] Model not found with direct ID, trying historyItemId lookup');
    } catch (directError) {
      console.error('[deleteGlobalModel] Direct deletion failed:', directError);
      // Continue to fallback method
    }

    // If direct lookup fails, try to find by historyItemId (for old models)
    // Extract historyItemId from old format: project-xxx-rev-yyy -> rev-yyy
    const historyItemId = modelId.includes('-rev-')
      ? modelId.substring(modelId.lastIndexOf('-rev-') + 1)
      : null;

    console.log('[deleteGlobalModel] Extracted historyItemId:', historyItemId);

    if (historyItemId) {
      const q = query(
        collection(db, 'users', userId, 'models'),
        where('historyItemId', '==', historyItemId)
      );
      const querySnapshot = await getDocs(q);

      console.log('[deleteGlobalModel] Query results:', querySnapshot.size, 'documents found');

      if (!querySnapshot.empty) {
        // Delete the first matching document
        await deleteDoc(querySnapshot.docs[0].ref);
        console.log('[deleteGlobalModel] Model deleted (by historyItemId):', historyItemId);
        return;
      }
    }

    console.warn('[deleteGlobalModel] Model not found in Firestore:', modelId);
    throw new Error(`Model not found: ${modelId}`);
  } catch (error) {
    console.error('[deleteGlobalModel] Error deleting global model:', error);
    throw error;
  }
}

export async function renameGlobalModel(userId: string, modelId: string, newName: string): Promise<void> {
  try {
    const modelRef = doc(db, 'users', userId, 'models', modelId);
    await updateDoc(modelRef, {
      name: newName,
      updatedAt: new Date().toISOString()
    });
    console.log('Global model renamed:', modelId);
  } catch (error) {
    console.error('Error renaming global model:', error);
    throw error;
  }
}

// --- Global Wardrobe Functions ---

export async function saveGlobalWardrobeItem(userId: string, item: Omit<GlobalWardrobeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'source'>): Promise<string> {
  try {
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const itemData: GlobalWardrobeItem = {
      ...item,
      id: itemId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'user-global',
    };

    await setDoc(doc(db, 'users', userId, 'wardrobe', itemId), itemData);
    console.log('Global wardrobe item saved:', itemId);
    return itemId;
  } catch (error) {
    console.error('Error saving global wardrobe item:', error);
    throw error;
  }
}

export async function getGlobalWardrobeItems(userId: string, projectId?: string): Promise<GlobalWardrobeItem[]> {
  try {
    let q = query(collection(db, 'users', userId, 'wardrobe'));
    if (projectId) {
      q = query(q, where('projectId', '==', projectId));
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data() as GlobalWardrobeItem);
  } catch (error) {
    console.error('Error loading global wardrobe items:', error);
    return [];
  }
}

/**
 * Delete a global wardrobe item
 * @param userId - User ID
 * @param itemId - Wardrobe item ID
 */
export async function deleteGlobalWardrobeItem(userId: string, itemId: string): Promise<void> {
  try {
    console.log('[deleteGlobalWardrobeItem] Deleting item:', { userId, itemId });

    if (!userId || !itemId) {
      throw new Error(`Invalid parameters: userId=${userId}, itemId=${itemId}`);
    }

    await deleteDoc(doc(db, 'users', userId, 'wardrobe', itemId));
    console.log('[deleteGlobalWardrobeItem] Item deleted:', itemId);
  } catch (error) {
    console.error('[deleteGlobalWardrobeItem] Error deleting item:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for global wardrobe items
 * @param userId - User ID
 * @param projectId - Optional Project ID to filter by
 * @param onUpdate - Callback function with updated items
 * @returns Unsubscribe function
 */
export function subscribeToGlobalWardrobe(
  userId: string,
  projectId: string | undefined,
  onUpdate: (items: GlobalWardrobeItem[]) => void
): () => void {
  let q = query(collection(db, 'users', userId, 'wardrobe'));
  if (projectId) {
    q = query(q, where('projectId', '==', projectId));
  }

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => doc.data() as GlobalWardrobeItem);
    onUpdate(items);
  }, (error) => {
    console.error("Error subscribing to global wardrobe:", error);
  });
}

/**
 * Subscribe to real-time updates for global models
 * @param userId - User ID
 * @param projectId - Optional Project ID to filter by
 * @param onUpdate - Callback function with updated models
 * @returns Unsubscribe function
 */
export function subscribeToGlobalModels(
  userId: string,
  projectId: string | undefined,
  onUpdate: (models: GlobalModel[]) => void
): () => void {
  let q = query(collection(db, 'users', userId, 'models'));
  if (projectId) {
    q = query(q, where('projectId', '==', projectId));
  }

  return onSnapshot(q, (snapshot) => {
    const models = snapshot.docs.map(doc => doc.data() as GlobalModel);
    console.log(`[subscribeToGlobalModels] Received ${models.length} models for project ${projectId || 'all'}`);
    onUpdate(models);
  }, (error) => {
    console.error("Error subscribing to global models:", error);
  });
}

/**
 * Check if a model already exists in Firestore for a specific project
 * @param userId - User ID
 * @param projectId - Project ID
 * @param historyItemId - History item ID to check
 * @returns True if model exists, false otherwise
 */
export async function checkModelExists(
  userId: string,
  projectId: string,
  historyItemId: string
): Promise<boolean> {
  try {
    const q = query(
      collection(db, 'users', userId, 'models'),
      where('projectId', '==', projectId),
      where('historyItemId', '==', historyItemId)
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking if model exists:', error);
    return false;
  }
}

/**
 * Check if a wardrobe item already exists in Firestore
 * @param userId - User ID
 * @param itemId - Item ID to check
 * @returns True if item exists, false otherwise
 */
export async function checkWardrobeItemExists(
  userId: string,
  itemId: string
): Promise<boolean> {
  try {
    const docRef = doc(db, 'users', userId, 'wardrobe', itemId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  } catch (error) {
    console.error('Error checking if wardrobe item exists:', error);
    return false;
  }
}
