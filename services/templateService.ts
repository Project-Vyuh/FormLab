/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { uploadBase64Image } from './storageService';
import { saveUserTemplate, getUserTemplate, loadUserTemplates, PredefinedTemplate, UserTemplate } from './firestoreService';

/**
 * Template Type Definitions
 */

export interface TemplateCreateData {
  name: string;
  description: string;
  type: 'models' | 'wardrobe';
  gender?: 'male' | 'female' | 'lgbtq+';
  category?: string;
  thumbnail: File | string; // File object or base64 string
  modelId?: string;
  wardrobeItemIds?: string[];
  tags?: string[];
}

export interface Template {
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
  isStarred: boolean;
  downloads?: number;
  createdAt: string;
  source: 'user' | 'predefined';
}

/**
 * Save a new template
 */
export async function createTemplate(
  userId: string,
  templateData: TemplateCreateData
): Promise<string> {
  try {
    // Upload thumbnail to Firebase Storage
    let thumbnailUrl: string;

    if (typeof templateData.thumbnail === 'string') {
      // Base64 string
      thumbnailUrl = await uploadBase64Image(
        templateData.thumbnail,
        userId,
        'templates',
        `template_${Date.now()}.jpg`
      );
    } else {
      // File object - convert to base64 first
      const base64 = await fileToBase64(templateData.thumbnail);
      thumbnailUrl = await uploadBase64Image(
        base64,
        userId,
        'templates',
        `template_${Date.now()}.jpg`
      );
    }

    // Prepare template data
    const template: Omit<UserTemplate, 'id' | 'userId' | 'createdAt' | 'source'> = {
      name: templateData.name,
      description: templateData.description,
      thumbnail: thumbnailUrl,
      category: templateData.type,
      type: determineTemplateType(templateData),
      modelId: templateData.modelId,
      wardrobeItemIds: templateData.wardrobeItemIds,
      gender: templateData.gender,
      wardrobeCategory: templateData.category,
      tags: templateData.tags || [],
      isStarred: false,
    };

    // Save to Firestore
    const templateId = await saveUserTemplate(userId, template);
    console.log('Template created successfully:', templateId);
    return templateId;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

/**
 * Load a template by ID
 */
export async function loadTemplate(
  userId: string,
  templateId: string
): Promise<Template | null> {
  try {
    const template = await getUserTemplate(userId, templateId);
    if (!template) return null;

    return {
      ...template,
      downloads: 0, // User templates don't have downloads
    };
  } catch (error) {
    console.error('Error loading template:', error);
    return null;
  }
}

/**
 * Load all templates for a user
 */
export async function loadAllUserTemplates(userId: string): Promise<Template[]> {
  try {
    const templates = await loadUserTemplates(userId);
    return templates.map(t => ({
      ...t,
      downloads: 0,
    }));
  } catch (error) {
    console.error('Error loading user templates:', error);
    return [];
  }
}

/**
 * Apply a model template (load model into Image Studio)
 */
export interface ApplyModelTemplateResult {
  modelId: string;
  modelUrl: string;
}

export async function applyModelTemplate(
  template: Template | PredefinedTemplate,
  modelsData: any[]
): Promise<ApplyModelTemplateResult | null> {
  if (!template.modelId) {
    console.error('Template does not have a model ID');
    return null;
  }

  // Find the model in the provided models data
  const model = modelsData.find(m => m.id === template.modelId);
  if (!model) {
    console.error('Model not found:', template.modelId);
    return null;
  }

  return {
    modelId: model.id,
    modelUrl: model.url,
  };
}

/**
 * Apply a wardrobe template (load outfit items into outfit stack)
 */
export interface ApplyWardrobeTemplateResult {
  wardrobeItems: any[];
}

export async function applyWardrobeTemplate(
  template: Template | PredefinedTemplate,
  wardrobeData: any[]
): Promise<ApplyWardrobeTemplateResult | null> {
  if (!template.wardrobeItemIds || template.wardrobeItemIds.length === 0) {
    console.error('Template does not have wardrobe item IDs');
    return null;
  }

  // Find all wardrobe items
  const items = template.wardrobeItemIds
    .map(id => wardrobeData.find(w => w.id === id))
    .filter(Boolean);

  if (items.length === 0) {
    console.error('No wardrobe items found for template');
    return null;
  }

  return {
    wardrobeItems: items,
  };
}

/**
 * Export template as JSON
 */
export function exportTemplate(template: Template): string {
  return JSON.stringify(template, null, 2);
}

/**
 * Import template from JSON
 */
export function importTemplate(jsonData: string): Template | null {
  try {
    const template = JSON.parse(jsonData) as Template;

    // Validate required fields
    if (!template.id || !template.name || !template.thumbnail || !template.category) {
      throw new Error('Invalid template structure');
    }

    return template;
  } catch (error) {
    console.error('Error importing template:', error);
    return null;
  }
}

/**
 * Helper: Convert File to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Helper: Determine template type
 */
function determineTemplateType(data: TemplateCreateData): 'model' | 'outfit' | 'complete' {
  if (data.modelId && data.wardrobeItemIds && data.wardrobeItemIds.length > 0) {
    return 'complete';
  } else if (data.modelId) {
    return 'model';
  } else if (data.wardrobeItemIds && data.wardrobeItemIds.length > 0) {
    return 'outfit';
  }
  return 'model'; // Default
}
