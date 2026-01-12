/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { removeBackground, Config } from '@imgly/background-removal';

/**
 * Progress callback for background removal
 */
export type BackgroundRemovalProgressCallback = (progress: {
    status: 'downloading' | 'processing' | 'complete';
    percentage: number;
}) => void;

/**
 * Remove background from an image file
 * @param imageFile - The image file to process
 * @param onProgress - Optional progress callback
 * @returns Promise<Blob> - Transparent PNG blob
 */
export async function removeImageBackground(
    imageFile: File,
    onProgress?: BackgroundRemovalProgressCallback
): Promise<Blob> {
    try {
        console.log('[backgroundRemovalService] Starting background removal for:', imageFile.name);

        if (onProgress) {
            onProgress({ status: 'downloading', percentage: 0 });
        }

        // Configure background removal
        const config: Config = {
            model: 'isnet', // Use standard isnet model
            output: {
                format: 'image/png',
                quality: 0.9
            },
            progress: (key, current, total) => {
                if (onProgress) {
                    const percentage = Math.round((current / total) * 100);
                    console.log(`[backgroundRemovalService] ${key}: ${percentage}%`);

                    if (key === 'fetch:model') {
                        onProgress({ status: 'downloading', percentage });
                    } else if (key === 'compute:inference') {
                        onProgress({ status: 'processing', percentage });
                    }
                }
            }
        };

        // Remove background
        const blob = await removeBackground(imageFile, config);

        if (onProgress) {
            onProgress({ status: 'complete', percentage: 100 });
        }

        console.log('[backgroundRemovalService] Background removal complete:', blob.size, 'bytes');
        return blob;

    } catch (error) {
        console.error('[backgroundRemovalService] Background removal failed:', error);
        throw new Error('Failed to remove background. Please try again.');
    }
}

/**
 * Check if an image already has a transparent background
 * @param imageFile - The image file to check
 * @returns Promise<boolean>
 */
export async function hasTransparentBackground(imageFile: File): Promise<boolean> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(false);
                    return;
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Check if any pixel has alpha < 255 (transparent)
                for (let i = 3; i < imageData.data.length; i += 4) {
                    if (imageData.data[i] < 255) {
                        resolve(true);
                        return;
                    }
                }

                resolve(false);
            };
            img.onerror = () => resolve(false);
            img.src = e.target?.result as string;
        };
        reader.onerror = () => resolve(false);
        reader.readAsDataURL(imageFile);
    });
}
