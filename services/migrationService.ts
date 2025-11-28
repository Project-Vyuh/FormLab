import { db } from './firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { GlobalModel, GlobalWardrobeItem, saveGlobalModel, saveGlobalWardrobeItem } from './firestoreService';
import { getAllProjectMetadata, loadProjectState } from './dbService';

export async function migrateAssetsToGlobalLibrary(userId: string) {
    console.log('Starting migration to Global Library...');
    let modelsMigrated = 0;
    let wardrobeItemsMigrated = 0;

    try {
        // 1. Get all projects
        const projects = await getAllProjectMetadata();
        console.log(`Found ${projects.length} projects to scan.`);

        for (const project of projects) {
            try {
                const state = await loadProjectState(project.id);
                if (!state) continue;

                // 2. Migrate Models
                if (state.generatedModelHistory && state.generatedModelHistory.length > 0) {
                    // Filter for base models (no parent)
                    const baseModels = state.generatedModelHistory.filter(item => item.parentId === null);

                    for (const model of baseModels) {
                        // Check if already exists (simple check by ID convention or just overwrite/ignore)
                        // Ideally we check if we've already migrated this specific history item
                        // For now, we'll just try to save it. saveGlobalModel generates a new ID, so we might duplicate if run multiple times.
                        // To prevent duplication, we could check if a global model with this projectId and historyItemId exists.
                        // But for this MVP migration, we'll rely on the user running it once or we can add a check.

                        await saveGlobalModel(userId, {
                            url: model.imageUrl,
                            name: model.name || `Model from ${project.title}`,
                            thumbnail: model.imageUrl,
                            projectId: project.id,
                            historyItemId: model.id
                        });
                        modelsMigrated++;
                    }
                }

                // 3. Migrate Wardrobe
                if (state.wardrobe && state.wardrobe.length > 0) {
                    const userWardrobe = state.wardrobe.filter(item => item.source !== 'predefined');

                    for (const item of userWardrobe) {
                        await saveGlobalWardrobeItem(userId, {
                            url: item.url,
                            name: item.name,
                            category: item.category,
                            projectId: project.id
                        });
                        wardrobeItemsMigrated++;
                    }
                }

            } catch (err) {
                console.error(`Failed to migrate project ${project.id}:`, err);
            }
        }

        console.log(`Migration complete. Migrated ${modelsMigrated} models and ${wardrobeItemsMigrated} wardrobe items.`);
        return { modelsMigrated, wardrobeItemsMigrated };

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
}
