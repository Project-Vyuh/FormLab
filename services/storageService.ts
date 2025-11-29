/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    UploadMetadata,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * Convert base64 data URL to Blob
 */
function base64ToBlob(base64Data: string): Blob {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64String = base64Data.includes(',')
        ? base64Data.split(',')[1]
        : base64Data;

    // Detect mime type from data URL or default to image/jpeg
    const mimeType = base64Data.includes(',')
        ? base64Data.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
        : 'image/jpeg';

    // Convert base64 to binary
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: mimeType });
}

/**
 * Generate a unique file path for user uploads
 */
function generateFilePath(
    userId: string,
    category: 'models' | 'wardrobe' | 'tryons' | 'videos' | 'products',
    fileName: string,
    projectId?: string
): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');

    if (category === 'models' && projectId) {
        return `users/${userId}/models/${projectId}/${timestamp}_${sanitizedFileName}`;
    }

    return `users/${userId}/${category}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Upload a base64 image to Firebase Storage
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @param userId - User ID for organizing files
 * @param category - Category of the file (models, wardrobe, tryons, videos, products)
 * @param fileName - Original file name
 * @param projectId - Optional project ID for models
 * @returns Download URL of the uploaded file
 */
export async function uploadBase64Image(
    base64Data: string,
    userId: string,
    category: 'models' | 'wardrobe' | 'tryons' | 'products',
    fileName: string = 'image.jpg',
    projectId?: string
): Promise<string> {
    try {
        // Convert base64 to Blob
        const blob = base64ToBlob(base64Data);

        // Generate file path
        const filePath = generateFilePath(userId, category, fileName, projectId);

        // Create storage reference
        const storageRef = ref(storage, filePath);

        // Set metadata
        const metadata: UploadMetadata = {
            contentType: blob.type,
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                userId: userId,
                category: category,
            },
        };

        // Upload file
        const snapshot = await uploadBytes(storageRef, blob, metadata);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`File uploaded successfully: ${filePath}`);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading base64 image:', error);
        throw new Error('Failed to upload image to storage');
    }
}

/**
 * Upload a File object to Firebase Storage
 * @param file - File object to upload
 * @param userId - User ID for organizing files
 * @param category - Category of the file
 * @param projectId - Optional project ID for models
 * @returns Download URL of the uploaded file
 */
export async function uploadFile(
    file: File,
    userId: string,
    category: 'models' | 'wardrobe' | 'tryons' | 'products',
    projectId?: string
): Promise<string> {
    try {
        // Generate file path
        const filePath = generateFilePath(userId, category, file.name, projectId);

        // Create storage reference
        const storageRef = ref(storage, filePath);

        // Set metadata
        const metadata: UploadMetadata = {
            contentType: file.type,
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                userId: userId,
                category: category,
                originalName: file.name,
            },
        };

        // Upload file
        const snapshot = await uploadBytes(storageRef, file, metadata);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`File uploaded successfully: ${filePath}`);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw new Error('Failed to upload file to storage');
    }
}

/**
 * Upload a video Blob to Firebase Storage
 * @param blob - Video Blob to upload
 * @param userId - User ID for organizing files
 * @param fileName - File name (default: video.mp4)
 * @returns Download URL of the uploaded video
 */
export async function uploadVideoBlob(
    blob: Blob,
    userId: string,
    fileName: string = 'video.mp4'
): Promise<string> {
    try {
        // Generate file path
        const filePath = generateFilePath(userId, 'videos', fileName);

        // Create storage reference
        const storageRef = ref(storage, filePath);

        // Set metadata
        const metadata: UploadMetadata = {
            contentType: blob.type || 'video/mp4',
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                userId: userId,
                category: 'videos',
            },
        };

        // Upload blob
        const snapshot = await uploadBytes(storageRef, blob, metadata);

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        console.log(`Video uploaded successfully: ${filePath}`);
        return downloadURL;
    } catch (error) {
        console.error('Error uploading video:', error);
        throw new Error('Failed to upload video to storage');
    }
}

/**
 * Delete a file from Firebase Storage
 * @param fileUrl - Full download URL or storage path
 */
export async function deleteFile(fileUrl: string): Promise<void> {
    try {
        // Extract path from URL if it's a full download URL
        let filePath = fileUrl;

        if (fileUrl.includes('firebasestorage.googleapis.com')) {
            // Extract path from download URL
            const urlParts = fileUrl.split('/o/')[1];
            if (urlParts) {
                filePath = decodeURIComponent(urlParts.split('?')[0]);
            }
        }

        // Create storage reference
        const storageRef = ref(storage, filePath);

        // Delete file
        await deleteObject(storageRef);

        console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
        console.error('Error deleting file:', error);
        throw new Error('Failed to delete file from storage');
    }
}

/**
 * Delete all files in a folder from Firebase Storage
 * @param folderPath - Path to the folder (e.g., 'users/userId/models/projectId')
 */
export async function deleteFolderContents(folderPath: string): Promise<void> {
    try {
        const { listAll } = await import('firebase/storage');
        const folderRef = ref(storage, folderPath);

        // List all items in the folder
        const listResult = await listAll(folderRef);

        // Delete all files
        const deletePromises = listResult.items.map(itemRef =>
            deleteObject(itemRef).catch(error => {
                console.warn(`Failed to delete ${itemRef.fullPath}:`, error);
                // Continue deleting other files even if one fails
            })
        );

        // Delete all subfolder contents recursively
        const subfolderPromises = listResult.prefixes.map(folderRef =>
            deleteFolderContents(folderRef.fullPath)
        );

        await Promise.all([...deletePromises, ...subfolderPromises]);

        console.log(`Folder deleted successfully: ${folderPath}`);
    } catch (error) {
        console.error('Error deleting folder:', error);
        throw new Error('Failed to delete folder from storage');
    }
}

/**
 * Get download URL for a file path
 * @param filePath - Storage path of the file
 * @returns Download URL
 */
export async function getFileUrl(filePath: string): Promise<string> {
    try {
        const storageRef = ref(storage, filePath);
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.error('Error getting file URL:', error);
        throw new Error('Failed to get file URL');
    }
}

/**
 * Check if a URL is a Firebase Storage URL
 * @param url - URL to check
 * @returns True if it's a Firebase Storage URL
 */
export function isStorageUrl(url: string): boolean {
    return url.includes('firebasestorage.googleapis.com') ||
           url.startsWith('gs://');
}

/**
 * Check if a URL is a base64 data URL
 * @param url - URL to check
 * @returns True if it's a base64 data URL
 */
export function isBase64Url(url: string): boolean {
    return url.startsWith('data:');
}
