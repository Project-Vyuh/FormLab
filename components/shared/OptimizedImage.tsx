/**
 * OptimizedImage Component
 * 
 * A shared component for displaying images with optimized loading:
 * - Shimmer placeholder while loading
 * - Native lazy loading
 * - Thumbnail/full-res URL fallback
 * - Consistent styling across app
 */

import React, { useState, useCallback } from 'react';

export interface OptimizedImageProps {
    /** Thumbnail URL (small, optimized version) */
    thumbnailUrl?: string;
    /** Full resolution URL (used as fallback if no thumbnail) */
    fullUrl: string;
    /** Alt text for accessibility */
    alt: string;
    /** Additional CSS classes */
    className?: string;
    /** Force loading full resolution instead of thumbnail */
    showFull?: boolean;
    /** Aspect ratio constraint */
    aspectRatio?: 'square' | '2/3' | '3/2' | 'auto';
}

/**
 * Shimmer gradient classes for loading animation
 */
const SHIMMER_CLASSES = 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-pulse';

const OptimizedImage: React.FC<OptimizedImageProps> = ({
    thumbnailUrl,
    fullUrl,
    alt,
    className = '',
    showFull = false,
    aspectRatio = 'auto',
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Determine which URL to use
    const imageUrl = showFull ? fullUrl : (thumbnailUrl || fullUrl);

    const handleLoad = useCallback(() => {
        setIsLoaded(true);
    }, []);

    const handleError = useCallback(() => {
        setHasError(true);
        // If thumbnail fails, fall back to full URL
        if (thumbnailUrl && imageUrl === thumbnailUrl) {
            console.warn('[OptimizedImage] Thumbnail failed, falling back to full URL');
        }
    }, [thumbnailUrl, imageUrl]);

    // Aspect ratio class mapping
    const aspectRatioClass = {
        'square': 'aspect-square',
        '2/3': 'aspect-[2/3]',
        '3/2': 'aspect-[3/2]',
        'auto': '',
    }[aspectRatio];

    return (
        <div
            className={`
        ${aspectRatioClass}
        ${!isLoaded ? SHIMMER_CLASSES : ''}
        overflow-hidden
      `}
        >
            <img
                src={hasError && thumbnailUrl ? fullUrl : imageUrl}
                alt={alt}
                loading="lazy"
                decoding="async"
                onLoad={handleLoad}
                onError={handleError}
                className={`
          ${className}
          ${!isLoaded ? 'opacity-0' : 'opacity-100'}
          transition-opacity duration-300
        `}
            />
        </div>
    );
};

export default OptimizedImage;
