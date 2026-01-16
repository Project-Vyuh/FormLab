/**
 * Thumbnail Service
 * 
 * Client-side thumbnail generation and upload utilities for optimized image loading.
 * Generates WebP thumbnails at 200x300px for model images.
 */

import { uploadBase64Image } from './storageService';

const THUMBNAIL_MAX_WIDTH = 200;
const THUMBNAIL_MAX_HEIGHT = 300;
const THUMBNAIL_QUALITY = 0.8;

/**
 * Fetches an image as a blob to avoid CORS issues
 * @param imageUrl - Source image URL
 * @returns Blob URL that can be used in canvas
 */
async function fetchImageAsBlob(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

/**
 * Generates a thumbnail from an image URL using canvas
 * Uses fetch to avoid CORS issues with cross-origin images
 * @param imageUrl - Source image URL (Firebase Storage, data:, or blob:)
 * @param maxWidth - Maximum thumbnail width (default: 200)
 * @param maxHeight - Maximum thumbnail height (default: 300)
 * @returns WebP data URL of the thumbnail
 */
export async function generateClientThumbnail(
    imageUrl: string,
    maxWidth: number = THUMBNAIL_MAX_WIDTH,
    maxHeight: number = THUMBNAIL_MAX_HEIGHT
): Promise<string> {
    // For Firebase Storage URLs, fetch as blob first to avoid CORS issues
    let safeImageUrl = imageUrl;
    if (imageUrl.includes('firebasestorage.googleapis.com')) {
        try {
            safeImageUrl = await fetchImageAsBlob(imageUrl);
        } catch (fetchError) {
            console.warn('[ThumbnailService] Could not fetch image, will try direct load:', fetchError);
            // Fall through and try direct load
        }
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        // Only set crossOrigin for non-blob URLs
        if (!safeImageUrl.startsWith('blob:')) {
            img.crossOrigin = 'anonymous';
        }

        img.onload = () => {
            try {
                // Calculate dimensions maintaining aspect ratio
                let width = img.naturalWidth;
                let height = img.naturalHeight;

                // Scale down to fit within max dimensions
                if (width > maxWidth) {
                    const scale = maxWidth / width;
                    width = maxWidth;
                    height = height * scale;
                }
                if (height > maxHeight) {
                    const scale = maxHeight / height;
                    height = maxHeight;
                    width = width * scale;
                }

                // Create canvas and draw scaled image
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(width);
                canvas.height = Math.round(height);

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Use high-quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Convert to WebP data URL
                const dataUrl = canvas.toDataURL('image/webp', THUMBNAIL_QUALITY);

                // Cleanup blob URL if we created one
                if (safeImageUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(safeImageUrl);
                }

                resolve(dataUrl);
            } catch (error) {
                // Cleanup on error
                if (safeImageUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(safeImageUrl);
                }
                reject(error);
            }
        };

        img.onerror = () => {
            // Cleanup on error
            if (safeImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(safeImageUrl);
            }
            reject(new Error(`Failed to load image: ${imageUrl.substring(0, 100)}...`));
        };

        img.src = safeImageUrl;
    });
}

/**
 * Generates a thumbnail and uploads it to Firebase Storage
 * @param imageUrl - Source image URL
 * @param userId - User ID for storage path
 * @param fileName - Base file name for the thumbnail
 * @returns Firebase Storage URL of the uploaded thumbnail
 */
export async function generateAndUploadThumbnail(
    imageUrl: string,
    userId: string,
    fileName: string
): Promise<string> {
    try {
        // Generate thumbnail as data URL
        const thumbnailDataUrl = await generateClientThumbnail(imageUrl);

        // Upload to Firebase Storage
        const thumbnailUrl = await uploadBase64Image(
            thumbnailDataUrl,
            userId,
            'models', // Store in models folder
            `${fileName}_thumb.webp`
        );

        console.log(`[ThumbnailService] Generated and uploaded thumbnail: ${thumbnailUrl.substring(0, 60)}...`);
        return thumbnailUrl;
    } catch (error) {
        console.error('[ThumbnailService] Failed to generate/upload thumbnail:', error);
        throw error;
    }
}

/**
 * Checks if an image URL is a thumbnail (already optimized)
 * @param url - Image URL to check
 * @returns true if the URL appears to be a thumbnail
 */
export function isThumbnailUrl(url: string): boolean {
    return url.includes('_thumb.webp') || url.includes('thumbnails/');
}
