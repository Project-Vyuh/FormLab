/**
 * Thumbnail Generation Script
 * 
 * Generates 200x300px WebP thumbnails for all pre-defined models
 * and uploads them to Firebase Storage, then updates Firestore.
 * 
 * Run with: npx tsx scripts/generateThumbnails.ts
 */

import admin from 'firebase-admin';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service account key
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Service account key not found at:', serviceAccountPath);
    console.error('   Please download it from Firebase Console and save as serviceAccountKey.json');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin SDK with service account
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'formlab-42fae.firebasestorage.app'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const THUMBNAIL_WIDTH = 200;
const THUMBNAIL_HEIGHT = 300;
const COLLECTION_NAME = 'predefined_models';
const THUMBNAIL_FOLDER = 'thumbnails/models';

interface PredefinedModel {
    id: string;
    url: string;
    thumbnail?: string;
    name: string;
}

async function downloadImage(url: string): Promise<Buffer> {
    console.log(`  📥 Downloading from: ${url.substring(0, 80)}...`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function generateThumbnail(imageBuffer: Buffer): Promise<Buffer> {
    return sharp(imageBuffer)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
            fit: 'cover',
            position: 'top' // Focus on face/top of model
        })
        .webp({ quality: 80 })
        .toBuffer();
}

async function uploadThumbnail(thumbnailBuffer: Buffer, modelId: string): Promise<string> {
    const fileName = `${THUMBNAIL_FOLDER}/${modelId}_thumb.webp`;
    const file = bucket.file(fileName);

    await file.save(thumbnailBuffer, {
        metadata: {
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000' // 1 year cache
        }
    });

    // Make the file public and get the URL
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    return publicUrl;
}

async function updateFirestoreDocument(docId: string, thumbnailUrl: string): Promise<void> {
    await db.collection(COLLECTION_NAME).doc(docId).update({
        thumbnail: thumbnailUrl
    });
}

async function processModel(model: PredefinedModel): Promise<boolean> {
    try {
        console.log(`\n🖼️  Processing: ${model.name || model.id}`);

        // Skip if already has thumbnail
        if (model.thumbnail && model.thumbnail.includes('_thumb.webp')) {
            console.log(`  ⏭️  Already has thumbnail, skipping`);
            return true;
        }

        // Download original image
        const imageBuffer = await downloadImage(model.url);
        console.log(`  ✓ Downloaded (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

        // Generate thumbnail
        const thumbnailBuffer = await generateThumbnail(imageBuffer);
        console.log(`  ✓ Thumbnail generated (${(thumbnailBuffer.length / 1024).toFixed(1)} KB)`);

        // Upload to Firebase Storage
        const thumbnailUrl = await uploadThumbnail(thumbnailBuffer, model.id);
        console.log(`  ✓ Uploaded to: ${thumbnailUrl.substring(0, 60)}...`);

        // Update Firestore
        await updateFirestoreDocument(model.id, thumbnailUrl);
        console.log(`  ✓ Firestore updated`);

        return true;
    } catch (error) {
        console.error(`  ❌ Error processing ${model.id}:`, error);
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('🚀 Thumbnail Generation Script');
    console.log('='.repeat(60));
    console.log(`\nTarget: ${COLLECTION_NAME} collection`);
    console.log(`Thumbnail size: ${THUMBNAIL_WIDTH}x${THUMBNAIL_HEIGHT}px WebP`);
    console.log(`Output folder: ${THUMBNAIL_FOLDER}\n`);

    try {
        // Fetch all pre-defined models
        const snapshot = await db.collection(COLLECTION_NAME).get();
        const models: PredefinedModel[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as PredefinedModel));

        console.log(`Found ${models.length} models to process\n`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const model of models) {
            const success = await processModel(model);
            if (success) {
                if (model.thumbnail && model.thumbnail.includes('_thumb.webp')) {
                    skipCount++;
                } else {
                    successCount++;
                }
            } else {
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Summary');
        console.log('='.repeat(60));
        console.log(`✅ Successfully processed: ${successCount}`);
        console.log(`⏭️  Already had thumbnails: ${skipCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📦 Total models: ${models.length}`);

        if (successCount > 0) {
            console.log('\n✨ Thumbnails generated and uploaded successfully!');
            console.log('   Clear your browser cache and reload the app to see the improvement.');
        }

    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run the script
main();
